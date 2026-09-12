import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { validateWorkflowProfile, ProfileContractError } from "./validate-profile-contracts.mjs";

const packageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

/** @typedef {{type: "CONTEXT_FAILURE", stage: string, reason: string}} ContextFailure */
const failure = (stage, reason) => ({ type: "CONTEXT_FAILURE", stage, reason });

function entryAt(target) {
  try {
    return { type: "ENTRY_PRESENT", stat: fs.lstatSync(target) };
  } catch (error) {
    return error.code === "ENOENT"
      ? { type: "ENTRY_ABSENT" }
      : failure("DISCOVER_REPOSITORY", "PATH_UNREADABLE");
  }
}

export function discoverRepository(start) {
  let directory;
  try {
    directory = fs.realpathSync(start);
    if (!fs.statSync(directory).isDirectory()) return failure("DISCOVER_REPOSITORY", "NOT_A_DIRECTORY");
  } catch {
    return failure("DISCOVER_REPOSITORY", "PATH_UNREADABLE");
  }
  for (let candidate = directory; ; candidate = path.dirname(candidate)) {
    const marker = entryAt(path.join(candidate, ".git"));
    if (marker.type === "CONTEXT_FAILURE") return marker;
    if (marker.type === "ENTRY_PRESENT") {
      if (marker.stat.isSymbolicLink()) return failure("DISCOVER_REPOSITORY", "SYMLINKED_GIT_MARKER");
      const environment = { ...process.env };
      for (const key of ["GIT_DIR", "GIT_WORK_TREE", "GIT_COMMON_DIR", "GIT_INDEX_FILE", "GIT_CEILING_DIRECTORIES"]) {
        delete environment[key];
      }
      const result = spawnSync("git", ["-C", candidate, "rev-parse", "--show-toplevel"], {
        encoding: "utf8", env: environment, timeout: 5000, maxBuffer: 16 * 1024,
      });
      if (result.error || result.status !== 0) return failure("DISCOVER_REPOSITORY", "GIT_ROOT_UNAVAILABLE");
      try {
        const root = fs.realpathSync(result.stdout.trim());
        if (root !== candidate) return failure("DISCOVER_REPOSITORY", "GIT_ROOT_MISMATCH");
        return { type: "REPOSITORY_ROOT", repositoryRoot: root, authority: "GIT" };
      } catch {
        return failure("DISCOVER_REPOSITORY", "GIT_ROOT_UNAVAILABLE");
      }
    }
    if (path.dirname(candidate) === candidate) break;
  }
  return { type: "REPOSITORY_ROOT", repositoryRoot: directory, authority: "EXPLICIT_DIRECTORY" };
}

export function selectRepositoryProfile(root, profiles) {
  const matches = [];
  for (const profile of profiles) {
    if (!profile.activation) continue;
    const anchor = path.join(root.repositoryRoot, profile.activation.path);
    const entry = entryAt(anchor);
    if (entry.type === "CONTEXT_FAILURE") return entry;
    if (entry.type === "ENTRY_ABSENT") continue;
    if (!entry.stat.isFile() || entry.stat.isSymbolicLink()) {
      return failure("MATCH_PROFILE", "ANCHOR_NOT_REGULAR_FILE");
    }
    matches.push({
      type: "REPOSITORY_PROFILE_SELECTED",
      profileName: profile.name,
      repositoryRoot: root.repositoryRoot,
      anchor,
      plugins: [...profile.plugins],
    });
  }
  if (matches.length > 1) return failure("MATCH_PROFILE", "AMBIGUOUS_PROFILES");
  return matches.length === 1 ? matches[0] : {
    type: "REPOSITORY_CONTEXT_UNMATCHED", repositoryRoot: root.repositoryRoot,
  };
}

export function inspectRepository(options) {
  const root = discoverRepository(options.repo);
  if (root.type === "CONTEXT_FAILURE") return root;
  let profiles;
  try {
    const directory = path.join(packageRoot, "source/profiles");
    profiles = fs.readdirSync(directory).filter(name => name.endsWith(".json")).sort().map(name => {
      const value = validateWorkflowProfile(JSON.parse(fs.readFileSync(path.join(directory, name), "utf8")), name);
      if (value.name !== name.slice(0, -5)) throw new Error("profile identity mismatch");
      return value;
    });
  } catch (error) {
    return failure("LOAD_PROFILES", error instanceof ProfileContractError ? "INVALID_PROFILE_CONTRACT" : "PROFILE_UNREADABLE");
  }
  return selectRepositoryProfile(root, profiles);
}

export function runContextCommand(argv) {
  const [action, ...rest] = argv;
  if (action !== "plan") return failure("PARSE_REQUEST", "UNSUPPORTED_ACTION");
  const options = { repo: process.cwd() };
  const seen = new Set();
  for (let index = 0; index < rest.length; index += 2) {
    const key = rest[index];
    const value = rest[index + 1];
    if (!["--repo", "--codex-home", "--backup-root"].includes(key) || seen.has(key) || !value || value.startsWith("--")) {
      return failure("PARSE_REQUEST", "INVALID_OPTION");
    }
    seen.add(key);
    if (key === "--repo") options.repo = path.resolve(value);
  }
  const selection = inspectRepository(options);
  return selection.type === "REPOSITORY_PROFILE_SELECTED"
    ? { type: "REPOSITORY_CONTEXT_PLAN", selection }
    : selection;
}
