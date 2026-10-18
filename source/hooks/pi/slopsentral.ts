import path from "node:path";
import { fileURLToPath } from "node:url";
import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";
import { failures, notices, scopedSkills, selectionName, type Rejected, type Selection } from "./runtime.ts";
import { Control, blockingFailures, hookContext, presented, type PolicyRun } from "./control.ts";
import { settingsMenu } from "./menu.ts";

const continuationType = "slopsentral-stop-continuation";
type CurrentPromptContext = { readonly type: "empty" } | { readonly type: "active"; readonly context: string };
type UserAnchor = { readonly type: "no-user" } | { readonly type: "user"; readonly id: string };
type PromptContext = CurrentPromptContext
  | { readonly type: "examining"; readonly prompt: string; readonly current: CurrentPromptContext }
  | { readonly type: "starting" }
  | { readonly type: "accepted"; readonly prompt: string; readonly context: string; readonly current: CurrentPromptContext; readonly after: UserAnchor };

function currentPromptContext(state: PromptContext): CurrentPromptContext {
  switch (state.type) {
    case "empty": case "active": return state;
    case "examining": case "accepted": return state.current;
    case "starting": return { type: "empty" };
  }
}

export default function slopsentral(pi: ExtensionAPI): void {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
  const control = new Control(root, pi);
  const config = control.config;
  const report = (runs: readonly PolicyRun[], ctx: ExtensionContext, label: string) => {
    const text = runs.map(presented).filter(Boolean).join("\n");
    if (text) ctx.ui.notify(`${label}:\n${text}`, failures(runs) ? "warning" : "info");
  };
  pi.registerFlag("slopsentral-profile", { type: "string", description: "Slopsentral profile for a new session" });
  let selection: Selection | Rejected = { type: "rejected", code: "INVALID_CONFIG" };
  const displaySelection = () => selection.type === "rejected" ? selection.code : selectionName(selection);
  let startup: { type: "pending" } | { type: "ready"; context: string } | { type: "rejected"; reason: string } = { type: "pending" };
  let lifecycle = new AbortController();
  let promptContext: PromptContext = { type: "empty" };
  const signal = (ctx: ExtensionContext) => ctx.signal ? AbortSignal.any([ctx.signal, lifecycle.signal]) : lifecycle.signal;

  const restore = (ctx: ExtensionContext) => {
    lifecycle.abort();
    lifecycle = new AbortController();
    promptContext = { type: "empty" };
    control.restore(ctx);
    const result = control.selection;
    selection = result;
    startup = { type: "pending" };
    ctx.ui.setStatus("slopsentral", `Slopsentral: ${displaySelection()}`);
    if (result.type === "rejected") { ctx.ui.notify(`Slopsentral profile unavailable: ${result.code}`, "error"); return; }
  };
  pi.on("session_start", (_event, ctx) => {
    lifecycle.abort();
    lifecycle = new AbortController();
    restore(ctx);
  });
  pi.on("session_shutdown", () => { promptContext = { type: "empty" }; lifecycle.abort(); control.invalidate(); });
  pi.on("session_tree", (_event, ctx) => restore(ctx));
  pi.on("agent_settled", async (_event, ctx) => {
    promptContext = { type: "empty" };
    control.clearToolContext();
    await control.run("Stop", ctx, { hook_event_name: "Stop", cwd: ctx.cwd, session_id: ctx.sessionManager.getSessionId(), stop_hook_active: false }, "background");
  });
  pi.on("tool_execution_start", (event, ctx) => { control.capture(event.toolName, event.args, ctx); });
  pi.on("user_bash", (_event, ctx) => { control.capture("user_bash", {}, ctx); });
  pi.on("resources_discover", () => ({ skillPaths: control.localSkillPaths() }));
  pi.on("context", (event, ctx) => {
    // Queued input bypasses before_agent_start. Wait for its new user entry and request text.
    if (promptContext.type === "accepted" && startup.type === "ready") {
      const user = ctx.sessionManager.getBranch().findLast(entry => entry.type === "message" && entry.message.role === "user");
      const message = event.messages.findLast(message => message.role === "user");
      const text = message && (typeof message.content === "string" ? message.content
        : message.content.filter(part => part.type === "text").map(part => part.text).join("\n"));
      if (user && (promptContext.after.type === "no-user" || user.id !== promptContext.after.id) && text === promptContext.prompt)
        promptContext = { type: "active", context: promptContext.context };
    }
    const current = currentPromptContext(promptContext);
    // Old releases persisted these hints. Preserve the transcript, exclude them from requests.
    return { messages: [
      ...event.messages.filter(message => message.role !== "custom"
        || (message.customType !== "slopsentral-guidance" && message.customType !== "slopsentral-prompt-hooks" && message.customType !== "slopsentral-gates-display")),
      ...(current.type === "active" ? [{ role: "custom" as const, customType: "slopsentral-prompt-hooks",
        content: current.context, display: false, timestamp: 0 }] : []),
      ...(control.currentContext() ? [{ role: "custom" as const, customType: "slopsentral-tool-hooks", content: control.currentContext(), display: false, timestamp: 0 }] : []),
    ] };
  });

  const choose = (name: string, ctx: ExtensionContext) => {
    if (!ctx.isIdle()) { ctx.ui.notify("Select a profile after the current run ends.", "warning"); return; }
    const error = control.profile(name, ctx);
    if (error) { ctx.ui.notify(`Unknown Slopsentral profile: ${name}: ${error}`, "error"); return; }
    restore(ctx);
    ctx.ui.notify(`Slopsentral profile: ${name}`, "info");
  };
  pi.registerCommand("slopsentral-profile", {
    description: "Show or select a Slopsentral profile, or select off",
    getArgumentCompletions: prefix => [...config.profiles.map(p => p.name), "off"].filter(name => name.startsWith(prefix)).map(name => ({ value: name, label: name })),
    handler: async (args, ctx) => {
      const name = args.trim();
      if (name) choose(name, ctx);
      else ctx.ui.notify(`Slopsentral: ${displaySelection()}\n${config.profiles.map(p => `${p.name}: ${p.description}`).join("\n")}\noff: turn off package context and automatic hooks`, "info");
    },
  });
  for (const profile of config.profiles) pi.registerCommand(`slopsentral-${profile.name}`, {
    description: profile.description,
    handler: async (args, ctx) => {
      if (args.trim()) { ctx.ui.notify("This profile command takes no arguments.", "error"); return; }
      choose(profile.name, ctx);
    },
  });

  const payload = (ctx: ExtensionContext, event: string) => ({ hook_event_name: event, cwd: ctx.cwd, session_id: ctx.sessionManager.getSessionId() });
  const changed = () => {
    lifecycle.abort(); lifecycle = new AbortController();
    selection = control.selection;
    startup = { type: "pending" };
    promptContext = { type: "empty" };
  };
  const sync = (ctx: ExtensionContext) => { if (control.sync(ctx)) { changed(); return true; } return false; };
  pi.registerCommand("slopsentral", {
    description: "Configure Slopsentral, inspect JSON state, set a layer, or record a scope review",
    handler: async (args, ctx) => {
      sync(ctx);
      if (control.refreshResources(ctx)) changed();
      const text = args.trim();
      const output = (value: unknown) => {
        const encoded = JSON.stringify(value);
        if (ctx.mode === "json") pi.sendMessage({ customType: "slopsentral-result", content: "", display: false, details: value }, { triggerTurn: false });
        else if (ctx.mode === "print") console.error(encoded);
        else ctx.ui.notify(encoded, "info");
      };
      if (text === "state") { output(control.state()); return; }
      if (text.startsWith("review ")) {
        const error = control.review(text.slice(7), ctx);
        output(error ? { type: "rejected", code: error } : { type: "review-recorded" });
        return;
      }
      if (text.startsWith("set ")) {
        const match = /^set (user|project|session) (.+)$/s.exec(text);
        if (!match || !(match[1] === "user" || match[1] === "project" || match[1] === "session")) { output({ type: "rejected", code: "INVALID_COMMAND" }); return; }
        let value: unknown;
        try { value = JSON.parse(match[2] ?? ""); } catch { output({ type: "rejected", code: "INVALID_JSON" }); return; }
        const error = control.change(match[1], value, ctx);
        if (!error) changed();
        output(error ? { type: "rejected", code: error } : { type: "saved", scope: match[1] });
        return;
      }
      if (text.startsWith("cancel ")) { control.coordinator.cancel(text.slice(7)); output({ type: "cancellation-requested" }); return; }
      if (text.startsWith("run ")) {
        if (!ctx.isIdle()) { output({ type: "rejected", code: "SETTINGS_BUSY" }); return; }
        const id = text.slice(4);
        const item = control.effective.type === "effective" ? control.effective.capabilities.find(item => item.capability.id === id) : undefined;
        if (!item || item.capability.type !== "HOOK") { output({ type: "rejected", code: "UNKNOWN_HOOK" }); return; }
        const runs = await control.run("Stop", ctx, payload(ctx, "Stop"), "all", true, id);
        output({ type: "hook-results", runs });
        return;
      }
      if (text) { output({ type: "rejected", code: "INVALID_COMMAND" }); return; }
      if (ctx.mode !== "tui") { output(control.state()); return; }
      if (!ctx.isIdle()) { ctx.ui.notify("Open settings after the current run ends.", "warning"); return; }
      await ctx.ui.custom<void>((tui, theme, _keybindings, done) => {
        const menu = settingsMenu(control, ctx, theme, changed, () => done(), () => tui.terminal.rows, () => tui.requestRender());
        return { get focused() { return menu.focused; }, set focused(value) { menu.focused = value; },
          render: width => menu.render(width), invalidate: () => menu.invalidate(), handleInput: data => { menu.handleInput?.(data); tui.requestRender(); } };
      });
    },
  });
  pi.on("input", async (event, ctx) => {
    sync(ctx);
    if (control.refreshResources(ctx)) changed();
    const current = currentPromptContext(promptContext);
    promptContext = current;
    if (selection.type === "rejected") { ctx.ui.notify(`Slopsentral profile unavailable: ${selection.code}`, "error"); return { action: "handled" }; }
    if (selection.type === "off") return { action: "continue" };
    const user = ctx.sessionManager.getBranch().findLast(entry => entry.type === "message" && entry.message.role === "user");
    const after: UserAnchor = user ? { type: "user", id: user.id } : { type: "no-user" };
    const submission: PromptContext = { type: "examining", prompt: event.text, current };
    promptContext = submission;
    const runs = await control.run("UserPromptSubmit", ctx,
      { ...payload(ctx, "UserPromptSubmit"), prompt: event.text, source: event.source });
    if (promptContext !== submission || signal(ctx).aborted) return { action: "handled" };
    promptContext = current;
    const reason = failures(runs);
    const context = hookContext(runs);
    report(runs, ctx, "Slopsentral prompt hooks");
    if (blockingFailures(runs)) return { action: "handled" };
    if (context) promptContext = { type: "accepted", prompt: event.text, context, current, after };
    return { action: "continue" };
  });
  pi.on("before_agent_start", async (event, ctx) => {
    if (sync(ctx)) { ctx.abort(); return; }
    control.clearToolContext();
    const accepted = promptContext;
    const starting: PromptContext = { type: "starting" };
    promptContext = starting;
    if (selection.type === "rejected") {
      promptContext = { type: "empty" };
      event.systemPromptOptions.sections.slopsentral = `Slopsentral profile unavailable: ${selection.code}. Select a valid profile before another run.`;
      event.systemPromptOptions.skills = scopedSkills(root, { type: "off" }, event.systemPromptOptions.skills);
      ctx.abort();
      return;
    }
    if (startup.type === "pending") {
      const runs = selection.type === "selected"
        ? await control.run("SessionStart", ctx, { ...payload(ctx, "SessionStart"), source: "startup" })
        : [];
      if (promptContext !== starting || signal(ctx).aborted) { ctx.abort(); return; }
      const failure = failures(runs);
      report(runs, ctx, "Slopsentral startup hooks");
      startup = blockingFailures(runs)
        ? { type: "rejected", reason: failure }
        : { type: "ready", context: hookContext(runs) };
    }
    const text = [selection.type === "selected" ? control.promptText() : "", startup.type === "ready" ? startup.context : `Startup hooks failed: ${startup.reason}`].filter(Boolean).join("\n\n");
    if (text) event.systemPromptOptions.sections.slopsentral = text;
    else delete event.systemPromptOptions.sections.slopsentral;
    event.systemPromptOptions.skills = control.scopeSkills(event.systemPromptOptions.skills);
    promptContext = { type: "empty" };
    if (startup.type === "rejected") ctx.abort();
    else {
      const context = [accepted.type === "accepted" && event.messageType === "user" && event.prompt === accepted.prompt ? accepted.context : "",
        control.takeBackgroundContext()].filter(Boolean).join("\n\n");
      if (context) promptContext = { type: "active", context };
    }
  });
  pi.on("tool_call", async (event, ctx) => {
    if (sync(ctx)) { ctx.abort(); return { block: true, reason: "Slopsentral configuration changed. Submit the request again." }; }
    if (selection.type === "rejected") return { block: true, reason: `Slopsentral profile unavailable: ${selection.code}` };
    if (selection.type === "off") return;
    if (startup.type === "rejected") return { block: true, reason: `Slopsentral startup hooks failed:\n${startup.reason}` };
    const runs = await control.run("PreToolUse", ctx, {
      ...payload(ctx, "PreToolUse"), tool_name: event.toolName === "read" ? "read_file" : event.toolName, toolArgs: event.input,
      tool_call_id: event.toolCallId,
    });
    const reason = failures(runs);
    control.rememberContext(hookContext(runs));
    report(runs, ctx, "Slopsentral hooks");
    if (!reason) return;
    if (blockingFailures(runs)) return { block: true, reason: `Slopsentral hooks rejected this call:\n${reason}` };
  });
  pi.on("tool_result", async (event, ctx) => {
    const propagation = control.instructionContext(event.toolName, event.input, ctx);
    const runs = selection.type === "selected" ? await control.run("PostToolUse", ctx, {
      ...payload(ctx, "PostToolUse"), tool_name: event.toolName, tool_call_id: event.toolCallId, tool_input: event.input,
    }) : [];
    const reason = failures(runs);
    control.rememberContext(hookContext(runs));
    report(runs, ctx, "Slopsentral post-tool hooks");
    if (blockingFailures(runs)) ctx.abort();
    if (!propagation) return;
    return {
      content: [...event.content, { type: "text", text: propagation }],
      details: event.details,
      isError: event.isError,
      ...(event.structuredContent === undefined ? {} : { structuredContent: event.structuredContent }),
      ...(event.usage === undefined ? {} : { usage: event.usage }),
    };
  });
  pi.on("agent_before_settle", async (event, ctx) => {
    if (event.outcome !== "completed" || ctx.signal?.aborted || selection.type !== "selected") return;
    const branch = ctx.sessionManager.getBranch();
    const user = branch.findLast(entry => entry.type === "message" && entry.message.role === "user");
    const marker = branch.findLast(entry => entry.type === "custom" && entry.customType === continuationType);
    const continued = marker?.type === "custom" && marker.data === user?.id;
    const runs = await control.run("Stop", ctx, { ...payload(ctx, "Stop"), stop_hook_active: false }, "foreground");
    const reason = failures(runs);
    const feedback = [reason, notices(runs)].filter(Boolean).join("\n");
    if (!feedback || signal(ctx).aborted) return;
    report(runs, ctx, "Slopsentral completion gates");
    const enforce = blockingFailures(runs).length > 0 && user !== undefined && !continued;
    const visible = runs.map(presented).filter(Boolean).join("\n");
    return {
      entries: [...event.entries,
        ...(hookContext(runs) || enforce ? [{ type: "custom_message" as const, customType: "slopsentral-gates", content: reason
          ? `Slopsentral completion gates failed${continued ? " after one continuation" : ""}:\n${feedback}\nExamine native reports or run /slopsentral-check. Report unresolved limits. Do not claim success without evidence.`
          : `Slopsentral completion gate notices:\n${hookContext(runs)}`, display: false }] : []),
        ...(visible ? [{ type: "custom_message" as const, customType: "slopsentral-gates-display", content: `Slopsentral completion gates${continued ? " after one continuation" : ""}:\n${visible}`, display: true }] : []),
        ...(enforce ? [{ type: "custom" as const, customType: continuationType, data: user.id }] : []),
      ],
      continue: event.continue || enforce,
    };
  });
  pi.registerCommand("slopsentral-check", {
    description: "Run the selected profile completion gates explicitly",
    handler: async (args, ctx) => {
      if (args.trim()) { ctx.ui.notify("This command takes no arguments.", "error"); return; }
      if (!ctx.isIdle()) { ctx.ui.notify("Run completion gates after the current run ends.", "warning"); return; }
      if (control.refreshResources(ctx)) changed();
      if (selection.type !== "selected") { ctx.ui.notify("Select a Slopsentral profile first.", "info"); return; }
      const gateSignal = signal(ctx);
      const runs = await control.run("Stop", ctx, { ...payload(ctx, "Stop"), stop_hook_active: false }, "all", true);
      if (gateSignal.aborted) return;
      report(runs, ctx, "Slopsentral completion gates");
      if (!runs.length) ctx.ui.notify("This profile has no completion gates.", "info");
    },
  });
}
