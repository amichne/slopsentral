import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import Ajv from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';

const root = path.resolve(import.meta.dirname, '../..');
const skill = 'source/skills/controlled-technical-writing';
const schemaPath = `${skill}/references/glossary.schema.json`;
const schema = JSON.parse(readFileSync(path.join(root, schemaPath), 'utf8'));
const data = JSON.parse(readFileSync(path.join(root, 'docs/glossary.json'), 'utf8'));
const ajv = new Ajv({ strict: true });
ajv.addKeyword('discriminator');
addFormats(ajv);
const validate = ajv.compile(schema);

test('the JSON glossary has a closed schema and real source-backed entries', () => {
  const policy = spawnSync(process.execPath, [`${skill.replace('controlled-technical-writing', 'manage-json-schemas')}/scripts/schema-contracts.js`,
    'policy', '--schema', schemaPath], { cwd: root, encoding: 'utf8' });
  assert.equal(policy.status, 0, policy.stderr || policy.stdout);
  assert.ok(validate(data), JSON.stringify(validate.errors));
  for (const example of schema.examples) assert.ok(validate(example), JSON.stringify(validate.errors));
  assert.equal(data.entries.length, 8);
  assert.ok(data.entries.every(entry => entry.rejectedForms.length === 0));
  for (const invalid of [
    { ...data, schemaVersion: true },
    { ...data, server: 'https://example.com' },
    { ...data, entries: [{ ...data.entries[0], usage: [] }] },
    { ...data, entries: [{ ...data.entries[0], rejectedForms: [{ type: 'REPLACE', form: 'skilll' }] }] },
  ]) assert.equal(validate(invalid), false);
});

test('the generated Markdown view cannot become a second glossary owner', () => {
  const result = spawnSync('uv', ['run', '--locked', 'python', `${skill}/scripts/check_glossary.py`,
    'docs/glossary.json', '--check-render', 'docs/GLOSSARY.md'], { cwd: root, encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr || result.stdout);
  const report = JSON.parse(result.stdout);
  assert.equal(report.type, 'GLOSSARY_REPORT');
  assert.equal(report.replacementTargets, 0);
  assert.equal(report.reviewTargets, 0);
});
