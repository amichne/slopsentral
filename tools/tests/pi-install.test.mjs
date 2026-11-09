import assert from 'node:assert/strict';
import { execFile, execFileSync } from 'node:child_process';
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { promisify } from 'node:util';
import { createAgentSession, DefaultResourceLoader, ModelRuntime, SessionManager, SettingsManager } from '@earendil-works/pi-coding-agent';

const execute = promisify(execFile);
const cli = path.resolve(import.meta.dirname, '../../node_modules/@earendil-works/pi-coding-agent/dist/cli.js');

test('Pi installs a release archive and discovers native skills without registry access', { skip: !process.env.SLOPSENTRAL_PI_ARCHIVE, timeout: 60000 }, async t => {
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
  const bin = path.join(directory, 'consumer-bin');
  fs.mkdirSync(bin);
  for (const [name, target] of [['node', process.execPath], ['bash', '/bin/bash'], ['sh', '/bin/sh'],
    ['dirname', '/usr/bin/dirname'], ['basename', '/usr/bin/basename'], ['tar', '/usr/bin/tar'], ['git', '/usr/bin/git']])
    fs.symlinkSync(target, path.join(bin, name));
  const npm = execFileSync('/bin/sh', ['-c', 'command -v npm'], { encoding: 'utf8' }).trim();
  // Execute npm at its actual path so host wrappers retain their own layout.
  fs.writeFileSync(path.join(bin, 'npm'), '#!/bin/sh\nexec "$PI_TEST_NPM" "$@"\n', { mode: 0o700 });
  const env = { HOME: directory, PATH: bin, PI_TEST_NPM: fs.realpathSync(npm), PI_CODING_AGENT_DIR: agentDir, npm_config_cache: path.join(directory, 'npm-cache'),
    npm_config_registry: 'http://127.0.0.1:9', npm_config_audit: 'false', npm_config_fund: 'false', npm_config_fetch_retries: '0' };
  const source = `npm:slopsentral-pi@${origin}/package.tgz`;
  await assert.rejects(execute(process.execPath, [cli, 'install', `npm:slopsentral-pi@${origin}/absent.tgz`], { cwd: directory, env }), error => error.stderr.includes('E404'));
  assert.equal(fs.existsSync(path.join(agentDir, 'settings.json')), false);
  await execute(process.execPath, [cli, 'install', source], { cwd: directory, env });
  assert.deepEqual(JSON.parse(fs.readFileSync(path.join(agentDir, 'settings.json'))).packages, [source]);
  assert.deepEqual(fs.readdirSync(path.join(agentDir, 'npm/node_modules')).filter(name => !name.startsWith('.')), ['slopsentral-pi']);
  const previousAgentDir = process.env.PI_CODING_AGENT_DIR;
  const previousHome = process.env.HOME;
  process.env.HOME = directory;
  process.env.PI_CODING_AGENT_DIR = agentDir;
  t.after(() => { if (previousAgentDir === undefined) delete process.env.PI_CODING_AGENT_DIR; else process.env.PI_CODING_AGENT_DIR = previousAgentDir; });
  t.after(() => { if (previousHome === undefined) delete process.env.HOME; else process.env.HOME = previousHome; });
  const settingsManager = SettingsManager.create(directory, agentDir);
  const loader = new DefaultResourceLoader({ cwd: directory, agentDir, settingsManager, noContextFiles: true });
  await loader.reload();
  assert.deepEqual(loader.getExtensions().errors, []);
  assert.equal(loader.getSkills().skills.some(skill => skill.name === 'openapi-contract-authoring'), true);
  assert.equal(loader.getSkills().skills.length, 32);
  assert.equal(loader.getPrompts().prompts.length, 2);
  assert.equal(loader.getExtensions().extensions.length, 2);
  // The archive is installed and discoverable without uv, but an enabled
  // canonical context hook still requires its runtime before tools are admitted.
  const modelRuntime = await ModelRuntime.create({ authPath: path.join(agentDir, 'auth.json'), modelsPath: null,
    modelsStorePath: path.join(agentDir, 'models-cache.json'), allowModelNetwork: false, refreshOnCreate: false });
  const { session } = await createAgentSession({ cwd: directory, agentDir, settingsManager, resourceLoader: loader, modelRuntime,
    sessionManager: SessionManager.inMemory(directory) });
  t.after(() => session.dispose());
  await session.bindExtensions({ mode: 'print', onError: error => assert.fail(error.message) });
  const previousPath = process.env.PATH;
  const emptyBin = path.join(directory, 'empty-bin');
  fs.mkdirSync(emptyBin);
  process.env.PATH = emptyBin;
  try {
    const start = await session.extensionRunner.emitBeforeAgentStart({ messageType: 'user', prompt: 'Examine installed hook readiness.' }, { cwd: directory });
    assert.match(start.systemPromptOptions.forceSystemPrompt, /HOOK_EXIT_127/);
    const blocked = await session.extensionRunner.emitToolCall({ type: 'tool_call', toolCallId: 'missing-uv', toolName: 'read', input: {} });
    assert.equal(blocked.block, true);
    assert.match(blocked.reason, /HOOK_EXIT_127/);
  } finally {
    if (previousPath === undefined) delete process.env.PATH; else process.env.PATH = previousPath;
  }
  await execute(process.execPath, [cli, 'install', source], { cwd: directory, env });
  assert.deepEqual(JSON.parse(fs.readFileSync(path.join(agentDir, 'settings.json'))).packages, [source]);
});
