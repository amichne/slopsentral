import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const repoRoot = path.resolve(import.meta.dirname, "../..");

test("tools and source are sibling roots", () => {
  const sourceRoot = path.join(repoRoot, "source");
  const toolsRoot = path.join(repoRoot, "tools");

  assert.equal(fs.statSync(sourceRoot).isDirectory(), true);
  assert.equal(fs.statSync(toolsRoot).isDirectory(), true);
  assert.equal(path.dirname(sourceRoot), path.dirname(toolsRoot));
  assert.equal(fs.existsSync(path.join(sourceRoot, "tools")), false);
  assert.equal(fs.existsSync(path.join(toolsRoot, "validate-source-graph.mjs")), true);
});

test("plugin consumption has no Slopsentral CLI or automatic profile hook", () => {
  const manifest = JSON.parse(fs.readFileSync(path.join(repoRoot, "package.json"), "utf8"));
  const lock = JSON.parse(fs.readFileSync(path.join(repoRoot, "package-lock.json"), "utf8"));
  assert.equal(manifest.bin, undefined);
  assert.equal(lock.packages[""].bin, undefined);
  for (const retired of [
    "tools/slopsentral.mjs",
    "tools/repository-context.mjs",
    "source/hooks/repository-profile.py",
    "source/hooks/repository-profile.hook.json",
    "source/hooks/codex/repository-profile.hooks.json",
  ]) {
    assert.equal(fs.existsSync(path.join(repoRoot, retired)), false, retired);
  }
});
