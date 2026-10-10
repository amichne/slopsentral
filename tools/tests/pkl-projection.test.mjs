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

const root = path.resolve(import.meta.dirname, '../..');
const pkl = process.env.PKL_BIN;
const native = { skip: !pkl };
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

for (const [harness, prefix] of [['codex', '.agents/plugins'], ['github-copilot', '.github/plugin']]) {
  test(`${harness}: complete deterministic projection, source bytes, modes, and provider compatibility`, native, t => {
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
        if (name.endsWith('.pyc') || name.split('/').some(p => ['__pycache__', 'build', 'dist', 'target'].includes(p))) continue;
        assert.deepEqual(files.get(prefix + '/' + plugin.name + '/skills/' + ref.name + '/' + name), file);
      }
    }
    for (const [key, value] of tree(path.join(root, 'tools/tests/fixtures/projection-v1', harness)))
      assert.deepEqual(files.get(key)?.bytes, value.bytes, `pinned provider compatibility: ${key}`);
    if (harness === 'codex') {
      const lock = JSON.parse(files.get(prefix + '/marketplace-lock.json').bytes);
      for (const plugin of lock.plugins) for (const ref of plugin.references)
        assert.equal(ref.sha256, checksum(files, prefix + '/' + plugin.name + '/' + ref.targetPath));
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
  execFileSync('git', ['init', '-q'], { cwd: repo });
  execFileSync('git', ['-c', 'user.name=Projection', '-c', 'user.email=projection@example.invalid', 'commit', '--allow-empty', '-qm', 'projection source'], { cwd: repo });
  return { dir, repo };
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
fs.appendFileSync(${JSON.stringify(path.join(repo, 'source/skills/shell-script-safety/SKILL.md'))}, '\\nchanged during evaluation\\n');
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
    { ...base, type: 'HOOK', hook: { type: 'HOOK', name: 'fixture', source: { type: 'LOCAL_SOURCE', path: './' },
      path: 'hooks/fixture.json', adapter: { hooks: { Stop: [{ hooks: [{ type: 'command', command: 'true', unknown: 'field' }] }] } } } },
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
