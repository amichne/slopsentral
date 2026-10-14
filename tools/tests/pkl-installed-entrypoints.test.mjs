import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test, { after } from 'node:test';

const repo = path.resolve(import.meta.dirname, '../..');
const skill = path.resolve(process.env.SLOPSENTRAL_PKL_SKILL_ROOT
  ?? path.join(repo, 'source/skills/pkl-engineering'));
const readinessRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'legacy-uv-readiness-'));
after(() => fs.rmSync(readinessRoot, { recursive: true, force: true }));
const readinessEnvironment = Object.fromEntries(Object.entries(process.env)
  .filter(([key]) => !key.startsWith('UV_') && !key.startsWith('PYTHON') && key !== 'VIRTUAL_ENV'));
Object.assign(readinessEnvironment, { UV_NO_CONFIG: '1', UV_PYTHON: '3.12', UV_PYTHON_DOWNLOADS: 'never',
  UV_CACHE_DIR: path.join(readinessRoot, 'cache'), PYTHONNOUSERSITE: '1' });
const legacyProbe = spawnSync('uv', ['run', '--locked', '--script',
  path.join(repo, 'tools/tests/fixtures/uv-legacy-probe.py')], {
  cwd: readinessRoot, env: readinessEnvironment, encoding: 'utf8', timeout: 60000,
});
assert.equal(legacyProbe.status, 0, legacyProbe.stderr);
const legacyUv = legacyProbe.stdout.trim();
assert.ok(path.isAbsolute(legacyUv));
const offlineProbe = spawnSync('uv', ['run', '--locked', '--script',
  path.join(repo, 'tools/tests/fixtures/uv-legacy-probe.py')], {
  cwd: readinessRoot, env: { ...readinessEnvironment, UV_OFFLINE: '1' }, encoding: 'utf8', timeout: 60000,
});
assert.equal(offlineProbe.status, 0, offlineProbe.stderr);
assert.equal(offlineProbe.stdout.trim(), legacyUv);

test('legacy uv reproduces the missing-script-lock risk without the minimum-version guard', t => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'uv-missing-lock-control-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const script = path.join(root, 'unprotected.py');
  fs.writeFileSync(script, '# /// script\n# requires-python = ">=3.12,<3.14"\n# dependencies = []\n# ///\nprint("UNPROTECTED_COMMAND_STARTED")\n');
  const result = spawnSync(legacyUv, ['run', '--locked', '--script', script], {
    cwd: root, env: { ...process.env, UV_PYTHON: '3.12', UV_NO_CONFIG: '1', UV_PYTHON_DOWNLOADS: 'never' },
    encoding: 'utf8', timeout: 60000,
  });
  assert.equal(result.status, 0, result.stdout + result.stderr);
  assert.equal(result.stdout.trim(), 'UNPROTECTED_COMMAND_STARTED');
  assert.match(result.stderr, /No lockfile found.*ignoring.*--locked/);
  assert.equal(fs.existsSync(`${script}.lock`), false);
});

for (const [name, args, expected] of [
  ['pkl_agent', [], /Develop and validate typed Pkl configuration/],
  ['pkl_sources', ['catalog'], /apple\/pkl/],
  ['pkl_tooling', ['capabilities'], /json/],
]) {
  test(`${name} direct shebang rejects unsupported uv, missing locks, and stale locks`, t => {
    const fixture = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'pkl-entrypoint-isolation-')));
    t.after(() => fs.rmSync(fixture, { recursive: true, force: true }));
    const installed = path.join(fixture, 'installed skill');
    fs.cpSync(skill, installed, { recursive: true,
      filter: entry => !entry.split(path.sep).includes('__pycache__') });
    const consumer = path.join(fixture, 'consumer');
    fs.mkdirSync(consumer);
    const environment = Object.fromEntries(Object.entries(process.env)
      .filter(([key]) => !key.startsWith('UV_') && !key.startsWith('PYTHON') && key !== 'VIRTUAL_ENV'));
    Object.assign(environment, { UV_NO_CONFIG: '1', UV_PYTHON_DOWNLOADS: 'never', UV_PYTHON: '3.12',
      PYTHONNOUSERSITE: '1', UV_OFFLINE: '1' });
    const script = path.join(installed, 'scripts', name);
    const invoke = () => spawnSync(script, args, {
      cwd: consumer, env: environment, encoding: 'utf8', timeout: 60000,
    });
    const lock = `${script}.lock`;
    const originalLock = fs.readFileSync(lock, 'utf8');
    const accepted = invoke();
    assert.equal(accepted.status, 0, accepted.stdout + accepted.stderr);
    assert.match(accepted.stdout, expected);
    assert.equal(fs.readFileSync(lock, 'utf8'), originalLock);
    assert.equal(fs.existsSync(path.join(consumer, 'pyproject.toml')), false);
    assert.equal(fs.existsSync(path.join(consumer, 'uv.lock')), false);

    assert.match(originalLock, /requires-python = ">=3\.12, <3\.14"/);
    const staleLock = originalLock.replace('>=3.12, <3.14', '>=3.12, <3.13');
    fs.writeFileSync(lock, staleLock);
    const rejected = invoke();
    assert.equal(rejected.status, 2, rejected.stdout + rejected.stderr);
    assert.match(rejected.stderr, /lockfile.*needs to be updated|lockfile.*not up-to-date/i);
    assert.equal(rejected.stdout, '', 'a stale lock must stop before the helper starts');
    assert.equal(fs.readFileSync(lock, 'utf8'), staleLock, 'the direct entry point must not rewrite its lock');
    fs.unlinkSync(lock);
    const missing = invoke();
    assert.equal(missing.status, 2, missing.stdout + missing.stderr);
    assert.match(missing.stderr, /lockfile/i);
    assert.equal(missing.stdout, '');
    assert.equal(fs.existsSync(lock), false);

    const oldBin = path.join(fixture, 'legacy-bin');
    fs.mkdirSync(oldBin);
    fs.symlinkSync(legacyUv, path.join(oldBin, 'uv'));
    const legacy = () => spawnSync(script, args, {
      cwd: consumer, env: { ...environment, PATH: `${oldBin}${path.delimiter}${environment.PATH}` },
      encoding: 'utf8', timeout: 60000,
    });
    for (const present of [false, true]) {
      if (present) fs.writeFileSync(lock, originalLock);
      const unsupported = legacy();
      assert.equal(unsupported.status, 2, unsupported.stdout + unsupported.stderr);
      assert.match(unsupported.stderr, /required.*uv|uv.*required|does not satisfy/i);
      assert.equal(unsupported.stdout, '');
      assert.equal(fs.existsSync(lock), present);
      if (present) assert.equal(fs.readFileSync(lock, 'utf8'), originalLock);
    }
  });
}
