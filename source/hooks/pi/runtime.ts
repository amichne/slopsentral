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
type FailureCode = "INVALID_CONFIG" | "UNKNOWN_PROFILE" | "INVALID_OUTPUT" | "EXIT_FAILED" | "LAUNCH_FAILED" | "TIMED_OUT" | "ABORTED" | "OUTPUT_LIMIT" | "QUEUE_FULL" | "STALE_CONTEXT" | "ADAPTER_FAILED" | "CANCEL_FAILED";
export type Rejected = { readonly type: "rejected"; readonly code: FailureCode }
  | { readonly type: "rejected"; readonly code: "BLOCKED"; readonly reason: string; readonly assessment?: "ASSESSED" | "FAILED" };
export type HookResult = (Rejected | { readonly type: "completed"; readonly context: string; readonly notice: string }) & { readonly diagnostics?: string };
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
    if (value.assessment !== undefined && value.assessment !== "ASSESSED" && value.assessment !== "FAILED")
      return { type: "rejected", code: "INVALID_OUTPUT" };
    return { type: "rejected", code: "BLOCKED", reason: reason.slice(0, 32768),
      ...(value.assessment === undefined ? {} : { assessment: value.assessment }) };
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
    const child = spawn(command, args, { cwd, env: { ...process.env, PLUGIN_ROOT: pluginRoot }, detached: process.platform !== "win32", stdio: ["pipe", "pipe", "pipe"] });
    const chunks: Buffer[] = [];
    const stderr: Buffer[] = [];
    let bytes = 0;
    let rejection: Rejected | undefined;
    let escalation: Promise<void> = Promise.resolve();
    const stop = (code: FailureCode) => {
      if (rejection) return;
      rejection = { type: "rejected", code };
      const kill = (signalName: NodeJS.Signals) => {
        try { if (child.pid && process.platform !== "win32") process.kill(-child.pid, signalName); else child.kill(signalName); }
        catch (error) {
          if (record(error) && error.code === "ESRCH") return;
          rejection = { type: "rejected", code: record(error) && error.code === "EPERM" ? "CANCEL_FAILED" : "ADAPTER_FAILED" };
          try { child.kill(signalName); } catch { rejection = { type: "rejected", code: "ADAPTER_FAILED" }; }
        }
      };
      kill("SIGTERM");
      escalation = new Promise(done => { setTimeout(() => { kill("SIGKILL"); done(); }, 250); });
    };
    const abort = () => stop("ABORTED");
    const timer = setTimeout(() => stop("TIMED_OUT"), action.timeout * 1000);
    signal?.addEventListener("abort", abort, { once: true });
    if (signal?.aborted) abort();
    child.stdout.on("data", (chunk: Buffer) => {
      bytes += chunk.length;
      if (bytes > limit) stop("OUTPUT_LIMIT"); else chunks.push(chunk);
    });
    child.stderr.on("data", (chunk: Buffer) => {
      bytes += chunk.length;
      if (bytes > limit) stop("OUTPUT_LIMIT"); else stderr.push(chunk);
    });
    child.stdin.on("error", (error: NodeJS.ErrnoException) => { if (error.code !== "EPIPE") stop("LAUNCH_FAILED"); });
    child.on("error", () => { rejection ??= { type: "rejected", code: "LAUNCH_FAILED" }; });
    child.on("close", async code => {
      clearTimeout(timer);
      signal?.removeEventListener("abort", abort);
      await escalation;
      const result = rejection ?? decodeHook(Buffer.concat(chunks).toString("utf8"), code ?? -1, action.event);
      const diagnostics = Buffer.concat(stderr).toString("utf8").slice(0, 16384);
      resolve(diagnostics ? { ...result, diagnostics } : result);
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
