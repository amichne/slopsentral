import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { promisify } from 'node:util';
import { createAgentSession, DefaultResourceLoader, ModelRuntime, SessionManager, SettingsManager } from '@earendil-works/pi-coding-agent';

const execute = promisify(execFile);
const cli = path.resolve(import.meta.dirname, '../../node_modules/@earendil-works/pi-coding-agent/dist/cli.js');

test('Pi installs a release archive and loads persisted profiles without registry access', { skip: !process.env.SLOPSENTRAL_PI_ARCHIVE, timeout: 60000 }, async t => {
  const directory = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'pi archive install ')));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  const agentDir = path.join(directory, 'agent');
  const archive = fs.readFileSync(process.env.SLOPSENTRAL_PI_ARCHIVE);
  const server = http.createServer((request, response) => {
    if (request.url === '/package.tgz') response.end(archive);
    else { response.writeHead(404); response.end('Absent release'); }
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise(resolve => server.close(resolve)));
  const address = server.address();
  assert.equal(typeof address, 'object');
  const origin = `http://127.0.0.1:${address.port}`;
  const env = { ...process.env, PI_CODING_AGENT_DIR: agentDir, npm_config_cache: path.join(directory, 'npm-cache'),
    npm_config_registry: 'http://127.0.0.1:9', npm_config_audit: 'false', npm_config_fund: 'false', npm_config_fetch_retries: '0' };
  const source = `npm:slopsentral-pi@${origin}/package.tgz`;
  await assert.rejects(execute(process.execPath, [cli, 'install', `npm:slopsentral-pi@${origin}/absent.tgz`], { cwd: directory, env }), error => error.stderr.includes('E404'));
  assert.equal(fs.existsSync(path.join(agentDir, 'settings.json')), false);
  await execute(process.execPath, [cli, 'install', source], { cwd: directory, env });
  assert.deepEqual(JSON.parse(fs.readFileSync(path.join(agentDir, 'settings.json'))).packages, [source]);
  assert.deepEqual(fs.readdirSync(path.join(agentDir, 'npm/node_modules')).filter(name => !name.startsWith('.')), ['slopsentral-pi']);
  const previousAgentDir = process.env.PI_CODING_AGENT_DIR;
  process.env.PI_CODING_AGENT_DIR = agentDir;
  t.after(() => { if (previousAgentDir === undefined) delete process.env.PI_CODING_AGENT_DIR; else process.env.PI_CODING_AGENT_DIR = previousAgentDir; });
  const settingsManager = SettingsManager.create(directory, agentDir);
  const loader = new DefaultResourceLoader({ cwd: directory, agentDir, settingsManager, noContextFiles: true });
  await loader.reload();
  assert.deepEqual(loader.getExtensions().errors, []);
  assert.equal(loader.getSkills().skills.some(skill => skill.name === 'openapi-contract-authoring'), false);
  const modelRuntime = await ModelRuntime.create({ authPath: path.join(agentDir, 'auth.json'), modelsPath: null,
    modelsStorePath: path.join(agentDir, 'models-cache.json'), allowModelNetwork: false, refreshOnCreate: false });
  const { session } = await createAgentSession({ cwd: directory, agentDir, resourceLoader: loader, modelRuntime, settingsManager,
    sessionManager: SessionManager.inMemory(directory) });
  t.after(() => session.dispose());
  const errors = [];
  await session.bindExtensions({ mode: 'print', onError: error => errors.push(error) });
  assert.ok(session.extensionRunner.getRegisteredCommands().some(command => command.name === 'slopsentral-kotlin-type-design'));
  await session.prompt('/slopsentral-kotlin-type-design');
  const result = await session.extensionRunner.emitBeforeAgentStart({ messageType: 'user', prompt: 'Describe an identifier' },
    { cwd: directory, skills: loader.getSkills().skills, sections: {} });
  assert.ok(result.systemPromptOptions.sections.slopsentral.includes('# Kotlin Engineering'));
  assert.ok(result.systemPromptOptions.sections.slopsentral_skills.includes('kotlin-review'));
  assert.ok(session.getActiveToolNames().includes('slopsentral_skill'));
  assert.deepEqual(errors, []);
});

for (const version of [undefined, '0.1.123']) {
  test(`published Pi launcher selects ${version ?? 'the pinned default'} and preserves literal arguments`, async t => {
    const directory = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'pi launcher ')));
    t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
    const executable = path.join(directory, 'pi');
    fs.writeFileSync(executable, '#!/bin/sh\nprintf "%s\\n" "$@"\n', { mode: 0o755 });
    const env = { ...process.env, PATH: `${directory}:${process.env.PATH}` };
    delete env.SLOPSENTRAL_PI_VERSION;
    if (version) env.SLOPSENTRAL_PI_VERSION = version;
    const launcher = path.resolve(import.meta.dirname, '../install-pi.sh');
    const { stdout } = await execute('/bin/sh', [launcher, '--local', 'literal $HOME; argument'], { env });
    const selected = version ?? '0.1.0';
    assert.deepEqual(stdout.trimEnd().split('\n'), [
      'install', `npm:slopsentral-pi@https://github.com/amichne/slopsentral/releases/download/pi-v${selected}/slopsentral-pi-${selected}.tgz`,
      '--local', 'literal $HOME; argument',
    ]);
  });
}

test('the real Pi JSON command returns structured settings without a model request', { timeout: 15000 }, async t => {
  const directory = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'pi-print-settings-')));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  const packagePath = path.join(directory, 'package');
  fs.mkdirSync(path.join(packagePath, 'extensions'), { recursive: true });
  const source = path.resolve(import.meta.dirname, '../../source/hooks/pi');
  for (const name of fs.readdirSync(source).filter(name => name.endsWith('.ts'))) fs.copyFileSync(path.join(source, name), path.join(packagePath, 'extensions', name));
  fs.writeFileSync(path.join(packagePath, 'package.json'), JSON.stringify({ type: 'module', pi: { extensions: ['./extensions/slopsentral.ts'], skills: [] } }));
  fs.writeFileSync(path.join(packagePath, 'profiles.json'), JSON.stringify({ schemaVersion: 1, defaultProfile: 'fixture', profiles: [{ name: 'fixture', description: 'Print fixture', skills: [], instructions: [], agents: [], hooks: [], hookPolicy: 'ADVISORY' }] }));
  const pending = execute(process.execPath, [cli, '--offline', '--no-extensions', '--no-skills', '--no-prompt-templates', '--no-themes', '-e', packagePath, '--mode', 'json', '/slopsentral state'], {
    cwd: directory, env: { ...process.env, PI_CODING_AGENT_DIR: path.join(directory, 'agent'), PI_OFFLINE: '1' },
    timeout: 10000,
  });
  pending.child.stdin.end();
  t.after(() => { if (pending.child.exitCode === null) pending.child.kill('SIGKILL'); });
  const { stdout } = await pending;
  const events = stdout.trim().split('\n').map(line => JSON.parse(line));
  const state = events.find(event => event.type === 'message_end' && event.message.customType === 'slopsentral-result').message.details;
  assert.equal(state.effective.profile, 'fixture');
  assert.deepEqual(state.journal.pending, []);
});
