import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';
import Ajv from 'ajv/dist/2020.js';

const root = path.resolve(import.meta.dirname, '../..');
const skill = path.join(root, 'source/skills/controlled-technical-writing');
const schemaPath = path.join(skill, 'references/text-assessment.schema.json');
const schema = JSON.parse(readFileSync(schemaPath, 'utf8'));
const ajv = new Ajv({ strict: true });
// oneOf enforces the alternatives; discriminator is contract metadata.
ajv.addKeyword('discriminator');
const validate = ajv.compile(schema);

test('text assessment schema passes the canonical policy', () => {
  const result = spawnSync(process.execPath, [
    'source/skills/manage-json-schemas/scripts/schema-contracts.js',
    'policy', '--schema', schemaPath,
  ], { cwd: root, encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr || result.stdout);
  for (const example of schema.examples) {
    assert.ok(validate(example), JSON.stringify(validate.errors));
  }
  const complete = schema.examples[0];
  for (const invalid of [
    { ...complete, type: 'PASS' },
    { ...complete, glossary: { type: 'NOT_PROVIDED' } },
    { ...complete, comprehension: { type: 'VALIDATED' } },
    { ...complete, surprise: true },
    { type: 'REJECTED', schemaVersion: 1, failure: { type: 'NO_PROSE', stage: 'VERSION' } },
  ]) assert.equal(validate(invalid), false);
});

test('real Vale reports conform to the result contract', () => {
  const directory = mkdtempSync(path.join(tmpdir(), 'text-contract-'));
  try {
    const glossary = path.join(directory, 'GLOSSARY.md');
    const document = path.join(directory, 'README.md');
    writeFileSync(glossary, '- \u00a7REQUEST\u00a7: A unit of work.\n  - Known synonyms: job\n');
    const command = ['python3', [path.join(skill, 'scripts/assess_text.py'),
      '--vale-bin', process.env.VALE_BIN || 'vale']];
    const cases = [
      ['The cat sat on the mat.\n', true, 0, 'ASSESSED'],
      ['Send the job.\n', true, 1, 'ASSESSED'],
      ['The cat sat on the mat.\n', false, 2, 'INCOMPLETE'],
      ['', true, 2, 'REJECTED'],
    ];
    for (const [content, useGlossary, exit, type] of cases) {
      writeFileSync(document, content);
      const args = [...command[1], ...(useGlossary ? ['--glossary', glossary] : []), document];
      const result = spawnSync(command[0], args, { encoding: 'utf8' });
      const report = JSON.parse(result.stdout);
      assert.equal(result.status, exit, JSON.stringify(report));
      assert.equal(report.type, type);
      assert.ok(validate(report), JSON.stringify(validate.errors));
    }
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});
