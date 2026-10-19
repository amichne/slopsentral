import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import test from 'node:test';
import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import { auditProfileComposition, loadCatalog } from '../catalog.mjs';
import { validateWorkflowProfile } from '../validate-profile-contracts.mjs';

const root = path.resolve(import.meta.dirname, '../..');
const original = JSON.parse(fs.readFileSync(path.join(root, 'source/profiles/local-development-default.json')));
const ajv = addFormats(new Ajv2020({ strict: true, strictTypes: false, discriminator: true }));
const settingsSchema = ajv.compile(JSON.parse(fs.readFileSync(path.join(root, 'source/schemas/pi/settings.schema.json'))));

test('profile and settings schemas accept the same closed skill bindings', () => {
  for (const invocation of ['human', 'model', 'either']) {
    const skills = { 'skill:semantic-ratchet': { invocation } };
    assert.equal(validateWorkflowProfile({ ...original, skills }).skills, skills);
    assert.equal(settingsSchema({ schemaVersion: 1, enabled: false, skills }), true, JSON.stringify(settingsSchema.errors));
  }
  for (const skills of [
    { 'hook:semantic-ratchet': { invocation: 'human' } },
    { 'skill:semantic-ratchet': { invocation: 'unknown' } },
    { 'skill:semantic-ratchet': {} },
    { 'skill:semantic-ratchet': { invocation: 'human', origin: 'human' } },
    { 'skill:semantic-ratchet': 'human' },
    [],
  ]) {
    assert.throws(() => validateWorkflowProfile({ ...original, skills }));
    assert.equal(settingsSchema({ schemaVersion: 1, skills }), false, JSON.stringify(skills));
  }
  assert.equal(settingsSchema({ schemaVersion: 1, enabled: 'false' }), false);
  assert.equal(settingsSchema({ schemaVersion: 2, enabled: false }), false);
});

test('profile bindings reject unknown skills and skills outside selected plugin closures', () => {
  const catalog = loadCatalog(root);
  assert.deepEqual(auditProfileComposition(catalog, { ...original,
    skills: { 'skill:semantic-ratchet': { invocation: 'human' } } }), []);
  for (const name of ['unknown-skill', 'openapi-contract-authoring']) {
    assert.ok(auditProfileComposition(catalog, { ...original,
      skills: { ['skill:' + name]: { invocation: 'model' } } }).some(finding => finding.includes('not composed')), name);
  }
});

function input(skills) {
  const reference = name => ({ type: 'SKILL', name, sourcePath: 'source/skills/' + name, sha256: 'sha256:' + 'a'.repeat(64) });
  const plugin = (name, names) => ({ name, version: '1.0.0', description: 'Fixture', interface: {}, tags: [], references: names.map(reference) });
  return { name: 'fixture', owner: { name: 'Fixture' }, description: 'Fixture', generatedAt: '2026-10-19T00:00:00Z', sourceSha: 'a'.repeat(40),
    plugins: [plugin('selected', ['first', 'second', 'third']), plugin('outside', ['fourth'])],
    profiles: [{ name: 'local-development-default', description: 'Fixture', plugins: ['selected'], hookPolicy: 'OFF', focusSkills: ['first'], skills }],
    projectedDigests: {} };
}

function evaluate(t, value) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'pi-profile-binding-'));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  const file = path.join(directory, 'input.json');
  fs.writeFileSync(file, JSON.stringify(value));
  return spawnSync(process.env.PKL_BIN, ['eval', '--no-project', '-p', 'harness=pi', '-p', 'input=' + pathToFileURL(file).href,
    'tools/projection/Project.pkl'], { cwd: root, encoding: 'utf8' });
}

test('native Pkl projects binding policy and selects the union with focused skills', { skip: !process.env.PKL_BIN }, t => {
  const result = evaluate(t, input({ 'skill:second': { invocation: 'model' }, 'skill:third': { invocation: 'human' } }));
  assert.equal(result.status, 0, result.stderr);
  const plan = JSON.parse(result.stdout);
  const config = JSON.parse(plan.files.find(file => file.path.endsWith('/profiles.json')).text);
  assert.deepEqual(config.profiles[0].skills.map(({ name, invocation }) => ({ name, invocation })), [
    { name: 'first', invocation: 'either' }, { name: 'second', invocation: 'model' }, { name: 'third', invocation: 'human' },
  ]);
  const manifest = JSON.parse(plan.files.find(file => file.path.endsWith('/package.json')).text);
  assert.deepEqual(manifest.pi.skills, []);
  assert.ok(plan.copies.some(copy => copy.source === 'source/hooks/pi/skills.ts' && copy.target === 'extensions/skills.ts'));
});

test('native Pkl rejects malformed and uncomposed skill bindings before a plan exists', { skip: !process.env.PKL_BIN }, t => {
  for (const skills of [
    { 'skill:unknown': { invocation: 'either' } },
    { 'skill:fourth': { invocation: 'human' } },
    { 'hook:first': { invocation: 'model' } },
    { 'skill:first': { invocation: 'unknown' } },
    { 'skill:first': { invocation: 'human', origin: 'human' } },
    { 'skill:first': {} },
  ]) {
    const result = evaluate(t, input(skills));
    assert.notEqual(result.status, 0, JSON.stringify(skills));
    assert.equal(result.stdout, '', JSON.stringify(skills));
  }
});
