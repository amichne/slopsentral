import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const projeKtorAction =
  "amichne/projeKtor@eb3799c2bc60b4803c84fded0b6f4cd587bd0702";

function read(relativePath) {
  return fs.readFileSync(path.join(repoRoot, relativePath), "utf8");
}

const validateWorkflow = read(".github/workflows/validate-source.yml");
const publicationWorkflow = read(".github/workflows/publish-harnesses.yml");

test("source validation projects both harnesses through immutable projeKtor", () => {
  assert.equal(validateWorkflow.match(new RegExp(`uses: ${projeKtorAction}`, "g"))?.length, 2);
  assert.equal(validateWorkflow.match(/version: v1\.2\.1/g)?.length, 2);
  assert.match(validateWorkflow, /harness: codex/);
  assert.match(validateWorkflow, /harness: github-copilot/);
  assert.doesNotMatch(validateWorkflow, /amichne\/intelligence|intelligence project/);
});

test("publication projects a harness matrix through immutable projeKtor", () => {
  assert.equal(publicationWorkflow.match(new RegExp(`uses: ${projeKtorAction}`, "g"))?.length, 1);
  assert.equal(publicationWorkflow.match(/version: v1\.2\.1/g)?.length, 1);
  assert.match(publicationWorkflow, /harness: \$\{\{ matrix\.harness \}\}/);
  assert.doesNotMatch(publicationWorkflow, /amichne\/intelligence|intelligence project/);
});

test("publication maps each projection to its dedicated harness branch", () => {
  assert.match(publicationWorkflow, /harness: codex\s+branch: harness\/codex/);
  assert.match(publicationWorkflow, /harness: github-copilot\s+branch: harness\/github-copilot/);
  assert.match(publicationWorkflow, /\.github\/scripts\/publish-harness-branch/);
  assert.doesNotMatch(publicationWorkflow, /git push origin "HEAD:\$\{GITHUB_REF_NAME\}"/);
});

test("main publication joins both projections without triggering itself", () => {
  assert.match(publicationWorkflow, /publish-main:[\s\S]*needs: publish/);
  assert.match(publicationWorkflow, /tar -cf/);
  assert.match(publicationWorkflow, /tar -xf/);
  assert.match(publicationWorkflow, /merge-multiple: true/);
  assert.match(publicationWorkflow, /publish-marketplaces-main/);
  assert.match(publicationWorkflow, /paths-ignore:\s+- '\.agents\/plugins\/\*\*'\s+- '\.github\/plugin\/\*\*'/);
});

test("retired broker and garden surfaces are absent", () => {
  for (const relativePath of [
    "broker",
    "garden",
    ".github/workflows/release-broker.yml",
    "source/skills/primitive-quality-audit",
    "source/skills/runtime-linking",
    "source/skills/source-graph-consolidation",
    "source/schemas/audits/primitive-audits.schema.json",
    "source/schemas/runtime/runtime-links.schema.json",
  ]) {
    assert.equal(fs.existsSync(path.join(repoRoot, relativePath)), false, relativePath);
  }
});
