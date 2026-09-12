#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { runContextCommand, contextExitCode } from "./repository-context.mjs";

const packageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function installedVersion(root) {
  try {
    const value = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));
    return typeof value.version === "string" ? value.version : "unknown";
  } catch {
    return "unknown";
  }
}

const packageVersion = installedVersion(packageRoot);

const help = `Slopsentral manages named Codex user profiles.

Usage:
  slopsentral --help
  slopsentral --version
  slopsentral doctor
  slopsentral profile plan <profile> [--codex-home PATH] [--backup-root PATH]
  slopsentral profile status <profile> [--codex-home PATH] [--backup-root PATH]
  slopsentral profile apply <profile> [--codex-home PATH] [--backup-root PATH] [--replace-existing]
  slopsentral profile rollback <manifest> [--codex-home PATH] [--backup-root PATH]
  slopsentral context plan [--repo PATH]
  slopsentral context status [--repo PATH]
  slopsentral context apply [--repo PATH] [--codex-home PATH] [--backup-root PATH]
  slopsentral context launch [--repo PATH] -- [CODEX ARGS...]
  slopsentral context hook

Operational commands emit JSON. Exit codes: 0 success, 1 runtime or I/O
failure, 2 invalid request or contract, and 3 conflict.
`;

const packagedProfiles = [
  "agent-authoring-default",
  "documentation-default",
  "intellij-plugin-default",
  "kotlin-repo-default",
  "local-development-default",
];

const packagedPlugins = [
  "agent-platform-authoring",
  "api-contracts",
  "code-knowledge-base",
  "developer-tools",
  "effective-delivery",
  "engineering-baseline",
  "intellij-engineering",
  "kotlin-engineering",
  "pkl-engineering",
  "skill-read-policy",
  "terminal-ui-design",
  "writing",
];

const requiredAssets = [
  "package.json",
  "source/adaptable.marketplace.json",
  "source/schemas/profiles/profile-transaction.schema.json",
  "source/schemas/profiles/workflow-profile.schema.json",
  "tools/install-skill",
  "tools/profile-lifecycle.mjs",
  "tools/repository-context.mjs",
  "tools/validate-profile-contracts.mjs",
  ...packagedProfiles.map((profile) => `source/profiles/${profile}.json`),
  ...packagedPlugins.map((plugin) => `source/plugins/${plugin}/plugin.json`),
];

class CliUsageError extends Error {}

function emit(value) {
  process.stdout.write(`${JSON.stringify(value, null, 2)}\n`);
}

function invalidRequest(message) {
  return { type: "SLOPSENTRAL_INVALID_REQUEST", schemaVersion: 1, message };
}

function parseProfileCommand(argv) {
  const [action, identity, ...rest] = argv;
  if (!action || !["plan", "status", "apply", "rollback"].includes(action)) {
    throw new CliUsageError("profile requires plan, status, apply, or rollback");
  }
  if (!identity || identity.startsWith("--")) {
    throw new CliUsageError(action === "rollback" ? "rollback requires a manifest" : `${action} requires a profile`);
  }

  const translated = action === "rollback"
    ? [action, "--transaction", identity]
    : [action, "--profile", identity];
  const seen = new Set();
  for (let index = 0; index < rest.length; index += 1) {
    const argument = rest[index];
    if (argument === "--replace-existing") {
      if (action !== "apply") throw new CliUsageError(`--replace-existing is not valid for ${action}`);
      if (seen.has(argument)) throw new CliUsageError(`duplicate option: ${argument}`);
      seen.add(argument);
      translated.push(argument);
      continue;
    }
    if (!["--codex-home", "--backup-root"].includes(argument)) {
      throw new CliUsageError(`unknown option: ${argument}`);
    }
    if (seen.has(argument)) throw new CliUsageError(`duplicate option: ${argument}`);
    const value = rest[index + 1];
    if (!value || value.startsWith("--")) throw new CliUsageError(`missing value for ${argument}`);
    seen.add(argument);
    translated.push(argument, value);
    index += 1;
  }
  return translated;
}

function writableLocation(target) {
  let candidate = path.resolve(target);
  while (!fs.existsSync(candidate)) {
    const parent = path.dirname(candidate);
    if (parent === candidate) {
      return { usable: false, reason: "no existing ancestor" };
    }
    candidate = parent;
  }
  try {
    const stat = fs.statSync(candidate);
    if (!stat.isDirectory()) return { usable: false, reason: `${candidate} is not a directory` };
    fs.accessSync(candidate, fs.constants.W_OK);
    return { usable: true, existingAncestor: candidate };
  } catch (error) {
    return { usable: false, reason: error.message };
  }
}

function checkNodeRuntime(nodeVersion) {
  const match = /^v?(\d+)\.(\d+)\.(\d+)/u.exec(nodeVersion);
  const supported = match && (Number(match[1]) > 20 || (Number(match[1]) === 20 && Number(match[2]) >= 11));
  return supported
    ? { type: "CHECK_PASSED", name: "NODE_RUNTIME", version: nodeVersion, requirement: ">=20.11" }
    : { type: "CHECK_FAILED", name: "NODE_RUNTIME", version: nodeVersion, requirement: ">=20.11", message: "unsupported Node runtime" };
}

function checkPackageAssets(root) {
  const missing = requiredAssets.filter((relativePath) => !fs.existsSync(path.join(root, relativePath)));
  if (missing.length > 0) {
    return { type: "CHECK_FAILED", name: "PACKAGE_ASSETS", packageRoot: root, missing };
  }
  try {
    const marketplace = JSON.parse(fs.readFileSync(path.join(root, "source/adaptable.marketplace.json"), "utf8"));
    JSON.parse(fs.readFileSync(path.join(root, "source/schemas/profiles/profile-transaction.schema.json"), "utf8"));
    JSON.parse(fs.readFileSync(path.join(root, "source/schemas/profiles/workflow-profile.schema.json"), "utf8"));
    for (const profile of packagedProfiles) {
      const relativePath = `source/profiles/${profile}.json`;
      const value = JSON.parse(fs.readFileSync(path.join(root, relativePath), "utf8"));
      if (value.type !== "WORKFLOW_PROFILE" || value.schemaVersion !== 2 || value.name !== profile) {
        throw new Error(`${relativePath} has an invalid profile identity`);
      }
    }
    for (const plugin of packagedPlugins) {
      const relativePath = `source/plugins/${plugin}/plugin.json`;
      const value = JSON.parse(fs.readFileSync(path.join(root, relativePath), "utf8"));
      if (value.type !== "PLUGIN" || value.name !== plugin) {
        throw new Error(`${relativePath} has an invalid plugin identity`);
      }
    }
    for (const skill of marketplace.skills ?? []) {
      const relativePath = `source/${skill.path}/SKILL.md`;
      if (!fs.existsSync(path.join(root, relativePath))) {
        throw new Error(`${relativePath} is missing from the portable package`);
      }
    }
    return {
      type: "CHECK_PASSED",
      name: "PACKAGE_ASSETS",
      packageRoot: root,
      profileCount: packagedProfiles.length,
      pluginCount: packagedPlugins.length,
      standaloneSkillCount: (marketplace.skills ?? []).length,
    };
  } catch (error) {
    return { type: "CHECK_FAILED", name: "PACKAGE_ASSETS", packageRoot: root, message: error.message };
  }
}

function configuredRoot(name, target) {
  if (!target) return { type: "CHECK_FAILED", name, message: `${name} cannot be resolved without HOME` };
  const usability = writableLocation(target);
  return usability.usable
    ? { type: "CHECK_PASSED", name, path: target, existingAncestor: usability.existingAncestor }
    : { type: "CHECK_FAILED", name, path: target, message: usability.reason };
}

function defaultCodexProbe(environment) {
  const searchPath = environment.PATH;
  if (!searchPath) return { type: "CODEX_CLI_MISSING" };
  const extensions = process.platform === "win32"
    ? (environment.PATHEXT ?? ".COM;.EXE;.BAT;.CMD").split(";")
    : [""];
  for (const directory of searchPath.split(path.delimiter).filter(Boolean)) {
    for (const extension of extensions) {
      const executable = path.join(directory, `codex${extension.toLowerCase()}`);
      try {
        if (fs.statSync(executable).isFile()) {
          fs.accessSync(executable, fs.constants.X_OK);
          return { type: "CODEX_CLI_FOUND", executable };
        }
      } catch {
        // This candidate is absent or unusable; continue searching.
      }
    }
  }
  return { type: "CODEX_CLI_MISSING" };
}

function codexCheck(probe) {
  if (probe.type === "CODEX_CLI_FOUND") {
    return { type: "CHECK_PASSED", name: "CODEX_CLI", executable: probe.executable };
  }
  return {
    type: "CHECK_WARNING",
    name: "CODEX_CLI",
    reason: probe.type,
    message: probe.message ?? "Codex CLI was not found; profile plan, apply, and status are unavailable",
  };
}

export function inspectDoctor({
  packageRoot: inspectedPackageRoot = packageRoot,
  environment = process.env,
  nodeVersion = process.version,
  probeCodex = defaultCodexProbe,
} = {}) {
  const home = environment.CODEX_HOME
    ? path.resolve(environment.CODEX_HOME)
    : environment.HOME
      ? path.join(path.resolve(environment.HOME), ".codex")
      : undefined;
  const backupRoot = environment.SLOPSENTRAL_BACKUP_ROOT
    ? path.resolve(environment.SLOPSENTRAL_BACKUP_ROOT)
    : home
      ? path.join(home, "backups/slopsentral")
      : undefined;
  const checks = [
    checkNodeRuntime(nodeVersion),
    checkPackageAssets(path.resolve(inspectedPackageRoot)),
    configuredRoot("CODEX_HOME", home),
    configuredRoot("BACKUP_ROOT", backupRoot),
    codexCheck(probeCodex(environment)),
  ];
  const failureCount = checks.filter((check) => check.type === "CHECK_FAILED").length;
  return {
    type: "SLOPSENTRAL_DOCTOR",
    schemaVersion: 1,
    version: packageVersion,
    readiness: failureCount === 0 ? { type: "DOCTOR_READY" } : { type: "DOCTOR_NOT_READY", failureCount },
    checks,
  };
}

function runProfile(argv) {
  const result = spawnSync(process.execPath, [path.join(packageRoot, "tools/profile-lifecycle.mjs"), ...argv], {
    stdio: "inherit",
    env: process.env,
  });
  if (result.error) {
    emit({ type: "SLOPSENTRAL_IO_FAILURE", schemaVersion: 1, message: result.error.message });
    return 1;
  }
  return Number.isInteger(result.status) ? result.status : 1;
}

function main() {
  const argv = process.argv.slice(2);
  if (argv.length === 1 && ["--help", "-h"].includes(argv[0])) {
    process.stdout.write(help);
    return 0;
  }
  if (argv.length === 1 && ["--version", "-v"].includes(argv[0])) {
    process.stdout.write(`slopsentral ${packageVersion}\n`);
    return 0;
  }
  if (argv.length === 1 && argv[0] === "doctor") {
    const report = inspectDoctor();
    emit(report);
    return report.readiness.type === "DOCTOR_READY" ? 0 : 1;
  }
  if (argv[0] === "profile") return runProfile(parseProfileCommand(argv.slice(1)));
  if (argv[0] === "context") {
    const result = runContextCommand(argv.slice(1));
    if (result.type === "CONTEXT_LAUNCH_EXIT") return result.exitCode;
    emit(result);
    return contextExitCode(result);
  }
  throw new CliUsageError(argv.length === 0 ? "a command is required; run slopsentral --help" : `unknown command: ${argv[0]}`);
}

const invokedAsEntrypoint = process.argv[1] &&
  fs.realpathSync(process.argv[1]) === fs.realpathSync(fileURLToPath(import.meta.url));

if (invokedAsEntrypoint) {
  try {
    process.exitCode = main();
  } catch (error) {
    if (error instanceof CliUsageError) {
      emit(invalidRequest(error.message));
      process.exitCode = 2;
    } else {
      emit({ type: "SLOPSENTRAL_IO_FAILURE", schemaVersion: 1, message: error.message });
      process.exitCode = 1;
    }
  }
}
