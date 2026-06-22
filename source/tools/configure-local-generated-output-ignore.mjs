#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const GENERATED_ROOTS = [".agents/plugins", ".github/plugin"];
const LOCAL_EXCLUDE_PATTERNS = ["/.agents/", "/.github/plugin/"];
const BEGIN_MARKER = "# BEGIN slopsentral generated marketplace output";
const END_MARKER = "# END slopsentral generated marketplace output";
const VALID_COMMANDS = new Set(["enable", "disable", "status"]);

const command = process.argv[2] ?? "enable";
if (!VALID_COMMANDS.has(command)) {
  console.error(
    `Usage: node source/tools/configure-local-generated-output-ignore.mjs enable|disable|status`,
  );
  process.exit(2);
}

function runGit(args, options = {}) {
  const result = spawnSync("git", args, {
    cwd: options.cwd ?? process.cwd(),
    encoding: "utf8",
    stdio: options.stdio ?? ["ignore", "pipe", "pipe"],
  });
  if (result.status !== 0) {
    const message = result.stderr.trim() || result.stdout.trim();
    throw new Error(`git ${args.join(" ")} failed${message ? `: ${message}` : ""}`);
  }
  return result.stdout;
}

function resolveGitPath(repoRoot, gitPath) {
  return path.isAbsolute(gitPath) ? gitPath : path.join(repoRoot, gitPath);
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function trackedGeneratedFiles() {
  return runGit(["ls-files", "-z", "--", ...GENERATED_ROOTS])
    .split("\0")
    .filter(Boolean);
}

function updateSkipWorktree(files, enable) {
  const flag = enable ? "--skip-worktree" : "--no-skip-worktree";
  const batchSize = 200;
  for (let index = 0; index < files.length; index += batchSize) {
    runGit(["update-index", flag, "--", ...files.slice(index, index + batchSize)]);
  }
}

function managedExcludeBlock() {
  return [
    BEGIN_MARKER,
    ...LOCAL_EXCLUDE_PATTERNS,
    END_MARKER,
    "",
  ].join("\n");
}

function removeManagedExcludeBlock(text) {
  const pattern = new RegExp(
    `\\n?${escapeRegExp(BEGIN_MARKER)}[\\s\\S]*?${escapeRegExp(END_MARKER)}\\n?`,
    "g",
  );
  return text.replace(pattern, "\n").replace(/\n{3,}/g, "\n\n");
}

function setLocalExcludeBlock(excludePath, enable) {
  fs.mkdirSync(path.dirname(excludePath), { recursive: true });
  const current = fs.existsSync(excludePath) ? fs.readFileSync(excludePath, "utf8") : "";
  const withoutBlock = removeManagedExcludeBlock(current).trimEnd();
  const next = enable
    ? `${withoutBlock}${withoutBlock ? "\n\n" : ""}${managedExcludeBlock()}`
    : `${withoutBlock}${withoutBlock ? "\n" : ""}`;
  fs.writeFileSync(excludePath, next, "utf8");
}

function readSkipWorktreeStatus() {
  const lines = runGit(["ls-files", "-v", "--", ...GENERATED_ROOTS])
    .split(/\r?\n/)
    .filter(Boolean);
  return {
    tracked: lines.length,
    skipped: lines.filter((line) => line.startsWith("S ")).length,
  };
}

function hasManagedExcludeBlock(excludePath) {
  if (!fs.existsSync(excludePath)) return false;
  return fs.readFileSync(excludePath, "utf8").includes(BEGIN_MARKER);
}

const repoRoot = path.resolve(runGit(["rev-parse", "--show-toplevel"]).trim());
process.chdir(repoRoot);

const excludePath = resolveGitPath(
  repoRoot,
  runGit(["rev-parse", "--git-path", "info/exclude"]).trim(),
);
const files = trackedGeneratedFiles();

if (command === "status") {
  const status = readSkipWorktreeStatus();
  console.log(`Generated roots: ${GENERATED_ROOTS.join(", ")}`);
  console.log(`Tracked generated files: ${status.tracked}`);
  console.log(`Skip-worktree files: ${status.skipped}`);
  console.log(`Local exclude block: ${hasManagedExcludeBlock(excludePath) ? "present" : "missing"}`);
  process.exit(0);
}

if (command === "enable") {
  setLocalExcludeBlock(excludePath, true);
  updateSkipWorktree(files, true);
  console.log(`Enabled local ignore for ${files.length} tracked generated files.`);
  console.log(`Updated ${path.relative(repoRoot, excludePath)} for untracked generated files.`);
} else {
  updateSkipWorktree(files, false);
  setLocalExcludeBlock(excludePath, false);
  console.log(`Disabled local ignore for ${files.length} tracked generated files.`);
  console.log(`Removed the managed block from ${path.relative(repoRoot, excludePath)}.`);
}
