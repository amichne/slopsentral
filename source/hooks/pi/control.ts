import fs from "node:fs";
import path from "node:path";
import { getAgentDir, type ExtensionAPI, type ExtensionContext } from "@earendil-works/pi-coding-agent";
import { parseConfig, runAction, type Action, type Config, type HookResult, type HookRun, type Selection, type Rejected } from "./runtime.ts";
import { catalogFromProfiles, examineResources, localSettings, parseCatalog, parseSettings, readSettings, record, resolveSettings, resourcePath, saveSettings,
  type Capability, type Effective, type HookPolicy, type Layer, type SaveScope, type Settings } from "./settings.ts";
import { collectMutation, emptyJournal, fileStamp, parseJournal, recordMutation, sameWorkspace, workspaceStamp, type Journal, type WorkspaceIdentity } from "./journal.ts";
import { HookCoordinator } from "./coordinator.ts";

const settingsType = "slopsentral-settings";
export const journalType = "slopsentral-mutations";
export type PolicyRun = HookRun & { readonly policy: HookPolicy };
export function blockingFailures(runs: readonly PolicyRun[]): string {
  return runs.flatMap(run => run.policy.critical === "blocking" && run.result.type === "rejected"
    ? [`${run.action.name}: ${run.result.code}${run.result.code === "BLOCKED" ? "\n" + run.result.reason : ""}`] : []).join("\n");
}
export function presented(run: PolicyRun): string {
  const { result, policy, action } = run;
  if (policy.output.type === "NEVER" || policy.output.type === "ERRORS" && result.type !== "rejected") return "";
  const primary = result.type === "rejected" ? `${action.name}: ${result.code}${result.code === "BLOCKED" ? "\n" + result.reason : ""}`
    : `${action.name}: ${[result.notice, result.context].filter(Boolean).join("\n") || "command completed"}`;
  const text = [primary, result.diagnostics].filter(Boolean).join("\n");
  if (policy.output.type !== "EXCLUDE") return text;
  const pattern = new RegExp(policy.output.pattern);
  return text.split("\n").filter(line => !pattern.test(line)).join("\n");
}
export function hookContext(runs: readonly PolicyRun[]): string {
  return runs.flatMap(run => run.policy.context !== "structured" ? [] : run.result.type === "completed"
    ? [run.result.context, run.result.notice] : [`${run.action.name}: ${run.result.code}${run.result.code === "BLOCKED" ? "\n" + run.result.reason : ""}`])
    .filter(Boolean).join("\n\n");
}

function contextCurrent(ctx: ExtensionContext): boolean {
  try { ctx.isIdle(); return true; }
  catch (error) {
    // Pi 1.3.0 dispose() invalidates contexts without a session_shutdown event.
    // Its documented stale-context rejection is an untyped Error at this adapter.
    if (error instanceof Error && error.message.startsWith("This extension ctx is stale after session replacement or reload.")) return false;
    throw error;
  }
}

export class Control {
  readonly config: Config;
  private readonly catalogSource: { readonly type: "CATALOG"; readonly capabilities: readonly Capability[] }
    | { readonly type: "PROFILE_FALLBACK"; readonly capabilities: readonly Capability[] };
  get catalog(): readonly Capability[] { return this.catalogSource.capabilities; }
  readonly loadErrors: string[] = [];
  readonly coordinator = new HookCoordinator();
  effective: Effective = { type: "rejected", code: "NOT_RESTORED" };
  journal: Journal = emptyJournal;
  private sessionSettings: Settings = { schemaVersion: 1 };
  private layers: Layer[] = [];
  private epoch = 0;
  private invocation = 0;
  private cwd = "";
  private sessionId = "";
  private journalError = "";
  private configurationError: Rejected | undefined;
  private settingsErrors: string[] = [];
  private settingsStamp = "";
  private readonly acceptedFiles = new Map<string, Settings>();
  private results: { id: string; event: string; result: HookResult; identity: { cwd: string; session: string; configuration: string; workspace: WorkspaceIdentity; journalRevision: number; operation: string } }[] = [];
  private toolContext = "";
  private backgroundContext = "";
  readonly root: string;
  private readonly pi: ExtensionAPI;
  constructor(root: string, pi: ExtensionAPI) {
    this.root = root;
    this.pi = pi;
    let config: Config = { schemaVersion: 1, defaultProfile: "off", profiles: [] };
    try {
      const parsed = parseConfig(JSON.parse(fs.readFileSync(path.join(root, "profiles.json"), "utf8")) as unknown);
      if (parsed.type === "configured") config = parsed.config;
      else this.loadErrors.push(parsed.code);
    } catch { this.loadErrors.push("PROFILES_READ_FAILED"); }
    this.config = config;
    let catalog = catalogFromProfiles(config);
    let source: "CATALOG" | "PROFILE_FALLBACK" = "PROFILE_FALLBACK";
    try {
      const parsed = parseCatalog(JSON.parse(fs.readFileSync(path.join(root, "capabilities.json"), "utf8")) as unknown);
      if (parsed) { catalog = [...parsed]; source = "CATALOG"; } else this.loadErrors.push("INVALID_CATALOG");
    } catch { this.loadErrors.push("CATALOG_UNAVAILABLE"); }
    this.catalogSource = { type: source, capabilities: catalog };
  }
  get files(): Readonly<Record<"user" | "project", string>> {
    return { user: path.join(getAgentDir(), "slopsentral.json"), project: path.join(this.cwd, ".pi/slopsentral.json") };
  }
  get selection(): Selection | Rejected {
    if (this.configurationError) return this.configurationError;
    if (this.effective.type === "rejected") return { type: "rejected", code: this.effective.code === "UNKNOWN_PROFILE" ? "UNKNOWN_PROFILE" : "INVALID_CONFIG" };
    const effective = this.effective;
    const active = effective.capabilities.filter(item => item.state === "enabled").map(item => item.capability);
    if (effective.profile === "off" && !active.length) return { type: "off" };
    const profile = this.config.profiles.find(item => item.name === effective.profile);
    const links = (kind: Capability["type"]) => active.flatMap(cap => cap.type === kind && cap.type !== "HOOK" ? [{ name: cap.name, path: cap.path }] : []);
    return { type: "selected", profile: { name: effective.profile, description: profile?.description ?? "Individual capabilities",
      hookPolicy: profile?.hookPolicy ?? "ADVISORY", skills: links("SKILL"), instructions: links("INSTRUCTION"), agents: links("AGENT"),
      hooks: active.flatMap(cap => cap.type === "HOOK" ? cap.actions : []) } };
  }
  invalidate(): void { this.epoch++; this.coordinator.invalidate(); this.toolContext = ""; this.backgroundContext = ""; }
  rememberContext(text: string): void { this.toolContext = this.boundedContext(this.toolContext, text); }
  currentContext(): string { return this.toolContext; }
  clearToolContext(): void { this.toolContext = ""; }
  takeBackgroundContext(): string { const text = this.backgroundContext; this.backgroundContext = ""; return text; }
  private boundedContext(previous: string, text: string): string {
    const combined = [previous, text].filter(Boolean).join("\n\n");
    return Buffer.byteLength(combined) <= 65536 ? combined : "Slopsentral hook context exceeds the context limit. Examine /slopsentral state for the complete results.";
  }
  restore(ctx: ExtensionContext): void {
    this.invalidate();
    this.cwd = ctx.cwd;
    this.sessionId = ctx.sessionManager.getSessionId();
    this.sessionSettings = { schemaVersion: 1 };
    this.journal = emptyJournal;
    this.journalError = "";
    this.configurationError = undefined;
    this.results = [];
    const branch = ctx.sessionManager.getBranch();
    let stored = false;
    for (const entry of branch) if (entry.type === "custom") {
      if (entry.customType === settingsType) {
        const parsed = parseSettings(entry.data);
        if (parsed.type === "settings") { this.sessionSettings = localSettings(parsed.settings, ctx.cwd); this.configurationError = undefined; }
        else this.configurationError = { type: "rejected", code: "INVALID_CONFIG" };
        stored = true;
      }
      if (entry.customType === "slopsentral-profile") {
        if (typeof entry.data === "string") this.sessionSettings = { ...this.sessionSettings, profile: entry.data };
        else this.configurationError = { type: "rejected", code: "INVALID_CONFIG" };
        stored = true;
      }
      if (entry.customType === journalType) {
        const parsed = parseJournal(entry.data);
        if (parsed) { this.journal = parsed; this.journalError = ""; }
        else this.journalError = "INVALID_JOURNAL";
      }
    }
    if (!stored) {
      const flag = this.pi.getFlag("slopsentral-profile");
      if (typeof flag === "string") this.sessionSettings = { schemaVersion: 1, profile: flag };
    }
    this.refresh();
    if (!stored && this.effective.type === "effective") this.pi.appendEntry("slopsentral-profile", this.effective.profile);
    this.status(ctx);
  }
  private refresh(): void {
    this.settingsErrors = [];
    this.layers = [];
    let admission: { readonly type: "accepted" } | { readonly type: "rejected"; readonly code: string } = { type: "accepted" };
    for (const origin of ["user", "project"] as const) {
      const loaded = readSettings(this.files[origin]);
      if (loaded.error) this.settingsErrors.push(`${origin}: ${loaded.error}`);
      const file = this.files[origin];
      const normalized = localSettings(loaded.settings, this.cwd);
      if (loaded.error && !this.acceptedFiles.has(file)) admission = { type: "rejected", code: `SETTINGS_UNAVAILABLE: ${origin}` };
      if (!loaded.error) this.acceptedFiles.set(file, normalized);
      this.layers.push({ origin, settings: loaded.error ? this.acceptedFiles.get(file) ?? normalized : normalized });
    }
    this.layers.push({ origin: "session", settings: this.sessionSettings });
    const all = [...this.catalog, ...this.layers.flatMap(layer => layer.settings.additions ?? [])];
    const resources = new Map(examineResources(this.root, all));
    if (this.catalogSource.type === "PROFILE_FALLBACK") for (const cap of this.catalog) if (cap.type === "HOOK") resources.set(cap.id, "CATALOG_UNAVAILABLE");
    this.effective = admission.type === "rejected" ? admission : resolveSettings(this.config, this.catalog, this.layers, resources);
    this.settingsStamp = fileStamp(Object.values(this.files));
  }
  sync(ctx: ExtensionContext): boolean {
    if (fileStamp(Object.values(this.files)) === this.settingsStamp) return false;
    this.invalidate(); this.refresh(); this.status(ctx);
    return true;
  }
  refreshResources(ctx: ExtensionContext): boolean {
    const before = this.effective.type === "effective" ? this.effective.revision : this.effective.code;
    this.refresh();
    const after = this.effective.type === "effective" ? this.effective.revision : this.effective.code;
    if (before === after) return false;
    this.invalidate(); this.status(ctx);
    return true;
  }
  change(scope: SaveScope, value: unknown, ctx: ExtensionContext): string | undefined {
    if (!ctx.isIdle()) return "SETTINGS_BUSY";
    this.sync(ctx);
    const parsed = parseSettings(value);
    if (parsed.type === "rejected") return parsed.code;
    const admitted = localSettings(parsed.settings, ctx.cwd);
    const layers = this.layers.filter(layer => layer.origin !== scope);
    layers.push({ origin: scope, settings: admitted });
    layers.sort((a, b) => ["user", "project", "session"].indexOf(a.origin) - ["user", "project", "session"].indexOf(b.origin));
    const candidate = resolveSettings(this.config, this.catalog, layers);
    if (candidate.type === "rejected") return candidate.code;
    if (scope !== "session") {
      const saved = saveSettings(this.files[scope], admitted);
      if (saved.type === "rejected") return saved.code;
    } else {
      this.sessionSettings = admitted;
      this.configurationError = undefined;
      this.pi.appendEntry(settingsType, admitted);
      if (admitted.profile !== undefined) this.pi.appendEntry("slopsentral-profile", admitted.profile);
    }
    this.invalidate();
    this.refresh();
    this.status(ctx);
    return undefined;
  }
  settings(scope: SaveScope): Settings { return this.layers.find(layer => layer.origin === scope)?.settings ?? { schemaVersion: 1 }; }
  profile(name: string, ctx: ExtensionContext): string | undefined {
    if (name !== "off" && !this.config.profiles.some(profile => profile.name === name)) return "UNKNOWN_PROFILE";
    return this.change("session", { ...this.sessionSettings, profile: name }, ctx);
  }
  capture(tool: string, args: unknown, ctx: ExtensionContext): void {
    // Collection is independent of assessment enablement. Disabled periods cannot erase evidence.
    const next = recordMutation(this.journal, collectMutation(ctx.cwd, tool, args, this.effective.type === "effective" ? this.effective.mutationAdapters : {}));
    if (next !== this.journal) { this.journal = next; this.persistJournal(); }
  }
  instructionContext(tool: string, args: unknown, ctx: ExtensionContext): string {
    const evidence = collectMutation(ctx.cwd, tool, args, this.effective.type === "effective" ? this.effective.mutationAdapters : {});
    return evidence.paths.filter(name => ["AGENTS.md", "AGENTS.override.md"].includes(path.basename(name))).map(name => {
      const file = path.join(ctx.cwd, name);
      try {
        if (fs.lstatSync(file).isSymbolicLink() || !fs.realpathSync(file).startsWith(fs.realpathSync(ctx.cwd) + path.sep))
          return `Instruction propagation failed for ${JSON.stringify(name)}: UNSAFE_INSTRUCTION.`;
        if (fs.statSync(file).size > 24576) return `Read the current instructions from ${JSON.stringify(name)}. The file exceeds the context limit.`;
        return `Current instructions from ${JSON.stringify(name)}:\n${fs.readFileSync(file, "utf8")}`;
      } catch (error) {
        return record(error) && error.code === "ENOENT" ? `The instruction file ${JSON.stringify(name)} was deleted. Reassess the inherited rules.`
          : `Instruction propagation failed for ${JSON.stringify(name)}: RESOURCE_READ_FAILED.`;
      }
    }).join("\n\n");
  }
  private persistJournal(): void { this.pi.appendEntry(journalType, this.journal); }
  review(note: string, ctx: ExtensionContext): string | undefined {
    if (!ctx.isIdle()) return "REVIEW_BUSY";
    if (this.journalError) return this.journalError;
    if (!note.trim() || note.includes("REPLACE WITH") || !this.journal.pending.length && !this.journal.gaps.length) return "MISSING_REVIEW";
    this.invalidate();
    this.journal = { ...emptyJournal, revision: this.journal.revision + 1, assessedRevision: this.journal.revision + 1, note: note.trim() };
    this.persistJournal(); this.status(ctx);
    return undefined;
  }
  status(ctx: ExtensionContext): void {
    const profile = this.effective.type === "effective" ? this.effective.profile : this.effective.code;
    const last = this.results.at(-1);
    const outcome = last ? `${last.id}: ${last.result.type === "rejected" ? last.result.code : "COMPLETED"}` : "";
    ctx.ui.setStatus("slopsentral", `Slopsentral: ${profile} | ${this.journal.pending.length} pending | ${this.coordinator.pending.length} jobs${outcome ? " | " + outcome : ""}`);
  }
  state() {
    return { schemaVersion: 1, effective: this.effective, journal: this.journal,
      coverage: ["Tool-event candidates include failed tools. Shell commands, unsupported tools, and external edits lack complete coverage."],
      errors: [...this.loadErrors, ...this.settingsErrors, ...(this.journalError ? [this.journalError] : [])],
      jobs: this.coordinator.pending, recent: this.results, jobOutcomes: this.coordinator.recent, files: this.files };
  }
  promptText(): string {
    if (this.effective.type !== "effective") return "";
    const lines = [`Slopsentral profile: ${this.effective.profile}. ${this.config.profiles.find(item => item.name === (this.effective.type === "effective" ? this.effective.profile : ""))?.description ?? "Individual capabilities"}`,
      "Apply this guidance within the user request and repository instructions. Profile selection grants no publication or tool authority."];
    let active = this.effective.profile !== "off";
    for (const item of this.effective.capabilities) if (item.state === "enabled" && item.capability.type !== "HOOK") {
      const cap = item.capability;
      if (cap.type === "SKILL") continue;
      active = true;
      const file = resourcePath(this.root, cap);
      if (cap.type === "INSTRUCTION") {
        try { if (fs.statSync(file).size > 65536) throw new Error("RESOURCE_TOO_LARGE"); lines.push(fs.readFileSync(file, "utf8")); }
        catch { lines.push(`${cap.id}: RESOURCE_READ_FAILED. Examine /slopsentral state.`); }
      } else lines.push(`${cap.type}: ${cap.name}: ${file}`);
    }
    return active ? lines.join("\n\n") : "";
  }
  localSkillPaths(): string[] {
    return this.effective.type === "effective" ? this.effective.capabilities.flatMap(item => item.state === "enabled" && item.capability.type === "SKILL"
      && path.isAbsolute(item.capability.path) ? [item.capability.path] : []) : [];
  }
  scopeSkills<T extends { filePath: string }>(skills: readonly T[]): T[] {
    const owned = new Set(this.catalog.flatMap(cap => cap.type === "SKILL" ? [resourcePath(this.root, cap)] : []));
    const selected = new Set<string>();
    if (this.effective.type === "effective") for (const item of this.effective.capabilities) if (item.capability.type === "SKILL") {
      const file = resourcePath(this.root, item.capability);
      owned.add(file);
      if (item.state === "enabled") selected.add(file);
    }
    return skills.filter(skill => {
      const file = path.resolve(skill.filePath);
      return selected.has(file) || !owned.has(file) && !file.startsWith(path.resolve(this.root) + path.sep);
    });
  }
  async run(event: Action["event"], ctx: ExtensionContext, payload: Readonly<Record<string, unknown>>,
    phase: "foreground" | "background" | "all" = "all", manual = false, onlyId?: string): Promise<PolicyRun[]> {
    if (this.effective.type !== "effective") return [];
    if (!this.effective.capabilities.some(item => item.capability.type === "HOOK" && item.capability.actions.some(action => action.event === event)
      && (manual || item.state !== "disabled") && (phase === "all" || phase === item.policy.execution))) return [];
    const runs: PolicyRun[] = [];
    const invocation = ++this.invocation;
    const user = ctx.sessionManager.getBranch().findLast(entry => entry.type === "message" && entry.message.role === "user");
    const assistant = ctx.sessionManager.getBranch().findLast(entry => entry.type === "message" && entry.message.role === "assistant");
    const operation = typeof payload.tool_call_id === "string" ? `${assistant?.id ?? user?.id ?? invocation}:${payload.tool_call_id}`
      : event === "Stop" && user ? user.id : `invocation:${invocation}`;
    const epoch = this.epoch;
    const revision = this.effective.revision;
    const stamp = workspaceStamp(ctx.cwd);
    const configStamp = this.settingsStamp;
    const session = ctx.sessionManager.getSessionId();
    const cwd = ctx.cwd;
    const baseValid = () => epoch === this.epoch && contextCurrent(ctx) && this.sessionId === session && this.cwd === cwd
      && this.effective.type === "effective" && this.effective.revision === revision
      && fileStamp(Object.values(this.files)) === configStamp;
    const valid = () => baseValid() && sameWorkspace(stamp, workspaceStamp(cwd));
    for (const item of this.effective.capabilities) {
      const cap = item.capability;
      if (cap.type !== "HOOK" || item.state === "disabled" && !manual) continue;
      if (onlyId !== undefined && cap.id !== onlyId) continue;
      if (manual && onlyId === undefined && item.state === "disabled" && !cap.profiles.includes(this.effective.profile)) continue;
      const policy: HookPolicy = manual ? { ...item.policy, execution: "foreground" } : item.policy;
      if (phase !== "all" && policy.execution !== phase) continue;
      const scope = cap.id === "hook:agents-md-scope";
      if (scope && event !== "Stop") continue;
      if (scope && !manual && this.journal.assessedRevision === this.journal.revision && policy.critical !== "blocking") continue;
      const snapshot = this.journal;
      if (scope && !this.journalError && !snapshot.pending.length && !snapshot.gaps.length) continue;
      for (const [actionIndex, authored] of cap.actions.entries()) {
        if (authored.event !== event) continue;
        const subject = event === "PreToolUse" || event === "PostToolUse" ? String(payload.tool_name) : String(payload.source);
        if (authored.matcher && authored.matcher !== "*" && !new RegExp(authored.matcher).test(subject)) continue;
        const action: Action = { ...authored, timeout: policy.timeoutSeconds ?? authored.timeout,
          argv: scope && !authored.argv.includes("assess") ? [...authored.argv, "assess"] : authored.argv };
        const scopeValid = () => valid() && (!scope || this.journal.revision === snapshot.revision);
        const deliver = (result: HookResult) => {
          if (scope && result.type === "rejected" && result.code === "BLOCKED" && result.assessment === "ASSESSED" && !this.journalError) {
            this.journal = { ...this.journal, assessedRevision: snapshot.revision }; this.persistJournal();
          }
          this.results.push({ id: cap.id, event, result, identity: { cwd, session, configuration: revision, workspace: stamp, journalRevision: snapshot.revision, operation } });
          if (this.results.length > 16) this.results.shift();
          if (policy.execution === "background") {
            if (policy.context === "structured") this.backgroundContext = this.boundedContext(this.backgroundContext, hookContext([{ action, policy, result }]));
            const text = presented({ action, policy, result });
            if (text) ctx.ui.notify(text, result.type === "rejected" ? "warning" : "info");
          }
          this.status(ctx);
        };
        const work = async (signal: AbortSignal): Promise<HookResult> => {
          if (item.reason || scope && this.journalError)
            return { type: "rejected", code: "BLOCKED", reason: this.journalError || item.reason };
          if (scope && snapshot.assessedRevision === snapshot.revision)
            return { type: "rejected", code: "BLOCKED", assessment: "ASSESSED", reason: `Pending scope review: ${JSON.stringify(snapshot.pending)}. Use /slopsentral review NOTE.` };
          const combined = policy.execution === "foreground" && ctx.signal ? AbortSignal.any([signal, ctx.signal]) : signal;
          const result = await runAction(this.root, action, ctx.cwd, { ...payload, ...(scope ? { changed_paths: snapshot.pending } : {}) }, combined);
          return scope && snapshot.gaps.length && result.type === "completed"
            ? { type: "rejected", code: "BLOCKED", assessment: "ASSESSED", reason: `Scope coverage needs review: ${snapshot.gaps.join(", ")}` } : result;
        };
        if (stamp.type === "UNAVAILABLE") {
          const result: HookResult = { type: "rejected", code: "BLOCKED", reason: stamp.reason };
          if (baseValid()) { deliver(result); if (policy.execution === "foreground") runs.push({ action, policy, result }); }
          continue;
        }
        const result = await this.coordinator.submit(`${cap.id}:${event}:${actionIndex}:${scope ? snapshot.revision : operation}`, policy, work, deliver, scopeValid);
        if (!result && policy.execution === "foreground" && !valid()) return [{ action, policy: { ...policy, critical: "blocking" }, result: { type: "rejected", code: "STALE_CONTEXT" } }];
        if (result && valid()) runs.push({ action, policy, result });
      }
    }
    return runs;
  }
}
