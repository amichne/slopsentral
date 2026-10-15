import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { tsImport } from 'tsx/esm/api';

const runtime = await tsImport('../../source/hooks/pi/runtime.ts', import.meta.url);
const { decodeHook, parseConfig, scopedSkills, select, runAction } = runtime.default ?? runtime;
const profile = { name: 'fixture', description: 'Fixture', skills: [{ name: 'chosen', path: 'plugin/skills/chosen/SKILL.md' }], instructions: [], agents: [], hooks: [], hookPolicy: 'ADVISORY' };
const config = { schemaVersion: 1, defaultProfile: 'fixture', profiles: [profile] };

test('runtime ingress rejects malformed profiles and selects only known profiles', () => {
  assert.equal(parseConfig(config).type, 'configured');
  assert.equal(select(config, 'fixture').type, 'selected');
  assert.deepEqual(select(config, 'off'), { type: 'off' });
  assert.deepEqual(select(config, 'unknown'), { type: 'rejected', code: 'UNKNOWN_PROFILE' });
  for (const value of [null, { ...config, extra: true }, { ...config, defaultProfile: 'absent' },
    { ...config, profiles: [profile, profile] },
    { ...config, profiles: [{ ...profile, skills: [{ name: 'bad', path: '../outside' }] }] },
    { ...config, profiles: [{ ...profile, hookPolicy: 'ignore' }] }]) {
    assert.equal(parseConfig(value).code, 'INVALID_CONFIG');
  }
  const hook = { name: 'gate', event: 'Stop', plugin: 'fixture', argv: ['uv'], timeout: 1 };
  for (const change of [{ event: ['Stop'] }, { event: 'unknown' }, { argv: ['sh', '|'] }, { timeout: 0 }, { matcher: '[' }])
    assert.equal(parseConfig({ ...config, profiles: [{ ...profile, hooks: [{ ...hook, ...change }] }] }).code, 'INVALID_CONFIG');
});

test('skill focus preserves unrelated resources and off removes package advertisements', () => {
  const root = '/package';
  const chosen = { filePath: '/package/plugin/skills/chosen/SKILL.md' };
  const excluded = { filePath: '/package/plugin/skills/other/SKILL.md' };
  const unrelated = { filePath: '/user/chosen/SKILL.md' };
  const similar = { filePath: '/package-other/SKILL.md' };
  assert.deepEqual(scopedSkills(root, select(config, 'fixture'), [chosen, excluded, unrelated, similar]), [chosen, unrelated, similar]);
  assert.deepEqual(scopedSkills(root, select(config, 'off'), [chosen, unrelated]), [unrelated]);
});

test('host response parser keeps failures distinct from successful and skipped commands', () => {
  assert.equal(decodeHook('', 0).type, 'completed');
  assert.equal(decodeHook('{}', 0).type, 'completed');
  assert.equal(decodeHook('{"systemMessage":"command completed, can skip"}', 0).notice, 'command completed, can skip');
  assert.equal(decodeHook('{"hookSpecificOutput":{"hookEventName":"SessionStart","additionalContext":"policy"}}', 0).context, 'policy');
  for (const value of ['{"decision":"block","reason":"blocked"}', '{"continue":false}', '{"hookSpecificOutput":{"permissionDecision":"deny"}}'])
    assert.equal(decodeHook(value, 0).code, 'BLOCKED');
  for (const value of ['PRIVATE OUTPUT', '[]', '{"unrecognized":true}', '{"systemMessage":4}'])
    assert.equal(decodeHook(value, 0).code, 'INVALID_OUTPUT');
  assert.equal(decodeHook('{}', 1).code, 'EXIT_FAILED');
});

test('real hook process receives JSON, consumer cwd, and plugin root without a shell', async t => {
  const directory = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'pi hook spaces ')));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  fs.mkdirSync(path.join(directory, 'fixture/hooks'), { recursive: true });
  const script = path.join(directory, 'fixture/hooks/probe.mjs');
  fs.writeFileSync(script, `import fs from 'node:fs'; const p=JSON.parse(fs.readFileSync(0,'utf8')); if(p.marker!=='expected'||process.cwd()!==${JSON.stringify(directory)}||process.env.PLUGIN_ROOT!==${JSON.stringify(path.join(directory, 'fixture'))}) process.exit(4); console.log(JSON.stringify({systemMessage:'received'}));`);
  const action = { name: 'probe', event: 'Stop', plugin: 'fixture', argv: [process.execPath, 'hooks/probe.mjs'], timeout: 5 };
  assert.deepEqual(await runAction(directory, action, directory, { marker: 'expected' }), { type: 'completed', context: '', notice: 'received' });
  for (const [name, code, expected] of [
    ['malformed', "console.log('PRIVATE RAW PAYLOAD')", 'INVALID_OUTPUT'],
    ['failed', 'process.exit(3)', 'EXIT_FAILED'],
    ['overflow', "process.stdout.write('x'.repeat(100000))", 'OUTPUT_LIMIT'],
    ['timeout', 'setTimeout(()=>{}, 10000)', 'TIMED_OUT'],
  ]) {
    fs.writeFileSync(script, code);
    const result = await runAction(directory, { ...action, timeout: 1 }, directory, {});
    assert.deepEqual(result, { type: 'rejected', code: expected }, name);
    assert.equal(JSON.stringify(result).includes('PRIVATE RAW PAYLOAD'), false);
  }
  const controller = new AbortController();
  controller.abort();
  assert.equal((await runAction(directory, action, directory, {}, controller.signal)).code, 'ABORTED');
  assert.equal((await runAction(directory, { ...action, argv: ['/absent/command'] }, directory, {})).code, 'LAUNCH_FAILED');
});

test('timeout escalates against descendants even after the process leader ends', { skip: process.platform === 'win32' }, async t => {
  const directory = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'pi-descendant-')));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  const descendant = path.join(directory, 'descendant.mjs');
  const leader = path.join(directory, 'leader.mjs');
  const pidPath = path.join(directory, 'pid');
  fs.writeFileSync(descendant, `import fs from 'node:fs'; process.on('SIGTERM',()=>{}); fs.writeFileSync(${JSON.stringify(pidPath)},String(process.pid));setInterval(()=>{},1000);`);
  fs.writeFileSync(leader, `import {spawn} from 'node:child_process';spawn(process.execPath,[${JSON.stringify(descendant)}],{stdio:'ignore'});setInterval(()=>{},1000);`);
  const result = await runAction(directory, { name: 'probe', plugin: 'fixture', event: 'Stop', argv: [process.execPath, leader], timeout: 1 }, directory, {});
  assert.equal(result.code, 'TIMED_OUT');
  const pid = Number(fs.readFileSync(pidPath, 'utf8'));
  t.after(() => { try { process.kill(pid, 'SIGKILL'); } catch (error) { if (error.code !== 'ESRCH') throw error; } });
  await new Promise(resolve => setTimeout(resolve, 400));
  assert.throws(() => process.kill(pid, 0), error => error.code === 'ESRCH');
});
