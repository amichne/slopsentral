import assert from 'node:assert/strict';
import test from 'node:test';
import { tsImport } from 'tsx/esm/api';

const imported = await tsImport('../../source/hooks/pi/settings.ts', import.meta.url);
const settings = imported.default ?? imported;
const profile = { name: 'fixture', description: 'Fixture', skills: [], instructions: [], agents: [], hooks: [], hookPolicy: 'ADVISORY' };
const config = { schemaVersion: 1, defaultProfile: 'fixture', profiles: [profile] };
const catalog = [
  { id: 'instruction:rules', type: 'INSTRUCTION', name: 'rules', path: 'rules.md', dependencies: [], profiles: ['fixture'] },
  { id: 'hook:gate', type: 'HOOK', name: 'gate', dependencies: ['instruction:rules'], profiles: ['fixture'], actions: [] },
];

test('one settings contract accepts valid layers and rejects illegal background gates and regexes', () => {
  assert.equal(settings.parseSettings({ schemaVersion: 1 }).type, 'settings');
  for (const value of [null, { schemaVersion: 2 }, { schemaVersion: 1, extra: true },
    { schemaVersion: 1, hooks: { 'hook:gate': { execution: 'background', critical: 'blocking', output: { type: 'NEVER' }, context: 'none' } } },
    { schemaVersion: 1, hooks: { 'hook:gate': { execution: 'background', critical: 'report', output: { type: 'EXCLUDE', pattern: '[' }, context: 'none' } } }])
    assert.equal(settings.parseSettings(value).type, 'rejected');
});

test('effective settings preserve precedence, origins, and disabled dependency failures', () => {
  const resolved = settings.resolveSettings(config, catalog, [
    { origin: 'user', settings: { schemaVersion: 1, capabilities: { 'instruction:rules': false } } },
    { origin: 'project', settings: { schemaVersion: 1, capabilities: { 'instruction:rules': true } } },
    { origin: 'session', settings: { schemaVersion: 1, capabilities: { 'instruction:rules': false } } },
  ]);
  assert.equal(resolved.type, 'effective');
  const rules = resolved.capabilities.find(item => item.capability.id === 'instruction:rules');
  assert.equal(rules.origin, 'session');
  assert.equal(rules.state, 'disabled');
  const gate = resolved.capabilities.find(item => item.capability.id === 'hook:gate');
  assert.equal(gate.state, 'unavailable');
  assert.match(gate.reason, /instruction:rules/);
});

test('portable JSON Schemas and runtime ingress agree on policies, capabilities, and invalid settings', async () => {
  const fs = await import('node:fs');
  const { default: Ajv } = await import('ajv/dist/2020.js');
  const { default: addFormats } = await import('ajv-formats');
  const schema = JSON.parse(fs.readFileSync(new URL('../../source/schemas/pi/settings.schema.json', import.meta.url)));
  const ajv = new Ajv({ strict: true, allErrors: true, discriminator: true });
  addFormats(ajv);
  const validate = ajv.compile(schema);
  const valid = [
    { schemaVersion: 1 },
    { schemaVersion: 1, capabilities: { 'instruction:rules': false }, hooks: { 'hook:gate': { execution: 'foreground', critical: 'blocking', output: { type: 'EXCLUDE', pattern: '^NOTICE:' }, context: 'structured' } } },
    { schemaVersion: 1, additions: catalog, mutationAdapters: { custom_write: ['path', 'destination'] } },
  ];
  for (const value of valid) {
    assert.equal(validate(value), true, JSON.stringify(validate.errors));
    assert.equal(settings.parseSettings(value).type, 'settings');
  }
  for (const value of [
    { schemaVersion: 1, unexpected: true },
    { schemaVersion: 1, hooks: { 'hook:gate': { execution: 'background', critical: 'blocking', output: { type: 'NEVER' }, context: 'none' } } },
    { schemaVersion: 1, hooks: { 'hook:gate': { execution: 'background', critical: 'report', output: { type: 'EXCLUDE', pattern: '[' }, context: 'none' } } },
    { schemaVersion: 1, additions: [{ ...catalog[0], path: '../escape' }] },
  ]) {
    assert.equal(validate(value), false, JSON.stringify(value));
    assert.equal(settings.parseSettings(value).type, 'rejected');
  }
});

test('unsupported tool names cannot borrow object prototype properties as mutation adapters', async () => {
  const imported = await tsImport('../../source/hooks/pi/journal.ts', import.meta.url);
  const { collectMutation } = imported.default ?? imported;
  for (const name of ['constructor', 'toString', 'valueOf'])
    assert.deepEqual(collectMutation('/workspace', name, {}, {}), { paths: [], gaps: [`UNSUPPORTED_TOOL: ${name}`] });
});

test('hook deadlines accept only bounded positive whole seconds', () => {
  const value = { schemaVersion: 1, hooks: { 'hook:gate': { execution: 'foreground', critical: 'report', output: { type: 'ERRORS' }, context: 'none', timeoutSeconds: 5 } } };
  assert.equal(settings.parseSettings(value).type, 'settings');
  for (const timeoutSeconds of [0, -1, 0.5, 3601, '5'])
    assert.equal(settings.parseSettings({ ...value, hooks: { 'hook:gate': { ...value.hooks['hook:gate'], timeoutSeconds } } }).type, 'rejected');
});

test('an enforcing source profile keeps an explicit foreground scope gate', () => {
  const configured = { ...config, profiles: [{ ...profile, hookPolicy: 'ENFORCING' }] };
  const scope = { id: 'hook:agents-md-scope', type: 'HOOK', name: 'agents-md-scope', dependencies: [], profiles: ['fixture'], actions: [] };
  const result = settings.resolveSettings(configured, [scope], []);
  assert.equal(result.type, 'effective');
  assert.equal(result.capabilities[0].policy.execution, 'foreground');
  assert.equal(result.capabilities[0].policy.critical, 'blocking');
});

test('catalog and explicit assessment schemas admit fixture facts and reject malformed protocol inputs', async () => {
  const fs = await import('node:fs');
  const { default: Ajv } = await import('ajv/dist/2020.js');
  const { default: addFormats } = await import('ajv-formats');
  const ajv = new Ajv({ strict: true, discriminator: true });
  addFormats(ajv);
  const schema = name => JSON.parse(fs.readFileSync(new URL(`../../source/schemas/pi/${name}.schema.json`, import.meta.url)));
  ajv.addSchema(schema('settings'));
  const catalogSchema = ajv.compile(schema('capabilities'));
  assert.equal(catalogSchema({ schemaVersion: 1, capabilities: catalog }), true);
  assert.equal(catalogSchema({ schemaVersion: 1, capabilities: [{ ...catalog[0], type: 'UNKNOWN' }] }), false);
  const assessment = ajv.compile(schema('scope-assessment'));
  const valid = { hook_event_name: 'Stop', cwd: '/work/repository', session_id: 'first-run', changed_paths: ['module/main.py', 'AGENTS.md'] };
  assert.equal(assessment(valid), true);
  for (const input of [
    { ...valid, changed_paths: ['../outside'] }, { ...valid, changed_paths: ['/outside'] },
    { ...valid, changed_paths: ['.git/HEAD'] }, { ...valid, changed_paths: ['.'] },
    { ...valid, cwd: 'relative' }, { ...valid, stop_hook_active: 'false' },
    { ...valid, unexpected: true }, { ...valid, hook_event_name: 'PostToolUse' },
  ]) assert.equal(assessment(input), false, JSON.stringify(input));
});
