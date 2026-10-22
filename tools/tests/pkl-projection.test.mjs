import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync, spawn, spawnSync } from 'node:child_process';
import test from 'node:test';
import { pathToFileURL } from 'node:url';
import { project } from '../project-marketplaces.mjs';
import { install } from '../install-projection-pkl.mjs';
import { loadCatalog, pluginClosure } from '../catalog.mjs';
import { currentSourceLocalPaths } from '../routing-source-evidence.mjs';
import { validPaths, invalidPaths, wrappedPaths, nonlocalReferences, effectControlReferences } from './fixtures/current-source-paths.mjs';

const root = path.resolve(import.meta.dirname, '../..');
const pkl = process.env.PKL_BIN;
const native = { skip: !pkl };
const compatibilityBaselines = [
  // PROVENANCE.md names the original source. The first fixture commit preserves those exact provider bytes.
  { name: 'original provider compatibility', sourceRevision: '33b2581eb6758bd39f2b51e4b6b517e79d402da7',
    fixtureRevision: 'c1409b05191c20e110e978844e8919bf6a4b9e25' },
  // The uv migration changed the checked-in fixture bytes without updating PROVENANCE.md.
  { name: 'uv provider regression', sourceRevision: '774716ce2cdee28133d463ae865f4c67bef68fb4',
    fixtureRevision: '774716ce2cdee28133d463ae865f4c67bef68fb4' },
];
function temporary(t) {
  const dir = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'slopsentral projection ')));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  return dir;
}
function tree(directory) {
  return new Map(fs.readdirSync(directory, { recursive: true }).filter(f => fs.statSync(path.join(directory, f)).isFile())
    .sort().map(f => [f, { bytes: fs.readFileSync(path.join(directory, f)), mode: fs.statSync(path.join(directory, f)).mode & 0o777 }]));
}
function checksum(files, prefix) {
  const hash = crypto.createHash('sha256');
  if (files.has(prefix)) hash.update(files.get(prefix).bytes);
  else for (const [key, file] of [...files].filter(([key]) => key.startsWith(prefix + '/')).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0))
    hash.update(key.slice(prefix.length + 1)).update('\0').update(file.bytes).update('\0');
  return 'sha256:' + hash.digest('hex');
}

for (const [harness, prefix] of [['codex', '.agents/plugins'], ['github-copilot', '.github/plugin'], ['amp', '.amp/plugins']]) {
  test(`${harness}: complete deterministic current projection, source bytes, modes, and digests`, native, t => {
    const dir = temporary(t);
    const first = project({ source: root, harness, out: path.join(dir, 'first'), pkl });
    const second = project({ source: root, harness, out: path.join(dir, 'second'), pkl });
    assert.equal(first.type, 'PROJECTED');
    assert.deepEqual(tree(first.out), tree(second.out), 'repeated projections must be byte and mode identical');
    const files = tree(first.out);
    const catalog = loadCatalog(root);
    const market = JSON.parse(files.get(prefix + '/marketplace.json').bytes);
    assert.deepEqual(market.plugins.map(p => p.name), catalog.marketplace.plugins.map(p => p.name));
    for (const plugin of catalog.plugins) for (const ref of pluginClosure(catalog, plugin).refs.values()) {
      if (ref.type !== 'SKILL') continue;
      const original = tree(path.join(root, 'source', ref.path));
      for (const [name, file] of original) {
        if (name.endsWith('.pyc') || name.split('/').some(p => ['__pycache__', '.ruff_cache', '.pytest_cache', 'build', 'dist', 'target'].includes(p))) continue;
        assert.deepEqual(files.get(prefix + '/' + plugin.name + '/skills/' + ref.name + '/' + name), file);
      }
    }
    if (harness === 'codex' || harness === 'amp') {
      const lock = JSON.parse(files.get(prefix + '/marketplace-lock.json').bytes);
      for (const plugin of lock.plugins) for (const ref of plugin.references)
        assert.equal(ref.sha256, checksum(files, prefix + '/' + plugin.name + '/' + ref.targetPath));
    }
  });
  for (const baseline of harness === 'amp' ? [] : compatibilityBaselines) test(`${harness}: ${baseline.name} from pinned source and fixtures`, native, t => {
    const dir = temporary(t);
    const repo = path.join(dir, 'historical-source');
    fs.mkdirSync(repo);
    const archive = execFileSync('git', ['archive', '--format=tar', baseline.sourceRevision, '--', 'source', 'tools'],
      { cwd: root, maxBuffer: 32 * 1024 * 1024 });
    execFileSync('tar', ['-xf', '-', '-C', repo], { input: archive });
    const external = externalEvidencePaths(repo).filter(ref => !fs.existsSync(path.join(repo, ref)));
    if (external.length) {
      const evidence = execFileSync('git', ['archive', '--format=tar', baseline.sourceRevision, '--', ...external],
        { cwd: root, maxBuffer: 32 * 1024 * 1024 });
      execFileSync('tar', ['-xf', '-', '-C', repo], { input: evidence });
    }
    execFileSync('git', ['init', '-q'], { cwd: repo });
    execFileSync('git', ['fetch', '--quiet', '--no-tags', '--depth=1', root, baseline.sourceRevision], { cwd: repo });
    execFileSync('git', ['update-ref', 'HEAD', baseline.sourceRevision], { cwd: repo });
    assert.equal(execFileSync('git', ['rev-parse', 'HEAD'], { cwd: repo, encoding: 'utf8' }).trim(), baseline.sourceRevision);
    // Historical source uses its original policy gate. Current uv policy intentionally rejects its old hook commands.
    // Keep runtime schemas separate so the archived source remains unchanged.
    const runtime = path.join(dir, 'current-projector');
    fs.mkdirSync(path.join(runtime, 'source'), { recursive: true });
    fs.cpSync(path.join(repo, 'tools'), path.join(runtime, 'tools'), { recursive: true });
    fs.cpSync(path.join(repo, 'source/schemas'), path.join(runtime, 'source/schemas'), { recursive: true });
    fs.symlinkSync(path.join(root, 'node_modules'), path.join(runtime, 'node_modules'), 'dir');
    // Copy the current projector unchanged so this proves current mapping compatibility, not an old projector replay.
    for (const name of ['project-marketplaces.mjs', 'catalog.mjs', 'resource-contract.mjs', 'routing-source-evidence.mjs'])
      fs.copyFileSync(path.join(root, 'tools', name), path.join(runtime, 'tools', name));
    fs.cpSync(path.join(root, 'tools/projection'), path.join(runtime, 'tools/projection'), { recursive: true });
    fs.mkdirSync(path.join(runtime, 'source/schemas/primitives'), { recursive: true });
    fs.copyFileSync(path.join(root, 'source/schemas/primitives/resource-reference.schema.json'),
      path.join(runtime, 'source/schemas/primitives/resource-reference.schema.json'));
    const sourceCheck = spawnSync(process.execPath, [path.join(runtime, 'tools/validate-source-graph.mjs'), '--repo', repo], { encoding: 'utf8' });
    assert.equal(sourceCheck.status, 0, sourceCheck.stdout + sourceCheck.stderr);
    const output = execFileSync(process.execPath, [path.join(runtime, 'tools/project-marketplaces.mjs'),
      '--source', repo, '--harness', harness, '--out', path.join(dir, 'historical-projection'), '--pkl-bin', pkl],
      { encoding: 'utf8', maxBuffer: 4 * 1024 * 1024 });
    const result = JSON.parse(output);
    assert.equal(result.type, 'PROJECTED');
    const files = tree(result.out);
    const fixtureRepo = path.join(dir, 'pinned-fixtures');
    fs.mkdirSync(fixtureRepo);
    const fixturePath = 'tools/tests/fixtures/projection-v1/' + harness;
    const fixtureArchive = execFileSync('git', ['archive', '--format=tar', baseline.fixtureRevision, '--', fixturePath],
      { cwd: root, maxBuffer: 4 * 1024 * 1024 });
    execFileSync('tar', ['-xf', '-', '-C', fixtureRepo], { input: fixtureArchive });
    const expected = tree(path.join(fixtureRepo, fixturePath));
    if (baseline.name === 'uv provider regression') {
      assert.deepEqual(tree(path.join(root, fixturePath)), expected, 'checked-in uv fixtures must preserve their pinned bytes and modes');
    }
    assert.ok(expected.size > 0, 'historical compatibility must compare actual fixtures');
    for (const [key, value] of expected) {
      assert.ok(files.has(key), `historical projection must include ${key}`);
      assert.deepEqual(files.get(key).bytes, value.bytes, `pinned provider compatibility: ${key}`);
    }
  });
}

test('unsupported harness and existing or repository output fail before writing', t => {
  const dir = temporary(t);
  const existing = path.join(dir, 'existing');
  fs.mkdirSync(existing);
  fs.writeFileSync(path.join(existing, 'sentinel'), 'preserved');
  for (const [harness, out, code] of [
    ['unknown', path.join(dir, 'unused'), 'INVALID_INVOCATION'],
    ['codex', existing, 'OUTPUT_EXISTS'],
    ['codex', path.join(root, 'source', 'projection'), 'UNSAFE_PATH'],
  ]) assert.throws(() => project({ source: root, harness, out }), e => e.outcome?.code === code);
  const dangling = path.join(dir, 'dangling');
  fs.symlinkSync(path.join(dir, 'absent'), dangling);
  assert.throws(() => project({ source: root, harness: 'codex', out: dangling }), e => e.outcome?.code === 'OUTPUT_EXISTS');
  assert.equal(fs.readFileSync(path.join(existing, 'sentinel'), 'utf8'), 'preserved');
});

function fake(t, behavior) {
  const dir = temporary(t);
  const executable = path.join(dir, 'fake-pkl');
  fs.writeFileSync(executable, `#!${process.execPath}\nif(process.argv.includes('--version')) { console.log('Pkl 0.32.0 (test boundary)'); process.exit(0); }\n${behavior}\n`, { mode: 0o755 });
  return { dir, executable };
}
test('malformed evaluation and incomplete plans cannot create output; diagnostics exclude source text', t => {
  for (const behavior of [
    "process.stderr.write('PRIVATE SOURCE PAYLOAD'); process.exit(3);",
    "process.stdout.write(JSON.stringify({type:'PROJECTION_PLAN',schemaVersion:1,harness:'codex',plugins:[],files:[]}));",
  ]) {
    const { dir, executable } = fake(t, behavior);
    const out = path.join(dir, 'output');
    assert.throws(() => project({ source: root, harness: 'codex', out, pkl: executable }), e =>
      ['PKL_REJECTED', 'INVALID_PLAN'].includes(e.outcome?.code) && !JSON.stringify(e.outcome).includes('PRIVATE SOURCE'));
    assert.equal(fs.existsSync(out), false);
    assert.deepEqual(fs.readdirSync(dir), ['fake-pkl']);
  }
});

function sourceFixture(t) {
  const dir = temporary(t);
  const repo = path.join(dir, 'repo');
  fs.mkdirSync(repo);
  fs.cpSync(path.join(root, 'source'), path.join(repo, 'source'), { recursive: true,
    filter: p => !p.split(path.sep).some(part => part === '__pycache__') });
  for (const relative of externalEvidencePaths(repo)) {
    const destination = path.join(repo, relative);
    fs.mkdirSync(path.dirname(destination), { recursive: true });
    fs.copyFileSync(path.join(root, relative), destination);
    fs.chmodSync(destination, fs.statSync(path.join(root, relative)).mode & 0o777);
  }
  execFileSync('git', ['init', '-q'], { cwd: repo });
  execFileSync('git', ['-c', 'user.name=Projection', '-c', 'user.email=projection@example.invalid', 'commit', '--allow-empty', '-qm', 'projection source'], { cwd: repo });
  return { dir, repo };
}
function externalEvidencePaths(repo) {
  const directory = path.join(repo, 'source/evals');
  const references = new Set();
  for (const relative of fs.readdirSync(directory, { recursive: true }).filter(name => name.endsWith('.json'))) {
    const payload = JSON.parse(fs.readFileSync(path.join(directory, relative), 'utf8'));
    if (payload.type !== 'ROUTING_CASE_SET') continue;
    for (const entry of payload.cases)
      for (const ref of currentSourceLocalPaths(entry.source))
        if (!ref.startsWith('source/')) references.add(ref);
  }
  return [...references].sort();
}

for (const harness of ['codex', 'github-copilot']) {
  test(`${harness}: local caches cannot enter published bytes or source identity`, native, t => {
    const { dir, repo } = sourceFixture(t);
    const caches = ['.ruff_cache', '.pytest_cache'].map(name =>
      path.join(repo, 'source/skills/python-tooling/assets', name, 'private-probe'));
    for (const cache of caches) {
      fs.mkdirSync(path.dirname(cache), { recursive: true });
      fs.writeFileSync(cache, 'PRIVATE LOCAL CACHE');
    }
    const first = project({ source: repo, harness, out: path.join(dir, 'first'), pkl });
    for (const cache of caches) fs.writeFileSync(cache, 'CHANGED PRIVATE LOCAL CACHE');
    const second = project({ source: repo, harness, out: path.join(dir, 'second'), pkl });
    assert.equal(first.sourceSha, second.sourceSha);
    assert.deepEqual(tree(first.out), tree(second.out));
    assert.ok([...tree(first.out).keys()].every(file =>
      !file.split('/').some(part => ['.ruff_cache', '.pytest_cache'].includes(part))));
  });
}

function externalEvidenceFixture(t, references) {
  const fixture = sourceFixture(t);
  for (const relative of references) {
    const file = path.join(fixture.repo, relative);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, 'PRIVATE EXTERNAL EVIDENCE\n', { mode: 0o640 });
  }
  const casesPath = path.join(fixture.repo, 'source/evals/routing/pkl-engineering-workflows.json');
  const payload = JSON.parse(fs.readFileSync(casesPath, 'utf8'));
  payload.cases[0].source.evidenceRefs = [...references, ...nonlocalReferences];
  payload.cases[1].source = { type: 'LOCAL_VALIDATION', capturedAt: '2026-10-13',
    evidenceRefs: ['docs/historical-missing.txt', 'historical-missing.txt'] };
  fs.writeFileSync(casesPath, JSON.stringify(payload));
  // Unreferenced repository files must not enlarge the frozen input.
  fs.symlinkSync('/etc/passwd', path.join(fixture.repo, 'docs/unreferenced-secret'));
  const check = spawnSync(process.execPath, [path.join(root, 'tools/validate-source-graph.mjs'), '--repo', fixture.repo], { encoding: 'utf8' });
  assert.equal(check.status, 0, check.stdout + check.stderr);
  return { ...fixture, references };
}

test('the complete invalid current path matrix rejects before evaluation or publication', native, t => {
  const { dir, repo } = sourceFixture(t);
  const marker = path.join(dir, 'evaluator-invoked');
  const { executable } = fake(t, `
const fs=require('node:fs');
const cp=require('node:child_process');
fs.writeFileSync(${JSON.stringify(marker)}, 'INVOKED');
const r=cp.spawnSync(${JSON.stringify(pkl)},process.argv.slice(2),{encoding:'utf8',maxBuffer:32*1024*1024});
process.stdout.write(r.stdout ?? ''); process.stderr.write(r.stderr ?? ''); process.exitCode=r.status ?? 9;
`);
  fs.writeFileSync(path.join(repo, 'README.md'), 'current evidence\n');
  const casesPath = path.join(repo, 'source/evals/routing/pkl-engineering-workflows.json');
  const payload = JSON.parse(fs.readFileSync(casesPath, 'utf8'));
  for (const ref of [...invalidPaths, ...wrappedPaths]) {
    payload.cases[0].source.evidenceRefs = [ref];
    fs.writeFileSync(casesPath, JSON.stringify(payload));
    const out = path.join(dir, 'output');
    assert.throws(() => project({ source: repo, harness: 'codex', out, pkl: executable }),
      e => { assert.equal(e.outcome?.code, 'SOURCE_REJECTED', `${JSON.stringify(ref)}: ${e}`); return true; });
    assert.equal(fs.existsSync(out), false);
    assert.equal(fs.existsSync(marker), false, `${JSON.stringify(ref)} must not reach the evaluator`);
  }
  fs.mkdirSync(path.join(repo, 'docs'), { recursive: true });
  fs.writeFileSync(path.join(repo, 'docs/\nREADME.md'), 'existing newline filename\n');
  for (const ref of [...effectControlReferences, 'docs/\nREADME.md']) {
    payload.cases[0].source.evidenceRefs = [ref];
    fs.writeFileSync(casesPath, JSON.stringify(payload));
    const out = path.join(dir, 'controls-output');
    assert.throws(() => project({ source: repo, harness: 'codex', out, pkl: executable }),
      e => e.outcome?.code === 'SOURCE_REJECTED');
    assert.equal(fs.existsSync(marker), false);
    assert.equal(fs.existsSync(out), false);
  }
});

for (const [location, evidencePaths] of [
  ['nested', ['docs/projection-evidence.txt', 'tools/projection-evidence.txt', '.github/projection-evidence.txt']],
  ['root', validPaths],
]) {
for (const harness of ['codex', 'github-copilot']) {
  test(`${harness}: ${location} current evidence validates frozen source without entering payloads`, native, t => {
    const { dir, repo, references } = externalEvidenceFixture(t, evidencePaths);
    const result = project({ source: repo, harness, out: path.join(dir, 'output'), pkl });
    assert.equal(result.type, 'PROJECTED');
    const projected = tree(result.out);
    for (const ref of references) assert.equal(projected.has(ref), false, `evidence entered payload: ${ref}`);
    for (const [name, file] of projected) {
      assert.equal(file.bytes.includes(Buffer.from('PRIVATE EXTERNAL EVIDENCE')), false, name);
    }
  });
}

test(`missing ${location} current evidence rejects before evaluation or publication`, t => {
  const { dir, repo, references } = externalEvidenceFixture(t, evidencePaths);
  fs.unlinkSync(path.join(repo, references[0]));
  const out = path.join(dir, 'output');
  assert.throws(() => project({ source: repo, harness: 'codex', out, pkl: '/absent/evaluator' }),
    e => e.outcome?.code === 'SOURCE_REJECTED');
  assert.equal(fs.existsSync(out), false);
});

for (const mutation of ['bytes', 'mode', 'removal']) {
  test(`${location} current evidence ${mutation} mutation rejects the frozen result`, native, t => {
    const { dir, repo, references } = externalEvidenceFixture(t, evidencePaths);
    const target = path.join(repo, references[0]);
    const change = mutation === 'bytes' ? `fs.appendFileSync(target, 'changed');`
      : mutation === 'mode' ? `fs.chmodSync(target, 0o600);`
        : `if(fs.existsSync(target)) fs.unlinkSync(target);`;
    const { executable } = fake(t, `
const fs=require('node:fs');
const cp=require('node:child_process');
const target=${JSON.stringify(target)};
${change}
const r=cp.spawnSync(${JSON.stringify(pkl)},process.argv.slice(2),{encoding:'utf8',maxBuffer:32*1024*1024});
process.stdout.write(r.stdout ?? ''); process.stderr.write(r.stderr ?? ''); process.exitCode=r.status ?? 9;
`);
    const out = path.join(dir, 'output');
    assert.throws(() => project({ source: repo, harness: 'codex', out, pkl: executable }),
      e => { assert.equal(e.outcome?.code, 'INPUT_CHANGED', JSON.stringify(e.outcome)); return true; });
    assert.equal(fs.existsSync(out), false);
  });
}
}

test('symbolic source fails closed before publication', t => {
  const { dir, repo } = sourceFixture(t);
  fs.symlinkSync('/etc/passwd', path.join(repo, 'source', 'escape'));
  assert.throws(() => project({ source: repo, harness: 'codex', out: path.join(dir, 'output') }), e => e.outcome?.code === 'UNSAFE_PATH');
  assert.equal(fs.existsSync(path.join(dir, 'output')), false);
});

test('source mutation during evaluation rejects the frozen result', native, t => {
  const { dir, repo } = sourceFixture(t);
  const { executable } = fake(t, `
const fs=require('node:fs');
const cp=require('node:child_process');
fs.appendFileSync(${JSON.stringify(path.join(repo, 'source/skills/python-tooling/SKILL.md'))}, '\\nchanged during evaluation\\n');
const r=cp.spawnSync(${JSON.stringify(pkl)},process.argv.slice(2),{encoding:'utf8',maxBuffer:32*1024*1024});
process.stdout.write(r.stdout ?? ''); process.stderr.write(r.stderr ?? ''); process.exitCode=r.status ?? 9;
`);
  assert.throws(() => project({ source: repo, harness: 'codex', out: path.join(dir, 'output'), pkl: executable }),
    e => { assert.equal(e.outcome?.code, 'INPUT_CHANGED', JSON.stringify(e.outcome)); return true; });
  assert.equal(fs.existsSync(path.join(dir, 'output')), false);
});

test('runtime setup rejects corrupt downloads and unsupported platforms without writing', async t => {
  const dir = temporary(t);
  const out = path.join(dir, 'pkl');
  const corrupt = await install({ out, platform: 'linux-x64', download: async () => new Response('tampered') });
  assert.deepEqual(corrupt, { type: 'PKL_INSTALL_REJECTED', reason: 'DIGEST_MISMATCH' });
  assert.equal(fs.existsSync(out), false);
  const unsupported = await install({ out, platform: 'unknown', download: () => assert.fail('must not download') });
  assert.deepEqual(unsupported, { type: 'PKL_INSTALL_REJECTED', reason: 'UNSUPPORTED_PLATFORM' });
});

test('CLI emits a finite rejected outcome for invalid invocation', () => {
  const result = spawnSync(process.execPath, ['tools/project-marketplaces.mjs', '--harness', 'unknown', '--source', root, '--out', '/tmp/unused-projection'], { cwd: root, encoding: 'utf8' });
  assert.equal(result.status, 1);
  assert.equal(JSON.parse(result.stderr).code, 'INVALID_INVOCATION');
  assert.equal(result.stdout, '');
});

test('atomic publication preserves existing empty directories and admits one competing writer', async t => {
  const dir = temporary(t);
  const helper = path.join(root, 'tools/projection/publish_directory.py');
  const stages = ['one', 'two', 'three'].map(name => {
    const stage = path.join(dir, name);
    fs.mkdirSync(stage);
    fs.writeFileSync(path.join(stage, 'winner'), name);
    return stage;
  });
  const existing = path.join(dir, 'existing');
  fs.mkdirSync(existing);
  assert.deepEqual(JSON.parse(execFileSync('python3', [helper, stages[2], existing], { encoding: 'utf8' })),
    { type: 'PUBLISH_REJECTED', reason: 'OUTPUT_EXISTS' });
  assert.deepEqual(fs.readdirSync(existing), []);
  const target = path.join(dir, 'target');
  const outcomes = await Promise.all(stages.slice(0, 2).map(stage => new Promise((resolve, reject) => {
    const child = spawn('python3', [helper, stage, target]);
    let output = '';
    child.stdout.on('data', bytes => { output += bytes; });
    child.on('error', reject);
    child.on('close', code => code === 0 ? resolve(JSON.parse(output)) : reject(new Error('publication boundary failed')));
  })));
  assert.deepEqual(outcomes.map(o => o.type).sort(), ['PUBLISHED', 'PUBLISH_REJECTED']);
  assert.equal(outcomes.find(o => o.type === 'PUBLISH_REJECTED').reason, 'OUTPUT_EXISTS');
  const winner = fs.readFileSync(path.join(target, 'winner'), 'utf8');
  assert.ok(['one', 'two'].includes(winner));
  assert.equal(fs.existsSync(path.join(dir, winner)), false);
  assert.equal(fs.readFileSync(path.join(dir, winner === 'one' ? 'two' : 'one', 'winner'), 'utf8'), winner === 'one' ? 'two' : 'one');
});

// Exercise the native typed boundary, independently of the source graph gate.
test('Pkl rejects impossible asset variants and unknown nested input fields', native, t => {
  const dir = temporary(t);
  for (const name of ['Schema.pkl', 'Decode.pkl', 'Targets.pkl', 'Project.pkl'])
    fs.copyFileSync(path.join(root, 'tools/projection', name), path.join(dir, name));
  const base = { type: 'SKILL', name: 'fixture', sourcePath: 'source/skills/fixture', sha256: 'sha256:' + 'a'.repeat(64) };
  const references = [
    { ...base, hook: {} },
    { ...base, type: 'AGENT' },
    { ...base, type: 'UNKNOWN' },
    { ...base, sourcePath: '../outside' },
    { ...base, type: 'RESOURCE', sourcePath: 'source/skills/fixture/SKILL.md' },
    { ...base, type: 'RESOURCE', sourcePath: 'source/skills/fixture/scripts/SKILL.MD' },
    { ...base, type: 'RESOURCE', sourcePath: 'source/skills/fixture/scripts/../runtime' },
    { ...base, type: 'RESOURCE', sourcePath: 'outside/skills/fixture/scripts/runtime' },
    { ...base, type: 'RESOURCE', sourcePath: 'source/skills/fixture/scripts/runtime/' },
    { ...base, type: 'HOOK', hook: { type: 'HOOK', name: 'fixture', source: { type: 'LOCAL_SOURCE', path: './' },
      path: 'hooks/fixture.json', adapter: { hooks: { Stop: [{ hooks: [{ type: 'command', command: 'true', unknown: 'field' }] }] } } } },
    { ...base, type: 'HOOK', hook: { type: 'HOOK', name: 'fixture', source: { type: 'LOCAL_SOURCE', path: './' },
      path: 'hooks/fixture.json', adapter: { hooks: { Stop: [{ hooks: [{ type: 'command', command: 'true' }] }] } },
      dependsOn: [{ type: 'RESOURCE', name: 'runtime', source: { type: 'LOCAL_SOURCE', path: './' },
        path: 'skills/fixture/scripts/runtime', dependsOn: [{ type: 'SKILL', name: 'fixture',
          source: { type: 'LOCAL_SOURCE', path: './' }, path: 'skills/fixture' }] }] } },
  ];
  for (const ref of references) {
    const input = { name: 'fixture', owner: { name: 'Fixture' }, description: 'Fixture', generatedAt: '2026-10-10T00:00:00Z',
      sourceSha: 'a'.repeat(40), phase: 'PLAN', projectedDigests: {}, plugins: [{ name: 'fixture', version: '1.0.0',
        description: 'Fixture', interface: {}, tags: [], references: [ref] }] };
    const file = path.join(dir, 'input.json');
    fs.writeFileSync(file, JSON.stringify(input));
    const result = spawnSync(pkl, ['eval', '--no-project', '--no-cache', '--root-dir', dir, '--allowed-modules', '^pkl:,^file:',
      '--allowed-resources', '^prop:,^file:', '-p', 'harness=codex', '-p', 'input=' + pathToFileURL(file).href, path.join(dir, 'Project.pkl')],
      { encoding: 'utf8', timeout: 10000 });
    assert.notEqual(result.status, 0, 'invalid asset state must fail native Pkl evaluation');
    assert.equal(result.stdout, '');
  }
});
