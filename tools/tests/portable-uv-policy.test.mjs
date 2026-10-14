import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import test from 'node:test';

const repo = path.resolve(import.meta.dirname, '../..');
test('every executable portable launcher rejects missing and stale locks before application output', t => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'portable-direct-locks-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const environment = Object.fromEntries(Object.entries(process.env)
    .filter(([key]) => !key.startsWith('UV_') && !key.startsWith('PYTHON') && key !== 'VIRTUAL_ENV'));
  Object.assign(environment, { UV_NO_CONFIG: '1', UV_PYTHON: '3.12',
    UV_CACHE_DIR: path.join(root, 'cache'), UV_PYTHON_DOWNLOADS: 'never', PYTHONNOUSERSITE: '1' });
  assert.equal(fs.existsSync(environment.UV_CACHE_DIR), false, 'the readiness cache must start empty');
  const prepared = spawnSync('uv', ['run', '--locked', '--script',
    path.join(repo, 'tools/tests/fixtures/uv-legacy-probe.py')], {
    cwd: root, env: environment, encoding: 'utf8', timeout: 60000,
  });
  assert.equal(prepared.status, 0, prepared.stdout + prepared.stderr);
  const control = path.join(root, 'valid-control.py');
  const original = path.join(repo, 'source/skills/python-tooling/assets/standalone.py');
  fs.copyFileSync(original, control);
  fs.copyFileSync(`${original}.lock`, `${control}.lock`);
  fs.chmodSync(control, fs.statSync(original).mode & 0o777);
  const readinessScript = path.join(root, 'legacy-readiness.py');
  const originalReadiness = path.join(repo, 'tools/tests/fixtures/uv-legacy-probe.py');
  fs.copyFileSync(originalReadiness, readinessScript);
  fs.copyFileSync(`${originalReadiness}.lock`, `${readinessScript}.lock`);
  for (const script of [control, readinessScript]) {
    const before = fs.readFileSync(`${script}.lock`);
    const resolved = spawnSync('uv', ['lock', '--script', script, '--refresh'], {
      cwd: root, env: environment, encoding: 'utf8', timeout: 60000,
    });
    assert.equal(resolved.status, 0, resolved.stdout + resolved.stderr);
    assert.deepEqual(fs.readFileSync(`${script}.lock`), before, 'cache readiness must preserve each declared lock');
  }
  environment.UV_OFFLINE = '1';
  const valid = spawnSync(control, ['--self-test'], { cwd: root, env: environment, encoding: 'utf8', timeout: 60000 });
  assert.equal(valid.status, 0, valid.stdout + valid.stderr);
  assert.match(valid.stdout, /passed/);
  let count = 0;
  for (const base of ['source', 'tools']) for (const relative of fs.readdirSync(path.join(repo, base), { recursive: true })) {
    const file = path.join(repo, base, relative);
    if (!fs.statSync(file).isFile() || relative.split(path.sep).includes('__pycache__')) continue;
    const text = fs.readFileSync(file, 'utf8');
    if (!text.startsWith('#!') || !text.includes('# /// script\n') || (fs.statSync(file).mode & 0o111) === 0) continue;
    const installed = path.join(root, `${count++}`, path.basename(file));
    fs.mkdirSync(path.dirname(installed), { recursive: true });
    fs.copyFileSync(file, installed);
    fs.chmodSync(installed, fs.statSync(file).mode & 0o777);
    const lock = fs.readFileSync(`${file}.lock`, 'utf8');
    // Resolve each declared dependency before the offline forbidden-path checks.
    // An empty cache cannot distinguish a missing lock from absent metadata.
    fs.writeFileSync(`${installed}.lock`, lock);
    const readinessEnvironment = { ...environment };
    delete readinessEnvironment.UV_OFFLINE;
    const readiness = spawnSync('uv', ['lock', '--script', installed, '--refresh'], {
      cwd: root, env: readinessEnvironment, encoding: 'utf8', timeout: 60000,
    });
    assert.equal(readiness.status, 0, readiness.stdout + readiness.stderr);
    assert.equal(fs.readFileSync(`${installed}.lock`, 'utf8'), lock,
      'dependency readiness must preserve the declared lock');
    fs.rmSync(`${installed}.lock`);
    for (const present of [false, true]) {
      const stale = lock.replace(/^requires-python = ".*"$/m, 'requires-python = "==3.12.0"');
      assert.notEqual(stale, lock, file);
      if (present) fs.writeFileSync(`${installed}.lock`, stale);
      const result = spawnSync(installed, ['--help'], { cwd: root, env: environment, encoding: 'utf8', timeout: 60000 });
      assert.equal(result.status, 2, `${file}: ${result.stdout}${result.stderr}`);
      assert.match(result.stderr, /lockfile/i, file);
      assert.equal(result.stdout, '', file);
      assert.equal(fs.existsSync(`${installed}.lock`), present, file);
      if (present) assert.equal(fs.readFileSync(`${installed}.lock`, 'utf8'), stale, file);
    }
  }
  assert.ok(count > 0);
  t.diagnostic(`${count} executable portable launchers rejected both missing and stale locks`);
});

test('portable script metadata carries the existing uv minimum and an adjacent lock', () => {
  for (const root of ['source', 'tools']) {
    for (const relative of fs.readdirSync(path.join(repo, root), { recursive: true })) {
      const file = path.join(repo, root, relative);
      if (!fs.statSync(file).isFile() || relative.split(path.sep).includes('__pycache__')) continue;
      const text = fs.readFileSync(file, 'utf8');
      if (!text.startsWith('#!') || !text.includes('# /// script\n')) continue;
      if ((fs.statSync(file).mode & 0o111) !== 0)
        assert.ok(text.startsWith('#!/usr/bin/env -S uv run --locked --script\n'), `${root}/${relative}: direct launcher must lock`);
      const metadata = text.match(/^# \/\/\/ script\n([\s\S]*?)^# \/\/\/$/m)?.[1];
      assert.ok(metadata, `${root}/${relative}: script metadata must exist`);
      assert.match(metadata, /^# required-version = ">=0\.12\.9"$/m, `${root}/${relative}`);
      assert.ok(fs.existsSync(`${file}.lock`), `${root}/${relative}: missing script lock`);
    }
  }
});

for (const mutation of ['missing minimum', 'minimum outside metadata', 'unlocked direct launcher']) {
test(`the source gate rejects a portable consumer with ${mutation}`, t => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'uv-policy-source-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  for (const entry of ['source', 'tools', 'docs', '.github']) fs.cpSync(path.join(repo, entry), path.join(root, entry),
    { recursive: true, filter: file => !file.split(path.sep).includes('__pycache__') });
  const relative = mutation === 'unlocked direct launcher'
    ? 'source/skills/pkl-engineering/scripts/pkl_agent'
    : 'source/skills/code-knowledge-base/scripts/visualize.py';
  const file = path.join(root, relative);
  const text = fs.readFileSync(file, 'utf8');
  const changed = mutation === 'unlocked direct launcher' ? text.replace('uv run --locked --script', 'uv run --script')
    : text.replace('# required-version = ">=0.12.9"\n', '')
      + (mutation === 'minimum outside metadata' ? '\n# required-version = ">=0.12.9"\n' : '');
  fs.writeFileSync(file, changed);
  const result = spawnSync(process.execPath, [path.join(repo, 'tools/validate-source-graph.mjs'), '--repo', root],
    { encoding: 'utf8' });
  assert.equal(result.status, 1, result.stdout + result.stderr);
  assert.ok((result.stdout + result.stderr).includes(relative));
});
}
