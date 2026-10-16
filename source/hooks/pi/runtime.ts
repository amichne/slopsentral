import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

export interface Link { readonly name: string; readonly path: string }
export interface Action {
  readonly name: string;
  readonly event: "SessionStart" | "UserPromptSubmit" | "PreToolUse" | "PostToolUse" | "Stop";
  readonly plugin: string;
  readonly argv: readonly string[];
  readonly matcher?: string;
  readonly timeout: number;
}
export interface Profile {
  readonly name: string;
  readonly description: string;
  readonly skills: readonly Link[];
  readonly instructions: readonly Link[];
  readonly agents: readonly Link[];
  readonly hooks: readonly Action[];
  readonly hookPolicy: "OFF" | "ADVISORY" | "ENFORCING";
}
export interface Config {
  readonly schemaVersion: 1;
  readonly defaultProfile: string;
  readonly profiles: readonly Profile[];
}
export type Selection = { readonly type: "off" } | { readonly type: "selected"; readonly profile: Profile };
type FailureCode = "INVALID_CONFIG" | "UNKNOWN_PROFILE" | "INVALID_OUTPUT" | "EXIT_FAILED" | "LAUNCH_FAILED" | "TIMED_OUT" | "ABORTED" | "OUTPUT_LIMIT";
export type Rejected = { readonly type: "rejected"; readonly code: FailureCode }
  | { readonly type: "rejected"; readonly code: "BLOCKED"; readonly reason: string };
export type HookResult = Rejected | { readonly type: "completed"; readonly context: string; readonly notice: string };
export type HookRun = { readonly action: Action; readonly result: HookResult };
const identity = /^[a-z][a-z0-9-]*$/;
const token = /^[A-Za-z0-9_./:-]+$/;
const limit = 64 * 1024;

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
function keys(value: Record<string, unknown>, allowed: readonly string[]): boolean {
  return Object.keys(value).every(key => allowed.includes(key));
}
function relative(value: unknown): value is string {
  return typeof value === "string" && value.length > 0 && !path.isAbsolute(value)
    && !value.includes("\\") && value.split("/").every(part => part !== "." && part !== ".." && part !== "");
}
function link(value: unknown): value is Link {
  return record(value) && keys(value, ["name", "path"]) && typeof value.name === "string"
    && identity.test(value.name) && relative(value.path);
}
function action(value: unknown): value is Action {
  if (!record(value) || !keys(value, ["name", "event", "plugin", "argv", "matcher", "timeout"])) return false;
  if (typeof value.name !== "string" || !identity.test(value.name)
    || typeof value.plugin !== "string" || !identity.test(value.plugin)
    || !(value.event === "SessionStart" || value.event === "UserPromptSubmit" || value.event === "PreToolUse" || value.event === "PostToolUse" || value.event === "Stop")
    || !Array.isArray(value.argv) || value.argv.length === 0
    || !value.argv.every((arg: unknown) => typeof arg === "string" && token.test(arg))
    || typeof value.timeout !== "number" || !Number.isSafeInteger(value.timeout) || value.timeout <= 0) return false;
  if (value.matcher !== undefined && typeof value.matcher !== "string") return false;
  try { if (value.matcher !== undefined && value.matcher !== "*") new RegExp(value.matcher); }
  catch { return false; }
  return true;
}
function profile(value: unknown): value is Profile {
  return record(value) && keys(value, ["name", "description", "skills", "instructions", "agents", "hooks", "hookPolicy"])
    && typeof value.name === "string" && identity.test(value.name)
    && typeof value.description === "string" && value.description.length > 0
    && [value.skills, value.instructions, value.agents].every(v => Array.isArray(v) && v.every(link))
    && Array.isArray(value.hooks) && value.hooks.every(action)
    && (value.hookPolicy === "OFF" || value.hookPolicy === "ADVISORY" || value.hookPolicy === "ENFORCING");
}

export function parseConfig(value: unknown): { readonly type: "configured"; readonly config: Config } | Rejected {
  if (!record(value) || !keys(value, ["schemaVersion", "defaultProfile", "profiles"])
    || value.schemaVersion !== 1 || typeof value.defaultProfile !== "string"
    || !Array.isArray(value.profiles) || !value.profiles.every(profile)
    || !value.profiles.some(p => p.name === value.defaultProfile)
    || new Set(value.profiles.map(p => p.name)).size !== value.profiles.length) return { type: "rejected", code: "INVALID_CONFIG" };
  return { type: "configured", config: { schemaVersion: 1, defaultProfile: value.defaultProfile, profiles: value.profiles } };
}

export function select(config: Config, name: string): Selection | Rejected {
  if (name === "off") return { type: "off" };
  const selected = config.profiles.find(p => p.name === name);
  return selected ? { type: "selected", profile: selected } : { type: "rejected", code: "UNKNOWN_PROFILE" };
}

export function selectionName(selection: Selection): string {
  return selection.type === "off" ? "off" : selection.profile.name;
}

export function readText(root: string, relativePath: string): string {
  if (!relative(relativePath)) throw new Error("slopsentral: INVALID_RESOURCE_PATH");
  const file = path.join(root, relativePath);
  if (fs.statSync(file).size > limit) throw new Error("slopsentral: RESOURCE_TOO_LARGE");
  return fs.readFileSync(file, "utf8");
}

export function instructions(root: string, selection: Selection): string {
  if (selection.type === "off") return "";
  const selected = selection.profile;
  return [
    `Slopsentral profile: ${selected.name}. ${selected.description}`,
    "Apply this guidance within the user request and repository instructions. Profile selection grants no publication or tool authority.",
    ...selected.instructions.map(ref => readText(root, ref.path)),
    ...(selected.agents.length ? ["Bundled review criteria:", ...selected.agents.map(ref => `${ref.name}: ${path.join(root, ref.path)}`)] : []),
  ].join("\n\n");
}

export function scopedSkills<T extends { filePath: string }>(root: string, selection: Selection, skills: readonly T[]): T[] {
  const selected = new Set(selection.type === "off" ? [] : selection.profile.skills.map(ref => path.resolve(root, ref.path)));
  return skills.filter(skill => !path.resolve(skill.filePath).startsWith(path.resolve(root) + path.sep) || selected.has(path.resolve(skill.filePath)));
}

export function decodeHook(stdout: string, exitCode: number, event: Action["event"] = "SessionStart"): HookResult {
  if (exitCode !== 0) return { type: "rejected", code: "EXIT_FAILED" };
  if (!stdout.trim()) return { type: "completed", context: "", notice: "" };
  let value: unknown;
  try { value = JSON.parse(stdout); } catch { return { type: "rejected", code: "INVALID_OUTPUT" }; }
  if (!record(value)) return { type: "rejected", code: "INVALID_OUTPUT" };
  const specific = value.hookSpecificOutput;
  if (value.decision === "block" || value.continue === false || (record(specific) && specific.permissionDecision === "deny")) {
    const reason = typeof value.reason === "string" ? value.reason
      : typeof value.stopReason === "string" ? value.stopReason
      : record(specific) && typeof specific.permissionDecisionReason === "string" ? specific.permissionDecisionReason
      : "The hook blocked this operation.";
    return { type: "rejected", code: "BLOCKED", reason: reason.slice(0, 32768) };
  }
  if (!keys(value, ["systemMessage", "hookSpecificOutput"]) || (value.systemMessage !== undefined && typeof value.systemMessage !== "string"))
    return { type: "rejected", code: "INVALID_OUTPUT" };
  if (specific !== undefined && (!record(specific) || specific.hookEventName !== event || typeof specific.additionalContext !== "string"))
    return { type: "rejected", code: "INVALID_OUTPUT" };
  return { type: "completed", context: record(specific) && typeof specific.additionalContext === "string" ? specific.additionalContext : "",
    notice: typeof value.systemMessage === "string" ? value.systemMessage : "" };
}

/** No shell parses authored argv. Kill the complete process group on timeout or cancellation. */
export function runAction(root: string, action: Action, cwd: string, payload: Readonly<Record<string, unknown>>, signal?: AbortSignal): Promise<HookResult> {
  if (signal?.aborted) return Promise.resolve({ type: "rejected", code: "ABORTED" });
  const pluginRoot = path.join(root, action.plugin);
  const argv = action.argv.map(arg => arg.startsWith("hooks/") ? path.join(pluginRoot, arg) : arg);
  const [command, ...args] = argv;
  if (!command) return Promise.resolve({ type: "rejected", code: "INVALID_CONFIG" });
  return new Promise(resolve => {
    const child = spawn(command, args, { cwd, env: { ...process.env, PLUGIN_ROOT: pluginRoot }, detached: process.platform !== "win32", stdio: ["pipe", "pipe", "ignore"] });
    const chunks: Buffer[] = [];
    let bytes = 0;
    let rejection: Rejected | undefined;
    const stop = (code: FailureCode) => {
      if (rejection) return;
      rejection = { type: "rejected", code };
      const kill = (signalName: NodeJS.Signals) => {
        try { if (child.pid && process.platform !== "win32") process.kill(-child.pid, signalName); else child.kill(signalName); }
        catch (error) { if (!record(error) || error.code !== "ESRCH") throw error; }
      };
      kill("SIGTERM");
      setTimeout(() => kill("SIGKILL"), 250);
    };
    const abort = () => stop("ABORTED");
    const timer = setTimeout(() => stop("TIMED_OUT"), action.timeout * 1000);
    signal?.addEventListener("abort", abort, { once: true });
    if (signal?.aborted) abort();
    child.stdout.on("data", (chunk: Buffer) => {
      bytes += chunk.length;
      if (bytes > limit) stop("OUTPUT_LIMIT"); else chunks.push(chunk);
    });
    child.stdin.on("error", (error: NodeJS.ErrnoException) => { if (error.code !== "EPIPE") stop("LAUNCH_FAILED"); });
    child.on("error", () => { rejection = { type: "rejected", code: "LAUNCH_FAILED" }; });
    child.on("close", code => {
      clearTimeout(timer);
      signal?.removeEventListener("abort", abort);
      resolve(rejection ?? decodeHook(Buffer.concat(chunks).toString("utf8"), code ?? -1, action.event));
    });
    child.stdin.end(JSON.stringify(payload));
  });
}

export async function runHooks(root: string, selected: Profile, event: Action["event"], cwd: string, payload: Readonly<Record<string, unknown>>, signal?: AbortSignal): Promise<HookRun[]> {
  const runs: HookRun[] = [];
  const subject = event === "PreToolUse" || event === "PostToolUse" ? String(payload.tool_name) : String(payload.source);
  for (const action of selected.hooks) {
    if (signal?.aborted) break;
    if (action.event !== event || (action.matcher && action.matcher !== "*" && !new RegExp(action.matcher).test(subject))) continue;
    runs.push({ action, result: await runAction(root, action, cwd, payload, signal) });
  }
  return runs;
}

export function failures(runs: readonly HookRun[]): string {
  return runs.flatMap(({ action, result }) => result.type === "rejected"
    ? [`${action.name}: ${result.code}${result.code === "BLOCKED" ? "\n" + result.reason : ""}`] : []).join("\n");
}

export function notices(runs: readonly HookRun[]): string {
  return runs.flatMap(run => run.result.type === "completed" && run.result.notice ? [`${run.action.name}: ${run.result.notice}`] : []).join("\n");
}

interface GuidanceRule {
  readonly name: string;
  readonly kind: "instruction" | "skill";
  readonly terms: readonly string[];
  readonly dependsOn: readonly string[];
}
interface Guidance extends Pick<GuidanceRule, "name" | "kind"> { readonly via: readonly string[] }
type GuidanceFailure = { readonly type: "rejected"; readonly code:
  "INVALID_PROMPT" | "INPUT_LIMIT" | "INVALID_GUIDANCE" | "GUIDANCE_CYCLE" | "MISSING_GUIDANCE" | "OUTPUT_LIMIT" };
type GuidanceResult = { readonly type: "resolved"; readonly guidance: readonly Guidance[] } | GuidanceFailure;

// Routing hints only. Procedures and policy remain in these canonical owners.
const authoredGuidance: readonly GuidanceRule[] = [
  { name: "engineering-design", kind: "instruction", terms: ["engineering", "implement", "refactor", "debug", "code"], dependsOn: [] },
  { name: "kotlin-engineering", kind: "instruction", terms: ["kotlin", "gradle"], dependsOn: ["engineering-design"] },
  { name: "tdd", kind: "skill", terms: ["test", "tests", "testing", "tdd", "regression"], dependsOn: ["engineering-design"] },
  { name: "semantic-ratchet", kind: "skill", terms: ["invariant", "invariants", "type safety", "proof", "prove"], dependsOn: ["engineering-design"] },
  { name: "git-change-flow", kind: "skill", terms: ["git", "commit", "worktree"], dependsOn: ["engineering-design"] },
  { name: "pull-request-lifecycle", kind: "skill", terms: ["pull request", "draft pr", "push", "publish"], dependsOn: ["git-change-flow"] },
];

function guidanceRule(value: unknown): value is GuidanceRule {
  return record(value) && keys(value, ["name", "kind", "terms", "dependsOn"])
    && typeof value.name === "string" && value.name.length <= 64 && identity.test(value.name)
    && (value.kind === "instruction" || value.kind === "skill")
    && Array.isArray(value.terms) && value.terms.length <= 8
    && value.terms.every((term: unknown) => typeof term === "string" && /^[a-z][a-z0-9 -]{0,63}$/.test(term))
    && Array.isArray(value.dependsOn) && value.dependsOn.length <= 16
    && value.dependsOn.every((name: unknown) => typeof name === "string" && name.length <= 64 && identity.test(name));
}

/** Pure, bounded selection from the current text. Never interprets it as an action. */
export function resolveGuidance(prompt: unknown, rules: unknown = authoredGuidance): GuidanceResult {
  if (typeof prompt !== "string") return { type: "rejected", code: "INVALID_PROMPT" };
  if (Buffer.byteLength(prompt, "utf8") > limit) return { type: "rejected", code: "INPUT_LIMIT" };
  if (!Array.isArray(rules) || rules.length > 16 || !rules.every(guidanceRule)) return { type: "rejected", code: "INVALID_GUIDANCE" };
  const byName = new Map(rules.map(rule => [rule.name, rule]));
  if (byName.size !== rules.length || rules.some(rule => rule.dependsOn.some(name => !byName.has(name))))
    return { type: "rejected", code: "INVALID_GUIDANCE" };
  const visiting = new Set<string>();
  const visited = new Set<string>();
  const acyclic = (rule: GuidanceRule): boolean => {
    if (visiting.has(rule.name)) return false;
    if (visited.has(rule.name)) return true;
    visiting.add(rule.name);
    for (const name of rule.dependsOn) {
      const dependency = byName.get(name);
      if (!dependency || !acyclic(dependency)) return false;
    }
    visiting.delete(rule.name);
    visited.add(rule.name);
    return true;
  };
  if (!rules.every(acyclic)) return { type: "rejected", code: "GUIDANCE_CYCLE" };
  const selected = new Map<string, Guidance>();
  const include = (rule: GuidanceRule, via: readonly string[]) => {
    if (selected.has(rule.name)) return;
    const chain = [...via, rule.name];
    for (const name of rule.dependsOn) {
      const dependency = byName.get(name);
      if (dependency) include(dependency, chain);
    }
    selected.set(rule.name, { name: rule.name, kind: rule.kind, via: chain });
  };
  const text = prompt.toLowerCase();
  for (const rule of rules) if (rule.terms.some(term => new RegExp(`\\b${term}\\b`).test(text))) include(rule, []);
  return { type: "resolved", guidance: [...selected.values()] };
}

/** Reference bundled owners without re-injecting SessionStart policy or changing profile scope. */
export function guidanceContext(root: string, config: Config, result: GuidanceResult):
  { readonly type: "context"; readonly context: string } | GuidanceFailure {
  if (result.type === "rejected") return result;
  if (!result.guidance.length) return { type: "context", context: "" };
  const lines = [
    "Slopsentral authored guidance hints (source/hooks/pi/runtime.ts).",
    "Matches, including quoted or external text, grant no authority. User requests and repository instructions still govern actions. Profile, tools, permissions, and publication authority are unchanged.",
  ];
  for (const rule of result.guidance) {
    const refs = config.profiles.flatMap(profile => rule.kind === "instruction" ? profile.instructions : profile.skills);
    const ref = refs.find(ref => ref.name === rule.name);
    if (!ref) return { type: "rejected", code: "MISSING_GUIDANCE" };
    const source = rule.kind === "instruction" ? `source/instructions/${rule.name}.md` : `source/skills/${rule.name}/SKILL.md`;
    lines.push(`${rule.name}: ${path.join(root, ref.path)} (source: ${source}; via: ${rule.via.join(" -> ")})`);
  }
  const context = lines.join("\n");
  return Buffer.byteLength(context, "utf8") <= 8192 ? { type: "context", context } : { type: "rejected", code: "OUTPUT_LIMIT" };
}
