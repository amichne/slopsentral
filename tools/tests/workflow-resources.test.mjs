import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';
import test from 'node:test';
import { loadCatalog, pluginClosure, auditCatalog, auditProfileComposition, catalogReport } from '../catalog.mjs';
import { validateResourceReference } from '../resource-contract.mjs';
import { project } from '../project-marketplaces.mjs';

const root = path.resolve(import.meta.dirname, '../..');
const catalog = loadCatalog(root);
const resource = catalog.marketplace.resources[0];
const closure = name => pluginClosure(catalog, catalog.plugins.find(p => p.name === name));
const pkl = process.env.PKL_BIN;
if (process.argv.includes('--require-native') && !pkl) {
  process.stderr.write(JSON.stringify({ type: 'WORKFLOW_RESOURCE_VERIFICATION_REJECTED', reason: 'PKL_RUNTIME_REQUIRED' }) + '\n');
  process.exit(1);
}
function temporary(t) {
  const dir = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'workflow resources ')));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  return dir;
}

test('resource contract refines immutable data and rejects unsafe or workflow payload references', () => {
  const refined = validateResourceReference(resource);
  assert.equal(refined.type, 'RESOURCE_REFERENCE_VALID');
  assert.ok(Object.isFrozen(refined.reference));
  assert.ok(Object.isFrozen(refined.reference.source));
  for (const patch of [
    { type: 'SKILL' }, { unknown: true }, { source: { type: 'LOCAL_SOURCE', path: '../' } },
    { path: '../outside' }, { path: 'skills/pkl-engineering/SKILL.md' },
    { path: 'skills/pkl-engineering/scripts/../SKILL.md' },
    { path: 'skills/pkl-engineering/scripts/SKILL.md' },
    { path: 'skills/pkl-engineering/scripts/SKILL.MD' },
    { path: 'skills/pkl-engineering/scripts//pkl_agent' },
    { path: 'skills/pkl-engineering/scripts/pkl_agent/' },
    { dependsOn: [{ ...resource, type: 'HOOK' }] },
  ]) assert.equal(validateResourceReference({ ...resource, ...patch }).type, 'RESOURCE_REFERENCE_REJECTED');
});

test('guidance and automatic Pkl checks preserve every legacy workflow while selecting effects independently', () => {
  const workflows = closure('pkl-workflows');
  const checks = closure('pkl-repository-checks');
  assert.ok([...workflows.refs.keys()].every(k => k.startsWith('SKILL/')));
  assert.ok([...checks.refs.keys()].every(k => k.startsWith('HOOK/') || k.startsWith('RESOURCE/')));
  assert.deepEqual([...checks.refs.keys()].filter(k => k.startsWith('RESOURCE/')), ['RESOURCE/pkl-agent-runtime']);
  for (const name of ['pkl-workflow-default', 'pkl-checked-repository'])
    assert.deepEqual(auditProfileComposition(catalog, catalog.profiles.find(p => p.name === name)), []);
  assert.match(auditProfileComposition(catalog, { name: 'duplicate', plugins: ['pkl-repository-checks', 'pkl-repository-checks'] }).join('\n'), /duplicate plugin selection/);
  assert.equal(catalogReport(catalog).schemaVersion, 3);
});

test('resource identity conflicts and cycles stay rejected across shared consumers', () => {
  const modified = { ...catalog, plugins: catalog.plugins.map(p => p.name !== 'pkl-repository-checks' ? p : {
    ...p, resources: [{ ...resource, path: 'skills/pkl-engineering/scripts/other' }],
  }) };
  assert.match(auditCatalog(modified).join('\n'), /canonical marketplace reference|conflicting dependency locations/);
  const cyclic = { ...catalog, marketplace: { ...catalog.marketplace, resources: [{ ...resource, dependsOn: [resource] }] } };
  assert.match(auditCatalog(cyclic).join('\n'), /dependency cycle at RESOURCE\/pkl-agent-runtime/);
});

for (const [harness, tree] of [['codex', '.agents/plugins'], ['github-copilot', '.github/plugin']]) {
  test(`${harness}: runtime-only resource is delivered without discovery and configured hooks execute actual Pkl`, { skip: !pkl }, t => {
    const dir = temporary(t);
    const result = project({ source: root, harness, out: path.join(dir, 'projection'), pkl });
    const bundle = path.join(result.out, tree, 'pkl-repository-checks');
    const target = path.join(bundle, resource.path);
    assert.deepEqual(fs.readFileSync(target), fs.readFileSync(path.join(root, 'source', resource.path)));
    assert.equal(fs.statSync(target).mode & 0o777, fs.statSync(path.join(root, 'source', resource.path)).mode & 0o777);
    assert.ok(fs.readdirSync(bundle, { recursive: true }).every(p => path.basename(p) !== 'SKILL.md'));
    const manifest = JSON.parse(fs.readFileSync(path.join(bundle, harness === 'codex' ? '.codex-plugin/plugin.json' : 'plugin.json')));
    assert.equal(Object.hasOwn(manifest, 'skills'), false);
    const workflowBundle = path.join(result.out, tree, 'pkl-workflows');
    const workflowManifest = JSON.parse(fs.readFileSync(path.join(workflowBundle, harness === 'codex' ? '.codex-plugin/plugin.json' : 'plugin.json')));
    assert.equal(Object.hasOwn(workflowManifest, 'hooks'), false);
    assert.ok(fs.existsSync(path.join(workflowBundle, 'skills/pkl-engineering/SKILL.md')));
    if (harness === 'codex') {
      const lock = JSON.parse(fs.readFileSync(path.join(result.out, tree, 'marketplace-lock.json')));
      const ref = lock.plugins.find(p => p.name === 'pkl-repository-checks').references.find(r => r.type === 'RESOURCE');
      assert.equal(ref.sha256, 'sha256:' + crypto.createHash('sha256').update(fs.readFileSync(target)).digest('hex'));
    }
    const config = JSON.parse(fs.readFileSync(path.join(bundle, 'hooks/pkl-evaluate-check.hooks.json')));
    const command = config.hooks.Stop[0].hooks[0].command;
    const fixture = path.join(dir, 'fixture');
    fs.mkdirSync(path.join(fixture, '.intelligence'), { recursive: true });
    fs.writeFileSync(path.join(fixture, '.intelligence/pkl-entrypoints'), 'config.pkl\n');
    function run(source) {
      fs.writeFileSync(path.join(fixture, 'config.pkl'), source);
      const env = { ...process.env, PKL_BIN: pkl, PLUGIN_ROOT: bundle, INTELLIGENCE_CHANGED_FILES: 'config.pkl' };
      delete env.BASH_ENV; delete env.ENV;
      const output = spawnSync('bash', ['--noprofile', '--norc', '-c', command], { cwd: fixture, env, encoding: 'utf8',
        input: JSON.stringify({ hook_event_name: 'Stop', stop_hook_active: false }), timeout: 15000 });
      assert.equal(output.status, 0, output.stderr);
      assert.ok(output.stdout.length < 1024);
      assert.doesNotMatch(output.stdout + output.stderr, /PRIVATE PAYLOAD/);
      return JSON.parse(output.stdout);
    }
    assert.match(run('value: Int = 42\n').systemMessage, /outcome=completed/);
    assert.match(run('value: Int = "PRIVATE PAYLOAD"\n').reason, /outcome=check-failed/);
    fs.unlinkSync(target);
    assert.match(run('value: Int = 42\n').reason, /outcome=check-failed/);
  });
}

test('resource directories are rejected before an evaluator or output is created', t => {
  const dir = temporary(t);
  const repo = path.join(dir, 'repo');
  fs.mkdirSync(repo);
  fs.cpSync(path.join(root, 'source'), path.join(repo, 'source'), { recursive: true,
    filter: p => !p.split(path.sep).includes('__pycache__') });
  const manifest = path.join(repo, 'source/adaptable.marketplace.json');
  const source = JSON.parse(fs.readFileSync(manifest));
  source.resources[0].path = 'skills/pkl-engineering/scripts/tests';
  fs.writeFileSync(manifest, JSON.stringify(source));
  const out = path.join(dir, 'output');
  assert.throws(() => project({ source: repo, harness: 'codex', out, pkl: '/not/an/evaluator' }),
    e => e.outcome?.code === 'SOURCE_REJECTED');
  assert.equal(fs.existsSync(out), false);
});
