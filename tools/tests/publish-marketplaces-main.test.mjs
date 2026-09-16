import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const publisher = path.join(repoRoot, ".github/scripts/publish-marketplaces-main");

function git(cwd, ...args) {
  return execFileSync("git", args, {
    cwd,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  }).trim();
}

function createFixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "publish-marketplaces-main-"));
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

function projection(fixture) {
  const directory = path.join(fixture.root, "projection");
  for (const root of [".agents/plugins", ".github/plugin"]) {
    fs.mkdirSync(path.join(directory, root), { recursive: true });
    fs.writeFileSync(path.join(directory, root, "marketplace.json"), "{}\n");
  }
  return directory;
}
function run(f, p, sha = f.sourceSha) {
  return spawnSync(publisher, [p, sha], { cwd: f.checkout, encoding: "utf8" });
}
test("publishes both trees atomically, preserves source, removes obsolete output, and is idempotent", (t) => {
  const f = createFixture();
  t.after(() => fs.rmSync(f.root, { recursive: true, force: true }));
  fs.mkdirSync(path.join(f.seed, ".agents/plugins"), { recursive: true });
  fs.writeFileSync(path.join(f.seed, ".agents/plugins/obsolete"), "old");
  fs.writeFileSync(path.join(f.seed, ".agents/instructions.md"), "preserve me");
  git(f.seed, "add", "."); git(f.seed, "commit", "-m", "old projection"); git(f.seed, "push");
  f.sourceSha = git(f.seed, "rev-parse", "HEAD");
  const p = projection(f);
  const result = run(f, p);
  assert.equal(result.status, 0, result.stderr);
  const head = git(f.root, "--git-dir", f.remote, "rev-parse", "main");
  assert.equal(git(f.root, "--git-dir", f.remote, "rev-parse", "main^"), f.sourceSha);
  assert.equal(git(f.root, "--git-dir", f.remote, "show", "main:source.txt"), "canonical source");
  assert.equal(git(f.root, "--git-dir", f.remote, "show", "main:.agents/instructions.md"), "preserve me");
  assert.equal(git(f.root, "--git-dir", f.remote, "show", "main:.github/plugin/marketplace.json"), "{}");
  const tree = git(f.root, "--git-dir", f.remote, "ls-tree", "-r", "--name-only", "main");
  assert.match(tree, /\.agents\/plugins\/marketplace.json/);
  assert.doesNotMatch(tree, /obsolete/);
  assert.match(run(f, p, head).stdout, /already current/);
  assert.equal(git(f.root, "--git-dir", f.remote, "rev-parse", "main"), head);
  assert.match(run(f, p).stdout, /skipping stale/);
});
for (const corruption of ["missing", "extra", "symlink"]) {
  test(`rejects ${corruption} projection before publishing`, (t) => {
    const f = createFixture();
    t.after(() => fs.rmSync(f.root, { recursive: true, force: true }));
    const p = projection(f);
    if (corruption === "missing") fs.rmSync(path.join(p, ".github/plugin/marketplace.json"));
    if (corruption === "extra") fs.writeFileSync(path.join(p, ".github/workflow.yml"), "unsafe");
    if (corruption === "symlink") fs.symlinkSync(f.seed, path.join(p, ".agents/plugins/link"));
    assert.notEqual(run(f, p).status, 0);
    assert.equal(git(f.root, "--git-dir", f.remote, "rev-parse", "main"), f.sourceSha);
  });
}
