import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { promisify } from 'node:util';
import { DefaultResourceLoader, SettingsManager } from '@earendil-works/pi-coding-agent';

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
  assert.deepEqual(loader.getSkills().skills.map(skill => skill.name), ['semantic-ratchet']);
  assert.deepEqual(loader.getExtensions().extensions, []);
  await execute(process.execPath, [cli, 'install', source], { cwd: directory, env });
  assert.deepEqual(JSON.parse(fs.readFileSync(path.join(agentDir, 'settings.json'))).packages, [source]);
});
