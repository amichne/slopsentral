import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import test from 'node:test';

const repo = path.resolve(import.meta.dirname, '../..');
test('locked portable launchers reject missing and stale locks before application output', t => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'portable-direct-locks-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const environment = Object.fromEntries(Object.entries(process.env)
    .filter(([key]) => !key.startsWith('UV_') && !key.startsWith('PYTHON') && key !== 'VIRTUAL_ENV'));
  Object.assign(environment, { UV_NO_CONFIG: '1', UV_PYTHON: '3.12',
    UV_CACHE_DIR: path.join(root, 'cache'), UV_PYTHON_DOWNLOADS: 'never', PYTHONNOUSERSITE: '1' });
  assert.equal(fs.existsSync(environment.UV_CACHE_DIR), false, 'the readiness cache must start empty');
  const prepared = spawnSync('uv', ['run', '--locked', '--script',
    path.join(repo, 'tools/tests/fixtures/uv-legacy-probe.py')], {
    cwd: root, env: environment, encoding: 'utf8', timeout: 60000,
  });
  assert.equal(prepared.status, 0, prepared.stdout + prepared.stderr);
  environment.UV_OFFLINE = '1';
  let count = 0;
  for (const base of ['source', 'tools']) for (const relative of fs.readdirSync(path.join(repo, base), { recursive: true })) {
    const file = path.join(repo, base, relative);
    if (!fs.statSync(file).isFile() || relative.split(path.sep).includes('__pycache__')) continue;
    const text = fs.readFileSync(file, 'utf8');
    if (!text.startsWith('#!/usr/bin/env -S uv run --locked --script\n') || (fs.statSync(file).mode & 0o111) === 0) continue;
    const installed = path.join(root, `${count++}`, path.basename(file));
    fs.mkdirSync(path.dirname(installed), { recursive: true });
    fs.copyFileSync(file, installed);
    fs.chmodSync(installed, fs.statSync(file).mode & 0o777);
    const lock = fs.readFileSync(`${file}.lock`, 'utf8');
    // Resolve each declared dependency before the offline forbidden-path checks.
    // An empty cache cannot distinguish a missing lock from absent metadata.
    fs.writeFileSync(`${installed}.lock`, lock);
    const readinessEnvironment = { ...environment };
    delete readinessEnvironment.UV_OFFLINE;
    const readiness = spawnSync('uv', ['sync', '--locked', '--script', installed], {
      cwd: root, env: readinessEnvironment, encoding: 'utf8', timeout: 60000,
    });
    assert.equal(readiness.status, 0, readiness.stdout + readiness.stderr);
    assert.equal(fs.readFileSync(`${installed}.lock`, 'utf8'), lock,
      'dependency readiness must preserve the declared lock');
    const preparedIndex = spawnSync('uv', ['lock', '--script', installed, '--refresh'], {
      cwd: root, env: readinessEnvironment, encoding: 'utf8', timeout: 60000,
    });
    assert.equal(preparedIndex.status, 0, preparedIndex.stdout + preparedIndex.stderr);
    fs.rmSync(`${installed}.lock`);
    for (const present of [false, true]) {
      const stale = lock.replace(/^requires-python = ".*"$/m, 'requires-python = "==3.12.0"');
      assert.notEqual(stale, lock, file);
      if (present) fs.writeFileSync(`${installed}.lock`, stale);
      const result = spawnSync(installed, ['--help'], { cwd: root, env: environment, encoding: 'utf8', timeout: 60000 });
      assert.notEqual(result.status, 0, `${file}: ${result.stdout}${result.stderr}`);
      assert.match(result.stderr, /lockfile/i, file);
      assert.equal(result.stdout, '', file);
      assert.equal(fs.existsSync(`${installed}.lock`), present, file);
      if (present) assert.equal(fs.readFileSync(`${installed}.lock`, 'utf8'), stale, file);
    }
  }
  assert.ok(count > 0);
  t.diagnostic(`${count} executable portable launchers rejected both missing and stale locks`);
});

test('portable script metadata carries the uv minimum and an adjacent lock', () => {
  for (const root of ['bin', 'source', 'tools']) {
    for (const relative of fs.readdirSync(path.join(repo, root), { recursive: true })) {
      const file = path.join(repo, root, relative);
      if (!fs.statSync(file).isFile() || relative.split(path.sep).includes('__pycache__')) continue;
      const text = fs.readFileSync(file, 'utf8');
      if (!text.startsWith('#!') || !text.includes('# /// script\n')) continue;
      assert.ok(text.startsWith('#!/usr/bin/env -S uv run --locked --script\n'), `${root}/${relative}: locked launcher`);
      const metadata = text.match(/^# \/\/\/ script\n([\s\S]*?)^# \/\/\/$/m)?.[1];
      assert.ok(metadata, `${root}/${relative}: script metadata must exist`);
      assert.match(metadata, /^# required-version = ">=0\.12\.9"$/m, `${root}/${relative}`);
      const lock = file.endsWith('.tmpl') ? file.slice(0, -5) + '.lock.tmpl' : file + '.lock';
      assert.equal(fs.statSync(lock, { throwIfNoEntry: false })?.isFile(), true, `${root}/${relative}: adjacent lock`);
    }
  }
});

for (const [mutation, relative, expected] of [
  ['missing minimum', 'source/skills/code-knowledge-base/scripts/visualize.py', 'must declare the existing uv >=0.12.9 minimum'],
  ['minimum outside metadata', 'source/skills/code-knowledge-base/scripts/visualize.py', 'must declare the existing uv >=0.12.9 minimum'],
  ['unlocked direct launcher', 'source/skills/pkl-engineering/scripts/pkl_agent', 'must use uv run --locked --script'],
  ['missing adjacent lock', 'source/skills/pkl-engineering/scripts/pkl_agent', 'needs its adjacent lockfile'],
  ['unlocked hook invoker', 'source/hooks/codex/software-engineering-context.hooks.json', 'uv hook command must use --locked'],
]) {
  test(`the source gate rejects a portable consumer with ${mutation}`, t => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'uv-policy-source-'));
    t.after(() => fs.rmSync(root, { recursive: true, force: true }));
    for (const entry of ['source', 'tools', 'docs', '.github']) fs.cpSync(path.join(repo, entry), path.join(root, entry),
      { recursive: true, filter: file => !file.split(path.sep).some(part => ['__pycache__', 'node_modules'].includes(part)) });
    const file = path.join(root, relative);
    if (mutation === 'missing adjacent lock') {
      fs.rmSync(file + '.lock');
    } else {
      const text = fs.readFileSync(file, 'utf8');
      const changed = mutation.startsWith('unlocked')
        ? text.replace('uv run --locked --script', 'uv run --script')
        : text.replace('# required-version = ">=0.12.9"\n', '')
          + (mutation === 'minimum outside metadata' ? '\n# required-version = ">=0.12.9"\n' : '');
      fs.writeFileSync(file, changed);
    }
    const result = spawnSync(process.execPath, [path.join(repo, 'tools/validate-source-graph.mjs'), '--repo', root],
      { encoding: 'utf8' });
    const output = result.stdout + result.stderr;
    assert.equal(result.status, 1, output);
    assert.ok(output.split('\n').some(line => line.includes(relative) && line.includes(expected)), output);
  });
}

test('the source gate rejects shell tools, suffixed public commands, and undeclared Python launchers', t => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'automation-policy-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  for (const entry of ['source', 'tools', 'docs', '.github']) {
    fs.cpSync(path.join(repo, entry), path.join(root, entry), {
      recursive: true,
      filter: file => !file.split(path.sep).some(part => ['__pycache__', 'node_modules'].includes(part)),
    });
  }
  fs.mkdirSync(path.join(root, 'tools/bin'));
  for (const [name, contents] of [
    ['bin/public.py', fs.readFileSync(path.join(repo, 'tools/check.py'), 'utf8')],
    ['shell-tool', '#!/usr/bin/env bash\nexit 0\n'],
    ['ambient.py', '#!/usr/bin/env python3\nprint(1)\n'],
    ['helper.zsh', 'print hello\n'],
    ['missing-header.py', '#!/usr/bin/env -S uv run --locked --script\nprint("hello")\n'],
    ['missing-deps.py', fs.readFileSync(path.join(repo, 'tools/check.py'), 'utf8')
      .replace('# dependencies = []\n', '')],
  ]) {
    fs.writeFileSync(path.join(root, 'tools', name), contents);
  }
  fs.chmodSync(path.join(root, 'tools/bin/public.py'), 0o755);
  fs.copyFileSync(path.join(repo, 'tools/check.py.lock'), path.join(root, 'tools/bin/public.py.lock'));
  fs.copyFileSync(path.join(repo, 'tools/check.py.lock'), path.join(root, 'tools/missing-deps.py.lock'));
  const result = spawnSync(process.execPath, [path.join(repo, 'tools/validate-source-graph.mjs'), '--repo', root],
    { encoding: 'utf8' });
  assert.equal(result.status, 1, result.stdout + result.stderr);
  for (const name of ['bin/public.py', 'shell-tool', 'ambient.py', 'helper.zsh', 'missing-header.py', 'missing-deps.py']) {
    assert.ok((result.stdout + result.stderr).includes('tools/' + name), result.stdout + result.stderr);
  }
});

test('the source gate accepts new uv locks for projects, scripts, and extensionless commands', t => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'uv-policy-pr-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  function git(...args) {
    const result = spawnSync('git', ['-c', 'user.name=Fixture', '-c', 'user.email=fixture@example.invalid', ...args],
      { cwd: root, encoding: 'utf8' });
    assert.equal(result.status, 0, result.stdout + result.stderr);
    return result.stdout.trim();
  }
  for (const entry of ['source', 'tools', 'docs', '.github', 'bin']) {
    fs.cpSync(path.join(repo, entry), path.join(root, entry), {
      recursive: true, verbatimSymlinks: true,
      filter: file => !file.split(path.sep).some(part => ['__pycache__', 'node_modules'].includes(part)),
    });
  }
  git('init', '-q');
  git('commit', '--allow-empty', '-qm', 'base');
  const base = git('rev-parse', 'HEAD');
  fs.copyFileSync(path.join(repo, 'uv.lock'), path.join(root, 'uv.lock'));
  for (const relative of ['tools/new-tool.py', 'bin/new-tool']) {
    const script = path.join(root, relative);
    fs.copyFileSync(path.join(repo, 'tools/check.py'), script);
    fs.chmodSync(script, 0o755);
    fs.copyFileSync(path.join(repo, 'tools/check.py.lock'), script + '.lock');
  }
  git('add', 'uv.lock', 'tools/new-tool.py', 'tools/new-tool.py.lock', 'bin/new-tool', 'bin/new-tool.lock');
  git('commit', '-qm', 'head');
  const result = spawnSync(process.execPath, [path.join(repo, 'tools/validate-source-graph.mjs')], {
    cwd: root, env: { ...process.env, SLOPSENTRAL_PYTHON_POLICY_BASE: base }, encoding: 'utf8',
  });
  assert.equal(result.status, 0, result.stdout + result.stderr);
});
