import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { tsImport } from 'tsx/esm/api';

const imported = await tsImport('../../source/hooks/pi/skills.ts', import.meta.url);
const { AdmittedSkill, captureResources, immutable, loadSkill } = imported.default ?? imported;
const importedSettings = await tsImport('../../source/hooks/pi/settings.ts', import.meta.url);
const { resolveSettings } = importedSettings.default ?? importedSettings;
const root = path.resolve(import.meta.dirname, '../..');

test('an admitted skill keeps its binding, resource, and generation after a new plan resolves', t => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'pi captured skill '));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  const original = '---\nname: example\ndescription: Captured example.\n---\nUse the original instructions.\n';
  fs.writeFileSync(path.join(directory, 'SKILL.md'), original);
  const cap = { id: 'skill:example', type: 'SKILL', name: 'example', path: 'SKILL.md', profiles: ['fixture'], dependencies: [] };
  const config = { schemaVersion: 1, defaultProfile: 'fixture', profiles: [{ name: 'fixture', description: 'Fixture',
    skills: [{ name: 'example', path: 'SKILL.md', invocation: 'either' }], instructions: [], agents: [], hooks: [], hookPolicy: 'ADVISORY' }] };
  const resources = captureResources(directory, [cap]);
  const originalPlan = immutable(resolveSettings(config, [cap], [], resources.unavailable, resources.resources));
  const admitted = AdmittedSkill.admit(originalPlan, 'example', 'model', originalPlan.generation);
  assert.ok(admitted instanceof AdmittedSkill);
  const changed = resolveSettings(config, [cap], [{ origin: 'session', settings: { schemaVersion: 1, skills: { 'skill:example': { invocation: 'human' } } } }], resources.unavailable, resources.resources);
  assert.notEqual(changed.generation, admitted.generation);
  const loaded = loadSkill(admitted);
  assert.equal(loaded.type, 'loaded');
  assert.equal(loaded.generation, originalPlan.generation);
  assert.equal(loaded.resource.digest, crypto.createHash('sha256').update(original).digest('hex'));
  assert.ok(loaded.content.includes('Use the original instructions.'));
  assert.throws(() => { originalPlan.capabilities[0].binding.invocation = 'human'; }, TypeError);
  assert.throws(() => { originalPlan.capabilities.push(cap); }, TypeError);
  const cancelled = new AbortController();
  cancelled.abort();
  assert.deepEqual(loadSkill(admitted, cancelled.signal), { type: 'rejected', code: 'ABORTED' });
});

test('the compiler rejects an unchecked loader call and direct admission construction', t => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'pi admission types '));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  const file = path.join(directory, 'proof.ts');
  const modulePath = JSON.stringify(path.join(root, 'source/hooks/pi/skills.ts'));
  const args = ['--noEmit', '--strict', '--skipLibCheck', '--target', 'ES2023', '--module', 'ESNext', '--moduleResolution', 'Bundler', '--allowImportingTsExtensions', '--types', 'node', file];
  fs.writeFileSync(file, `import { AdmittedSkill, loadSkill, type Plan } from ${modulePath};
declare const plan: Plan;
const result = AdmittedSkill.admit(plan, 'example', 'model', plan.generation);
if (result instanceof AdmittedSkill) loadSkill(result);
`);
  const compiler = path.join(root, 'node_modules/typescript/bin/tsc');
  execFileSync(process.execPath, [compiler, ...args], { cwd: root, encoding: 'utf8' });
  fs.appendFileSync(file, `loadSkill('example');
new AdmittedSkill(plan.capabilities[0], plan.generation, {type:'captured',path:'/tmp/SKILL.md',digest:'unchecked',description:'Unchecked'});
`);
  let rejection;
  try { execFileSync(process.execPath, [compiler, ...args], { cwd: root, encoding: 'utf8', stdio: 'pipe' }); }
  catch (error) { rejection = error; }
  assert.equal(rejection?.status, 1);
  assert.match(rejection.stdout, /TS2345.*not assignable to parameter of type 'AdmittedSkill'/);
  assert.match(rejection.stdout, /TS2673.*constructor.*private/i);
});
