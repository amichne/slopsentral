import fs from "node:fs";
import path from "node:path";
import { getSelectListTheme, getSettingsListTheme, type ExtensionContext, type Theme } from "@earendil-works/pi-coding-agent";
import { Input, SelectList, SettingsList, Text, getKeybindings, truncateToWidth, type Component, type SettingItem } from "@earendil-works/pi-tui";
import type { Control } from "./control.ts";
import type { Capability, HookPolicy, SaveScope } from "./settings.ts";

export function profilePicker(choices: readonly string[], choose: (name: string) => void, cancel: () => void): Component & { focused: boolean } {
  const input = new Input({ placeholder: "Search" });
  input.focused = true;
  const list = new SelectList(choices.map(name => ({ value: name, label: name })), 3, getSelectListTheme());
  list.onSelect = item => choose(item.value);
  list.onCancel = cancel;
  return {
    get focused() { return input.focused; }, set focused(value) { input.focused = value; },
    render: width => [...input.render(width), "", ...list.render(width)].map(line => truncateToWidth(line, width)),
    invalidate: () => { input.invalidate(); list.invalidate(); },
    handleInput(data) {
      const kb = getKeybindings();
      if ((["tui.select.up", "tui.select.down", "tui.select.confirm", "tui.select.cancel"] as const).some(key => kb.matches(data, key))) list.handleInput(data);
      else { input.handleInput(data); list.setFilter(input.getValue()); }
    },
  };
}

function field(placeholder: string, submit: (text: string) => void, cancel: () => void): Component & { focused: boolean } {
  const input = new Input({ placeholder });
  input.focused = true;
  input.onSubmit = submit; input.onEscape = cancel;
  return input;
}
function detail(text: string, cancel: () => void): Component {
  const view = new Text(text);
  let offset = 0;
  return {
    render: width => { const lines = view.render(width); offset = Math.min(offset, Math.max(0, lines.length - 5)); return lines.slice(offset, offset + 5); },
    invalidate: () => view.invalidate(),
    handleInput(data) {
      const kb = getKeybindings();
      if (kb.matches(data, "tui.select.cancel")) cancel();
      else if (kb.matches(data, "tui.select.up")) offset = Math.max(0, offset - 1);
      else if (kb.matches(data, "tui.select.down")) offset++;
      else if (kb.matches(data, "tui.select.pageUp")) offset = Math.max(0, offset - 5);
      else if (kb.matches(data, "tui.select.pageDown")) offset += 5;
    },
  };
}

export function settingsMenu(control: Control, ctx: ExtensionContext, theme: Theme, changed: () => void,
  done: () => void, rows: () => number, requestRender: () => void): Component & { focused: boolean } {
  let scope: SaveScope = "session";
  let message = "";
  const apply = (settings: unknown): boolean => {
    const error = control.change(scope, settings, ctx);
    message = error ?? `Saved to ${scope}.`;
    if (!error) changed();
    return !error;
  };
  const policy = (id: string, change: (current: HookPolicy) => unknown): boolean => {
    const item = control.effective.type === "effective" ? control.effective.capabilities.find(item => item.capability.id === id) : undefined;
    if (!item) return false;
    const base = control.settings(scope);
    return apply({ ...base, hooks: { ...base.hooks, [id]: change(item.policy) } });
  };
  const toggle = (id: string, enabled: boolean): boolean => {
    const base = control.settings(scope);
    return apply({ ...base, capabilities: { ...base.capabilities, [id]: enabled } });
  };
  const hookMenu = (id: string, back: () => void): Component => {
    const item = control.effective.type === "effective" ? control.effective.capabilities.find(item => item.capability.id === id) : undefined;
    if (!item) return detail("Capability unavailable.", back);
    let list: SettingsList;
    const getPolicy = () => control.effective.type === "effective" ? control.effective.capabilities.find(item => item.capability.id === id)?.policy ?? item.policy : item.policy;
    list = new SettingsList([
      { id: "enabled", label: "Enabled", currentValue: item.selected ? "on" : "off", values: ["on", "off"], description: `${item.state}. Origin: ${item.origin}. ${item.reason}` },
      { id: "execution", label: "Execution", currentValue: item.policy.execution, values: ["foreground", "background"], description: `Policy origin: ${item.policyOrigin}. Background work cannot block.` },
      { id: "critical", label: "Critical path", currentValue: item.policy.critical, values: ["report", "blocking"] },
      { id: "output", label: "Output", currentValue: item.policy.output.type, values: ["ALWAYS", "ERRORS", "NEVER"], description: "Presentation follows protocol interpretation." },
      { id: "EXCLUDE", label: "Exclude regex", currentValue: item.policy.output.type === "EXCLUDE" ? item.policy.output.pattern : "Set…", submenu: (_value, finish) => field("Regex", text => {
        if (policy(id, current => ({ ...current, output: { type: "EXCLUDE", pattern: text } }))) { list.updateValue("output", "EXCLUDE"); finish(text); }
      }, () => finish()) },
      { id: "context", label: "Model context", currentValue: item.policy.context, values: ["structured", "none"] },
      { id: "timeoutSeconds", label: "Timeout seconds", currentValue: String(item.policy.timeoutSeconds ?? (item.capability.type === "HOOK" ? item.capability.actions[0]?.timeout : 30) ?? 30), values: ["5", "30", "60", "300", "1800"] },
      { id: "run", label: "Run completion", currentValue: "Run…", description: "Run this hook's Stop actions. Other events need their actual operation.", submenu: (_value, finish) => {
        let outcome = "Pending";
        void control.run("Stop", ctx, { hook_event_name: "Stop", cwd: ctx.cwd, session_id: ctx.sessionManager.getSessionId(), stop_hook_active: false }, "all", true, id)
          .then(runs => { outcome = runs.map(run => `${run.action.name}: ${run.result.type === "rejected" ? run.result.code : "COMPLETED"}`).join("\n") || "This hook has no completion actions."; requestRender(); }, () => { outcome = "ADAPTER_FAILED"; requestRender(); });
        return { render: width => new Text(outcome).render(width), invalidate: () => {}, handleInput: data => { if (getKeybindings().matches(data, "tui.select.cancel")) finish(); } };
      } },
      { id: "details", label: "Details", currentValue: "View…", submenu: (_value, finish) => detail(JSON.stringify(item, null, 2), () => finish()) },
    ], 3, getSettingsListTheme(), (key, value) => {
      const old = getPolicy();
      const success = key === "enabled" ? toggle(id, value === "on") : policy(id, current => key === "output"
        ? { ...current, output: { type: value } } : { ...current, [key]: key === "timeoutSeconds" ? Number(value) : value });
      if (!success) list.updateValue(key, key === "enabled" ? item.selected ? "on" : "off" : key === "output" ? old.output.type : key === "execution" ? old.execution : key === "critical" ? old.critical : old.context);
    }, back, { enableSearch: true });
    return list;
  };
  const capabilities = (kind: Capability["type"], back: () => void): Component => {
    const items = control.effective.type === "effective" ? control.effective.capabilities.filter(item => item.capability.type === kind) : [];
    let list: SettingsList;
    const entries: SettingItem[] = items.map(item => ({ id: item.capability.id, label: item.capability.name,
      currentValue: item.selected ? "on" : "off", description: `${item.state}. Origin: ${item.origin}. ${item.binding.type === "skill" ? `Invocation: ${item.binding.invocation}. Origin: ${item.binding.origin}. ` : ""}Dependencies: ${item.capability.dependencies.join(", ") || "none"}. ${item.reason}`,
      ...(kind === "HOOK" || kind === "SKILL" ? {} : { values: ["on", "off"] }) }));
    // SettingsList owns submenu return and selection. Pass its done callback directly.
    if (kind === "HOOK") for (const entry of entries) entry.submenu = (_value, finish) => hookMenu(entry.id, () => finish());
    if (kind === "SKILL") for (const entry of entries) entry.submenu = (_value, finish) => {
      const item = items.find(item => item.capability.id === entry.id);
      if (!item || item.binding.type !== "skill") return detail("Skill unavailable.", () => finish());
      const skillList = new SettingsList([
        { id: "enabled", label: "Enabled", currentValue: item.selected ? "on" : "off", values: ["on", "off"] },
        { id: "invocation", label: "Invocation", currentValue: item.binding.invocation, values: ["human", "model", "either"] },
        { id: "details", label: "Details", currentValue: "View…", submenu: (_current, complete) => detail(JSON.stringify(item, null, 2), () => complete()) },
      ], 3, getSettingsListTheme(), (key, value) => {
        if (key === "enabled") {
          if (!toggle(entry.id, value === "on")) skillList.updateValue(key, item.selected ? "on" : "off");
          else list.updateValue(entry.id, value);
        } else {
          const base = control.settings(scope);
          if (!apply({ ...base, skills: { ...base.skills, [entry.id]: { invocation: value } } })) skillList.updateValue(key, item.binding.type === "skill" ? item.binding.invocation : "either");
        }
      }, () => finish(), { enableSearch: true });
      return skillList;
    };
    list = new SettingsList(entries, 3, getSettingsListTheme(), (id, value) => {
      if (!toggle(id, value === "on")) list.updateValue(id, value === "on" ? "off" : "on");
    }, back, { enableSearch: true });
    return list;
  };
  const addition = (back: () => void): Component => {
    let current: Component = profilePicker(["INSTRUCTION", "SKILL", "RESOURCE", "HOOK"], kind => {
      current = field("Name, for example local-rules", name => {
        const finish = (cap: unknown) => {
          const base = control.settings(scope);
          if (apply({ ...base, additions: [...(base.additions ?? []), cap] })) {
            message = `Saved ${name}.`;
            back();
          }
        };
        if (kind !== "HOOK") current = field("Local file or skill directory", supplied => {
          let file = path.resolve(ctx.cwd, supplied);
          try { if (kind === "SKILL" && fs.statSync(file).isDirectory()) file = path.join(file, "SKILL.md"); } catch { /* Resolver exposes missing files. */ }
          finish({ id: `${kind.toLowerCase()}:${name}`, name, type: kind, path: file, dependencies: [], profiles: [] });
        }, back);
        else current = profilePicker(["SessionStart", "UserPromptSubmit", "PreToolUse", "PostToolUse", "Stop"], event => {
          current = field('Command argv, for example ["/usr/bin/true"]', text => {
            let argv: unknown;
            try { argv = JSON.parse(text); } catch { message = "INVALID_COMMAND_JSON"; return; }
            finish({ id: `hook:${name}`, name, type: "HOOK", dependencies: [], profiles: [], actions: [{ name, event, plugin: "local", argv, timeout: 30 }] });
          }, back);
        }, back);
      }, back);
    }, back);
    return {
      render: width => current.render(width), invalidate: () => current.invalidate(),
      handleInput: data => current.handleInput?.(data),
    };
  };
  const profile = control.effective.type === "effective" ? control.effective.profile : "unavailable";
  const list = new SettingsList([
    { id: "profile", label: "Profile", currentValue: profile, description: "Profiles supply presets. Individual overrides remain effective.", submenu: (_value, finish) => profilePicker([...control.config.profiles.map(item => item.name), "none"], name => {
      if (apply({ ...control.settings(scope), profile: name })) finish(control.effective.type === "effective" ? control.effective.profile : name);
    }, () => finish()) },
    { id: "scope", label: "Save scope", currentValue: scope, values: ["session", "project", "user"], description: "Precedence: defaults, profile, user, project, session." },
    { id: "enabled", label: "Extension", currentValue: control.effective.type === "effective" && control.effective.enabled ? "on" : "off", values: ["on", "off"], description: "Turn off advertisements, automatic hooks, and automatic collection.", },
    ...(["INSTRUCTION", "SKILL", "RESOURCE", "AGENT", "HOOK"] as const).map(kind => ({ id: kind, label: `${kind[0]}${kind.slice(1).toLowerCase()}s`, currentValue: "Select…",
      submenu: (_value: string, finish: () => void) => capabilities(kind, finish) })),
    { id: "add", label: "Add capability", currentValue: "Local…", submenu: (_value, finish) => addition(() => finish()) },
    { id: "pending", label: "Pending reviews", currentValue: String(control.journal.pending.length), submenu: (_value, finish) => detail([
      ...control.journal.pending, ...control.journal.gaps, `Last review: ${control.journal.note || "none"}`,
      "Record a review with /slopsentral review NOTE.",
    ].join("\n"), () => finish()) },
    { id: "recent", label: "State and results", currentValue: "View…", submenu: (_value, finish) => {
      const state = control.state();
      return detail([
        state.effective.type === "effective" ? `Profile: ${state.effective.profile}. Origin: ${state.effective.profileOrigin}.` : state.effective.code,
        ...state.errors, ...state.coverage, ...state.jobs.map(key => `Pending: ${key}`),
        ...state.recent.map(item => `${item.id} (${item.event}): ${item.result.type === "rejected" ? item.result.code + (item.result.code === "BLOCKED" ? "\n" + item.result.reason : "") : item.result.notice || "COMPLETED"}`),
      ].join("\n\n"), () => finish());
    } },
    { id: "cancel", label: "Cancel job", currentValue: "Select…", submenu: (_value, finish) => profilePicker(control.coordinator.pending, key => { control.coordinator.cancel(key); finish(); }, () => finish()) },
    { id: "reset", label: "Reset overrides", currentValue: "Select…", submenu: (_value, finish) => profilePicker(["session", "project", "user"], selected => {
      const previous = scope;
      if (selected === "session" || selected === "project" || selected === "user") { scope = selected; apply({ schemaVersion: 1 }); scope = previous; }
      finish();
    }, () => finish()) },
  ], 3, getSettingsListTheme(), (id, value) => {
    if (id === "enabled") {
      if (!apply({ ...control.settings(scope), enabled: value === "on" })) list.updateValue(id, control.effective.type === "effective" && control.effective.enabled ? "on" : "off");
    }
    else if (value === "session" || value === "project" || value === "user") scope = value;
  }, done, { enableSearch: true });
  let focused = false;
  return {
    get focused() { return focused; }, set focused(value) { focused = value; },
    render(width) {
      const height = rows();
      if (height < 8) return [truncateToWidth("Slopsentral: enlarge the terminal or press Escape.", width)];
      return [truncateToWidth(theme.fg("accent", theme.bold("Slopsentral")), width), ...list.render(width),
        ...(message ? [truncateToWidth(message, width)] : [])].slice(0, Math.max(1, height - 1)).map(line => truncateToWidth(line, width));
    },
    invalidate: () => list.invalidate(),
    handleInput(data) { if (rows() < 8 && getKeybindings().matches(data, "tui.select.cancel")) done(); else list.handleInput(data); },
  };
}
