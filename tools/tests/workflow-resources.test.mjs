import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync, spawnSync } from 'node:child_process';
import test from 'node:test';
import { loadCatalog, pluginClosure, auditCatalog, auditProfileComposition, catalogReport } from '../catalog.mjs';
import { validateResourceReference } from '../resource-contract.mjs';
import { project } from '../project-marketplaces.mjs';

const root = path.resolve(import.meta.dirname, '../..');
const catalog = loadCatalog(root);
const resource = catalog.marketplace.resources.find(ref => ref.name === 'pkl-agent-runtime');
assert.ok(resource, 'The runtime resource must keep its canonical identity');
const fixtureName = 'resource-contract-fixture';
const hook = catalog.marketplace.hooks.find(ref => ref.name === 'pkl-evaluate-check');
const fixturePlugin = {
  type: 'PLUGIN', schemaVersion: 1, name: fixtureName, version: '1.0.0',
  description: 'Isolated runtime resource projection fixture.',
  skills: [], agents: [], instructions: [], hooks: [hook],
  metadata: { composition: 'referential', role: 'advanced', workstream: fixtureName,
    owner: fixtureName, scope: 'Runtime resource contract fixture.',
    dailyDriver: 'Use only inside the isolated projection fixture.', notFor: 'Shipped installation.' },
};
const fixtureCatalog = { ...catalog, plugins: [...catalog.plugins,
  { ...fixturePlugin, files: ['plugin.json'] }] };
const closure = name => pluginClosure(fixtureCatalog, fixtureCatalog.plugins.find(plugin => plugin.name === name));
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

test('the executable documentation example preserves the canonical runtime dependency', () => {
  const document = fs.readFileSync(path.join(root, 'docs/workflow-resources.md'), 'utf8');
  const [example] = [...document.matchAll(/```json\n([\s\S]*?)\n```/g)].map(match => JSON.parse(match[1]));
  assert.equal(validateResourceReference(example).type, 'RESOURCE_REFERENCE_VALID');
  assert.deepEqual(example, resource);
});

test('Pkl guidance and unselected runtime contracts keep independent composition', () => {
  const workflows = closure('developer-tooling');
  const checks = closure(fixtureName);
  assert.ok([...workflows.refs.keys()].every(k => k.startsWith('SKILL/') || k.startsWith('AGENT/')));
  assert.ok([...checks.refs.keys()].every(k => k.startsWith('HOOK/') || k.startsWith('RESOURCE/')));
  assert.deepEqual([...checks.refs.keys()].filter(k => k.startsWith('RESOURCE/')),
    ['RESOURCE/pkl-agent-runtime', 'RESOURCE/pkl-agent-runtime-lock']);
  for (const name of ['pkl-workflow-default', 'pkl-checked-repository'])
    assert.deepEqual(auditProfileComposition(catalog, catalog.profiles.find(p => p.name === name)), []);
  assert.match(auditProfileComposition(fixtureCatalog, { name: 'duplicate', plugins: [fixtureName, fixtureName] }).join('\n'), /duplicate plugin selection/);
  assert.equal(catalogReport(catalog).schemaVersion, 3);
});

test('resource identity conflicts and cycles stay rejected across shared consumers', () => {
  const modified = { ...fixtureCatalog, plugins: fixtureCatalog.plugins.map(p => p.name !== fixtureName ? p : {
    ...p, resources: [{ ...resource, path: 'skills/pkl-engineering/scripts/other' }],
  }) };
  assert.match(auditCatalog(modified).join('\n'), /canonical marketplace reference|conflicting dependency locations/);
  const cyclic = { ...fixtureCatalog, marketplace: { ...catalog.marketplace, resources: [{ ...resource, dependsOn: [resource] }] } };
  assert.match(auditCatalog(cyclic).join('\n'), /dependency cycle at RESOURCE\/pkl-agent-runtime/);
});

for (const [harness, tree] of [['codex', '.agents/plugins'], ['github-copilot', '.github/plugin']]) {
  test(`${harness}: runtime-only resource is delivered without discovery and configured hooks execute actual Pkl`, { skip: !pkl }, t => {
    const dir = temporary(t);
    const repo = path.join(dir, 'source-repo');
    fs.mkdirSync(repo);
    fs.cpSync(path.join(root, 'source'), path.join(repo, 'source'), { recursive: true,
      filter: source => !source.split(path.sep).includes('__pycache__') });
    for (const entry of ['tools', 'docs', '.github'])
      fs.cpSync(path.join(root, entry), path.join(repo, entry), { recursive: true });
    const pluginDirectory = path.join(repo, 'source/plugins', fixtureName);
    fs.mkdirSync(pluginDirectory);
    fs.writeFileSync(path.join(pluginDirectory, 'plugin.json'), JSON.stringify(fixturePlugin));
    const marketplacePath = path.join(repo, 'source/adaptable.marketplace.json');
    const marketplace = JSON.parse(fs.readFileSync(marketplacePath));
    marketplace.plugins.push({
      type: 'PLUGIN_ENTRY', name: fixtureName, description: fixturePlugin.description, tags: ['fixture'],
      plugin: { type: 'PLUGIN_REFERENCE', name: fixtureName, version: fixturePlugin.version,
        source: { type: 'LOCAL_SOURCE', path: `./plugins/${fixtureName}` } },
    });
    fs.writeFileSync(marketplacePath, JSON.stringify(marketplace));
    const benchmark = JSON.parse(fs.readFileSync(path.join(repo, 'source/evals/promptfoo/execution/developer-tooling.json')));
    benchmark.targetName = fixtureName;
    benchmark.notes = ['Static projection fixture only. No model run.'];
    benchmark.setupQuestions = ['Which isolated directory owns this fixture?'];
    benchmark.verifiers.commands = ['node tools/tests/workflow-resources.test.mjs --require-native'];
    benchmark.scenarios = [{
      type: 'PLUGIN_EVAL_SCENARIO', id: 'runtime-resource-fixture', title: 'Runtime resource fixture',
      purpose: 'Exercise the runtime-only resource contract.',
      routingCaseIds: ['pkl-checks-preserve-runtime-contract'],
      expectedPrimitive: { type: 'HOOK', name: 'pkl-evaluate-check' },
      userInput: 'Run the supplied isolated resource fixture. Do not change remote state.',
      successChecklist: ['The resource executes without a workflow skill and preserves typed failure.'],
    }];
    fs.writeFileSync(path.join(repo, 'source/evals/promptfoo/execution', fixtureName + '.json'), JSON.stringify(benchmark));
    execFileSync('git', ['init', '-q'], { cwd: repo });
    execFileSync('git', ['-c', 'user.name=Fixture', '-c', 'user.email=fixture@example.invalid',
      '-c', 'commit.gpgsign=false', 'commit', '--allow-empty', '-qm', 'projection fixture'], { cwd: repo });
    const sourceCheck = spawnSync(process.execPath, [path.join(root, 'tools/validate-source-graph.mjs'), '--repo', repo], { encoding: 'utf8' });
    assert.equal(sourceCheck.status, 0, sourceCheck.stdout + sourceCheck.stderr);
    const result = project({ source: repo, harness, out: path.join(dir, 'projection'), pkl });
    const bundle = path.join(result.out, tree, fixtureName);
    const target = path.join(bundle, resource.path);
    assert.deepEqual(fs.readFileSync(target), fs.readFileSync(path.join(root, 'source', resource.path)));
    assert.equal(fs.statSync(target).mode & 0o777, fs.statSync(path.join(root, 'source', resource.path)).mode & 0o777);
    const runtimeLock = `${target}.lock`;
    assert.ok(fs.existsSync(runtimeLock), 'runtime-only projection must supply the adjacent script lock');
    const sourceLock = fs.readFileSync(path.join(root, 'source', `${resource.path}.lock`), 'utf8');
    assert.equal(fs.readFileSync(runtimeLock, 'utf8'), sourceLock);
    assert.ok(fs.readdirSync(bundle, { recursive: true }).every(p => path.basename(p) !== 'SKILL.md'));
    const manifest = JSON.parse(fs.readFileSync(path.join(bundle, harness === 'codex' ? '.codex-plugin/plugin.json' : 'plugin.json')));
    assert.equal(Object.hasOwn(manifest, 'skills'), false);
    const workflowBundle = path.join(result.out, tree, 'developer-tooling');
    const workflowManifest = JSON.parse(fs.readFileSync(path.join(workflowBundle, harness === 'codex' ? '.codex-plugin/plugin.json' : 'plugin.json')));
    assert.equal(Object.hasOwn(workflowManifest, 'hooks'), false);
    assert.ok(fs.existsSync(path.join(workflowBundle, 'skills/pkl-engineering/SKILL.md')));
    if (harness === 'codex') {
      const lock = JSON.parse(fs.readFileSync(path.join(result.out, tree, 'marketplace-lock.json')));
      const references = lock.plugins.find(p => p.name === fixtureName).references;
      const ref = references.find(r => r.name === resource.name);
      assert.equal(ref.sha256, 'sha256:' + crypto.createHash('sha256').update(fs.readFileSync(target)).digest('hex'));
      const lockRef = references.find(r => r.name === 'pkl-agent-runtime-lock');
      assert.equal(lockRef.sha256, 'sha256:' + crypto.createHash('sha256').update(sourceLock).digest('hex'));
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
    const staleLock = sourceLock.replace('>=3.12, <3.14', '>=3.12, <3.13');
    assert.notEqual(staleLock, sourceLock);
    fs.writeFileSync(runtimeLock, staleLock);
    assert.match(run('value: Int = 42\n').reason, /outcome=check-failed/);
    assert.equal(fs.readFileSync(runtimeLock, 'utf8'), staleLock);
    fs.unlinkSync(runtimeLock);
    assert.match(run('value: Int = 42\n').reason, /outcome=check-failed/);
    assert.equal(fs.existsSync(runtimeLock), false);
    fs.writeFileSync(runtimeLock, sourceLock);
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
