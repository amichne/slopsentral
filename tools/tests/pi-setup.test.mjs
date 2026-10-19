import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { pathToFileURL } from 'node:url';
import { install, qualify, rollback, shellQuote } from '../setup-pi.mts';
import { DefaultResourceLoader, SettingsManager } from '@earendil-works/pi-coding-agent';

const uv = process.env.UV_BIN ?? 'uv';
const root = path.resolve(import.meta.dirname, '../..');
test('bootstrap --help is offline and describes native setup and recovery', () => {
  const environment = { ...process.env };
  delete environment.SLOPSENTRAL_PI_VERSION;
  const result = spawnSync('/bin/sh', [path.join(root, 'tools/install-pi.sh'), '--help'], { env: environment, encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /native Pi/);
  assert.match(result.stdout, /--rollback/);
  assert.match(result.stdout, /--project/);
});

const hash = value => crypto.createHash('sha256').update(value).digest('hex');
const json = value => Buffer.from(JSON.stringify(value));
function workspace(t) {
  const directory = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "Pi setup 'literal; $fixture ")));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  const cwd = path.join(directory, 'project'), agentDir = path.join(directory, 'agent');
  fs.mkdirSync(cwd); fs.mkdirSync(agentDir);
  const oldHome = process.env.HOME; process.env.HOME = directory;
  t.after(() => { if (oldHome === undefined) delete process.env.HOME; else process.env.HOME = oldHome; });
  return { directory, cwd, agentDir, project: false };
}
function write(file, value) { fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, json(value)); }
function bundle(directory, version = '0.1.123', instruction = '') {
  const pkg = path.join(directory, 'input-' + version + '-' + crypto.randomUUID());
  fs.mkdirSync(path.join(pkg, 'owner/skills/example'), { recursive: true });
  const skill = Buffer.from('---\nname: example\ndescription: A native fixture skill.\n---\nUse the fixture.\n');
  fs.writeFileSync(path.join(pkg, 'owner/skills/example/SKILL.md'), skill);
  write(path.join(pkg, 'package.json'), { name: 'slopsentral-pi', version: '0.1.0', type: 'module', pi: { skills: ['./owner/skills/example'] } });
  for (const name of ['marketplace.json', 'marketplace-lock.json']) write(path.join(pkg, name), {});
  fs.writeFileSync(path.join(pkg, 'AGENTS.md'), instruction);
  const instructions = [];
  if (instruction) { fs.mkdirSync(path.join(pkg, 'owner/instructions')); fs.writeFileSync(path.join(pkg, 'owner/instructions/example.md'), instruction); instructions.push({ name: 'example', path: 'owner/instructions/example.md', sha256: 'sha256:' + hash(instruction) }); }
  write(path.join(pkg, 'profile-inventory.json'), { type: 'PI_CONTENT_PROFILE', schemaVersion: 1, profile: 'fixture', invocation: 'either', instructionFile: 'AGENTS.md', skills: [{ name: 'example', path: 'owner/skills/example', sha256: 'sha256:' + hash(Buffer.concat([Buffer.from('SKILL.md\0'), skill, Buffer.from('\0')])) }], instructions });
  const out = path.join(directory, 'packed-' + crypto.randomUUID());
  const packed = spawnSync(uv, ['run', '--locked', '--script', 'tools/package_pi.py', pkg, out, '--version', version], { cwd: root, encoding: 'utf8' });
  assert.equal(packed.status, 0, packed.stderr + packed.stdout);
  return fs.readFileSync(JSON.parse(packed.stdout).archive);
}
function producer(archive, version = '0.1.123') {
  const revision = 'a'.repeat(40), tree = 'c'.repeat(40), tag = 'slopsentral-v' + version;
  const candidate = { schema_version: 1, repository: 'amichne/slopsentral', source_revision: revision, source_tree: tree, run_id: 101, run_number: Number(version.split('.').at(-1)), run_attempt: 1, event: 'push', version, archive: 'slopsentral-pi-' + version + '.tgz', sha256: hash(archive), size: archive.length };
  const promotion = { repository: candidate.repository, source_revision: revision, merged_revision: revision, source_tree: tree, version, main_run_id: 101, main_run_attempt: 1, build_run_id: 101, build_run_attempt: 1, candidate_sha256: hash(json(candidate)), archive_sha256: hash(archive) };
  const setup = { schema_version: 1, repository: candidate.repository, source_revision: revision, version, candidate_sha256: hash(json(candidate)), files: ['install-pi.sh', 'setup-pi.mts'].map(file => ({ file, sha256: hash(fs.readFileSync(path.join(root, 'tools', file))), size: fs.statSync(path.join(root, 'tools', file)).size })) };
  const bytes = new Map([['candidate.json', json(candidate)], ['promotion.json', json(promotion)], ['setup.json', json(setup)], [candidate.archive, archive]]);
  const release = { tag_name: tag, draft: false, prerelease: false, assets: [...bytes].map(([name, value]) => ({ name, size: value.length, digest: 'sha256:' + hash(value), browser_download_url: 'https://github.com/amichne/slopsentral/releases/download/' + tag + '/' + name })) };
  const run = { id: 101, repository: { full_name: candidate.repository }, path: '.github/workflows/validate-source.yml', head_sha: revision, head_branch: 'main', event: 'push', status: 'completed', conclusion: 'success', run_attempt: 1, run_number: candidate.run_number };
  const steps = [
    ['Validate marketplace source', ['Compile Kotlin concepts and forbidden calls', 'Validate Pkl facade against native Pkl', 'Project both providers and execute projected hook contracts']],
    ['Retain tested Pi candidate', ['Examine every Pi contract through the native host', 'Install the candidate archive through the native Pi CLI', 'Test native setup and recovery', 'Retain the tested setup installer']],
  ];
  const jobs = { jobs: steps.map(([name, names]) => ({ name, conclusion: 'success', steps: names.map(name => ({ name, conclusion: 'success' })) })) };
  const routes = new Map([['/releases/latest', release], ['/releases/tags/' + tag, release], ['/actions/runs/101', { ...run, run_attempt: 2, conclusion: 'failure' }], ['/actions/runs/101/attempts/1', run], ['/actions/runs/101/attempts/1/jobs?per_page=100', jobs], ['/git/commits/' + revision, { tree: { sha: tree } }], ['/git/ref/tags/' + tag, { object: { type: 'commit', sha: revision } }]]);
  return { run, jobs, bytes, release, client: { json: async route => { assert.ok(routes.has(route), route); return structuredClone(routes.get(route)); }, bytes: async url => { const result = bytes.get(url.split('/').at(-1)); assert.ok(result); return result; } } };
}

test('clean and repeat setup preserve unrelated configuration and native discovery', async t => {
  const options = workspace(t);
  const unrelated = { model: 'user-model', custom: { keep: true }, packages: [] };
  write(path.join(options.agentDir, 'settings.json'), unrelated);
  fs.writeFileSync(path.join(options.agentDir, 'auth.json'), 'authentication sentinel');
  const fixture = producer(bundle(options.directory));
  const admitted = await qualify(fixture.client);
  const first = await install(admitted, options);
  assert.equal(first.status, 'INSTALLED');
  const settings = JSON.parse(fs.readFileSync(path.join(options.agentDir, 'settings.json')));
  assert.equal(settings.model, unrelated.model); assert.deepEqual(settings.custom, unrelated.custom); assert.equal(settings.packages.length, 1);
  const transaction = fs.readFileSync(path.join(first.state, 'transaction.json'));
  assert.equal((await install(await qualify(fixture.client), options)).status, 'CURRENT');
  assert.deepEqual(fs.readFileSync(path.join(first.state, 'transaction.json')), transaction);
  const manager = SettingsManager.create(options.cwd, options.agentDir);
  const loader = new DefaultResourceLoader({ cwd: options.cwd, agentDir: options.agentDir, settingsManager: manager });
  await loader.reload();
  assert.deepEqual(loader.getSkills().skills.map(skill => skill.name), ['example']);
  assert.deepEqual(loader.getExtensions().errors, []);
  assert.equal(loader.getExtensions().extensions.some(extension => extension.path.includes('slopsentral-setup')), false);
  assert.equal(fs.readFileSync(path.join(options.agentDir, 'auth.json'), 'utf8'), 'authentication sentinel');
  rollback(options);
  assert.deepEqual(JSON.parse(fs.readFileSync(path.join(options.agentDir, 'settings.json'))), unrelated);
});

test('upgrade removes legacy filtered, project-shadowing and local-path registrations, preserving old records', async t => {
  const options = workspace(t), old = path.join(options.directory, 'legacy package');
  write(path.join(old, 'package.json'), { name: 'slopsentral-pi', pi: { extensions: ['./extensions/slopsentral.ts'], skills: [] } });
  fs.mkdirSync(path.join(old, 'extensions')); fs.writeFileSync(path.join(old, 'extensions/slopsentral.ts'), 'throw Error("old runtime loaded");');
  const source = 'npm:slopsentral-pi@https://github.com/amichne/slopsentral/releases/download/slopsentral-v0.1.243/slopsentral-pi-0.1.243.tgz';
  const personal = { packages: [{ source, skills: [], extensions: ['./extensions/slopsentral.ts'] }, old], extensions: [path.join(old, 'extensions/slopsentral.ts')], custom: { preserved: true } };
  const project = { packages: [source], model: 'project-model' };
  write(path.join(options.agentDir, 'settings.json'), personal); write(path.join(options.cwd, '.pi/settings.json'), project);
  const journal = path.join(options.agentDir, 'sessions/old-session.jsonl'); fs.mkdirSync(path.dirname(journal)); fs.writeFileSync(journal, 'old slopsentral-profile and journal sentinel');
  const first = await install(await qualify(producer(bundle(options.directory)).client), options);
  const current = JSON.parse(fs.readFileSync(path.join(options.agentDir, 'settings.json')));
  assert.equal(current.packages.length, 1); assert.equal(typeof current.packages[0], 'string'); assert.deepEqual(current.extensions, []); assert.deepEqual(current.custom, personal.custom);
  assert.deepEqual(JSON.parse(fs.readFileSync(path.join(options.cwd, '.pi/settings.json'))), { packages: [], model: 'project-model' });
  const loader = new DefaultResourceLoader({ cwd: options.cwd, agentDir: options.agentDir, settingsManager: SettingsManager.create(options.cwd, options.agentDir) }); await loader.reload();
  assert.deepEqual(loader.getSkills().skills.map(skill => skill.name), ['example']); assert.deepEqual(loader.getExtensions().errors, []);
  assert.equal(loader.getExtensions().extensions.some(e => e.path.startsWith(old)), false);
  assert.equal(fs.readFileSync(journal, 'utf8'), 'old slopsentral-profile and journal sentinel');
  rollback(options);
  assert.deepEqual(JSON.parse(fs.readFileSync(path.join(options.agentDir, 'settings.json'))), personal);
  assert.deepEqual(JSON.parse(fs.readFileSync(path.join(options.cwd, '.pi/settings.json'))), project);
});

test('project instructions preserve existing text, occur once, and respect native project trust', async t => {
  const options = { ...workspace(t), project: true }, instruction = 'Scoped fixture instruction.\n';
  fs.writeFileSync(path.join(options.cwd, 'AGENTS.md'), '# Existing project\nPreserve me.\n');
  const original = fs.readFileSync(path.join(options.cwd, 'AGENTS.md'));
  const first = await install(await qualify(producer(bundle(options.directory, '0.1.123', instruction)).client), options);
  await install(await qualify(producer(bundle(options.directory, '0.1.123', instruction)).client), options);
  const updated = fs.readFileSync(path.join(options.cwd, 'AGENTS.md'), 'utf8');
  assert.ok(updated.startsWith(original.toString())); assert.equal(updated.split(instruction.trim()).length, 2);
  const trusted = new DefaultResourceLoader({ cwd: options.cwd, agentDir: options.agentDir, settingsManager: SettingsManager.create(options.cwd, options.agentDir) }); await trusted.reload();
  assert.deepEqual(trusted.getSkills().skills.map(skill => skill.name), ['example']);
  assert.ok(trusted.getAgentsFiles().agentsFiles.some(file => file.path === path.join(options.cwd, 'AGENTS.md') && file.content.includes(instruction.trim())));
  const untrusted = new DefaultResourceLoader({ cwd: options.cwd, agentDir: options.agentDir, settingsManager: SettingsManager.create(options.cwd, options.agentDir, { projectTrusted: false }) }); await untrusted.reload();
  assert.equal(untrusted.getSkills().skills.some(skill => skill.name === 'example'), false);
  assert.equal(fs.existsSync(path.join(options.cwd, '.pi/trust.json')), false);
  rollback(options); assert.deepEqual(fs.readFileSync(path.join(options.cwd, 'AGENTS.md')), original);
});

for (const fault of ['checksum', 'failed-run', 'skipped-step', 'wrong-source']) test('qualification rejects ' + fault + ' before configuration effects', async t => {
  const options = workspace(t), fixture = producer(bundle(options.directory));
  if (fault === 'checksum') fixture.bytes.set('slopsentral-pi-0.1.123.tgz', Buffer.from('wrong bytes'));
  if (fault === 'failed-run') fixture.run.conclusion = 'failure';
  if (fault === 'skipped-step') fixture.jobs.jobs[1].steps[2].conclusion = 'skipped';
  if (fault === 'wrong-source') fixture.run.head_sha = 'b'.repeat(40);
  await assert.rejects(qualify(fixture.client));
  assert.equal(fs.existsSync(path.join(options.agentDir, 'settings.json')), false);
});

test('later edits block rollback and concurrent edits block installation', async t => {
  const options = workspace(t), admitted = await qualify(producer(bundle(options.directory)).client);
  const config = path.join(options.agentDir, 'settings.json');
  await assert.rejects(install(admitted, { ...options, beforeCommit: () => write(config, { model: 'concurrent change' }) }), /CONFIG_CHANGED/);
  assert.deepEqual(JSON.parse(fs.readFileSync(config)), { model: 'concurrent change' });
  const result = await install(admitted, options);
  write(config, { model: 'later edit' });
  assert.throws(() => rollback(options), /CONFIG_CHANGED/);
  assert.deepEqual(JSON.parse(fs.readFileSync(config)), { model: 'later edit' });
});

test('partial write failure restores all prior configuration and keeps recovery evidence', async t => {
  const options = { ...workspace(t), project: true };
  const config = path.join(options.cwd, '.pi/settings.json'); write(config, { model: 'preserve' });
  const before = fs.readFileSync(config); let writes = 0;
  await assert.rejects(install(await qualify(producer(bundle(options.directory, '0.1.123', 'Fixture instruction.\n')).client), { ...options,
    write: (file, bytes, mode) => { if (++writes === 2) throw Error('fixture write failure'); fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, bytes, { mode }); },
  }), /fixture write failure/);
  assert.deepEqual(fs.readFileSync(config), before);
  assert.equal(fs.existsSync(path.join(options.cwd, 'AGENTS.md')), false);
});

test('existing native version damage is reported rather than overwritten', async t => {
  const options = workspace(t), admitted = await qualify(producer(bundle(options.directory)).client);
  const result = await install(admitted, options);
  const file = path.join(result.state, 'packages/0.1.123/owner/skills/example/SKILL.md'); fs.writeFileSync(file, 'user modification');
  await assert.rejects(install(admitted, options), /INSTALLED_BYTES_CHANGED/);
  assert.equal(fs.readFileSync(file, 'utf8'), 'user modification');
});

test('empty incoming instructions remove only the owned block and keep scope boundaries', async t => {
  const options = workspace(t), file = path.join(options.agentDir, 'AGENTS.md');
  fs.writeFileSync(file, '<!-- slopsentral:begin -->\nOld rule.\n<!-- slopsentral:end -->');
  const result = await install(await qualify(producer(bundle(options.directory)).client), options);
  assert.equal(fs.readFileSync(file, 'utf8'), ''); rollback(options);
  assert.match(fs.readFileSync(file, 'utf8'), /Old rule/);
});

test('recovery commands preserve shell metacharacters literally', t => {
  const { directory } = workspace(t), sentinel = path.join(directory, 'must not exist');
  const literal = "a 'quote' $(touch " + shellQuote(sentinel) + ') ; $HOME';
  const result = spawnSync('/bin/sh', ['-c', 'printf %s ' + shellQuote(literal)], { encoding: 'utf8' });
  assert.equal(result.status, 0); assert.equal(result.stdout, literal); assert.equal(fs.existsSync(sentinel), false);
});

test('project-controlled recovery code and transaction have no authority', async t => {
  const options = { ...workspace(t), project: true };
  const state = path.join(options.cwd, '.pi/slopsentral-setup');
  const marker = path.join(options.directory, 'must-not-exist');
  const helper = `import fs from 'node:fs'; fs.writeFileSync(${JSON.stringify(marker)}, 'executed');`;
  fs.mkdirSync(state, { recursive: true }); fs.writeFileSync(path.join(state, 'setup-pi.mts'), helper);
  write(path.join(state, 'setup.json'), { files: [{ file: 'setup-pi.mts', sha256: hash(helper) }] });
  write(path.join(state, 'transaction.json'), { schemaVersion: 1, status: 'applied', version: '0.1.123', files: [{ path: marker, before: Buffer.from('forged').toString('base64'), after: null, mode: 0o600 }] });
  assert.throws(() => rollback(options), /NO_RECOVERY/);
  const hook = path.join(options.directory, 'offline.mjs'); fs.writeFileSync(hook, 'globalThis.fetch = async () => new Response("absent", { status: 404 });');
  for (const flags of [['--project', '--rollback'], ['--rollback', '--project']]) {
    const result = spawnSync('/bin/sh', [path.join(root, 'tools/install-pi.sh'), ...flags], { cwd: options.cwd, env: { ...process.env, NODE_OPTIONS: '--import=' + pathToFileURL(hook).href, PI_CODING_AGENT_DIR: options.agentDir }, encoding: 'utf8' });
    assert.notEqual(result.status, 0); assert.match(result.stderr, /DOWNLOAD_FAILED/); assert.doesNotMatch(result.stderr, /PI_UNAVAILABLE/);
    assert.equal(fs.existsSync(marker), false);
  }
});

test('symlink ancestors and ambiguous autoload copies stop before activation', async t => {
  const options = workspace(t), admitted = await qualify(producer(bundle(options.directory)).client);
  const alias = path.join(options.directory, 'alias'); fs.symlinkSync(options.agentDir, alias);
  await assert.rejects(install(admitted, { ...options, agentDir: path.join(alias, 'nested') }), /UNSAFE_CONFIG/);
  assert.equal(fs.existsSync(path.join(options.agentDir, 'nested')), false);
  const extension = path.join(options.agentDir, 'extensions/slopsentral.ts');
  fs.mkdirSync(path.dirname(extension)); fs.writeFileSync(extension, 'export default function() { /* unfamiliar custom copy */ }');
  await assert.rejects(install(admitted, options), /AMBIGUOUS_LEGACY_EXTENSION/);
  assert.equal(fs.existsSync(path.join(options.agentDir, 'settings.json')), false);
  assert.equal(fs.existsSync(extension), true);
});

test('an interrupted transaction requires recovery and an attributable dead lock is reclaimed', async t => {
  const options = { ...workspace(t), project: true };
  const result = await install(await qualify(producer(bundle(options.directory, '0.1.123', 'Scoped instructions.')).client), options);
  const record = path.join(options.directory, '.pi/slopsentral-recovery', hash(result.state), 'transaction.json');
  const transaction = JSON.parse(fs.readFileSync(record)); transaction.status = 'pending';
  // A process died after changing settings but before writing instructions.
  const instruction = transaction.files.find(item => item.path === path.join(options.cwd, 'AGENTS.md'));
  if (instruction.before === null) fs.unlinkSync(instruction.path); else fs.writeFileSync(instruction.path, Buffer.from(instruction.before, 'base64'));
  fs.writeFileSync(record, json(transaction), { mode: 0o600 });
  const lock = path.join(result.state, 'setup.lock'); fs.mkdirSync(lock); write(path.join(lock, 'owner.json'), { pid: 2147483647 });
  await assert.rejects(install(await qualify(producer(bundle(options.directory)).client), options), /RECOVERY_REQUIRED/);
  rollback(options);
  assert.equal(fs.existsSync(path.join(options.cwd, '.pi/settings.json')), false);
  assert.equal(fs.existsSync(path.join(options.cwd, 'AGENTS.md')), false);
  assert.equal(JSON.parse(fs.readFileSync(record)).status, 'restored');
});

test('personal setup migrates successive projects while retaining private history', async t => {
  const options = workspace(t), admitted = await qualify(producer(bundle(options.directory)).client);
  const configA = path.join(options.cwd, '.pi/settings.json'); write(configA, { packages: ['npm:slopsentral-pi@0.1.123'] });
  const first = await install(admitted, options);
  const next = { ...options, cwd: path.join(options.directory, 'another project') }; fs.mkdirSync(next.cwd);
  const configB = path.join(next.cwd, '.pi/settings.json'); write(configB, { packages: ['npm:slopsentral-pi@0.1.123'] });
  assert.equal((await install(admitted, next)).status, 'INSTALLED');
  assert.deepEqual(JSON.parse(fs.readFileSync(configA)).packages, []);
  assert.deepEqual(JSON.parse(fs.readFileSync(configB)).packages, []);
  const privateRoot = path.join(options.directory, '.pi/slopsentral-recovery', hash(first.state));
  assert.equal(fs.readdirSync(path.join(privateRoot, 'history')).length, 1);
  rollback(next); assert.deepEqual(JSON.parse(fs.readFileSync(configB)).packages, ['npm:slopsentral-pi@0.1.123']);
  assert.deepEqual(JSON.parse(fs.readFileSync(configA)).packages, []);
});

test('permission-only concurrent and later edits are preserved', async t => {
  const options = workspace(t), config = path.join(options.agentDir, 'settings.json');
  write(config, { model: 'preserve' }); fs.chmodSync(config, 0o644);
  const admitted = await qualify(producer(bundle(options.directory)).client);
  await assert.rejects(install(admitted, { ...options, beforeCommit: () => fs.chmodSync(config, 0o600) }), /CONFIG_CHANGED/);
  assert.equal(fs.statSync(config).mode & 0o777, 0o600);
  fs.chmodSync(config, 0o644); await install(admitted, options); fs.chmodSync(config, 0o600);
  assert.throws(() => rollback(options), /CONFIG_CHANGED/);
  assert.equal(fs.statSync(config).mode & 0o777, 0o600);
  assert.equal((await install(admitted, options)).status, 'CURRENT');
  assert.equal(fs.statSync(config).mode & 0o777, 0o600);
});
