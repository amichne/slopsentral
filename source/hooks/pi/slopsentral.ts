import path from "node:path";
import { fileURLToPath } from "node:url";
import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";
import { failures, instructions, notices, parseConfig, readText, runHooks, scopedSkills, select, selectionName, type Rejected, type Selection } from "./runtime.ts";

const stateType = "slopsentral-profile";
const continuationType = "slopsentral-stop-continuation";

export default function slopsentral(pi: ExtensionAPI): void {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
  const parsed = parseConfig(JSON.parse(readText(root, "profiles.json")) as unknown);
  if (parsed.type === "rejected") throw new Error(`slopsentral: ${parsed.code}`);
  const config = parsed.config;
  const policyText = new Map(config.profiles.map(profile => [profile.name, instructions(root, { type: "selected", profile })]));
  pi.registerFlag("slopsentral-profile", { type: "string", description: "Slopsentral profile for a new session" });
  let selection: Selection | Rejected = { type: "rejected", code: "INVALID_CONFIG" };
  const displaySelection = () => selection.type === "rejected" ? selection.code : selectionName(selection);
  let startup: { type: "pending" } | { type: "ready"; context: string } | { type: "rejected"; reason: string } = { type: "pending" };
  let lifecycle = new AbortController();
  const signal = (ctx: ExtensionContext) => ctx.signal ? AbortSignal.any([ctx.signal, lifecycle.signal]) : lifecycle.signal;

  const restore = (ctx: ExtensionContext) => {
    const latest = ctx.sessionManager.getBranch().findLast(entry => entry.type === "custom" && entry.customType === stateType);
    const data: unknown = latest?.type === "custom" ? latest.data : undefined;
    const flag = pi.getFlag("slopsentral-profile");
    const name = latest === undefined ? flag ?? config.defaultProfile : data;
    const result: Selection | Rejected = typeof name === "string" ? select(config, name) : { type: "rejected", code: "INVALID_CONFIG" };
    selection = result;
    startup = { type: "pending" };
    ctx.ui.setStatus("slopsentral", `Slopsentral: ${displaySelection()}`);
    if (result.type === "rejected") { ctx.ui.notify(`Slopsentral profile unavailable: ${result.code}`, "error"); return; }
    if (latest === undefined) pi.appendEntry(stateType, name);
  };
  pi.on("session_start", (_event, ctx) => {
    lifecycle.abort();
    lifecycle = new AbortController();
    restore(ctx);
  });
  pi.on("session_shutdown", () => lifecycle.abort());
  pi.on("session_tree", (_event, ctx) => restore(ctx));

  const choose = (name: string, ctx: ExtensionContext) => {
    if (!ctx.isIdle()) { ctx.ui.notify("Select a profile after the current run ends.", "warning"); return; }
    const result = select(config, name);
    if (result.type === "rejected") { ctx.ui.notify(`Unknown Slopsentral profile: ${name}`, "error"); return; }
    pi.appendEntry(stateType, name);
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
  pi.on("before_agent_start", async (event, ctx) => {
    if (selection.type === "rejected") {
      event.systemPromptOptions.sections.slopsentral = `Slopsentral profile unavailable: ${selection.code}. Select a valid profile before another run.`;
      event.systemPromptOptions.skills = scopedSkills(root, { type: "off" }, event.systemPromptOptions.skills);
      ctx.abort();
      return;
    }
    if (startup.type === "pending") {
      const runs = selection.type === "selected" && selection.profile.hookPolicy !== "OFF"
        ? await runHooks(root, selection.profile, "SessionStart", ctx.cwd, { ...payload(ctx, "SessionStart"), source: "startup" }, signal(ctx))
        : [];
      const failure = failures(runs);
      if (failure) ctx.ui.notify(`Slopsentral startup hooks:\n${failure}`, "warning");
      startup = failure && selection.type === "selected" && selection.profile.hookPolicy === "ENFORCING"
        ? { type: "rejected", reason: failure }
        : { type: "ready", context: runs.flatMap(run => run.result.type === "completed" ? [run.result.context, run.result.notice] : []).filter(Boolean).join("\n\n") };
    }
    const text = [selection.type === "selected" ? policyText.get(selection.profile.name) : "", startup.type === "ready" ? startup.context : `Startup hooks failed: ${startup.reason}`].filter(Boolean).join("\n\n");
    if (text) event.systemPromptOptions.sections.slopsentral = text;
    else delete event.systemPromptOptions.sections.slopsentral;
    event.systemPromptOptions.skills = scopedSkills(root, selection, event.systemPromptOptions.skills);
    if (startup.type === "rejected") ctx.abort();
  });
  pi.on("tool_call", async (event, ctx) => {
    if (selection.type === "rejected") return { block: true, reason: `Slopsentral profile unavailable: ${selection.code}` };
    if (selection.type === "off" || selection.profile.hookPolicy === "OFF") return;
    if (startup.type === "rejected") return { block: true, reason: `Slopsentral startup hooks failed:\n${startup.reason}` };
    const runs = await runHooks(root, selection.profile, "PreToolUse", ctx.cwd, {
      ...payload(ctx, "PreToolUse"), tool_name: event.toolName === "read" ? "read_file" : event.toolName, toolArgs: event.input,
    }, signal(ctx));
    const reason = failures(runs);
    const notice = notices(runs);
    if (notice) ctx.ui.notify(notice, "info");
    if (!reason) return;
    if (selection.profile.hookPolicy === "ENFORCING") return { block: true, reason: `Slopsentral hooks rejected this call:\n${reason}` };
    ctx.ui.notify(`Slopsentral hooks:\n${reason}`, "warning");
  });
  pi.on("agent_before_settle", async (event, ctx) => {
    if (event.outcome !== "completed" || ctx.signal?.aborted || selection.type !== "selected" || selection.profile.hookPolicy === "OFF") return;
    const branch = ctx.sessionManager.getBranch();
    const user = branch.findLast(entry => entry.type === "message" && entry.message.role === "user");
    const marker = branch.findLast(entry => entry.type === "custom" && entry.customType === continuationType);
    const continued = marker?.type === "custom" && marker.data === user?.id;
    const runs = await runHooks(root, selection.profile, "Stop", ctx.cwd, { ...payload(ctx, "Stop"), stop_hook_active: false }, signal(ctx));
    const reason = failures(runs);
    const feedback = [reason, notices(runs)].filter(Boolean).join("\n");
    if (!feedback || signal(ctx).aborted) return;
    ctx.ui.notify(`Slopsentral completion gates:\n${feedback}`, reason ? "warning" : "info");
    const enforce = reason.length > 0 && selection.profile.hookPolicy === "ENFORCING" && user !== undefined && !continued;
    return {
      entries: [...event.entries,
        { type: "custom_message", customType: "slopsentral-gates", content: reason
          ? `Slopsentral completion gates failed${continued ? " after one continuation" : ""}:\n${feedback}\nExamine native reports or run /slopsentral-check. Report unresolved limits. Do not claim success without evidence.`
          : `Slopsentral completion gate notices:\n${feedback}`, display: true },
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
      if (selection.type !== "selected") { ctx.ui.notify("Select a Slopsentral profile first.", "info"); return; }
      const runs = await runHooks(root, selection.profile, "Stop", ctx.cwd, { ...payload(ctx, "Stop"), stop_hook_active: false }, signal(ctx));
      const lines = runs.map(({ action, result }) => `${action.name}: ${result.type === "rejected" ? result.code : result.notice || "command completed"}`);
      ctx.ui.notify(lines.join("\n") || "This profile has no completion gates.", failures(runs) ? "warning" : "info");
    },
  });
}
