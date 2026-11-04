import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { prepareHookRuntime } from '../setup-pi.mts';
import { runHook } from '../../source/hooks/pi/adapter.ts';

function fixture(t) {
  const directory = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'pi runtime ')));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  return directory;
}

test('private runtime rejects an unverified archive before executing it or recording readiness', async t => {
  const directory = fixture(t);
  const state = path.join(directory, 'state');
  await assert.rejects(prepareHookRuntime(state, async url => {
    assert.match(url, /^https:\/\/github.com\/astral-sh\/uv\/releases\/download\/0\.12\.9\/uv-[a-z0-9_-]+\.tar\.gz$/);
    return Buffer.from('unverified executable payload');
  }), /PROVENANCE_MISMATCH: Pinned uv archive checksum differs/);
  assert.deepEqual(fs.readdirSync(state), []);
});

test('runtime receipts cannot select an executable outside private storage', async t => {
  const directory = fixture(t);
  const state = path.join(directory, 'state');
  fs.mkdirSync(state, { mode: 0o700 });
  fs.writeFileSync(path.join(state, 'hook-runtime.json'), JSON.stringify({
    schemaVersion: 1, platform: process.platform + '-' + process.arch,
    python: '3.12.14', executable: '../foreign', sha256: '0'.repeat(64),
  }));
  await assert.rejects(prepareHookRuntime(state, () => assert.fail('A foreign receipt must not trigger a download')), /HOOK_RUNTIME_CHANGED/);
  assert.equal(fs.existsSync(path.join(directory, 'foreign')), false);
});

test('a symlink receipt remains unchanged and is not followed', async t => {
  const directory = fixture(t);
  const state = path.join(directory, 'state');
  fs.mkdirSync(state, { mode: 0o700 });
  const foreign = path.join(directory, 'foreign');
  fs.writeFileSync(foreign, 'foreign bytes');
  const receipt = path.join(state, 'hook-runtime.json');
  fs.symlinkSync(foreign, receipt);
  await assert.rejects(prepareHookRuntime(state, () => assert.fail('A symlink receipt must not trigger a download')), /UNSAFE_CONFIG/);
  assert.equal(fs.readFileSync(foreign, 'utf8'), 'foreign bytes');
  assert.equal(fs.lstatSync(receipt).isSymbolicLink(), true);
});

test('project-controlled runtime receipts cannot authorize an executable', async t => {
  const directory = fixture(t);
  const home = path.join(directory, 'home');
  fs.mkdirSync(home);
  const previousHome = process.env.HOME;
  process.env.HOME = home;
  t.after(() => { if (previousHome === undefined) delete process.env.HOME; else process.env.HOME = previousHome; });
  const state = path.join(directory, 'project', 'slopsentral-setup');
  const plugin = path.join(state, 'packages', 'fixture', 'plugin');
  fs.mkdirSync(path.join(plugin, 'hooks'), { recursive: true });
  fs.writeFileSync(path.join(plugin, 'hooks/fixture.py'), '# dependencies = []\n');
  const platform = process.platform + '-' + process.arch;
  const executable = 'hook-runtime-3.12.14-' + platform + '/python';
  const file = path.join(state, executable);
  fs.mkdirSync(path.dirname(file));
  const marker = path.join(directory, 'project', 'executed');
  const bytes = '#!/bin/sh\nprintf unsafe > "$PLUGIN_ROOT/../../../../executed"\nprintf "{}"\n';
  fs.writeFileSync(file, bytes, { mode: 0o700 });
  fs.writeFileSync(path.join(state, 'hook-runtime.json'), JSON.stringify({ schemaVersion: 1, platform,
    python: '3.12.14', executable, sha256: crypto.createHash('sha256').update(bytes).digest('hex') }));
  const result = await runHook({ name: 'fixture', event: 'UserPromptSubmit', command: 'uv run --locked --script hooks/fixture.py', timeout: 2 }, plugin, directory, 'fixture');
  assert.equal(result.type, 'failed');
  assert.equal(fs.existsSync(marker), false);
});
