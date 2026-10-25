import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { createAgentSession, DefaultResourceLoader, ModelRuntime, SessionManager, SettingsManager } from '@earendil-works/pi-coding-agent';

const root = path.resolve(import.meta.dirname, '../..');
test('the default uses native skill discovery with no Slopsentral runtime registrations', {
  skip: !process.env.SLOPSENTRAL_PI_PACKAGE && !process.env.PKL_BIN,
}, async t => {
  const directory = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'pi-native-default-')));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  let pkg = process.env.SLOPSENTRAL_PI_PACKAGE;
  if (!pkg) {
    const out = path.join(directory, 'projection');
    execFileSync(process.execPath, ['tools/project-marketplaces.mjs', '--source', root, '--harness', 'pi', '--out', out], { cwd: root });
    pkg = path.join(out, '.pi/slopsentral');
  }
  const manifest = JSON.parse(fs.readFileSync(path.join(pkg, 'package.json')));
  assert.deepEqual(manifest.pi, { skills: ['./software-engineering/skills/semantic-ratchet'] });
  assert.equal(manifest.peerDependencies, undefined);
  const inventory = JSON.parse(fs.readFileSync(path.join(pkg, 'profile-inventory.json')));
  assert.equal(inventory.profile, 'native-default');
  assert.deepEqual(inventory.instructions, []);
  for (const retired of ['extensions', 'profiles.json', 'capabilities.json']) assert.equal(fs.existsSync(path.join(pkg, retired)), false);
  const agentDir = path.join(directory, 'agent');
  const cwd = path.join(directory, 'project');
  fs.mkdirSync(cwd);
  fs.mkdirSync(agentDir);
  const previousHome = process.env.HOME;
  process.env.HOME = directory;
  t.after(() => { if (previousHome === undefined) delete process.env.HOME; else process.env.HOME = previousHome; });
  const settingsManager = SettingsManager.inMemory({ packages: [pkg] });
  const resourceLoader = new DefaultResourceLoader({ cwd, agentDir, settingsManager });
  await resourceLoader.reload();
  assert.deepEqual(resourceLoader.getSkills().skills.map(s => s.name), ['semantic-ratchet']);
  assert.deepEqual(resourceLoader.getSkills().diagnostics, []);
  assert.deepEqual(resourceLoader.getExtensions().errors, []);
  assert.equal(resourceLoader.getExtensions().extensions.some(e => e.path.startsWith(pkg)), false);
  const modelRuntime = await ModelRuntime.create({ authPath: path.join(agentDir, 'auth.json'), modelsPath: null,
    modelsStorePath: path.join(agentDir, 'models-cache.json'), allowModelNetwork: false, refreshOnCreate: false });
  const { session } = await createAgentSession({ cwd, agentDir, settingsManager, resourceLoader, modelRuntime,
    sessionManager: SessionManager.inMemory(cwd) });
  t.after(() => session.dispose());
  await session.bindExtensions({ mode: 'print', onError: error => assert.fail(error.message) });
  assert.equal(session.extensionRunner.getRegisteredCommands().some(c => c.name.startsWith('slopsentral')), false);
  assert.equal(session.getActiveToolNames().some(name => name.startsWith('slopsentral')), false);
  assert.equal([...session.extensionRunner.getFlags().keys()].some(name => name.startsWith('slopsentral')), false);
  t.diagnostic('Native Pi 1.3.0: one default skill; zero Slopsentral registrations; no model request.');
});
