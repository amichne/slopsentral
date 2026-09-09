#!/usr/bin/env node
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import {
  ProfileContractError,
  validateProfileTransaction,
  validateWorkflowProfile,
} from "./validate-profile-contracts.mjs";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const managedMarker = "# slopsentral-managed-profile:";
const marketplaceName = "slopsentral";

function sha256(content) {
  return `sha256:${crypto.createHash("sha256").update(content).digest("hex")}`;
}

function ordered(values) {
  return [...values].sort((left, right) => left.localeCompare(right, "en"));
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

function assertExactKeys(value, expected, label) {
  const unexpected = Object.keys(value).filter((key) => !expected.includes(key));
  if (unexpected.length > 0) throw new UsageError(`${label} has unsupported fields: ${unexpected.join(", ")}`);
}

function parseWorkflowProfile(value, expectedName) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new UsageError(`profile ${expectedName} must be an object`);
  }
  assertExactKeys(
    value,
    ["type", "schemaVersion", "name", "description", "marketplaces", "plugins", "hooks", "validation"],
    `profile ${expectedName}`,
  );
  if (value.type !== "WORKFLOW_PROFILE" || value.schemaVersion !== 1 || value.name !== expectedName) {
    throw new UsageError(`profile ${expectedName} has an invalid identity`);
  }
  if (!Array.isArray(value.plugins) || value.plugins.some((name) => typeof name !== "string" || !name)) {
    throw new UsageError(`profile ${expectedName}.plugins must contain names`);
  }
  if (new Set(value.plugins).size !== value.plugins.length) {
    throw new UsageError(`profile ${expectedName}.plugins contains duplicates`);
  }
  return Object.freeze({ name: value.name, plugins: Object.freeze([...value.plugins]) });
}

function loadInputs(profileName) {
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/u.test(profileName)) {
    throw new UsageError("profile name must be kebab-case");
  }
  const profilePath = path.join(repoRoot, "source/profiles", `${profileName}.json`);
  if (!fs.existsSync(profilePath)) throw new UsageError(`unknown profile: ${profileName}`);
  const rawProfile = readJson(profilePath);
  validateWorkflowProfile(rawProfile, path.relative(repoRoot, profilePath));
  const profile = parseWorkflowProfile(rawProfile, profileName);
  const marketplace = readJson(path.join(repoRoot, "source/adaptable.marketplace.json"));
  const available = ordered((marketplace.plugins ?? []).map((entry) => entry.name));
  const unknown = profile.plugins.filter((name) => !available.includes(name));
  if (unknown.length > 0) throw new UsageError(`profile references unknown plugins: ${unknown.join(", ")}`);
  return { profile, available };
}

function quoteTomlKey(value) {
  return JSON.stringify(value);
}

function renderProfile(profile, available) {
  const selected = new Set(profile.plugins);
  const lines = [
    `${managedMarker} ${profile.name}`,
    `# source-sha256: ${sha256(Buffer.from(JSON.stringify({ profile, available })))}`,
    "# Generated from source/profiles; change the source profile and re-apply.",
    "",
  ];
  for (const plugin of available) {
    lines.push(`[plugins.${quoteTomlKey(`${plugin}@${marketplaceName}`)}]`);
    lines.push(`enabled = ${selected.has(plugin) ? "true" : "false"}`);
    lines.push("");
  }
  return Buffer.from(lines.join("\n"));
}

function fileImage(file) {
  let stat;
  try {
    stat = fs.lstatSync(file);
  } catch (error) {
    if (error.code === "ENOENT") return Object.freeze({ type: "FILE_ABSENT" });
    throw error;
  }
  if (!stat.isFile()) throw new ConflictError(file, { type: "TARGET_NOT_REGULAR_FILE" });
  const content = fs.readFileSync(file);
  return Object.freeze({
    type: "FILE_CONTENT",
    sha256: sha256(content),
    sizeBytes: content.byteLength,
    mode: stat.mode & 0o777,
    content,
  });
}

function publicImage(image) {
  if (image.type === "FILE_ABSENT") return image;
  return { type: "FILE_CONTENT", sha256: image.sha256, sizeBytes: image.sizeBytes, mode: image.mode };
}

function sameImage(left, right) {
  if (left.type !== right.type) return false;
  return left.type === "FILE_ABSENT" ||
    (left.sha256 === right.sha256 && left.sizeBytes === right.sizeBytes && left.mode === right.mode);
}

function isManagedProfile(image, profileName) {
  return image.type === "FILE_CONTENT" &&
    image.content.toString("utf8").split("\n", 1)[0] === `${managedMarker} ${profileName}`;
}

function newTransactionId(now = new Date()) {
  const timestamp = now.toISOString().replaceAll(/[-:.]/gu, "");
  return `${timestamp}-${crypto.randomUUID()}`;
}

function atomicWrite(file, content, mode = 0o600) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const temporary = path.join(path.dirname(file), `.${path.basename(file)}.${crypto.randomUUID()}.tmp`);
  try {
    fs.writeFileSync(temporary, content, { mode });
    fs.chmodSync(temporary, mode);
    fs.renameSync(temporary, file);
  } finally {
    if (fs.existsSync(temporary)) fs.rmSync(temporary);
  }
}

function writeManifest(transactionDirectory, manifest) {
  const manifestPath = path.join(transactionDirectory, "manifest.json");
  atomicWrite(manifestPath, Buffer.from(`${JSON.stringify(manifest, null, 2)}\n`));
  return manifestPath;
}

function storedBefore(transactionDirectory, image) {
  if (image.type === "FILE_ABSENT") return image;
  const backupPath = "files/000-before";
  const absoluteBackup = path.join(transactionDirectory, backupPath);
  fs.mkdirSync(path.dirname(absoluteBackup), { recursive: true });
  fs.writeFileSync(absoluteBackup, image.content, { flag: "wx", mode: 0o600 });
  const copied = fs.readFileSync(absoluteBackup);
  if (sha256(copied) !== image.sha256) throw new Error("backup verification failed");
  return { ...publicImage(image), type: "STORED_FILE_CONTENT", backupPath };
}

function changeFor(target, before, after) {
  if (before.type === "FILE_ABSENT" && after.type === "FILE_CONTENT") {
    return { type: "FILE_CREATED", target, before, after: publicImage(after) };
  }
  if (before.type === "STORED_FILE_CONTENT" && after.type === "FILE_ABSENT") {
    return { type: "FILE_REMOVED", target, before, after };
  }
  if (before.type === "STORED_FILE_CONTENT" && after.type === "FILE_CONTENT") {
    return { type: "FILE_REPLACED", target, before, after: publicImage(after) };
  }
  throw new Error("unchanged images cannot form a transaction change");
}

function commitMutation({ backupRoot, operation, target, before, desired }) {
  const id = newTransactionId();
  const transactionDirectory = path.join(backupRoot, operation.profileName, id);
  fs.mkdirSync(path.dirname(transactionDirectory), { recursive: true });
  fs.mkdirSync(transactionDirectory);
  const backedUpBefore = storedBefore(transactionDirectory, before);
  const after = desired.type === "FILE_ABSENT"
    ? desired
    : { ...publicImage(desired), content: desired.content };
  const change = changeFor(target, backedUpBefore, after);
  const base = {
    type: "PROFILE_TRANSACTION",
    schemaVersion: 1,
    id,
    createdAt: new Date().toISOString(),
    operation,
    lifecycle: { type: "PREPARED_TRANSACTION" },
    changes: [change],
  };
  validateProfileTransaction(base, "prepared transaction");
  const manifestPath = writeManifest(transactionDirectory, base);

  if (desired.type === "FILE_ABSENT") {
    fs.rmSync(target);
  } else {
    atomicWrite(target, desired.content, desired.mode);
  }

  const committed = {
    ...base,
    lifecycle: { type: "COMMITTED_TRANSACTION", committedAt: new Date().toISOString() },
  };
  validateProfileTransaction(committed, "committed transaction");
  writeManifest(transactionDirectory, committed);
  return { type: "COMMITTED_TRANSACTION", id, manifestPath };
}

function desiredImage(content, mode) {
  return Object.freeze({
    type: "FILE_CONTENT",
    sha256: sha256(content),
    sizeBytes: content.byteLength,
    mode,
    content,
  });
}

function profileContext(options) {
  const { profile, available } = loadInputs(requiredOption(options, "profile"));
  const target = path.join(options.codexHome, `${profile.name}.config.toml`);
  const before = fileImage(target);
  const content = renderProfile(profile, available);
  const mode = before.type === "FILE_CONTENT" ? before.mode : 0o600;
  const desired = desiredImage(content, mode);
  return { profile, target, before, desired };
}

function plan(options) {
  const context = profileContext(options);
  const mutation = sameImage(context.before, context.desired)
    ? { type: "FILE_UNCHANGED", target: context.target }
    : context.before.type === "FILE_ABSENT"
      ? { type: "FILE_CREATE_PLANNED", target: context.target }
      : { type: "FILE_REPLACE_PLANNED", target: context.target };
  return {
    type: "PROFILE_PLAN",
    schemaVersion: 1,
    profileName: context.profile.name,
    backupRoot: options.backupRoot,
    mutation,
  };
}

function apply(options) {
  const context = profileContext(options);
  if (sameImage(context.before, context.desired)) {
    return { type: "PROFILE_UP_TO_DATE", schemaVersion: 1, profileName: context.profile.name, target: context.target };
  }
  if (context.before.type === "FILE_CONTENT" &&
      !isManagedProfile(context.before, context.profile.name) && !options.replaceExisting) {
    throw new ConflictError(context.target, { type: "UNMANAGED_TARGET" });
  }
  const transaction = commitMutation({
    backupRoot: options.backupRoot,
    operation: { type: "APPLY_PROFILE", profileName: context.profile.name },
    target: context.target,
    before: context.before,
    desired: context.desired,
  });
  return { type: "PROFILE_APPLIED", schemaVersion: 1, profileName: context.profile.name, target: context.target, transaction };
}

function readStoredImage(transactionDirectory, image) {
  if (image.type === "FILE_ABSENT") return image;
  if (image.type !== "STORED_FILE_CONTENT") throw new UsageError("transaction before-image is not restorable");
  const backup = path.resolve(transactionDirectory, image.backupPath);
  if (!backup.startsWith(`${path.resolve(transactionDirectory)}${path.sep}`)) {
    throw new UsageError("transaction backup path escapes its directory");
  }
  const content = fs.readFileSync(backup);
  if (sha256(content) !== image.sha256 || content.byteLength !== image.sizeBytes) {
    throw new ConflictError(backup, { type: "BACKUP_CONTENT_MISMATCH" });
  }
  return { type: "FILE_CONTENT", sha256: image.sha256, sizeBytes: image.sizeBytes, mode: image.mode, content };
}

function assertRestorableTransaction(value) {
  validateProfileTransaction(value);
  if (!value || value.type !== "PROFILE_TRANSACTION" || value.schemaVersion !== 1 ||
      !["PREPARED_TRANSACTION", "COMMITTED_TRANSACTION"].includes(value.lifecycle?.type) ||
      !Array.isArray(value.changes) || value.changes.length !== 1) {
    throw new UsageError("rollback requires a prepared or committed single-file profile transaction");
  }
  return value;
}

function rollback(options) {
  const manifestPath = path.resolve(requiredOption(options, "transaction"));
  const resolvedBackupRoot = path.resolve(options.backupRoot);
  if (!manifestPath.startsWith(`${resolvedBackupRoot}${path.sep}`) || path.basename(manifestPath) !== "manifest.json") {
    throw new UsageError("transaction manifest must be inside the configured backup root");
  }
  let transaction = assertRestorableTransaction(readJson(manifestPath));
  const expectedManifestPath = path.join(
    resolvedBackupRoot,
    transaction.operation.profileName,
    transaction.id,
    "manifest.json",
  );
  if (manifestPath !== expectedManifestPath) {
    throw new UsageError("transaction manifest path does not match its typed identity");
  }
  const change = transaction.changes[0];
  const current = fileImage(change.target);
  if (transaction.lifecycle.type === "PREPARED_TRANSACTION") {
    if (sameImage(current, publicImage(change.before))) {
      return {
        type: "PROFILE_ALREADY_RESTORED",
        schemaVersion: 1,
        profileName: transaction.operation.profileName,
        target: change.target,
      };
    }
    if (sameImage(current, change.after)) {
      transaction = {
        ...transaction,
        lifecycle: { type: "COMMITTED_TRANSACTION", committedAt: new Date().toISOString() },
      };
      validateProfileTransaction(transaction, manifestPath);
      writeManifest(path.dirname(manifestPath), transaction);
    }
  }
  if (!sameImage(current, change.after)) {
    throw new ConflictError(change.target, {
      type: "CURRENT_CONTENT_MISMATCH",
      expected: publicImage(change.after),
      actual: publicImage(current),
    });
  }
  const desired = readStoredImage(path.dirname(manifestPath), change.before);
  const profileName = transaction.operation.profileName;
  const rollbackTransaction = commitMutation({
    backupRoot: options.backupRoot,
    operation: { type: "ROLLBACK_PROFILE", profileName, reversesTransactionId: transaction.id },
    target: change.target,
    before: current,
    desired,
  });
  return {
    type: "PROFILE_ROLLED_BACK",
    schemaVersion: 1,
    profileName,
    target: change.target,
    transaction: rollbackTransaction,
  };
}

function status(options) {
  const context = profileContext(options);
  return sameImage(context.before, context.desired)
    ? { type: "PROFILE_UP_TO_DATE", schemaVersion: 1, profileName: context.profile.name, target: context.target }
    : {
        type: "PROFILE_CHANGES_REQUIRED",
        schemaVersion: 1,
        profileName: context.profile.name,
        target: context.target,
        current: publicImage(context.before),
        desired: publicImage(context.desired),
      };
}

class UsageError extends Error {}
class ConflictError extends Error {
  constructor(target, reason) {
    super(`conflict at ${target}`);
    this.target = target;
    this.reason = reason;
  }
}

function requiredOption(options, name) {
  const value = options[name];
  if (!value) throw new UsageError(`missing --${name.replaceAll(/[A-Z]/gu, (letter) => `-${letter.toLowerCase()}`)}`);
  return value;
}

function parseArgs(argv) {
  const [command, ...rest] = argv;
  if (!["plan", "apply", "status", "rollback"].includes(command)) {
    throw new UsageError("usage: profile-lifecycle.mjs <plan|apply|status|rollback> [options]");
  }
  const options = { command, replaceExisting: false };
  for (let index = 0; index < rest.length; index += 1) {
    const argument = rest[index];
    if (argument === "--replace-existing") {
      if (options.replaceExisting) throw new UsageError("duplicate option: --replace-existing");
      options.replaceExisting = true;
      continue;
    }
    const fields = new Map([
      ["--profile", "profile"],
      ["--transaction", "transaction"],
      ["--codex-home", "codexHome"],
      ["--backup-root", "backupRoot"],
    ]);
    const field = fields.get(argument);
    if (!field) throw new UsageError(`unknown option: ${argument}`);
    if (options[field]) throw new UsageError(`duplicate option: ${argument}`);
    const value = rest[index + 1];
    if (!value || value.startsWith("--")) throw new UsageError(`missing value for ${argument}`);
    options[field] = path.resolve(value);
    if (field === "profile") options[field] = value;
    index += 1;
  }
  if (!options.codexHome) {
    if (process.env.CODEX_HOME) options.codexHome = path.resolve(process.env.CODEX_HOME);
    else {
      if (!process.env.HOME) throw new UsageError("--codex-home is required when CODEX_HOME and HOME are unavailable");
      options.codexHome = path.join(process.env.HOME, ".codex");
    }
  }
  options.backupRoot ??= process.env.SLOPSENTRAL_BACKUP_ROOT
    ? path.resolve(process.env.SLOPSENTRAL_BACKUP_ROOT)
    : path.join(options.codexHome, "backups/slopsentral");
  if (command === "rollback" && options.profile) {
    throw new UsageError("--profile is not valid for rollback; the transaction owns its profile identity");
  }
  if (command !== "rollback" && options.transaction) {
    throw new UsageError(`--transaction is not valid for ${command}`);
  }
  if (command !== "apply" && options.replaceExisting) {
    throw new UsageError(`--replace-existing is not valid for ${command}`);
  }
  return options;
}

function emit(value) {
  process.stdout.write(`${JSON.stringify(value, null, 2)}\n`);
}

function main() {
  try {
    const options = parseArgs(process.argv.slice(2));
    const result = options.command === "plan" ? plan(options)
      : options.command === "apply" ? apply(options)
      : options.command === "status" ? status(options)
      : rollback(options);
    emit(result);
  } catch (error) {
    if (error instanceof UsageError || error instanceof ProfileContractError) {
      emit({ type: "PROFILE_INVALID_REQUEST", schemaVersion: 1, message: error.message });
      process.exitCode = 2;
      return;
    }
    if (error instanceof ConflictError) {
      emit({ type: "PROFILE_CONFLICT", schemaVersion: 1, target: error.target, reason: error.reason });
      process.exitCode = 3;
      return;
    }
    emit({ type: "PROFILE_IO_FAILURE", schemaVersion: 1, message: error.message });
    process.exitCode = 1;
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();

export { apply, parseArgs, plan, renderProfile, rollback, status };
