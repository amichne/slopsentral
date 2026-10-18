import assert from 'node:assert/strict';
import test from 'node:test';
import { tsImport } from 'tsx/esm/api';

const importedControl = await tsImport('../../source/hooks/pi/control.ts', import.meta.url);
const { presented, blockingFailures } = importedControl.default ?? importedControl;
const importedRuntime = await tsImport('../../source/hooks/pi/runtime.ts', import.meta.url);
const { decodeHook } = importedRuntime.default ?? importedRuntime;
const action = { name: 'gate', event: 'Stop', plugin: 'fixture', argv: ['/usr/bin/true'], timeout: 30 };
const policy = { execution: 'foreground', critical: 'blocking', output: { type: 'ALWAYS' }, context: 'structured' };

test('every display policy preserves the decoded outcome and independent blocking decision', () => {
  const result = decodeHook(JSON.stringify({ decision: 'block', reason: 'hide this\nkeep this' }), 0, 'Stop');
  const snapshot = structuredClone(result);
  for (const [output, expected] of [
    [{ type: 'ALWAYS' }, 'gate: BLOCKED\nhide this\nkeep this'],
    [{ type: 'ERRORS' }, 'gate: BLOCKED\nhide this\nkeep this'],
    [{ type: 'EXCLUDE', pattern: '^(gate:|hide)' }, 'keep this'],
    [{ type: 'NEVER' }, ''],
  ]) {
    const run = { action, policy: { ...policy, output }, result };
    assert.equal(presented(run), expected);
    assert.match(blockingFailures([run]), /BLOCKED/);
    assert.deepEqual(result, snapshot);
  }
  const success = decodeHook('{"systemMessage":"success"}', 0, 'Stop');
  assert.equal(presented({ action, policy: { ...policy, output: { type: 'ERRORS' } }, result: success }), '');
  assert.equal(blockingFailures([{ action, policy, result: success }]), '');
});
