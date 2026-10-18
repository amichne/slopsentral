import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import type { Action, Config } from "./runtime.ts";

export type Origin = "defaults" | "profile" | "user" | "project" | "session";
export type SaveScope = "user" | "project" | "session";
export type OutputPolicy = { readonly type: "ALWAYS" | "ERRORS" | "NEVER" }
  | { readonly type: "EXCLUDE"; readonly pattern: string };
export type HookPolicy = ({ readonly execution: "foreground"; readonly critical: "blocking" | "report" }
  | { readonly execution: "background"; readonly critical: "report" }) & {
  readonly output: OutputPolicy;
  readonly context: "structured" | "none";
  readonly timeoutSeconds?: number;
};
interface CapabilityBase {
  readonly id: string;
  readonly name: string;
  readonly dependencies: readonly string[];
  readonly profiles: readonly string[];
}
export type Capability = CapabilityBase & (
  { readonly type: "INSTRUCTION" | "SKILL" | "RESOURCE" | "AGENT"; readonly path: string }
  | { readonly type: "HOOK"; readonly actions: readonly Action[] }
);
export interface Settings {
  readonly schemaVersion: 1;
  readonly profile?: string;
  readonly capabilities?: Readonly<Record<string, boolean>>;
  readonly hooks?: Readonly<Record<string, HookPolicy>>;
  readonly additions?: readonly Capability[];
  readonly mutationAdapters?: Readonly<Record<string, readonly string[]>>;
}
export type SettingsResult = { readonly type: "settings"; readonly settings: Settings }
  | { readonly type: "rejected"; readonly code: "INVALID_SETTINGS" };
export interface Layer { readonly origin: SaveScope; readonly settings: Settings }
export interface EffectiveCapability {
  readonly capability: Capability;
  readonly origin: Origin;
  readonly policyOrigin: Origin;
  readonly policy: HookPolicy;
  readonly state: "enabled" | "disabled" | "unavailable";
  readonly reason: string;
}
export type Effective = {
  readonly type: "effective";
  readonly profile: string;
  readonly profileOrigin: Origin;
  readonly revision: string;
  readonly capabilities: readonly EffectiveCapability[];
  readonly mutationAdapters: Readonly<Record<string, readonly string[]>>;
} | { readonly type: "rejected"; readonly code: string };

const identity = /^[a-z][a-z0-9-]*$/;
const capabilityId = /^(instruction|skill|resource|agent|hook):[a-z][a-z0-9-]*$/;
const events = ["SessionStart", "UserPromptSubmit", "PreToolUse", "PostToolUse", "Stop"];
export function record(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
function keys(value: Record<string, unknown>, allowed: readonly string[]): boolean {
  return Object.keys(value).every(key => allowed.includes(key));
}
function strings(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item: unknown) => typeof item === "string" && item.length > 0 && !item.includes("\0"));
}
function regex(value: unknown): value is string {
  if (typeof value !== "string" || value.length > 1024) return false;
  try { new RegExp(value); return true; } catch { return false; }
}
function outputPolicy(value: unknown): value is OutputPolicy {
  if (!record(value)) return false;
  return value.type === "EXCLUDE" ? keys(value, ["type", "pattern"]) && regex(value.pattern)
    : keys(value, ["type"]) && (value.type === "ALWAYS" || value.type === "ERRORS" || value.type === "NEVER");
}
export function hookPolicy(value: unknown): value is HookPolicy {
  return record(value) && keys(value, ["execution", "critical", "output", "context", "timeoutSeconds"])
    && (value.execution === "foreground" && (value.critical === "blocking" || value.critical === "report")
      || value.execution === "background" && value.critical === "report")
    && outputPolicy(value.output) && (value.context === "structured" || value.context === "none")
    && (value.timeoutSeconds === undefined || typeof value.timeoutSeconds === "number" && Number.isSafeInteger(value.timeoutSeconds) && value.timeoutSeconds > 0 && value.timeoutSeconds <= 3600);
}
function action(value: unknown): value is Action {
  return record(value) && keys(value, ["name", "event", "plugin", "argv", "matcher", "timeout"])
    && typeof value.name === "string" && identity.test(value.name)
    && typeof value.plugin === "string" && identity.test(value.plugin)
    && typeof value.event === "string" && events.includes(value.event)
    && strings(value.argv) && value.argv.length > 0
    && typeof value.timeout === "number" && Number.isSafeInteger(value.timeout) && value.timeout > 0 && value.timeout <= 3600
    && (value.matcher === undefined || value.matcher === "*" || regex(value.matcher));
}
function capability(value: unknown): value is Capability {
  if (!record(value) || !keys(value, ["id", "name", "type", "dependencies", "profiles", "path", "actions"])
    || typeof value.id !== "string" || !capabilityId.test(value.id)
    || typeof value.name !== "string" || !identity.test(value.name)
    || value.id !== `${String(value.type).toLowerCase()}:${value.name}`
    || !strings(value.dependencies) || !value.dependencies.every(id => capabilityId.test(id))
    || new Set(value.dependencies).size !== value.dependencies.length
    || !strings(value.profiles) || !value.profiles.every(name => identity.test(name))
    || new Set(value.profiles).size !== value.profiles.length) return false;
  return value.type === "HOOK"
    ? value.path === undefined && Array.isArray(value.actions) && value.actions.every(action)
    : ["INSTRUCTION", "SKILL", "RESOURCE", "AGENT"].includes(String(value.type)) && value.actions === undefined
      && typeof value.path === "string" && value.path.length > 0 && !value.path.includes("\0")
      && !value.path.split(/[\\/]/).some(part => part === "..");
}
export function parseCatalog(value: unknown): readonly Capability[] | undefined {
  if (!record(value) || !keys(value, ["schemaVersion", "capabilities"]) || value.schemaVersion !== 1
    || !Array.isArray(value.capabilities) || !value.capabilities.every(capability)
    || new Set(value.capabilities.map(item => item.id)).size !== value.capabilities.length) return undefined;
  return value.capabilities;
}
function settings(value: unknown): value is Settings {
  if (!record(value) || !keys(value, ["schemaVersion", "profile", "capabilities", "hooks", "additions", "mutationAdapters"])
    || value.schemaVersion !== 1 || value.profile !== undefined && (typeof value.profile !== "string" || !identity.test(value.profile))) return false;
  if (value.capabilities !== undefined && (!record(value.capabilities)
    || !Object.entries(value.capabilities).every(([id, enabled]) => capabilityId.test(id) && typeof enabled === "boolean"))) return false;
  if (value.hooks !== undefined && (!record(value.hooks)
    || !Object.entries(value.hooks).every(([id, policy]) => id.startsWith("hook:") && capabilityId.test(id) && hookPolicy(policy)))) return false;
  if (value.additions !== undefined && (!Array.isArray(value.additions) || !value.additions.every(capability)
    || new Set(value.additions.map(item => item.id)).size !== value.additions.length)) return false;
  if (value.mutationAdapters !== undefined && (!record(value.mutationAdapters)
    || !Object.entries(value.mutationAdapters).every(([tool, fields]) => /^[A-Za-z][A-Za-z0-9_.:-]*$/.test(tool)
      && strings(fields) && fields.length > 0 && fields.every(field => /^[A-Za-z][A-Za-z0-9_]*$/.test(field))))) return false;
  return true;
}
export function parseSettings(value: unknown): SettingsResult {
  return settings(value) ? { type: "settings", settings: structuredClone(value) } : { type: "rejected", code: "INVALID_SETTINGS" };
}
export function localSettings(settings: Settings, cwd: string): Settings {
  return settings.additions === undefined ? settings : { ...settings, additions: settings.additions.map(cap => cap.type === "HOOK"
    ? cap : { ...cap, path: path.resolve(cwd, cap.path) }) };
}

/** Compatibility ingress for packages projected before the capability catalog existed. */
export function catalogFromProfiles(config: Config): Capability[] {
  const result = new Map<string, Capability>();
  for (const profile of config.profiles) {
    for (const [kind, links] of [["INSTRUCTION", profile.instructions], ["SKILL", profile.skills], ["AGENT", profile.agents]] as const)
      for (const link of links) {
        const id = `${kind.toLowerCase()}:${link.name}`;
        const old = result.get(id);
        result.set(id, { id, name: link.name, type: kind, path: link.path, dependencies: [], profiles: [...(old?.profiles ?? []), profile.name] });
      }
    for (const action of profile.hooks) {
      const id = `hook:${action.name}`;
      const old = result.get(id);
      if (old?.type === "HOOK") result.set(id, { ...old, profiles: [...new Set([...old.profiles, profile.name])],
        actions: old.actions.some(item => JSON.stringify(item) === JSON.stringify(action)) ? old.actions : [...old.actions, action] });
      else result.set(id, { id, name: action.name, type: "HOOK", actions: [action], dependencies: [], profiles: [profile.name] });
    }
  }
  return [...result.values()];
}

export function resolveSettings(config: Config, catalog: readonly Capability[], layers: readonly Layer[],
  availability: ReadonlyMap<string, string> = new Map()): Effective {
  let profileName = config.defaultProfile;
  let profileOrigin: Origin = "defaults";
  const enabled = new Map<string, { value: boolean; origin: Origin }>();
  const policies = new Map<string, { value: HookPolicy; origin: Origin }>();
  const all = new Map(catalog.map(item => [item.id, item]));
  const additions = new Set<string>();
  const adapters: Record<string, readonly string[]> = {};
  for (const layer of layers) {
    if (layer.settings.profile !== undefined) { profileName = layer.settings.profile; profileOrigin = layer.origin; }
    for (const cap of layer.settings.additions ?? []) {
      if (all.has(cap.id) && !additions.has(cap.id)) return { type: "rejected", code: `DUPLICATE_CAPABILITY: ${cap.id}` };
      all.set(cap.id, cap); additions.add(cap.id);
      enabled.set(cap.id, { value: true, origin: layer.origin });
    }
    for (const [id, value] of Object.entries(layer.settings.capabilities ?? {})) enabled.set(id, { value, origin: layer.origin });
    for (const [id, value] of Object.entries(layer.settings.hooks ?? {})) policies.set(id, { value, origin: layer.origin });
    Object.assign(adapters, layer.settings.mutationAdapters);
  }
  const profile = config.profiles.find(item => item.name === profileName);
  if (profileName !== "off" && !profile) return { type: "rejected", code: "UNKNOWN_PROFILE" };
  for (const id of [...enabled.keys(), ...policies.keys()]) if (!all.has(id)) return { type: "rejected", code: `UNKNOWN_CAPABILITY: ${id}` };
  const states = new Map<string, EffectiveCapability>();
  function resolve(cap: Capability, ancestors: readonly string[] = []): EffectiveCapability {
    const cached = states.get(cap.id);
    if (cached) return cached;
    const override = enabled.get(cap.id);
    const active = override?.value ?? (profile !== undefined && cap.profiles.includes(profile.name)
      && (cap.type !== "HOOK" || profile.hookPolicy !== "OFF"));
    const scopeDefault = cap.id === "hook:agents-md-scope" && profile?.hookPolicy !== "ENFORCING";
    const fallback: HookPolicy = scopeDefault
      ? { execution: "background", critical: "report", output: { type: "ALWAYS" }, context: "none" }
      : { execution: "foreground", critical: profile?.hookPolicy === "ENFORCING" ? "blocking" : "report", output: { type: "ALWAYS" }, context: "structured" };
    const policy = policies.get(cap.id)?.value ?? fallback;
    let reason = availability.get(cap.id) ?? "";
    if (ancestors.includes(cap.id)) reason = "DEPENDENCY_CYCLE";
    else for (const dependency of cap.dependencies) {
      const target = all.get(dependency);
      if (!target || resolve(target, [...ancestors, cap.id]).state !== "enabled") reason ||= `DEPENDENCY_UNAVAILABLE: ${dependency}`;
    }
    const item: EffectiveCapability = { capability: cap, origin: override?.origin ?? "profile", policyOrigin: policies.get(cap.id)?.origin ?? (scopeDefault ? "defaults" : "profile"),
      policy, state: !active ? "disabled" : reason ? "unavailable" : "enabled", reason };
    states.set(cap.id, item);
    return item;
  }
  const capabilities = [...all.values()].map(cap => resolve(cap));
  return { type: "effective", profile: profileName, profileOrigin, capabilities, mutationAdapters: adapters,
    revision: crypto.createHash("sha256").update(JSON.stringify({ profileName, capabilities, adapters })).digest("hex") };
}

export function resourcePath(root: string, capability: Capability & { readonly path: string }): string {
  return path.resolve(root, capability.path);
}
export function examineResources(root: string, catalog: readonly Capability[]): ReadonlyMap<string, string> {
  const unavailable = new Map<string, string>();
  for (const cap of catalog) if (cap.type !== "HOOK") {
    try { if (!fs.statSync(resourcePath(root, cap)).isFile()) unavailable.set(cap.id, "MISSING_RESOURCE"); }
    catch { unavailable.set(cap.id, "RESOURCE_FAILED"); }
  }
  return unavailable;
}
export function readSettings(file: string): { readonly settings: Settings; readonly error?: string } {
  try {
    if (fs.statSync(file).size > 1024 * 1024) return { settings: { schemaVersion: 1 }, error: "SETTINGS_TOO_LARGE" };
    const parsed = parseSettings(JSON.parse(fs.readFileSync(file, "utf8")) as unknown);
    return parsed.type === "settings" ? { settings: parsed.settings } : { settings: { schemaVersion: 1 }, error: parsed.code };
  } catch (error) {
    if (record(error) && error.code === "ENOENT") return { settings: { schemaVersion: 1 } };
    return { settings: { schemaVersion: 1 }, error: "SETTINGS_READ_FAILED" };
  }
}
export function saveSettings(file: string, settings: Settings): { readonly type: "saved" } | { readonly type: "rejected"; readonly code: string } {
  if (parseSettings(settings).type === "rejected") return { type: "rejected", code: "INVALID_SETTINGS" };
  const temporary = `${file}.${crypto.randomUUID()}.tmp`;
  try {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(temporary, JSON.stringify(settings, null, 2) + "\n", { mode: 0o600, flag: "wx" });
    fs.renameSync(temporary, file);
    return { type: "saved" };
  } catch { return { type: "rejected", code: "SETTINGS_WRITE_FAILED" }; }
  finally { fs.rmSync(temporary, { force: true }); }
}
