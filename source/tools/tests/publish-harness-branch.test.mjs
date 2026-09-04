import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const publisher = path.join(repoRoot, ".github/scripts/publish-harness-branch");

function git(cwd, ...args) {
  return execFileSync("git", args, {
    cwd,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  }).trim();
}

function createFixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "publish-harness-branch-"));
  const remote = path.join(root, "remote.git");
  const seed = path.join(root, "seed");
  const checkout = path.join(root, "checkout");

  git(root, "init", "--bare", "--initial-branch=main", remote);
  git(root, "init", "--initial-branch=main", seed);
  git(seed, "config", "user.name", "Fixture Author");
  git(seed, "config", "user.email", "fixture@example.invalid");
  fs.writeFileSync(path.join(seed, "source.txt"), "canonical source\n");
  git(seed, "add", "source.txt");
  git(seed, "commit", "-m", "seed source");
  git(seed, "remote", "add", "origin", remote);
  git(seed, "push", "-u", "origin", "main");
  git(root, "clone", remote, checkout);

  return {
    checkout,
    remote,
    root,
    seed,
    sourceSha: git(checkout, "rev-parse", "HEAD"),
  };
}

function createProjection(root, relativeManifest, marker) {
  const projection = path.join(root, `projection-${marker}`);
  const manifest = path.join(projection, relativeManifest);
  fs.mkdirSync(path.dirname(manifest), { recursive: true });
  fs.writeFileSync(manifest, `${JSON.stringify({ marker })}\n`);
  return projection;
}

function publish(checkout, projection, targetBranch, sourceBranch, sourceSha) {
  return execFileSync(
    publisher,
    [projection, targetBranch, sourceBranch, sourceSha],
    {
      cwd: checkout,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    },
  );
}

test("publishes an artifact-only harness branch and skips an unchanged tree", (t) => {
  const fixture = createFixture();
  t.after(() => fs.rmSync(fixture.root, { recursive: true, force: true }));
  const projection = createProjection(
    fixture.root,
    ".agents/plugins/marketplace.json",
    "codex",
  );

  publish(fixture.checkout, projection, "harness/codex", "main", fixture.sourceSha);

  assert.equal(
    git(fixture.root, "--git-dir", fixture.remote, "ls-tree", "-r", "--name-only", "harness/codex"),
    ".agents/plugins/marketplace.json",
  );
  assert.match(
    git(fixture.root, "--git-dir", fixture.remote, "log", "-1", "--format=%B", "harness/codex"),
    new RegExp(`Source-Commit: ${fixture.sourceSha}`),
  );
  assert.equal(
    git(
      fixture.root,
      "--git-dir",
      fixture.remote,
      "rev-list",
      "--parents",
      "-1",
      "harness/codex",
    ).split(" ").length,
    1,
  );

  const firstCommit = git(
    fixture.root,
    "--git-dir",
    fixture.remote,
    "rev-parse",
    "harness/codex",
  );
  const secondRun = publish(
    fixture.checkout,
    projection,
    "harness/codex",
    "main",
    fixture.sourceSha,
  );

  assert.match(secondRun, /is already current/);
  assert.equal(
    git(fixture.root, "--git-dir", fixture.remote, "rev-parse", "harness/codex"),
    firstCommit,
  );

  fs.writeFileSync(
    path.join(projection, ".agents/plugins/marketplace.json"),
    `${JSON.stringify({ marker: "codex-updated" })}\n`,
  );
  publish(fixture.checkout, projection, "harness/codex", "main", fixture.sourceSha);
  const updatedCommit = git(
    fixture.root,
    "--git-dir",
    fixture.remote,
    "rev-parse",
    "harness/codex",
  );
  assert.notEqual(updatedCommit, firstCommit);
  assert.deepEqual(
    git(
      fixture.root,
      "--git-dir",
      fixture.remote,
      "rev-list",
      "--parents",
      "-1",
      updatedCommit,
    ).split(" "),
    [updatedCommit, firstCommit],
  );
});

test("publishes only the Copilot subtree and rejects projection leakage", (t) => {
  const fixture = createFixture();
  t.after(() => fs.rmSync(fixture.root, { recursive: true, force: true }));
  const projection = createProjection(
    fixture.root,
    ".github/plugin/marketplace.json",
    "github-copilot",
  );

  fs.writeFileSync(path.join(projection, "secret.txt"), "must not publish\n");
  const leaking = spawnSync(
    publisher,
    [projection, "harness/github-copilot", "main", fixture.sourceSha],
    { cwd: fixture.checkout, encoding: "utf8" },
  );
  assert.notEqual(leaking.status, 0);
  assert.match(leaking.stderr, /must contain only \.github\/plugin/);

  fs.rmSync(path.join(projection, "secret.txt"));
  publish(
    fixture.checkout,
    projection,
    "harness/github-copilot",
    "main",
    fixture.sourceSha,
  );
  assert.equal(
    git(
      fixture.root,
      "--git-dir",
      fixture.remote,
      "ls-tree",
      "-r",
      "--name-only",
      "harness/github-copilot",
    ),
    ".github/plugin/marketplace.json",
  );
});

test("refuses to roll a harness branch back to an older source commit", (t) => {
  const fixture = createFixture();
  t.after(() => fs.rmSync(fixture.root, { recursive: true, force: true }));
  const olderSourceSha = fixture.sourceSha;

  fs.writeFileSync(path.join(fixture.seed, "source.txt"), "new canonical source\n");
  git(fixture.seed, "add", "source.txt");
  git(fixture.seed, "commit", "-m", "advance source");
  git(fixture.seed, "push", "origin", "main");
  const newerSourceSha = git(fixture.seed, "rev-parse", "HEAD");
  const newerProjection = createProjection(
    fixture.root,
    ".agents/plugins/marketplace.json",
    "newer-codex",
  );
  publish(
    fixture.checkout,
    newerProjection,
    "harness/codex",
    "main",
    newerSourceSha,
  );
  const newerHarnessCommit = git(
    fixture.root,
    "--git-dir",
    fixture.remote,
    "rev-parse",
    "harness/codex",
  );

  git(fixture.seed, "push", "--force", "origin", `${olderSourceSha}:main`);
  const olderProjection = createProjection(
    fixture.root,
    ".agents/plugins/marketplace.json",
    "older-codex",
  );
  const rollback = spawnSync(
    publisher,
    [olderProjection, "harness/codex", "main", olderSourceSha],
    { cwd: fixture.checkout, encoding: "utf8" },
  );
  assert.notEqual(rollback.status, 0);
  assert.match(rollback.stderr, /refusing to move harness\/codex backward/);
  assert.equal(
    git(fixture.root, "--git-dir", fixture.remote, "rev-parse", "harness/codex"),
    newerHarnessCommit,
  );
});

test("fails closed for an unsupported target or stale source commit", (t) => {
  const fixture = createFixture();
  t.after(() => fs.rmSync(fixture.root, { recursive: true, force: true }));
  const projection = createProjection(
    fixture.root,
    ".github/plugin/marketplace.json",
    "github-copilot",
  );

  const unsupported = spawnSync(
    publisher,
    [projection, "harness/other", "main", fixture.sourceSha],
    { cwd: fixture.checkout, encoding: "utf8" },
  );
  assert.notEqual(unsupported.status, 0);
  assert.match(unsupported.stderr, /unsupported target branch/);

  fs.writeFileSync(path.join(fixture.seed, "source.txt"), "new canonical source\n");
  git(fixture.seed, "add", "source.txt");
  git(fixture.seed, "commit", "-m", "advance source");
  git(fixture.seed, "push", "origin", "main");

  const stale = publish(
    fixture.checkout,
    projection,
    "harness/github-copilot",
    "main",
    fixture.sourceSha,
  );
  assert.match(stale, /::notice::main advanced/);
  const unpublished = spawnSync(
    "git",
    ["--git-dir", fixture.remote, "rev-parse", "harness/github-copilot"],
    { cwd: fixture.root, encoding: "utf8" },
  );
  assert.notEqual(unpublished.status, 0);
});
