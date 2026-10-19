import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { promisify } from 'node:util';
import Ajv2020 from 'ajv/dist/2020.js';
import { createAgentSession, DefaultResourceLoader, ModelRuntime, SessionManager, SettingsManager } from '@earendil-works/pi-coding-agent';

const execute = promisify(execFile);
const root = path.resolve(import.meta.dirname, '../..');
const cli = path.join(root, 'node_modules/@earendil-works/pi-coding-agent/dist/cli.js');
const selected = ['kotlin-design-practices', 'kotlin-review', 'negative-capability-proof', 'semantic-ratchet'];

test('a content profile installs tested archive bytes and uses only native Pi discovery', { skip: !process.env.PKL_BIN, timeout: 60000 }, async t => {
  const directory = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'pi native content ')));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  const out = path.join(directory, 'projected');
  const { stdout } = await execute('uv', ['run', '--locked', 'tools/marketplace.py', 'project', '--source', root,
    '--harness', 'pi', '--profile', 'kotlin-type-design', '--out', out], { cwd: root });
  assert.equal(JSON.parse(stdout).type, 'PROJECTED');
  const pkg = path.join(out, '.pi/slopsentral');
  const manifest = JSON.parse(fs.readFileSync(path.join(pkg, 'package.json')));
  assert.deepEqual(Object.keys(manifest.pi), ['skills']);
  assert.equal(manifest.peerDependencies, undefined);
  for (const file of ['extensions', 'profiles.json', 'capabilities.json']) assert.equal(fs.existsSync(path.join(pkg, file)), false);
  assert.equal(manifest.pi.skills.length, selected.length);
  const inventory = JSON.parse(fs.readFileSync(path.join(pkg, 'profile-inventory.json')));
  const schema = JSON.parse(fs.readFileSync(path.join(root, 'source/schemas/pi/content-profile.schema.json')));
  const validate = new Ajv2020({ strict: true, allErrors: true }).compile(schema);
  assert.equal(validate(inventory), true, JSON.stringify(validate.errors));
  assert.equal(validate({ ...inventory, invocation: 'model' }), false);
  assert.equal(validate({ ...inventory, skills: [] }), false);
  assert.equal(inventory.profile, 'kotlin-type-design');
  assert.deepEqual(inventory.skills.map(s => s.name).sort(), selected);
  for (const resource of [...inventory.skills, ...inventory.instructions]) {
    const target = path.join(pkg, resource.path);
    const digest = crypto.createHash('sha256');
    if (fs.statSync(target).isFile()) digest.update(fs.readFileSync(target));
    else for (const file of fs.readdirSync(target, { recursive: true }).filter(p => fs.statSync(path.join(target, p)).isFile()).sort()) {
      digest.update(file).update('\0').update(fs.readFileSync(path.join(target, file))).update('\0');
    }
    assert.equal(resource.sha256, 'sha256:' + digest.digest('hex'), resource.path);
  }
  for (const skill of selected) {
    const entry = manifest.pi.skills.find(p => p.endsWith('/' + skill));
    assert.ok(entry, skill);
    const original = path.join(root, 'source/skills', skill);
    for (const file of fs.readdirSync(original, { recursive: true }).filter(p => fs.statSync(path.join(original, p)).isFile())) {
      assert.deepEqual(fs.readFileSync(path.join(pkg, entry, file)), fs.readFileSync(path.join(original, file)), `${skill}/${file}`);
    }
  }
  const instruction = fs.readFileSync(path.join(root, 'source/instructions/kotlin-engineering.md'));
  assert.deepEqual(fs.readFileSync(path.join(pkg, 'AGENTS.md')), instruction);
  const second = path.join(directory, 'repeat');
  await execute('uv', ['run', '--locked', 'tools/marketplace.py', 'project', '--harness', 'pi', '--profile', 'kotlin-type-design', '--out', second], { cwd: root });
  const files = fs.readdirSync(pkg, { recursive: true }).filter(p => fs.statSync(path.join(pkg, p)).isFile()).sort();
  assert.deepEqual(files, fs.readdirSync(path.join(second, '.pi/slopsentral'), { recursive: true }).filter(p => fs.statSync(path.join(second, '.pi/slopsentral', p)).isFile()).sort());
  for (const file of files) assert.deepEqual(fs.readFileSync(path.join(pkg, file)), fs.readFileSync(path.join(second, '.pi/slopsentral', file)));
  const { stdout: packed } = await execute('uv', ['run', '--locked', '--script', 'tools/package_pi.py', pkg, path.join(directory, 'archive')], { cwd: root });
  const archive = JSON.parse(packed);
  assert.equal(archive.type, 'PACKAGED');
  const bytes = fs.readFileSync(archive.archive);
  assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'), archive.sha256);
  const server = http.createServer((_request, response) => response.end(bytes));
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise(resolve => server.close(resolve)));
  const source = `npm:slopsentral-pi@http://127.0.0.1:${server.address().port}/package.tgz`;
  const agentDir = path.join(directory, 'agent');
  const cwd = path.join(directory, 'consumer');
  fs.mkdirSync(cwd);
  const home = path.join(directory, 'home');
  fs.mkdirSync(home);
  const env = { ...process.env, HOME: home, PI_CODING_AGENT_DIR: agentDir, npm_config_cache: path.join(directory, 'npm-cache'),
    npm_config_registry: 'http://127.0.0.1:9', npm_config_audit: 'false', npm_config_fund: 'false', npm_config_fetch_retries: '0' };
  await execute(process.execPath, [cli, 'install', source], { cwd, env });
  const installed = path.join(agentDir, 'npm/node_modules/slopsentral-pi');
  for (const file of files) assert.deepEqual(fs.readFileSync(path.join(installed, file)), fs.readFileSync(path.join(pkg, file)));
  assert.deepEqual(fs.readdirSync(path.join(agentDir, 'npm/node_modules')).filter(p => !p.startsWith('.')), ['slopsentral-pi']);
  const previous = process.env.PI_CODING_AGENT_DIR;
  const previousHome = process.env.HOME;
  process.env.HOME = home;
  process.env.PI_CODING_AGENT_DIR = agentDir;
  t.after(() => { if (previous === undefined) delete process.env.PI_CODING_AGENT_DIR; else process.env.PI_CODING_AGENT_DIR = previous; });
  t.after(() => { if (previousHome === undefined) delete process.env.HOME; else process.env.HOME = previousHome; });
  const settingsManager = SettingsManager.create(cwd, agentDir);
  const loader = new DefaultResourceLoader({ cwd, agentDir, settingsManager });
  await loader.reload();
  assert.equal(loader.getAgentsFiles().agentsFiles.some(f => f.content.includes(instruction.toString().trim())), false,
    'package installation alone must not inject an instruction');
  // Deploy the instruction through the native project scope, then reload native resources.
  fs.copyFileSync(path.join(installed, 'AGENTS.md'), path.join(cwd, 'AGENTS.md'));
  await loader.reload();
  assert.deepEqual(loader.getSkills().diagnostics, []);
  assert.deepEqual(loader.getSkills().skills.map(s => s.name).sort(), selected);
  assert.deepEqual(loader.getExtensions().errors, []);
  assert.equal(loader.getExtensions().extensions.some(e => e.path.startsWith(installed)), false);
  assert.deepEqual(loader.getAgentsFiles().agentsFiles.filter(f => f.path === path.join(cwd, 'AGENTS.md')).map(f => f.content), [instruction.toString()]);
  const modelRuntime = await ModelRuntime.create({ authPath: path.join(agentDir, 'auth.json'), modelsPath: null,
    modelsStorePath: path.join(agentDir, 'models-cache.json'), allowModelNetwork: false, refreshOnCreate: false });
  const { session } = await createAgentSession({ cwd, agentDir, resourceLoader: loader, modelRuntime, settingsManager,
    sessionManager: SessionManager.inMemory(cwd) });
  t.after(() => session.dispose());
  await session.bindExtensions({ mode: 'print', onError: error => assert.fail(error.message) });
  assert.ok(session.systemPrompt.includes(instruction.toString().trim()));
  assert.equal(session.extensionRunner.getRegisteredCommands().some(c => c.name.startsWith('slopsentral')), false);
  assert.equal(session.getActiveToolNames().some(name => name.startsWith('slopsentral')), false);
  assert.equal([...session.extensionRunner.getFlags().keys()].some(name => name.startsWith('slopsentral')), false);
  t.diagnostic(`Native Pi ${JSON.parse(fs.readFileSync(path.join(root, 'node_modules/@earendil-works/pi-coding-agent/package.json'))).version}: four skills, scoped instructions, zero Slopsentral registrations, no model request.`);
});
