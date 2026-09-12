import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import crypto from "node:crypto";
import { isDeepStrictEqual } from "node:util";
import { parse as parseToml } from "smol-toml";
import { validateWorkflowProfile, ProfileContractError } from "./validate-profile-contracts.mjs";
import { apply, commitMutation, fileImage, desiredImage, sameImage } from "./profile-lifecycle.mjs";

const packageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

/** @typedef {{type: "CONTEXT_FAILURE", stage: string, reason: string}} ContextFailure */
const failure = (stage, reason) => ({ type: "CONTEXT_FAILURE", stage, reason });
const conflict = (reason) => ({ type: "CONTEXT_CONFLICT", stage: "PREPARE_CONFIG", reason });
const digest = (text) => crypto.createHash("sha256").update(text).digest("hex");
const beginMarker = "# slopsentral-context:begin";
const endMarker = "# slopsentral-context:end\n";
const configLimit = 1024 * 1024;

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
    matches.push(Object.freeze({
      type: "REPOSITORY_PROFILE_SELECTED",
      profileName: profile.name,
      repositoryRoot: root.repositoryRoot,
      anchor,
      plugins: Object.freeze([...profile.plugins]),
    }));
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

function splitManagedConfig(content) {
  const start = content.indexOf(beginMarker);
  if (start === -1) return content.includes("# slopsentral-context:")
    ? conflict("INVALID_MANAGED_BLOCK")
    : { type: "UNMANAGED_CONFIG", base: content };
  if (start === 0 || content[start - 1] !== "\n" || content.indexOf(beginMarker, start + 1) !== -1) {
    return conflict("INVALID_MANAGED_BLOCK");
  }
  const header = /^# slopsentral-context:begin v1 ([a-z0-9]+(?:-[a-z0-9]+)*) (ABSENT|PRESENT) ([a-f0-9]{64})\n/u.exec(content.slice(start));
  if (!header) return conflict("INVALID_MANAGED_BLOCK");
  const bodyStart = start + header[0].length;
  const end = content.indexOf(endMarker, bodyStart);
  if (end === -1 || content.indexOf(endMarker, end + endMarker.length) !== -1) return conflict("INVALID_MANAGED_BLOCK");
  const body = content.slice(bodyStart, end);
  if (digest(body) !== header[3]) return conflict("MANAGED_BLOCK_CHANGED");
  const prefix = content.slice(0, start - 1);
  const suffix = content.slice(end + endMarker.length);
  const base = prefix + (prefix && !prefix.endsWith("\n") && suffix ? "\n" : "") + suffix;
  return { type: "MANAGED_CONFIG", base, body, profileName: header[1], origin: header[2] };
}

function readProjectConfig(repositoryRoot) {
  const directory = path.join(repositoryRoot, ".codex");
  const entry = entryAt(directory);
  if (entry.type === "CONTEXT_FAILURE") return entry;
  if (entry.type === "ENTRY_PRESENT" && (!entry.stat.isDirectory() || entry.stat.isSymbolicLink())) {
    return conflict("CONFIG_DIRECTORY_NOT_REGULAR");
  }
  const target = path.join(directory, "config.toml");
  let before;
  try {
    const targetEntry = entryAt(target);
    if (targetEntry.type === "CONTEXT_FAILURE") return targetEntry;
    if (targetEntry.type === "ENTRY_PRESENT" &&
        (!targetEntry.stat.isFile() || targetEntry.stat.isSymbolicLink() || targetEntry.stat.size > configLimit)) {
      return conflict("CONFIG_NOT_REGULAR_OR_TOO_LARGE");
    }
    before = fileImage(target);
  } catch {
    return conflict("CONFIG_UNREADABLE");
  }
  const content = before.type === "FILE_CONTENT" ? before.content.toString("utf8") : "";
  if (before.type === "FILE_CONTENT" && !Buffer.from(content).equals(before.content)) return conflict("CONFIG_NOT_UTF8");
  const split = splitManagedConfig(content);
  if (split.type === "CONTEXT_CONFLICT") return split;
  try {
    // Parse both the original document and the remaining user document. This
    // rejects table collisions and markers embedded in a TOML string.
    const original = parseToml(content);
    const parsed = parseToml(split.base);
    if (split.type === "MANAGED_CONFIG" && !isDeepStrictEqual(original, parseToml(`${split.base}\n${split.body}`))) {
      return conflict("MANAGED_BLOCK_SCOPE_CHANGED");
    }
    return { type: "PROJECT_CONFIG", target, before, split, parsed };
  } catch {
    return conflict("INVALID_TOML");
  }
}

function isTable(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value) && !(value instanceof Date);
}

function prepareContext(options) {
  const selection = inspectRepository(options);
  if (selection.type === "CONTEXT_FAILURE") return selection;
  const config = readProjectConfig(selection.repositoryRoot);
  if (config.type !== "PROJECT_CONFIG") return config;
  const { before, split, parsed } = config;
  const mode = before.type === "FILE_CONTENT" ? before.mode : 0o600;
  let desired;
  let profileName;
  if (selection.type === "REPOSITORY_CONTEXT_UNMATCHED") {
    if (split.type === "UNMANAGED_CONFIG") return selection;
    profileName = split.profileName;
    desired = split.origin === "ABSENT" && split.base === ""
      ? { type: "FILE_ABSENT" }
      : desiredImage(Buffer.from(split.base), mode);
  } else {
    profileName = selection.profileName;
    if (parsed.plugins !== undefined && !isTable(parsed.plugins)) return conflict("INVALID_PLUGIN_TABLE");
    const lines = [];
    for (const name of selection.plugins) {
      const id = `${name}@slopsentral`;
      const existing = parsed.plugins?.[id];
      if (existing !== undefined) {
        if (!isTable(existing) || existing.enabled !== true) return conflict("PLUGIN_NOT_ENABLED_BY_USER");
        continue;
      }
      lines.push(`[plugins.${JSON.stringify(id)}]`, "enabled = true", "");
    }
    const body = lines.join("\n");
    const origin = split.type === "MANAGED_CONFIG" ? split.origin : before.type === "FILE_ABSENT" ? "ABSENT" : "PRESENT";
    const content = split.base + (body
      ? `\n${beginMarker} v1 ${profileName} ${origin} ${digest(body)}\n${body}${endMarker}`
      : "");
    try {
      parseToml(content);
    } catch {
      return conflict("PLUGIN_TABLE_COLLISION");
    }
    desired = desiredImage(Buffer.from(content), mode);
  }
  const mutation = sameImage(before, desired) ? "FILE_UNCHANGED"
    : desired.type === "FILE_ABSENT" ? "FILE_REMOVE_PLANNED"
    : before.type === "FILE_ABSENT" ? "FILE_CREATE_PLANNED" : "FILE_REPLACE_PLANNED";
  return { type: "PREPARED_CONTEXT", selection, profileName, config, desired, mutation };
}

function publicPlan(prepared) {
  return {
    type: "REPOSITORY_CONTEXT_PLAN",
    selection: prepared.selection,
    mutation: { type: prepared.mutation, target: prepared.config.target },
    pluginPolicy: "PRESERVE_UNSELECTED",
  };
}

export function applyRepositoryContext(options) {
  const initial = prepareContext(options);
  if (initial.type !== "PREPARED_CONTEXT") return initial;
  const directory = path.dirname(initial.config.target);
  const lockPath = path.join(directory, ".slopsentral-context.lock");
  let lock;
  try {
    fs.mkdirSync(directory, { recursive: true });
    lock = fs.openSync(lockPath, "wx", 0o600);
  } catch (error) {
    return error.code === "EEXIST" ? conflict("ACTIVATION_IN_PROGRESS") : failure("LOCK_CONFIG", "IO_FAILURE");
  }
  try {
    const prepared = prepareContext(options);
    if (prepared.type !== "PREPARED_CONTEXT") return prepared;
    if (prepared.config.target !== initial.config.target) return conflict("REPOSITORY_CONTEXT_CHANGED");
    if (options.action === "hook" && prepared.mutation === "FILE_UNCHANGED") {
      return { type: "REPOSITORY_CONTEXT_UP_TO_DATE", selection: prepared.selection, target: prepared.config.target };
    }
    let tooling;
    if (prepared.selection.type === "REPOSITORY_PROFILE_SELECTED") {
      try {
        tooling = apply({ ...options, profile: prepared.profileName, replaceExisting: false, commandTimeoutMs: 10000 });
        if (tooling.type === "PLUGIN_INVENTORY_FAILED") return failure(tooling.stage, tooling.reason);
      } catch (error) {
        return error.reason ? conflict("PROFILE_OVERLAY_CONFLICT") : failure("PREPARE_TOOLS", "PROFILE_SETUP_FAILED");
      }
    }
    // A plugin install can take time. Recheck the anchor and user file before
    // committing the prepared image, while still holding our per-repo lock.
    const current = prepareContext(options);
    if (current.type !== "PREPARED_CONTEXT" ||
        current.profileName !== prepared.profileName ||
        current.selection.type !== prepared.selection.type ||
        !sameImage(current.config.before, prepared.config.before) ||
        !sameImage(current.desired, prepared.desired)) return conflict("REPOSITORY_CONTEXT_CHANGED");
    const common = { selection: prepared.selection, target: prepared.config.target };
    if (prepared.mutation === "FILE_UNCHANGED") {
      return { type: "REPOSITORY_CONTEXT_UP_TO_DATE", ...common, ...(tooling ? { tooling } : {}) };
    }
    const transaction = commitMutation({
      backupRoot: options.backupRoot,
      operation: {
        type: "APPLY_REPOSITORY_PROFILE",
        profileName: prepared.profileName,
        repositoryRoot: prepared.selection.repositoryRoot,
      },
      target: prepared.config.target,
      before: prepared.config.before,
      desired: prepared.desired,
    });
    return {
      type: prepared.selection.type === "REPOSITORY_PROFILE_SELECTED" ? "REPOSITORY_CONTEXT_APPLIED" : "REPOSITORY_CONTEXT_REMOVED",
      ...common, transaction, ...(tooling ? { tooling } : {}),
    };
  } catch {
    return failure("WRITE_CONFIG", "IO_FAILURE");
  } finally {
    fs.closeSync(lock);
    fs.rmSync(lockPath);
  }
}

function hookInput() {
  const buffer = Buffer.alloc(64 * 1024 + 1);
  let length = 0;
  try {
    while (length < buffer.length) {
      const count = fs.readSync(0, buffer, length, buffer.length - length, null);
      if (count === 0) break;
      length += count;
    }
    if (length === buffer.length) return failure("READ_HOOK", "INVALID_HOOK_INPUT");
    const input = JSON.parse(buffer.subarray(0, length).toString("utf8"));
    if (!input || input.hook_event_name !== "SessionStart" ||
        !["startup", "resume", "clear", "compact"].includes(input.source) ||
        typeof input.cwd !== "string" || !path.isAbsolute(input.cwd)) return failure("READ_HOOK", "INVALID_HOOK_INPUT");
    return { type: "SESSION_START_INPUT", source: input.source, repo: input.cwd };
  } catch {
    return failure("READ_HOOK", "INVALID_HOOK_INPUT");
  }
}

function hookOutput(result) {
  if (["REPOSITORY_CONTEXT_APPLIED", "REPOSITORY_CONTEXT_REMOVED"].includes(result.type)) {
    return { systemMessage: "Repository tooling configuration updated automatically. Codex loads it in the next session; use slopsentral context launch for activation before terminal startup." };
  }
  if (["CONTEXT_FAILURE", "CONTEXT_CONFLICT"].includes(result.type)) {
    return { systemMessage: `Repository profile activation: ${result.stage} / ${result.reason}.` };
  }
  return {};
}

function parseContextArgs(argv) {
  const [action, ...rest] = argv;
  if (!["plan", "status", "apply", "hook", "launch"].includes(action)) return failure("PARSE_REQUEST", "UNSUPPORTED_ACTION");
  const options = { action, repo: process.cwd(), codexArgs: [] };
  const seen = new Set();
  for (let index = 0; index < rest.length; index += 2) {
    const key = rest[index];
    if (key === "--" && action === "launch") {
      options.codexArgs = rest.slice(index + 1);
      break;
    }
    const value = rest[index + 1];
    if (!["--repo", "--codex-home", "--backup-root"].includes(key) || seen.has(key) || !value || value.startsWith("--")) {
      return failure("PARSE_REQUEST", "INVALID_OPTION");
    }
    seen.add(key);
    const field = key === "--repo" ? "repo" : key === "--codex-home" ? "codexHome" : "backupRoot";
    options[field] = path.resolve(value);
  }
  if (action === "hook" && seen.has("--repo")) return failure("PARSE_REQUEST", "INVALID_OPTION");
  options.codexHome ??= process.env.CODEX_HOME ? path.resolve(process.env.CODEX_HOME)
    : process.env.HOME ? path.join(process.env.HOME, ".codex") : undefined;
  if (!options.codexHome) return failure("PARSE_REQUEST", "CODEX_HOME_UNAVAILABLE");
  options.backupRoot ??= process.env.SLOPSENTRAL_BACKUP_ROOT
    ? path.resolve(process.env.SLOPSENTRAL_BACKUP_ROOT) : path.join(options.codexHome, "backups/slopsentral");
  if (options.codexArgs.some(arg => arg === "-C" || arg.startsWith("-C") || arg === "--cd" || arg.startsWith("--cd=") || arg.startsWith("--remote"))) {
    return failure("PARSE_REQUEST", "USE_REPO_OPTION_FOR_LAUNCH");
  }
  return { type: "CONTEXT_OPTIONS", ...options };
}

export function contextExitCode(result) {
  if (result.type === "CONTEXT_CONFLICT") return 3;
  if (result.type !== "CONTEXT_FAILURE") return 0;
  return ["PARSE_REQUEST", "LOAD_PROFILES", "MATCH_PROFILE"].includes(result.stage) ? 2 : 1;
}

export function runContextCommand(argv) {
  const options = parseContextArgs(argv);
  if (options.type === "CONTEXT_FAILURE") return options;
  if (options.action === "hook") {
    const input = hookInput();
    if (input.type === "CONTEXT_FAILURE") return hookOutput(input);
    if (["clear", "compact"].includes(input.source)) return {};
    return hookOutput(applyRepositoryContext({ ...options, repo: input.repo }));
  }
  if (["plan", "status"].includes(options.action)) {
    const prepared = prepareContext(options);
    if (prepared.type !== "PREPARED_CONTEXT") return prepared;
    const plan = publicPlan(prepared);
    return options.action === "plan" ? plan : {
      ...plan, type: prepared.mutation === "FILE_UNCHANGED" ? "REPOSITORY_CONTEXT_CONFIGURED" : "REPOSITORY_CONTEXT_CHANGES_REQUIRED",
    };
  }
  const result = applyRepositoryContext(options);
  if (options.action !== "launch" || contextExitCode(result) !== 0) return result;
  const child = spawnSync("codex", options.codexArgs, {
    cwd: options.repo, env: { ...process.env, CODEX_HOME: options.codexHome }, stdio: "inherit",
  });
  if (child.error) return failure("LAUNCH_CODEX", "CODEX_UNAVAILABLE");
  return { type: "CONTEXT_LAUNCH_EXIT", exitCode: Number.isInteger(child.status) ? child.status : 1 };
}
