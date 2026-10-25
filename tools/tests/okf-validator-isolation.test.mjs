import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

const repo = path.resolve(import.meta.dirname, '../..');
const skill = process.env.SLOPSENTRAL_OKF_SKILL_ROOT
  ? path.resolve(process.env.SLOPSENTRAL_OKF_SKILL_ROOT)
  : path.join(repo, 'source/skills/code-knowledge-base');

test('OKF validator uses its own locked environment outside a repository', t => {
  const fixture = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'okf-validator-isolation-')));
  t.after(() => fs.rmSync(fixture, { recursive: true, force: true }));
  const installed = path.join(fixture, 'installed skill');
  fs.cpSync(skill, installed, {
    recursive: true,
    filter: entry => !entry.split(path.sep).includes('__pycache__'),
  });
  const consumer = path.join(fixture, 'consumer');
  const docs = path.join(consumer, 'docs');
  fs.mkdirSync(docs, { recursive: true });
  fs.writeFileSync(path.join(docs, 'index.md'), '# Index\n\n[Account](account.md)\n');
  const concept = path.join(docs, 'account.md');
  fs.writeFileSync(concept,
    '---\ntype: systems\ntitle: Account\ndescription: Account state\n---\n# Account\n');

  // Keep CI's interpreter location without its project or package environment.
  const environment = Object.fromEntries(Object.entries(process.env)
    .filter(([name]) => (!name.startsWith('UV_') || name === 'UV_PYTHON_INSTALL_DIR')
      && !name.startsWith('PYTHON') && name !== 'VIRTUAL_ENV'));
  environment.UV_NO_CONFIG = '1';
  environment.UV_PYTHON_DOWNLOADS = 'never';
  environment.PYTHONNOUSERSITE = '1';
  const invoke = args => spawnSync('uv', args, {
    cwd: consumer, env: environment, encoding: 'utf8', timeout: 60000,
  });
  const runtime = path.join(fixture, 'runtime');
  const created = invoke(['venv', '--no-project', '--python', '3.12', runtime]);
  assert.equal(created.status, 0, created.stderr);
  const python = path.join(runtime, process.platform === 'win32' ? 'Scripts/python.exe' : 'bin/python');
  const probe = spawnSync(python,
    ['-c', 'import importlib.util; print(importlib.util.find_spec("yaml") is None)'], {
      cwd: consumer, env: environment, encoding: 'utf8',
    });
  assert.equal(probe.status, 0, probe.stderr);
  assert.equal(probe.stdout.trim(), 'True', 'the ambient test interpreter must lack PyYAML');
  environment.UV_PYTHON = python;
  const validator = path.join(installed, 'scripts/validate.py');
  const command = ['run', '--locked', '--script', validator, 'docs', '--strict'];

  const accepted = invoke(command);
  assert.equal(accepted.status, 0, accepted.stdout + accepted.stderr);
  assert.match(accepted.stdout, /2 file\(s\), 0 error\(s\), 0 lint\(s\)/);
  assert.doesNotMatch(accepted.stderr, /--locked.*no effect/);
  assert.equal(fs.existsSync(path.join(consumer, 'pyproject.toml')), false);
  assert.equal(fs.existsSync(path.join(consumer, 'uv.lock')), false);

  fs.writeFileSync(concept,
    '---\ntype: ""\ntitle: Account\ndescription: Account state\n---\n# Account\n');
  const rejected = invoke(command);
  assert.equal(rejected.status, 1, rejected.stdout + rejected.stderr);
  assert.match(rejected.stdout, /frontmatter is missing a non-empty 'type' string/);

  const lock = `${validator}.lock`;
  const originalLock = fs.readFileSync(lock);
  const originalScript = fs.readFileSync(validator, 'utf8');
  assert.match(originalScript, /pyyaml==6\.0\.3/);
  fs.writeFileSync(validator, originalScript.replace('pyyaml==6.0.3', 'pyyaml==6.0.2'));
  const stale = invoke(command);
  assert.equal(stale.status, 2, stale.stdout + stale.stderr);
  assert.match(stale.stderr, /lockfile.*needs to be updated|lockfile.*not up-to-date/i);
  assert.equal(stale.stdout, '', 'a stale lock must stop before bundle validation');
  assert.deepEqual(fs.readFileSync(lock), originalLock, 'locked execution must not rewrite the lock');
});
