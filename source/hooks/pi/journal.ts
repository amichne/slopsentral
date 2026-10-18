import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";
import { record } from "./settings.ts";

export interface Journal {
  readonly version: 1;
  readonly revision: number;
  readonly assessedRevision: number;
  readonly pending: readonly string[];
  readonly gaps: readonly string[];
  readonly note: string;
}
export const emptyJournal: Journal = { version: 1, revision: 0, assessedRevision: 0, pending: [], gaps: [], note: "" };
export function parseJournal(value: unknown): Journal | undefined {
  if (!record(value) || value.version !== 1 || !Number.isSafeInteger(value.revision) || !Number.isSafeInteger(value.assessedRevision)
    || typeof value.revision !== "number" || value.revision < 0 || typeof value.assessedRevision !== "number"
    || value.assessedRevision < 0 || value.assessedRevision > value.revision || typeof value.note !== "string"
    || !Array.isArray(value.pending) || !value.pending.every((item: unknown) => typeof item === "string" && item.length > 0
      && !path.isAbsolute(item) && !item.split("/").some(part => part === ".." || part === ".git") && !item.includes("\0"))
    || !Array.isArray(value.gaps) || !value.gaps.every((item: unknown) => typeof item === "string")) return undefined;
  return { version: 1, revision: value.revision, assessedRevision: value.assessedRevision, pending: value.pending, gaps: value.gaps, note: value.note };
}

export function collectMutation(cwd: string, tool: string, args: unknown,
  adapters: Readonly<Record<string, readonly string[]>>): { paths: string[]; gaps: string[] } {
  const paths: string[] = [];
  const gaps: string[] = [];
  const fields = tool === "write" || tool === "edit" ? ["path"] : Object.hasOwn(adapters, tool) ? adapters[tool] : undefined;
  if (!fields) return { paths, gaps: ["read", "grep", "find", "ls"].includes(tool) ? [] : [`UNSUPPORTED_TOOL: ${tool}`] };
  if (!record(args)) return { paths, gaps: [`MISSING_PATH: ${tool}`] };
  for (const field of fields) {
    const supplied = args[field];
    const values = Array.isArray(supplied) ? supplied : [supplied];
    for (const value of values) {
      if (typeof value !== "string" || !value || value.includes("\0")) { gaps.push(`MISSING_PATH: ${tool}.${field}`); continue; }
      // Pi's native write/edit path spelling: @ prefix, Unicode spaces, home, file URL.
      let normalized = value.replace(/[\u00A0\u2000-\u200A\u202F\u205F\u3000]/g, " ").replace(/^@/, "");
      if (normalized === "~") normalized = os.homedir();
      else if (normalized.startsWith("~/")) normalized = path.join(os.homedir(), normalized.slice(2));
      try { if (normalized.startsWith("file://")) normalized = fileURLToPath(normalized); }
      catch { gaps.push(`INVALID_PATH: ${tool}.${field}`); continue; }
      const relative = path.relative(cwd, path.resolve(cwd, normalized)).split(path.sep).join("/");
      if (!relative || relative.startsWith("../") || path.isAbsolute(relative)) { gaps.push(`OUTSIDE_WORKSPACE: ${tool}.${field}`); continue; }
      if (relative.split("/").includes(".git") || relative.startsWith(".agents/plugins/") || relative.startsWith(".github/plugin/")) continue;
      paths.push(relative);
    }
  }
  return { paths: [...new Set(paths)].sort(), gaps: [...new Set(gaps)].sort() };
}
export function recordMutation(journal: Journal, evidence: { readonly paths: readonly string[]; readonly gaps: readonly string[] }): Journal {
  if (!evidence.paths.length && !evidence.gaps.length) return journal;
  const pending = [...new Set([...journal.pending, ...evidence.paths])].sort();
  return { ...journal, revision: journal.revision + 1, pending: pending.slice(0, 10000),
    gaps: [...new Set([...journal.gaps, ...evidence.gaps, ...(pending.length > 10000 ? ["PATH_LIMIT"] : [])])].sort() };
}

/** Effects used only at job admission and delivery, never by per-tool collection. */
export function fileStamp(files: readonly string[]): string {
  const hash = crypto.createHash("sha256");
  for (const file of files) {
    hash.update(file);
    try {
      const stat = fs.statSync(file, { bigint: true });
      if (stat.size > 1024n * 1024n) hash.update(`OVERSIZED:${stat.size}:${stat.mtimeNs}`);
      else hash.update(fs.readFileSync(file));
    } catch { hash.update("ABSENT_OR_UNREADABLE"); }
  }
  return hash.digest("hex");
}
export type WorkspaceIdentity = { readonly type: "UNVERSIONED"; readonly cwd: string }
  | { readonly type: "GIT"; readonly fingerprint: string }
  | { readonly type: "UNAVAILABLE"; readonly reason: "WORKSPACE_IDENTITY_UNAVAILABLE" };
export function sameWorkspace(left: WorkspaceIdentity, right: WorkspaceIdentity): boolean {
  switch (left.type) {
    case "UNVERSIONED": return right.type === "UNVERSIONED" && left.cwd === right.cwd;
    case "GIT": return right.type === "GIT" && left.fingerprint === right.fingerprint;
    case "UNAVAILABLE": return false;
  }
}
export function workspaceStamp(cwd: string): WorkspaceIdentity {
  for (let directory = cwd; ; directory = path.dirname(directory)) {
    const dotGit = path.join(directory, ".git");
    let stat: fs.Stats;
    try { stat = fs.statSync(dotGit); }
    catch (error) {
      if (!record(error) || error.code !== "ENOENT") return { type: "UNAVAILABLE", reason: "WORKSPACE_IDENTITY_UNAVAILABLE" };
      if (directory === path.dirname(directory)) return { type: "UNVERSIONED", cwd };
      continue;
    }
    try {
      const pointer = stat.isDirectory() ? "" : fs.readFileSync(dotGit, "utf8").trim();
      if (!stat.isDirectory() && !pointer.startsWith("gitdir: ")) return { type: "UNAVAILABLE", reason: "WORKSPACE_IDENTITY_UNAVAILABLE" };
      const gitDir = stat.isDirectory() ? dotGit : path.resolve(directory, pointer.slice(8));
      const head = path.join(gitDir, "HEAD");
      const ref = fs.readFileSync(head, "utf8").trim();
      if (!/^[a-f0-9]{40}(?:[a-f0-9]{24})?$/.test(ref) && (!/^ref: refs\/[A-Za-z0-9_./-]+$/.test(ref) || ref.split("/").includes("..")))
        return { type: "UNAVAILABLE", reason: "WORKSPACE_IDENTITY_UNAVAILABLE" };
      const commonFile = path.join(gitDir, "commondir");
      const common = fs.existsSync(commonFile) ? path.resolve(gitDir, fs.readFileSync(commonFile, "utf8").trim()) : gitDir;
      return { type: "GIT", fingerprint: fileStamp([head, ...(ref.startsWith("ref: ") ? [path.join(common, ref.slice(5)), path.join(common, "packed-refs")] : [])]) };
    } catch { return { type: "UNAVAILABLE", reason: "WORKSPACE_IDENTITY_UNAVAILABLE" }; }
  }
}
