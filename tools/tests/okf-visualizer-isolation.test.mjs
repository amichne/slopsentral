import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

const repo = path.resolve(import.meta.dirname, '../..');
const skill = path.resolve(process.env.SLOPSENTRAL_OKF_SKILL_ROOT
  ?? path.join(repo, 'source/skills/code-knowledge-base'));

test('documented OKF visualization uses its own lock outside a repository', t => {
  const fixture = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'okf-visualizer-isolation-')));
  t.after(() => fs.rmSync(fixture, { recursive: true, force: true }));
  const installed = path.join(fixture, 'installed skill');
  fs.cpSync(skill, installed, { recursive: true,
    filter: entry => !entry.split(path.sep).includes('__pycache__') });
  const consumer = path.join(fixture, 'consumer');
  const docs = path.join(consumer, 'docs');
  fs.mkdirSync(docs, { recursive: true });
  fs.writeFileSync(path.join(docs, 'index.md'), '# Index\n\n[Account](account.md)\n');
  fs.writeFileSync(path.join(docs, 'account.md'),
    '---\ntype: systems\ntitle: Account\ndescription: Account state\n---\n# Account\n');
  // Keep CI's interpreter location without its project or package environment.
  const environment = Object.fromEntries(Object.entries(process.env)
    .filter(([name]) => (!name.startsWith('UV_') || name === 'UV_PYTHON_INSTALL_DIR')
      && !name.startsWith('PYTHON') && name !== 'VIRTUAL_ENV'));
  Object.assign(environment, { UV_NO_CONFIG: '1', UV_PYTHON_DOWNLOADS: 'never', PYTHONNOUSERSITE: '1' });
  const invoke = args => spawnSync('uv', args, {
    cwd: consumer, env: environment, encoding: 'utf8', timeout: 60000,
  });
  const runtime = path.join(fixture, 'runtime');
  const created = invoke(['venv', '--no-project', '--python', '3.12', runtime]);
  assert.equal(created.status, 0, created.stderr);
  const python = path.join(runtime, process.platform === 'win32' ? 'Scripts/python.exe' : 'bin/python');
  const probe = spawnSync(python, ['-c', 'import importlib.util; print(importlib.util.find_spec("yaml") is None)'],
    { cwd: consumer, env: environment, encoding: 'utf8' });
  assert.equal(probe.status, 0, probe.stderr);
  assert.equal(probe.stdout.trim(), 'True', 'the ambient interpreter must lack PyYAML');
  environment.UV_PYTHON = python;
  const guide = fs.readFileSync(path.join(installed, 'references/knowledge-page-contract.md'), 'utf8');
  const line = guide.split('\n').find(value => value.startsWith('uv run ') && value.includes('/scripts/visualize.py'));
  assert.ok(line, 'the installed guide must provide the visualization command');
  const [binary, ...command] = line.match(/"[^"]*"|\S+/gu)
    .map(value => value.replace(/^"|"$/g, '').replace('<skill-root>', installed));
  assert.equal(binary, 'uv');
  const accepted = invoke(command);
  assert.equal(accepted.status, 0, accepted.stdout + accepted.stderr);
  assert.match(accepted.stdout, /viz\.html : 1 nodes, 0 edges/);
  const html = fs.readFileSync(path.join(docs, 'viz.html'), 'utf8');
  const nodes = JSON.parse(html.match(/var NODES = (.*?), EDGES = /)[1]);
  assert.deepEqual(nodes.map(node => ({ id: node.id, label: node.label, type: node.type })),
    [{ id: 'account', label: 'Account', type: 'systems' }]);
  assert.equal(fs.readFileSync(path.join(docs, 'graph.mmd'), 'utf8'),
    '```mermaid\ngraph LR\n    root["root (1)"]\n```\n');
  assert.equal(fs.existsSync(path.join(consumer, 'pyproject.toml')), false);
  assert.equal(fs.existsSync(path.join(consumer, 'uv.lock')), false);
  assert.doesNotMatch(accepted.stderr, /--locked.*no effect/);

  const missing = invoke([...command.slice(0, -1), 'missing-bundle']);
  assert.equal(missing.status, 2, missing.stdout + missing.stderr);
  assert.match(missing.stderr, /not a directory/);
  const script = path.join(installed, 'scripts/visualize.py');
  const lock = `${script}.lock`;
  const originalLock = fs.readFileSync(lock);
  const source = fs.readFileSync(script, 'utf8');
  assert.match(source, /pyyaml==6\.0\.3/);
  fs.writeFileSync(script, source.replace('pyyaml==6.0.3', 'pyyaml==6.0.2'));
  fs.unlinkSync(path.join(docs, 'viz.html'));
  fs.unlinkSync(path.join(docs, 'graph.mmd'));
  const stale = invoke(command);
  assert.equal(stale.status, 2, stale.stdout + stale.stderr);
  assert.match(stale.stderr, /lockfile.*needs to be updated|lockfile.*not up-to-date/i);
  assert.equal(stale.stdout, '');
  assert.equal(fs.existsSync(path.join(docs, 'viz.html')), false);
  assert.equal(fs.existsSync(path.join(docs, 'graph.mmd')), false);
  assert.deepEqual(fs.readFileSync(lock), originalLock);
});
