import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { decode, runHook } from '../../source/hooks/pi/adapter.ts';

test('hook responses keep context, rejection, and malformed results distinct', () => {
  assert.deepEqual(decode('{}'), { type: 'accepted', context: '' });
  assert.deepEqual(decode('{"hookSpecificOutput":{"additionalContext":"policy"}}'), { type: 'accepted', context: 'policy' });
  assert.deepEqual(decode('{"decision":"block","reason":"review needed"}'), { type: 'blocked', reason: 'review needed' });
  for (const input of ['', '[]', '{"decision":"allow"}', '{"unexpected":true}', '{"hookSpecificOutput":{}}']) assert.equal(decode(input).type, 'failed');
});

test('real hook subprocess preserves literal roots, stdin and cwd, with bounded failures', async t => {
  const directory = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "Pi adapter 'literal; $root ")));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  fs.mkdirSync(path.join(directory, 'hooks'));
  const script = path.join(directory, 'hooks/fixture.mjs');
  const hook = { name: 'fixture', event: 'Stop', command: 'node hooks/fixture.mjs', timeout: 2 };
  fs.writeFileSync(script, `let text = ''; for await (const chunk of process.stdin) text += chunk; const input = JSON.parse(text); console.log(JSON.stringify({hookSpecificOutput:{additionalContext:[input.hook_event_name,input.session_id,process.cwd(),process.env.PLUGIN_ROOT].join('|')}}));`);
  assert.deepEqual(await runHook(hook, directory, directory, "session ' $literal"), { type: 'accepted', context: `Stop|session ' $literal|${directory}|${directory}` });
  fs.writeFileSync(script, 'console.log("not JSON")');
  assert.deepEqual(await runHook(hook, directory, directory, 'session'), { type: 'failed', reason: 'HOOK_INVALID_JSON' });
  fs.writeFileSync(script, 'process.exit(3)');
  assert.match((await runHook(hook, directory, directory, 'session')).reason, /HOOK_EXIT_3/);
  fs.writeFileSync(script, 'setInterval(() => {}, 1000)');
  assert.deepEqual(await runHook({ ...hook, timeout: 0.05 }, directory, directory, 'session'), { type: 'failed', reason: 'HOOK_TIMEOUT' });
  const controller = new AbortController();
  const pending = runHook(hook, directory, directory, 'session', controller.signal);
  controller.abort();
  assert.deepEqual(await pending, { type: 'failed', reason: 'HOOK_CANCELLED' });
  fs.writeFileSync(script, 'process.stdout.write("x".repeat(1024 * 1024 + 1))');
  assert.deepEqual(await runHook(hook, directory, directory, 'session'), { type: 'failed', reason: 'HOOK_OUTPUT_LIMIT' });
});
