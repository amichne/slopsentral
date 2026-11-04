import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import test from 'node:test';

const root = path.resolve(import.meta.dirname, '../..');
const directory = 'source/skills/personal-setup-management';
const read = name => fs.readFileSync(path.join(root, directory, name), 'utf8');
const reference = read('references/shell-config-layout.md');
const commands = reference.match(/```sh\n([\s\S]*?)```/)[1];

function run(cwd, env, command, args) {
  const result = spawnSync(command, args, { cwd, env, encoding: 'utf8', timeout: 10000 });
  assert.ifError(result.error);
  assert.equal(result.status, 0, result.stderr);
  return result.stdout;
}

test('documented native HOME reads preserve private files, unrelated links and the real index', t => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'setup ownership '));
  t.after(() => fs.rmSync(home, { recursive: true, force: true }));
  const env = { PATH: process.env.PATH, HOME: home, GIT_CONFIG_NOSYSTEM: '1', GIT_CONFIG_GLOBAL: '/dev/null' };
  const metadata = path.join(home, '.dotfiles.git');
  run(home, env, 'git', ['init', '--bare', metadata]);
  const git = args => run(home, env, 'git', [`--git-dir=${metadata}`, `--work-tree=${home}`, ...args]);
  git(['remote', 'add', 'origin', 'https://github.com/amichne/dotfiles.git']);
  fs.mkdirSync(path.join(home, '.local/bin'), { recursive: true });
  fs.mkdirSync(path.join(home, 'scripts'));
  for (const name of ['.zshrc', '.local/bin/df', 'scripts/df.py', 'scripts/install.py']) {
    fs.writeFileSync(path.join(home, name), 'public fixture\n');
    git(['add', '--', name]);
  }
  git(['-c', 'user.name=Fixture', '-c', 'user.email=fixture@example.invalid',
    '-c', 'commit.gpgsign=false', '-c', 'core.hooksPath=/dev/null', 'commit', '-m', 'public source']);
  const head = git(['rev-parse', 'HEAD']).trim();
  const privatePath = path.join(home, '.private');
  fs.writeFileSync(privatePath, 'PRIVATE_MARKER');
  fs.symlinkSync('/nonexistent-unrelated-fixture', path.join(home, 'unrelated-link'));
  fs.appendFileSync(path.join(home, '.zshrc'), 'pending public edit\n');
  git(['add', '--', '.zshrc']);
  const index = fs.readFileSync(path.join(metadata, 'index'));
  const output = run(home, env, '/bin/sh', ['-eu', '-c', commands]);
  assert.ok(output.startsWith('true\ntrue\nhttps://github.com/amichne/dotfiles.git\n' + head + '\n'));
  assert.match(output, /M  \.zshrc/);
  assert.ok(!output.includes('PRIVATE_MARKER'));
  assert.ok(!output.includes('.private'));
  assert.ok(!output.includes('unrelated-link'));
  assert.deepEqual(fs.readFileSync(path.join(metadata, 'index')), index);
  assert.equal(fs.readFileSync(privatePath, 'utf8'), 'PRIVATE_MARKER');
  assert.equal(fs.readlinkSync(path.join(home, 'unrelated-link')), '/nonexistent-unrelated-fixture');
  // The worktree override changes this observation; the documented first read must omit it.
  assert.equal(git(['rev-parse', '--is-bare-repository']).trim(), 'false');
  assert.equal(git(['config', '--get', 'core.bare']).trim(), 'true');
});

test('documented metadata reads stop on absent HOME metadata without creating it', t => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'absent setup '));
  t.after(() => fs.rmSync(home, { recursive: true, force: true }));
  const result = spawnSync('/bin/sh', ['-eu', '-c', commands], {
    cwd: home, env: { PATH: process.env.PATH, HOME: home }, encoding: 'utf8', timeout: 10000,
  });
  assert.notEqual(result.status, 0);
  assert.equal(fs.existsSync(path.join(home, '.dotfiles.git')), false);
});

test('standalone skill retains discovery, archive, legacy, privacy and activation boundaries', () => {
  const skill = read('SKILL.md');
  assert.match(skill, /amichne\/dotfiles/);
  assert.match(skill, /amichne\/ayi/);
  assert.match(skill, /Historical[\s\S]*apply only if rediscovered and\n   verified/);
  assert.match(skill, /archive registry/);
  assert.match(skill, /never a recursive copy of live HOME/);
  assert.match(skill, /Passing fixture checks do not prove the live shell loaded it/);
  assert.match(reference, /It need not have an\norigin/);
  assert.match(reference, /Missing or conflicting evidence stops\ndependent writes/);
  assert.match(reference, /do not establish model routing, better model outcomes/);
  const cases = JSON.parse(fs.readFileSync(path.join(root, 'source/evals/routing/personal-setup-workflows.json'))).cases;
  for (const id of ['personal-setup-verifies-current-dotfiles-authority',
    'personal-setup-retains-verified-legacy-layout', 'personal-setup-resolves-ayi-archive-registry']) {
    const entry = cases.find(value => value.id === id);
    assert.ok(entry);
    assert.deepEqual(entry.observedRoute.loadedPrimitives, []);
    assert.match(entry.notes, /not an observed model routing result/);
  }
});

test('consumer setup contract follows the current installer without manufacturing field evidence', () => {
  const readJson = file => JSON.parse(fs.readFileSync(path.join(root, file), 'utf8'));
  const id = 'repository-consumer-setup-uses-current-marketplace-cli';
  const entry = readJson('source/evals/routing/marketplace-workflows.json').cases.find(value => value.id === id);
  assert.equal(entry.source.type, 'CURRENT_SOURCE');
  assert.ok(entry.source.evidenceRefs.includes('tools/slopsentral.py'));
  assert.match(fs.readFileSync(path.join(root, 'README.md'), 'utf8'), /tools\/slopsentral\.py self install/);
  assert.ok(entry.allowedActions.some(value => value.includes('tools/slopsentral.py')));
  assert.ok(entry.allowedActions.some(value => value.includes('--host') && value.includes('--plugin')));
  assert.ok(!entry.allowedActions.some(value => /intelligence/i.test(value)));
  assert.deepEqual(entry.observedRoute.loadedPrimitives, []);
  const golden = readJson('source/evals/routing/fixtures/golden-routing-observations.json')
    .observations.find(value => value.caseId === id);
  assert.deepEqual(golden.satisfiedAllowedActions, entry.allowedActions);
  assert.deepEqual(golden.avoidedForbiddenActions, entry.forbiddenActions);
  assert.match(golden.notes, /Synthetic golden contract fixture/);
});
