import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import {
  ToolchainError, entryFor, fetchTool, loadManifest, profileTools, toolEnvironment,
} from '../toolchain.mjs';

const root = path.resolve(import.meta.dirname, '../..');
const binary = Buffer.from('#!/bin/sh\necho fixture\n');
const digest = crypto.createHash('sha256').update(binary).digest('hex');
const fixture = () => loadManifest(JSON.stringify({
  schemaVersion: 1,
  tools: {
    pkl: { version: '1.0.0', profiles: ['core'], environment: 'PKL_BIN',
      assets: { 'linux-x64': { url: 'https://github.com/o/r/releases/download/1/pkl', sha256: digest, format: 'binary', executable: 'pkl' } } },
    kotlin: { version: '2.0.0', profiles: ['ci'],
      assets: { any: { url: 'https://github.com/o/k/releases/download/2/k.zip', sha256: digest, format: 'zip', executable: 'kotlinc/bin/kotlinc' } } },
  },
}));

function cache(t) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'toolchain-'));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  return { SLOPSENTRAL_TOOLCHAIN_CACHE: directory, PATH: '/usr/bin' };
}

test('the committed manifest pins every asset to an https GitHub release and a SHA-256', () => {
  const manifest = loadManifest();
  assert.deepEqual(Object.keys(manifest.tools).sort(), ['kotlin', 'pkl', 'uv', 'vale', 'worktrunk']);
  for (const name of ['uv', 'pkl', 'vale']) {
    assert.ok(manifest.tools[name].profiles.includes('core'), name);
    for (const platform of ['darwin-arm64', 'darwin-x64', 'linux-x64', 'linux-arm64']) {
      assert.ok(manifest.tools[name].assets[platform], `${name} ${platform}`);
    }
  }
  assert.equal(manifest.tools.uv.version, fs.readFileSync(path.join(root, 'uv.toml'), 'utf8').match(/required-version = "==([^"]+)"/)[1]);
});

test('invalid manifests reject before any download', () => {
  for (const asset of [{ url: 'http://example.com/x', sha256: digest, format: 'binary', executable: 'x' },
    { url: 'https://github.com/x', sha256: 'short', format: 'binary', executable: 'x' },
    { url: 'https://github.com/x', sha256: digest, format: 'rpm', executable: 'x' },
    { url: 'https://github.com/x', sha256: digest, format: 'binary', executable: '../escape' }]) {
    assert.throws(() => loadManifest(JSON.stringify({ schemaVersion: 1, tools: { t: { version: '1', profiles: ['core'], assets: { any: asset } } } })),
      error => error instanceof ToolchainError && error.reason === 'INVALID_MANIFEST');
  }
});

test('a verified fetch publishes once and reuses the entry without network access', async t => {
  const env = cache(t);
  const manifest = fixture();
  let downloads = 0;
  const download = async () => { downloads += 1; return binary; };
  const entry = await fetchTool(manifest, 'pkl', { platform: 'linux-x64', env, download });
  assert.equal(fs.readFileSync(entry.executable, 'utf8'), binary.toString());
  assert.ok(fs.statSync(entry.executable).mode & 0o111);
  assert.ok(entry.directory.endsWith(`pkl-1.0.0-${digest.slice(0, 16)}`));
  await fetchTool(manifest, 'pkl', { platform: 'linux-x64', env, download: () => assert.fail('must reuse cache') });
  assert.equal(downloads, 1);
});

test('a digest mismatch or unsupported platform rejects without publishing', async t => {
  const env = cache(t);
  const manifest = fixture();
  await assert.rejects(fetchTool(manifest, 'pkl', { platform: 'linux-x64', env, download: async () => Buffer.from('tampered') }),
    error => error.reason === 'DIGEST_MISMATCH');
  assert.equal(fs.existsSync(entryFor(manifest, 'pkl', { platform: 'linux-x64', env }).directory), false);
  assert.deepEqual(fs.readdirSync(env.SLOPSENTRAL_TOOLCHAIN_CACHE), []);
  await assert.rejects(fetchTool(manifest, 'pkl', { platform: 'plan9-mips', env, download: () => assert.fail('must not download') }),
    error => error.reason === 'UNSUPPORTED_PLATFORM');
});

test('the child environment puts pinned tools first and keeps explicit overrides', async t => {
  const env = cache(t);
  const manifest = fixture();
  const entry = await fetchTool(manifest, 'pkl', { platform: 'linux-x64', env, download: async () => binary });
  const selected = toolEnvironment(manifest, ['pkl'], { platform: 'linux-x64', env });
  assert.equal(selected.env.PKL_BIN, entry.executable);
  assert.deepEqual(selected.env.PATH.split(path.delimiter).slice(0, 3), [path.join(root, 'bin'), path.dirname(entry.executable), '/usr/bin']);
  const overridden = toolEnvironment(manifest, ['pkl'], { platform: 'linux-x64', env: { ...env, PKL_BIN: '/explicit/pkl' } });
  assert.equal(overridden.env.PKL_BIN, '/explicit/pkl');
  assert.throws(() => toolEnvironment(manifest, ['pkl'], { platform: 'linux-x64', env: { ...env, SLOPSENTRAL_TOOLCHAIN_CACHE: path.join(env.SLOPSENTRAL_TOOLCHAIN_CACHE, 'empty') } }),
    error => error.reason === 'NOT_FETCHED');
});

test('profiles select platform tools and include platform-independent assets', () => {
  const manifest = fixture();
  assert.deepEqual(profileTools(manifest, 'core', 'linux-x64'), ['pkl']);
  assert.deepEqual(profileTools(manifest, 'ci', 'darwin-arm64'), ['kotlin']);
  assert.deepEqual(profileTools(manifest, 'core', 'darwin-arm64'), []);
});

test('the CLI rejects an unknown command with a finite outcome', () => {
  const result = spawnSync(process.execPath, [path.join(root, 'tools/toolchain.mjs'), 'install'], { encoding: 'utf8' });
  assert.equal(result.status, 2);
  assert.equal(JSON.parse(result.stderr).reason, 'INVALID_INVOCATION');
});

test('end-user uv bootstraps match the development pin', () => {
  const pinned = loadManifest().tools.uv.version;
  const installer = fs.readFileSync(path.join(root, 'install.sh'), 'utf8');
  const pi = fs.readFileSync(path.join(root, 'tools/setup-pi.mts'), 'utf8');
  assert.deepEqual([...new Set([...installer.matchAll(/astral\.sh\/uv\/([\d.]+)\//g)].map(m => m[1]))], [pinned]);
  assert.deepEqual([...new Set([...pi.matchAll(/astral-sh\/uv\/releases\/download\/([\d.]+)\//g)].map(m => m[1]))], [pinned]);
  for (const [platform, asset] of Object.entries(loadManifest().tools.uv.assets)) {
    assert.match(pi, new RegExp(`'${platform}': \\['[^']+', '${asset.sha256}'\\]`), platform);
  }
});
