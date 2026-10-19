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
  assert.match(verifier, /tools\/marketplace.py/);
  assert.match(read("tools/ci.py"), /tools\/install_projection_pkl.py/);
  assert.ok(validateWorkflow.indexOf('Install checksum-verified native tools') < validateWorkflow.indexOf('Validate source, Python'));

});

test("publication consumes the full successful main run without rebuilding", () => {
  assert.match(publicationWorkflow, /workflow_run:/);
  assert.match(publicationWorkflow, /workflows: \[Validate Source\]/);
  assert.match(publicationWorkflow, /workflow_run.conclusion == 'success'/);
  assert.match(publicationWorkflow, /workflow_run.event == 'push'/);
  assert.match(publicationWorkflow, /tools.release_assets admit-run/);
  assert.match(publicationWorkflow, /steps.admission.outputs.artifact/);
  assert.match(publicationWorkflow, /run-id: \$\{\{ env.SOURCE_RUN_ID \}\}/);
  assert.match(publicationWorkflow, /tools.release_assets unpack/);
  assert.doesNotMatch(publicationWorkflow, /marketplace.py project|install_projection_pkl|npm ci|actions\/setup-node/);
  assert.doesNotMatch(publicationWorkflow, /^  push:/m);
});

test("publication uses tested payloads for both branches and main", () => {
  assert.match(publicationWorkflow, /tools\/publish.py harness[^\n]+harness\/codex main/);
  assert.match(publicationWorkflow, /tools\/publish.py harness[^\n]+harness\/github-copilot main/);
  assert.match(publicationWorkflow, /tools\/publish.py main/);
  assert.match(validateWorkflow, /--out "\$RUNNER_TEMP\/qualified-projections"/);
  assert.match(validateWorkflow, /tools.release_assets package/);
  assert.match(validateWorkflow, /name: marketplace-candidate/);
  assert.match(validateWorkflow, /npm run docs:check/);
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
