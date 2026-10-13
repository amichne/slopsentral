import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

const repo = path.resolve(import.meta.dirname, '../..');
const skill = path.resolve(process.env.SLOPSENTRAL_PKL_SKILL_ROOT
  ?? path.join(repo, 'source/skills/pkl-engineering'));

for (const [name, args, expected] of [
  ['pkl_agent', [], /Develop and validate typed Pkl configuration/],
  ['pkl_sources', ['catalog'], /apple\/pkl/],
  ['pkl_tooling', ['capabilities'], /json/],
]) {
  test(`${name} direct shebang uses its script lock and rejects a stale lock`, t => {
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
  });
}
