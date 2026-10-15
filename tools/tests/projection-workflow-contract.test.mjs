import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
function read(relativePath) {
  return fs.readFileSync(path.join(repoRoot, relativePath), "utf8");
}

const validateWorkflow = read(".github/workflows/validate-source.yml");
const publicationWorkflow = read(".github/workflows/publish-harnesses.yml");

test("source validation projects three harnesses through pinned local Pkl", () => {
  assert.match(validateWorkflow, /uv run --locked tools\/verify_marketplaces.py/);
  assert.match(validateWorkflow, /uv run --locked tools\/ci.py native/);
  const verifier = read("tools/verify_marketplaces.py");
  assert.match(verifier, /"codex", "github-copilot"/);
  assert.match(verifier, /"codex", "github-copilot", "pi"/);
  assert.match(verifier, /tools\/tests\/pi-host.test.mjs/);
  assert.match(verifier, /tools\/project-marketplaces.mjs/);
  assert.match(read("tools/ci.py"), /tools\/install-projection-pkl.mjs/);
  assert.ok(validateWorkflow.indexOf('Install checksum-verified native tools') < validateWorkflow.indexOf('Validate source, Python'));

});

test("publication projects a harness matrix through the same local Pkl boundary", () => {
  assert.match(publicationWorkflow, /node tools\/project-marketplaces.mjs --source \./);
  assert.match(publicationWorkflow, /--harness '\$\{\{ matrix\.harness \}\}'/);
  assert.match(publicationWorkflow, /node tools\/install-projection-pkl.mjs/);
  assert.match(publicationWorkflow, /npm ci --ignore-scripts/);
  assert.doesNotMatch(publicationWorkflow, /amichne\/projeKtor|intelligence project/);
});

test("publication maps each projection to its dedicated harness branch", () => {
  assert.match(publicationWorkflow, /harness: codex\s+branch: harness\/codex/);
  assert.match(publicationWorkflow, /harness: github-copilot\s+branch: harness\/github-copilot/);
  assert.match(publicationWorkflow, /tools\/publish.py harness/);
  assert.doesNotMatch(publicationWorkflow, /git push origin "HEAD:\$\{GITHUB_REF_NAME\}"/);
});

test("main publication joins both projections without triggering itself", () => {
  assert.match(publicationWorkflow, /publish-main:[\s\S]*needs: publish/);
  assert.match(publicationWorkflow, /tar -cf/);
  assert.match(publicationWorkflow, /tar -xf/);
  assert.match(publicationWorkflow, /merge-multiple: true/);
  assert.match(publicationWorkflow, /tools\/publish.py main/);
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
