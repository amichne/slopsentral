import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { project } from '../project-marketplaces.mjs';
import { composedSkillNames, pluginSkillNames } from './fixtures/composed-skills.mjs';
import { DefaultResourceLoader, SettingsManager } from '@earendil-works/pi-coding-agent';

const root = path.resolve(import.meta.dirname, '../..');
test('all five plugins load native skills, agent prompts, and hook adapters without duplicate skills', { skip: !process.env.PKL_BIN }, async t => {
  const directory = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'pi-plugin-contract-')));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  const oldHome = process.env.HOME;
  process.env.HOME = directory;
  t.after(() => { if (oldHome === undefined) delete process.env.HOME; else process.env.HOME = oldHome; });
  const out = path.join(directory, 'projection');
  const result = project({ source: root, harness: 'pi', out });
  assert.equal(result.plugins, 5);
  const pkg = path.join(out, '.pi/slopsentral');
  const manifest = JSON.parse(fs.readFileSync(path.join(pkg, 'package.json')));
  assert.deepEqual(manifest.pi.skills.map(skill => path.basename(skill)).sort(), composedSkillNames());
  assert.equal(manifest.pi.prompts.length, 2);
  assert.equal(manifest.pi.extensions.length, 2);
  const agentDir = path.join(directory, 'agent');
  const cwd = path.join(directory, 'project');
  fs.mkdirSync(agentDir); fs.mkdirSync(cwd);
  const loader = new DefaultResourceLoader({ cwd, agentDir, settingsManager: SettingsManager.inMemory({ packages: [pkg] }) });
  await loader.reload();
  assert.deepEqual(loader.getSkills().diagnostics, []);
  assert.deepEqual(loader.getExtensions().errors, []);
  assert.deepEqual(loader.getSkills().skills.map(skill => skill.name).sort(), composedSkillNames());
  assert.deepEqual(loader.getPrompts().prompts.map(p => p.name).sort(), ['slopsentral-openapi-contract-rater', 'slopsentral-schema-type-enforcer']);
  assert.equal(loader.getExtensions().extensions.length, 2);
  for (const [name, prompts, extensions] of [
    ['software-engineering', 0, 1], ['kotlin-engineering', 0, 0],
    ['intellij-plugin-development', 0, 0], ['repository-knowledge', 0, 1], ['developer-tooling', 2, 0],
  ]) {
    const selected = new DefaultResourceLoader({ cwd, agentDir, settingsManager: SettingsManager.inMemory({ packages: [path.join(pkg, name)] }) });
    await selected.reload();
    assert.deepEqual(selected.getExtensions().errors, [], name);
    assert.deepEqual(selected.getSkills().diagnostics, [], name);
    assert.deepEqual(selected.getSkills().skills.map(skill => skill.name).sort(), pluginSkillNames(name), name);
    assert.equal(selected.getPrompts().prompts.length, prompts, name);
    assert.equal(selected.getExtensions().extensions.length, extensions, name);
  }
});
