import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const repoRoot = path.resolve(import.meta.dirname, "../../..");

function read(relativePath) {
  return fs.readFileSync(path.join(repoRoot, relativePath), "utf8");
}

test("red-green work publishes every validated checkpoint", () => {
  const skill = read("source/skills/tdd/SKILL.md");

  assert.match(skill, /commit and push each validated RED and passing GREEN checkpoint before continuing/i);
});

test("defined or linked deliverables route through a green pull request", () => {
  const gitFlow = read("source/skills/git-change-flow/SKILL.md");
  const prLifecycle = read("source/skills/pull-request-lifecycle/SKILL.md");

  for (const guidance of [gitFlow, prLifecycle]) {
    assert.match(guidance, /task, ticket, subtask, or direct message/i);
    assert.match(guidance, /defines a deliverable or links a file containing the deliverable/i);
  }

  assert.match(prLifecycle, /raise or update a pull request and follow its latest head until green/i);
});
