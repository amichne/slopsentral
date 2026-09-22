import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const repoRoot = path.resolve(import.meta.dirname, "../..");

function read(relativePath) {
  return fs.readFileSync(path.join(repoRoot, relativePath), "utf8");
}

test("local red-green work does not require publication", () => {
  const skill = read("source/skills/tdd/SKILL.md");

  assert.match(skill, /local TDD loop does not require a remote/i);
  assert.doesNotMatch(skill, /commit and push each validated RED/i);
  assert.doesNotMatch(skill, /Every validated RED and passing GREEN checkpoint was committed and pushed/i);
  assert.match(skill, /commit or push only when the\s+requested end state/i);
});

test("task context alone does not manufacture publication authority", () => {
  const gitFlow = read("source/skills/git-change-flow/SKILL.md");
  const prLifecycle = read("source/skills/pull-request-lifecycle/SKILL.md");

  for (const guidance of [gitFlow, prLifecycle]) {
    assert.match(guidance, /requested end state/i);
    assert.match(guidance, /local-only scope/i);
    assert.doesNotMatch(guidance, /deliverable defaults the end\s+state to a green PR|is a publication request/i);
  }

  assert.match(prLifecycle, /linked deliverable alone does not authorize publication/i);
});
