import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import test from 'node:test';

function runWithoutWorktrunk(t, ci) {
  const bin = fs.mkdtempSync(path.join(os.tmpdir(), 'slopsentral-no-wt-'));
  t.after(() => fs.rmSync(bin, { recursive: true, force: true }));
  fs.writeFileSync(path.join(bin, 'which'), '#!/bin/sh\nexit 1\n', { mode: 0o755 });
  const env = { ...process.env, PATH: bin };
  delete env.NODE_TEST_CONTEXT;
  if (ci) env.CI = 'true';
  else delete env.CI;
  return spawnSync(process.execPath, ['--test', '--test-reporter=tap',
    path.join(import.meta.dirname, 'worktrunk-automation.test.mjs')], {
    env, encoding: 'utf8', timeout: 30_000,
  });
}

test('missing Worktrunk fails all lifecycle checks in CI instead of skipping them', t => {
  const result = runWithoutWorktrunk(t, true);
  assert.equal(result.status, 1, result.stdout + result.stderr);
  assert.match(result.stdout, /Worktrunk \(wt\) is required for CI lifecycle checks/);
  assert.match(result.stdout, /# fail 3/);
  assert.match(result.stdout, /# skipped 0/);
});

test('missing Worktrunk remains an explicit optional skip outside CI', t => {
  const result = runWithoutWorktrunk(t, false);
  assert.equal(result.status, 0, result.stdout + result.stderr);
  assert.match(result.stdout, /# skipped 3/);
});
