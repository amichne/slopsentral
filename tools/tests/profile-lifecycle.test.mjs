import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

const repoRoot = path.resolve(import.meta.dirname, "../..");
const lifecycle = path.join(repoRoot, "tools/profile-lifecycle.mjs");

function fixture(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "profile-lifecycle-test-"));
  const codexHome = path.join(root, "codex");
  const backupRoot = path.join(root, "versioned-backups");
  fs.mkdirSync(codexHome, { recursive: true });
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  return { codexHome, backupRoot };
}

function run({ codexHome, backupRoot }, ...args) {
  const result = spawnSync(
    process.execPath,
    [lifecycle, ...args, "--codex-home", codexHome, "--backup-root", backupRoot],
    { cwd: repoRoot, encoding: "utf8" },
  );
  const output = result.stdout.trim() ? JSON.parse(result.stdout) : undefined;
  return { ...result, output };
}

function diagnostic(result) {
  return result.stderr || result.stdout || result.error?.message || "command failed without diagnostics";
}

test("apply backs up replaced user content and rollback is itself reversible", (t) => {
  const context = fixture(t);
  const target = path.join(context.codexHome, "local-development-default.config.toml");
  const original = "# personal profile\nmodel = \"gpt-5.6-terra\"\n";
  fs.writeFileSync(target, original);
  fs.chmodSync(target, 0o640);

  const applied = run(context, "apply", "--profile", "local-development-default", "--replace-existing");

  assert.equal(applied.status, 0, diagnostic(applied));
  assert.equal(applied.output.type, "PROFILE_APPLIED");
  assert.notEqual(fs.readFileSync(target, "utf8"), original);
  assert.equal(applied.output.transaction.type, "COMMITTED_TRANSACTION");
  const applyTransaction = applied.output.transaction.manifestPath;
  const applyManifest = JSON.parse(fs.readFileSync(applyTransaction, "utf8"));
  const applyChange = applyManifest.changes[0];
  assert.equal(applyChange.type, "FILE_REPLACED");
  assert.equal(
    fs.readFileSync(path.join(path.dirname(applyTransaction), applyChange.before.backupPath), "utf8"),
    original,
  );
  const generated = fs.readFileSync(target, "utf8");

  const rolledBack = run(context, "rollback", "--transaction", applyTransaction);

  assert.equal(rolledBack.status, 0, diagnostic(rolledBack));
  assert.equal(rolledBack.output.type, "PROFILE_ROLLED_BACK");
  assert.equal(fs.readFileSync(target, "utf8"), original);
  assert.equal(fs.statSync(target).mode & 0o777, 0o640);
  assert.equal(rolledBack.output.transaction.type, "COMMITTED_TRANSACTION");
  const rollbackManifest = JSON.parse(
    fs.readFileSync(rolledBack.output.transaction.manifestPath, "utf8"),
  );
  assert.equal(rollbackManifest.operation.type, "ROLLBACK_PROFILE");
  assert.equal(rollbackManifest.operation.reversesTransactionId, applyManifest.id);
  assert.equal(rollbackManifest.changes[0].type, "FILE_REPLACED");
  assert.equal(
    fs.readFileSync(
      path.join(path.dirname(rolledBack.output.transaction.manifestPath), rollbackManifest.changes[0].before.backupPath),
      "utf8",
    ),
    generated,
  );
});

test("rollback refuses to overwrite content changed after apply", (t) => {
  const context = fixture(t);
  const applied = run(context, "apply", "--profile", "documentation-default");
  assert.equal(applied.status, 0, diagnostic(applied));
  const target = path.join(context.codexHome, "documentation-default.config.toml");
  fs.appendFileSync(target, "\n# user changed this later\n");

  const rolledBack = run(context, "rollback", "--transaction", applied.output.transaction.manifestPath);

  assert.equal(rolledBack.status, 3, diagnostic(rolledBack));
  assert.equal(rolledBack.output.type, "PROFILE_CONFLICT");
  assert.equal(rolledBack.output.reason.type, "CURRENT_CONTENT_MISMATCH");
  assert.match(fs.readFileSync(target, "utf8"), /user changed this later/);
});

test("applying an unchanged managed profile is a no-op without a new transaction", (t) => {
  const context = fixture(t);
  const first = run(context, "apply", "--profile", "agent-authoring-default");
  assert.equal(first.status, 0, diagnostic(first));
  const manifestsBefore = fs.readdirSync(context.backupRoot, { recursive: true })
    .filter((entry) => entry.endsWith("manifest.json"));

  const second = run(context, "apply", "--profile", "agent-authoring-default");

  assert.equal(second.status, 0, diagnostic(second));
  assert.equal(second.output.type, "PROFILE_UP_TO_DATE");
  const manifestsAfter = fs.readdirSync(context.backupRoot, { recursive: true })
    .filter((entry) => entry.endsWith("manifest.json"));
  assert.deepEqual(manifestsAfter, manifestsBefore);
});

test("apply refuses to replace unmanaged content without explicit adoption", (t) => {
  const context = fixture(t);
  const target = path.join(context.codexHome, "kotlin-repo-default.config.toml");
  fs.writeFileSync(target, "# user-owned\n");

  const applied = run(context, "apply", "--profile", "kotlin-repo-default");

  assert.equal(applied.status, 3, diagnostic(applied));
  assert.equal(applied.output.type, "PROFILE_CONFLICT");
  assert.equal(applied.output.reason.type, "UNMANAGED_TARGET");
  assert.equal(fs.readFileSync(target, "utf8"), "# user-owned\n");
  assert.equal(fs.existsSync(context.backupRoot), false);
});

test("rolling back a created file records its bytes and can itself be reversed", (t) => {
  const context = fixture(t);
  const target = path.join(context.codexHome, "intellij-plugin-default.config.toml");
  const applied = run(context, "apply", "--profile", "intellij-plugin-default");
  assert.equal(applied.status, 0, diagnostic(applied));
  const generated = fs.readFileSync(target);

  const removed = run(context, "rollback", "--transaction", applied.output.transaction.manifestPath);
  assert.equal(removed.status, 0, diagnostic(removed));
  assert.equal(fs.existsSync(target), false);
  const removalManifest = JSON.parse(fs.readFileSync(removed.output.transaction.manifestPath, "utf8"));
  assert.equal(removalManifest.changes[0].type, "FILE_REMOVED");
  assert.deepEqual(
    fs.readFileSync(
      path.join(path.dirname(removed.output.transaction.manifestPath), removalManifest.changes[0].before.backupPath),
    ),
    generated,
  );

  const restored = run(context, "rollback", "--transaction", removed.output.transaction.manifestPath);
  assert.equal(restored.status, 0, diagnostic(restored));
  assert.deepEqual(fs.readFileSync(target), generated);
});

test("plan and status are read-only", (t) => {
  const context = fixture(t);
  const planned = run(context, "plan", "--profile", "documentation-default");
  assert.equal(planned.status, 0, diagnostic(planned));
  assert.equal(planned.output.type, "PROFILE_PLAN");
  assert.equal(planned.output.mutation.type, "FILE_CREATE_PLANNED");
  assert.equal(fs.existsSync(context.backupRoot), false);
  assert.equal(fs.readdirSync(context.codexHome).length, 0);

  const observed = run(context, "status", "--profile", "documentation-default");
  assert.equal(observed.status, 0, diagnostic(observed));
  assert.equal(observed.output.type, "PROFILE_CHANGES_REQUIRED");
  assert.equal(fs.existsSync(context.backupRoot), false);
  assert.equal(fs.readdirSync(context.codexHome).length, 0);
});

test("rollback accepts manifests only from the configured backup root", (t) => {
  const context = fixture(t);
  const applied = run(context, "apply", "--profile", "documentation-default");
  assert.equal(applied.status, 0, diagnostic(applied));
  const otherRoot = path.join(path.dirname(context.backupRoot), "other-backups");

  const rolledBack = run(
    { ...context, backupRoot: otherRoot },
    "rollback",
    "--transaction",
    applied.output.transaction.manifestPath,
  );

  assert.equal(rolledBack.status, 2, diagnostic(rolledBack));
  assert.equal(rolledBack.output.type, "PROFILE_INVALID_REQUEST");
});

test("rollback recovers a prepared transaction left after its atomic target write", (t) => {
  const context = fixture(t);
  const applied = run(context, "apply", "--profile", "local-development-default");
  assert.equal(applied.status, 0, diagnostic(applied));
  const manifestPath = applied.output.transaction.manifestPath;
  const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
  fs.writeFileSync(
    manifestPath,
    `${JSON.stringify({ ...manifest, lifecycle: { type: "PREPARED_TRANSACTION" } }, null, 2)}\n`,
  );

  const rolledBack = run(context, "rollback", "--transaction", manifestPath);

  assert.equal(rolledBack.status, 0, diagnostic(rolledBack));
  assert.equal(rolledBack.output.type, "PROFILE_ROLLED_BACK");
  assert.equal(
    JSON.parse(fs.readFileSync(manifestPath, "utf8")).lifecycle.type,
    "COMMITTED_TRANSACTION",
  );
  assert.equal(
    fs.existsSync(path.join(context.codexHome, "local-development-default.config.toml")),
    false,
  );
});

test("apply refuses to follow a user-content symlink", (t) => {
  const context = fixture(t);
  const realFile = path.join(path.dirname(context.codexHome), "personal.config.toml");
  const target = path.join(context.codexHome, "documentation-default.config.toml");
  fs.writeFileSync(realFile, "# keep me\n");
  fs.symlinkSync(realFile, target);

  const applied = run(context, "apply", "--profile", "documentation-default", "--replace-existing");

  assert.equal(applied.status, 3, diagnostic(applied));
  assert.equal(applied.output.reason.type, "TARGET_NOT_REGULAR_FILE");
  assert.equal(fs.readFileSync(realFile, "utf8"), "# keep me\n");
  assert.equal(fs.lstatSync(target).isSymbolicLink(), true);
  assert.equal(fs.existsSync(context.backupRoot), false);
});
