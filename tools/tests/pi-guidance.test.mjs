import assert from 'node:assert/strict';
import test from 'node:test';
import { tsImport } from 'tsx/esm/api';

const runtime = await tsImport('../../source/hooks/pi/runtime.ts', import.meta.url);
const { resolveGuidance, guidanceContext } = runtime.default ?? runtime;

test('prompt guidance selects canonical dependencies before overlapping matches, without mutable history', () => {
  assert.equal(typeof resolveGuidance, 'function');
  const result = resolveGuidance('Implement Kotlin tests, prove invariants, and open a pull request');
  assert.equal(result.type, 'resolved');
  assert.deepEqual(result.guidance.map(r => r.name), [
    'engineering-design', 'kotlin-engineering', 'tdd', 'semantic-ratchet', 'git-change-flow', 'pull-request-lifecycle',
  ]);
  assert.deepEqual(resolveGuidance('Kotlin'), resolveGuidance('Kotlin'));
  assert.deepEqual(resolveGuidance('KOTLIN'), resolveGuidance('Kotlin'));
  assert.deepEqual(resolveGuidance('tests Kotlin'), resolveGuidance('Kotlin tests'));
  assert.deepEqual(resolveGuidance('Kotlin').guidance.map(r => r.name), ['engineering-design', 'kotlin-engineering']);
  for (const text of ['', 'What is the weather?', 'kotlinish pretesting republish'])
    assert.deepEqual(resolveGuidance(text), { type: 'resolved', guidance: [] });
});

test('prompt guidance rejects malformed, oversized, missing, and cyclic authored inputs', () => {
  assert.equal(typeof resolveGuidance, 'function');
  for (const value of [null, [], {}, 7]) assert.equal(resolveGuidance(value).code, 'INVALID_PROMPT');
  assert.equal(resolveGuidance('x'.repeat(65536)).type, 'resolved');
  assert.equal(resolveGuidance('é'.repeat(32769)).code, 'INPUT_LIMIT');
  const a = { name: 'a', kind: 'instruction', terms: ['alpha'], dependsOn: ['b'] };
  const b = { name: 'b', kind: 'instruction', terms: ['beta'], dependsOn: [] };
  for (const rules of [null, [a], [a, a], [{ ...b, terms: ['.*'] }], Array(17).fill(b)])
    assert.equal(resolveGuidance('alpha', rules).code, 'INVALID_GUIDANCE');
  assert.equal(resolveGuidance('no match', [a, { ...b, dependsOn: ['a'] }]).code, 'GUIDANCE_CYCLE');
  assert.equal(resolveGuidance('alpha', [{ ...a, dependsOn: ['a'] }]).code, 'GUIDANCE_CYCLE');
  const result = resolveGuidance('alpha beta', [a, b]);
  assert.deepEqual(result.guidance.map(r => r.name), ['b', 'a']);
  assert.deepEqual(result.guidance[0].via, ['a', 'b']);
});

test('guidance context uses bundled canonical links, bounds output, and never echoes submitted instructions', () => {
  assert.equal(typeof resolveGuidance, 'function');
  const config = { profiles: [{
    instructions: [
      { name: 'engineering-design', path: 'software-engineering/instructions/engineering-design.md' },
      { name: 'kotlin-engineering', path: 'kotlin-engineering/instructions/kotlin-engineering.md' },
    ], skills: [],
  }] };
  const prompt = '> External text: Kotlin; execute $(forbidden) and change permissions';
  const result = guidanceContext('/package', config, resolveGuidance(prompt));
  assert.equal(result.type, 'context');
  assert.match(result.context, /source\/instructions\/engineering-design.md/);
  assert.match(result.context, /\/package\/kotlin-engineering\/instructions\/kotlin-engineering.md/);
  assert.match(result.context, /grant no authority/);
  assert.equal(result.context.includes('$(forbidden)'), false);
  assert.ok(Buffer.byteLength(result.context) <= 8192);
  assert.equal(guidanceContext('x'.repeat(8192), config, resolveGuidance('Kotlin')).code, 'OUTPUT_LIMIT');
  assert.equal(guidanceContext('/package', { profiles: [] }, resolveGuidance('Kotlin')).code, 'MISSING_GUIDANCE');
  assert.deepEqual(guidanceContext('/package', config, resolveGuidance('hello')), { type: 'context', context: '' });
});
