import assert from 'node:assert/strict';
import test from 'node:test';
import { tsImport } from 'tsx/esm/api';

const imported = await tsImport('../../source/hooks/pi/coordinator.ts', import.meta.url);
const { HookCoordinator } = imported.default ?? imported;
const background = { execution: 'background', critical: 'report', output: { type: 'NEVER' }, context: 'none' };
const completed = { type: 'completed', context: 'proof', notice: '' };

test('background acceptance returns before a controlled job completes and stale results never deliver', async () => {
  const coordinator = new HookCoordinator();
  const barrier = Promise.withResolvers();
  const started = Promise.withResolvers();
  let returned = false;
  let delivered = 0;
  const pending = coordinator.submit('scope', background, async () => { started.resolve(); await barrier.promise; return completed; },
    () => delivered++, () => true).then(() => { returned = true; });
  await started.promise;
  await new Promise(resolve => setImmediate(resolve));
  try {
    assert.equal(returned, true, 'background settlement must end before barrier release');
    coordinator.invalidate();
  } finally { barrier.resolve(); await pending; }
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(delivered, 0);
});

test('configuration and journal identity reject late results without clearing pending work', async () => {
  const coordinator = new HookCoordinator();
  const barrier = Promise.withResolvers();
  let current = true;
  let delivered = false;
  const pending = coordinator.submit('scope', background, async () => { await barrier.promise; return completed; },
    () => { delivered = true; }, () => current);
  current = false;
  barrier.resolve();
  await pending;
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(delivered, false);
});

test('an adapter defect remains a failed outcome and leaves the coordinator usable', async () => {
  const coordinator = new HookCoordinator();
  const foreground = { ...background, execution: 'foreground', critical: 'blocking' };
  const results = [];
  const result = await coordinator.submit('defect', foreground, async () => { throw new Error('private defect detail'); }, value => results.push(value), () => true);
  assert.deepEqual(result, { type: 'rejected', code: 'ADAPTER_FAILED' });
  assert.deepEqual(results, [result]);
  assert.deepEqual(await coordinator.submit('healthy', foreground, async () => completed, () => {}, () => true), completed);
});

test('duplicate operation keys share one effect while distinct operations keep their own results', async () => {
  const coordinator = new HookCoordinator();
  const barrier = Promise.withResolvers();
  const started = Promise.withResolvers();
  const results = [];
  let effects = 0;
  const run = async () => { effects++; started.resolve(); await barrier.promise; return completed; };
  const deliver = value => results.push(value);
  await coordinator.submit('same-operation', background, run, deliver, () => true);
  await started.promise;
  await coordinator.submit('same-operation', background, run, deliver, () => true);
  const foreground = { ...background, execution: 'foreground' };
  const joined = coordinator.submit('same-operation', foreground, run, deliver, () => true);
  try {
    assert.equal(effects, 1);
    assert.deepEqual(coordinator.pending, ['same-operation']);
  } finally { barrier.resolve(); }
  assert.deepEqual(await joined, completed);
  await coordinator.submit('different-operation', foreground, run, deliver, () => true);
  assert.equal(effects, 2);
  assert.deepEqual(results, [completed, completed]);
});
