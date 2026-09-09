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
