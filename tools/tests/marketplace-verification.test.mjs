import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import test from 'node:test';

const repoRoot = path.resolve(import.meta.dirname, '../..');

test('the source gate rejects whitespace already staged for a Worktrunk commit', t => {
  const root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'slopsentral-source-gate-')));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const bin = path.join(root, 'bin');
  fs.mkdirSync(bin);
  // Isolate the whitespace boundary; the source and catalog validators have their own checks.
  fs.writeFileSync(path.join(bin, 'node'), `#!${process.execPath}\nprocess.exit(0);\n`, { mode: 0o755 });
  const env = Object.fromEntries(Object.entries(process.env)
    .filter(([key]) => !key.startsWith('GIT_') && key !== 'BASH_ENV' && key !== 'ENV'));
  env.PATH = `${bin}:${process.env.PATH}`;
  const run = (command, args) => spawnSync(command, args, { cwd: root, env, encoding: 'utf8', timeout: 30_000 });
  for (const args of [['init', '-q'], ['config', 'user.email', 'gate@example.invalid'],
    ['config', 'user.name', 'Gate Test']]) assert.equal(run('git', args).status, 0);
  const source = path.join(root, 'task.txt');
  fs.writeFileSync(source, 'valid\n');
  assert.equal(run('git', ['add', 'task.txt']).status, 0);
  assert.equal(run('git', ['commit', '-qm', 'test: source gate']).status, 0);
  const script = JSON.parse(fs.readFileSync(path.join(repoRoot, 'package.json'), 'utf8')).scripts['check:source'];
  assert.equal(run('bash', ['--noprofile', '--norc', '-c', script]).status, 0);
  fs.writeFileSync(source, 'invalid \n');
  assert.equal(run('git', ['add', 'task.txt']).status, 0);
  const rejected = run('bash', ['--noprofile', '--norc', '-c', script]);
  assert.equal(rejected.status, 2);
  assert.match(rejected.stdout, /trailing whitespace/);
});

function verify(t, failedHarness) {
  const root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'slopsentral verification ')));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const repo = path.join(root, 'repo');
  const bin = path.join(root, 'bin');
  const temp = path.join(root, 'temp');
  for (const directory of [path.join(repo, 'tools'), bin, temp]) fs.mkdirSync(directory, { recursive: true });
  fs.copyFileSync(path.join(repoRoot, 'tools/verify-marketplaces'), path.join(repo, 'tools/verify-marketplaces'));
  const log = path.join(root, 'commands.jsonl');
  for (const command of ['projeKtor', 'node']) {
    fs.writeFileSync(path.join(bin, command), `#!${process.execPath}
const fs = require('node:fs');
const args = process.argv.slice(2);
fs.appendFileSync(process.env.VERIFY_TEST_LOG, JSON.stringify({
  command: ${JSON.stringify(command)}, args, cwd: process.cwd(),
  instructionRoot: process.env.INSTRUCTION_MARKETPLACE_ROOT,
  stopRoot: process.env.STOP_MARKETPLACE_ROOT,
}) + '\\n');
if (args.includes('--out')) fs.mkdirSync(args[args.indexOf('--out') + 1], { recursive: true });
if (args.includes(process.env.VERIFY_TEST_FAILED_HARNESS)) process.exit(37);
`, { mode: 0o755 });
  }
  const env = { ...process.env, PATH: `${bin}:${process.env.PATH}`, TMPDIR: temp, VERIFY_TEST_LOG: log };
  delete env.BASH_ENV;
  delete env.INSTRUCTION_MARKETPLACE_ROOT;
  delete env.STOP_MARKETPLACE_ROOT;
  if (failedHarness) env.VERIFY_TEST_FAILED_HARNESS = failedHarness;
  else delete env.VERIFY_TEST_FAILED_HARNESS;
  const result = spawnSync('bash', ['--noprofile', '--norc', path.join(repo, 'tools/verify-marketplaces')], {
    cwd: root, env, encoding: 'utf8', timeout: 30_000,
  });
  const commands = fs.readFileSync(log, 'utf8').trim().split('\n').map(line => JSON.parse(line));
  assert.deepEqual(fs.readdirSync(temp), [], 'all invocation-owned projections must be removed');
  for (const command of commands) assert.equal(command.cwd, repo);
  return { result, commands };
}

test('verification projects both providers and checks the generated Codex hooks', t => {
  const { result, commands } = verify(t);
  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(commands.map(({ command }) => command), ['projeKtor', 'projeKtor', 'node', 'node']);
  assert.deepEqual(commands.slice(0, 2).map(({ args }) => args.slice(0, 5)), [
    ['project', '--source', '.', '--harness', 'codex'],
    ['project', '--source', '.', '--harness', 'github-copilot'],
  ]);
  const codexRoot = commands[0].args[6];
  assert.notEqual(codexRoot, commands[1].args[6]);
  assert.equal(commands[2].instructionRoot, codexRoot);
  assert.equal(commands[3].stopRoot, codexRoot);
  assert.deepEqual(commands[2].args, ['--test', 'tools/tests/instruction-delivery.test.mjs']);
  assert.deepEqual(commands[3].args, ['--test', 'tools/tests/stop-output-contract.test.mjs']);
});

for (const failedHarness of ['codex', 'github-copilot']) {
  test(`a failed ${failedHarness} projection prevents downstream verification`, t => {
    const { result, commands } = verify(t, failedHarness);
    assert.equal(result.status, 37, result.stderr);
    assert.equal(commands.length, failedHarness === 'codex' ? 1 : 2);
  });
}
