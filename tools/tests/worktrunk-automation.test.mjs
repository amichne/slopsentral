import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import test from 'node:test';

const repoRoot = path.resolve(import.meta.dirname, '../..');
const wt = spawnSync('which', ['wt'], { encoding: 'utf8' }).stdout?.trim();
const skipWorktrunk = !wt && process.env.CI !== 'true';

function fixture(t) {
  assert.ok(wt, 'Worktrunk (wt) is required for CI lifecycle checks');
  const root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'slopsentral-wt-')));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const repo = path.join(root, 'repo');
  const bin = path.join(root, 'bin');
  fs.mkdirSync(path.join(repo, '.config'), { recursive: true });
  fs.mkdirSync(bin);
  fs.copyFileSync(path.join(repoRoot, '.config/wt.toml'), path.join(repo, '.config/wt.toml'));
  fs.writeFileSync(path.join(root, 'user.toml'), 'worktree-path = "{{ repo_path }}/../{{ branch | sanitize }}"\n');
  fs.writeFileSync(path.join(root, 'system.toml'), '');
  const log = path.join(root, 'commands.log');
  fs.writeFileSync(path.join(bin, 'npm'), `#!/bin/sh
printf '%s\\n' "$PWD:$*" >> "$WT_TEST_LOG"
case "$*" in
  ci) exit "\${WT_TEST_SETUP_EXIT:-0}" ;;
  'run check:source') exit "\${WT_TEST_CHECK_EXIT:-0}" ;;
  'run verify') exit "\${WT_TEST_VERIFY_EXIT:-0}" ;;
  *) exit 99 ;;
esac
`, { mode: 0o755 });
  const env = Object.fromEntries(Object.entries(process.env)
    .filter(([key]) => !key.startsWith('WORKTRUNK_') && !key.startsWith('GIT_') && key !== 'BASH_ENV' && key !== 'ENV'));
  Object.assign(env, {
    PATH: `${bin}:${process.env.PATH}`,
    XDG_CONFIG_HOME: path.join(root, 'config'),
    WORKTRUNK_CONFIG_PATH: path.join(root, 'user.toml'),
    WORKTRUNK_SYSTEM_CONFIG_PATH: path.join(root, 'system.toml'),
    WORKTRUNK_COMMIT__GENERATION__COMMAND: "printf 'test: worktrunk fixture\\n'",
    WT_TEST_LOG: log,
  });
  const run = (command, args, extraEnv = {}) => spawnSync(command, args, {
    cwd: repo, env: { ...env, ...extraEnv }, encoding: 'utf8', timeout: 30_000,
  });
  const git = (...args) => {
    const result = run('git', args);
    assert.equal(result.status, 0, result.stderr);
    return result.stdout.trim();
  };
  git('init', '-q', '--initial-branch=main');
  git('config', 'user.email', 'worktrunk-test@example.invalid');
  git('config', 'user.name', 'Worktrunk Test');
  fs.writeFileSync(path.join(repo, 'tracked.txt'), 'before\n');
  git('add', '.');
  git('commit', '-qm', 'test: fixture base');
  return { root, repo, log, run, git };
}

test('creation runs blocking setup in the new worktree before handoff', { skip: skipWorktrunk }, t => {
  const f = fixture(t);
  const success = f.run(wt, ['switch', '--create', 'task', '--base=main', '--yes', '--no-cd', '--format=json']);
  assert.equal(success.status, 0, success.stderr);
  assert.equal(fs.readFileSync(f.log, 'utf8').trim(), `${path.join(f.root, 'task')}:ci`);
  const handoff = path.join(f.root, 'handoff');
  const failed = f.run(wt, ['switch', '--create', 'failed-task', '--base=main', '--yes', '--no-cd',
    '--execute', 'touch', '--', handoff], { WT_TEST_SETUP_EXIT: '17' });
  assert.equal(failed.error, undefined);
  assert.equal(failed.signal, null);
  assert.notEqual(failed.status, 0, failed.stderr);
  assert.match(fs.readFileSync(f.log, 'utf8'), /failed-task:ci/);
  assert.equal(fs.existsSync(handoff), false, 'failed setup must prevent agent handoff');
});

test('failed pre-commit checks preserve HEAD and staged task scope', { skip: skipWorktrunk }, t => {
  const f = fixture(t);
  const head = f.git('rev-parse', 'HEAD');
  fs.writeFileSync(path.join(f.repo, 'tracked.txt'), 'after\n');
  fs.writeFileSync(path.join(f.repo, 'unrelated.txt'), 'user work\n');
  f.git('add', 'tracked.txt');
  const failed = f.run(wt, ['step', 'commit', '--stage=none', '--yes'], { WT_TEST_CHECK_EXIT: '19' });
  assert.equal(failed.error, undefined);
  assert.equal(failed.signal, null);
  assert.notEqual(failed.status, 0, failed.stderr);
  assert.match(fs.readFileSync(f.log, 'utf8'), /run check:source/);
  assert.equal(f.git('rev-parse', 'HEAD'), head);
  assert.equal(f.git('diff', '--cached', '--name-only'), 'tracked.txt');
  assert.match(f.git('status', '--short'), /\?\? unrelated\.txt/);
  const success = f.run(wt, ['step', 'commit', '--stage=none', '--yes']);
  assert.equal(success.status, 0, success.stderr);
  assert.notEqual(f.git('rev-parse', 'HEAD'), head);
  assert.equal(f.git('show', '--pretty=format:', '--name-only', 'HEAD'), 'tracked.txt');
  assert.match(f.git('status', '--short'), /\?\? unrelated\.txt/);
});

test('manual verification and the merge gate propagate check failures', { skip: skipWorktrunk }, t => {
  const f = fixture(t);
  const alias = f.run(wt, ['--yes', 'verify']);
  assert.equal(alias.status, 0, alias.stderr);
  assert.equal(fs.readFileSync(f.log, 'utf8').trim(), `${f.repo}:run verify`);
  const failed = f.run(wt, ['hook', 'pre-merge', 'project:', '--yes'], { WT_TEST_VERIFY_EXIT: '23' });
  assert.equal(failed.error, undefined);
  assert.equal(failed.signal, null);
  assert.notEqual(failed.status, 0, failed.stderr);
  assert.equal(fs.readFileSync(f.log, 'utf8').trim().split('\n').length, 2);
});
