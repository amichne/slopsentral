import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { pathToFileURL } from 'node:url';

const root = path.resolve(import.meta.dirname, '../..');
const setup = path.join(root, 'tools/setup-pi.mts');
const launcher = path.join(root, 'tools/install-pi.sh');

function fixture(t, { version = '1.4.0', status = '0', missing = false, timeout = false } = {}) {
  const directory = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'pi compatibility ')));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  const bin = path.join(directory, 'bin');
  fs.mkdirSync(bin);
  for (const [name, target] of [['node', process.execPath], ['uname', '/usr/bin/uname'], ['tar', '/usr/bin/tar']]) {
    fs.symlinkSync(target, path.join(bin, name));
  }
  if (!missing) fs.writeFileSync(path.join(bin, 'pi'), `#!/bin/sh
printf '%s\\n' "$*" >> "$PI_TEST_CALLS"
${timeout ? 'exec /bin/sleep 30' : 'printf \'%s\\n\' "$PI_TEST_VERSION"; exit "$PI_TEST_STATUS"'}
`, { mode: 0o700 });
  const preload = path.join(directory, 'network.mjs');
  fs.writeFileSync(preload, `
import crypto from 'node:crypto';
import fs from 'node:fs';
import childProcess from 'node:child_process';
import { syncBuiltinESMExports } from 'node:module';
const originalSpawn = childProcess.spawnSync;
const response = bytes => ({ status: 0, stdout: Buffer.concat([Buffer.from(bytes), Buffer.from('\\n200')]) });
const missing = () => ({ status: 22, stdout: Buffer.from('\\n404') });
const bytes = fs.readFileSync(process.env.PI_TEST_SETUP);
const url = 'https://github.com/amichne/slopsentral/releases/download/slopsentral-v0.1.999/setup-pi.mts';
globalThis.fetch = async () => { throw new TypeError('fetch failed'); };
childProcess.spawnSync = (command, args, options) => {
  if (command !== 'curl') return originalSpawn(command, args, options);
  const input = args.at(-1);
  fs.appendFileSync(process.env.PI_TEST_REQUESTS, input + '\\n');
  // Reaching qualification proves admission; no fixture release may change settings.
  if (process.argv[1]?.endsWith('/setup-pi.mts')) return missing();
  if (input === 'https://api.github.com/repos/amichne/slopsentral/releases/latest') {
    return response(JSON.stringify({ tag_name: 'slopsentral-v0.1.999', draft: false, prerelease: false,
      assets: [{ name: 'setup-pi.mts', browser_download_url: url, size: bytes.length,
        digest: 'sha256:' + crypto.createHash('sha256').update(bytes).digest('hex') }] }));
  }
  if (input === url) return response(bytes);
  throw Error('Unexpected network request: ' + input);
};
syncBuiltinESMExports();
`);
  return {
    cwd: directory,
    encoding: 'utf8',
    timeout: 20000,
    env: { ...process.env, HOME: directory, TMPDIR: directory, PATH: bin,
      PI_CODING_AGENT_DIR: path.join(directory, 'agent'),
      NODE_OPTIONS: '--import=' + pathToFileURL(preload).href,
      PI_TEST_SETUP: setup, PI_TEST_VERSION: version, PI_TEST_STATUS: status,
      PI_TEST_CALLS: path.join(directory, 'calls'), PI_TEST_REQUESTS: path.join(directory, 'requests') },
  };
}

for (const version of ['1.3.0', '1.4.0', '2.0.0-dev+local', 'custom-build', '']) {
  test(`native setup admits runnable Pi ${JSON.stringify(version)} best-effort`, t => {
    const options = fixture(t, { version });
    const result = spawnSync(process.execPath, [setup], options);
    assert.equal(result.status, 1, result.stderr);
    assert.match(result.stderr, /PI_COMPATIBILITY_UNVERIFIED/);
    assert.match(result.stderr, /DOWNLOAD_FAILED: HTTP 404/);
    assert.doesNotMatch(result.stderr, /PI_UNAVAILABLE/);
    assert.equal(fs.readFileSync(options.env.PI_TEST_CALLS, 'utf8'), '--version\n');
    assert.equal(fs.readFileSync(options.env.PI_TEST_REQUESTS, 'utf8').trim(),
      'https://api.github.com/repos/amichne/slopsentral/releases/latest');
    assert.equal(fs.existsSync(options.env.PI_CODING_AGENT_DIR), false);
  });
}

for (const failure of [{ missing: true }, { status: '7' }, { timeout: true }]) {
  test(`native setup rejects unavailable Pi before qualification: ${JSON.stringify(failure)}`, t => {
    const options = fixture(t, failure);
    const result = spawnSync(process.execPath, [setup], options);
    assert.equal(result.status, 1, result.stderr);
    assert.match(result.stderr, /PI_UNAVAILABLE/);
    assert.doesNotMatch(result.stderr, /1\.3\.0|PI_COMPATIBILITY_UNVERIFIED/);
    assert.equal(fs.existsSync(options.env.PI_TEST_REQUESTS), false);
    assert.equal(fs.existsSync(options.env.PI_CODING_AGENT_DIR), false);
  });
}

test('shell launcher delegates to the verified installer with a newer Pi', t => {
  const options = fixture(t);
  const result = spawnSync('/bin/sh', [launcher], options);
  assert.equal(result.status, 1, result.stderr);
  assert.match(result.stderr, /PI_COMPATIBILITY_UNVERIFIED/);
  assert.match(result.stderr, /DOWNLOAD_FAILED: HTTP 404/);
  assert.equal(fs.readFileSync(options.env.PI_TEST_CALLS, 'utf8'), '--version\n');
  assert.equal(fs.existsSync(options.env.PI_CODING_AGENT_DIR), false);
});

for (const shell of [false, true]) {
  test(`rollback still qualifies the installer without Pi (${shell ? 'shell' : 'direct'})`, t => {
    const options = fixture(t, { missing: true });
    const result = shell
      ? spawnSync('/bin/sh', [launcher, '--rollback'], options)
      : spawnSync(process.execPath, [setup, '--rollback'], options);
    assert.equal(result.status, 1, result.stderr);
    assert.match(result.stderr, /DOWNLOAD_FAILED: HTTP 404/);
    assert.doesNotMatch(result.stderr, /PI_UNAVAILABLE|PI_COMPATIBILITY_UNVERIFIED/);
    assert.equal(fs.existsSync(options.env.PI_TEST_CALLS), false);
    assert.equal(fs.existsSync(options.env.PI_CODING_AGENT_DIR), false);
  });
}

test('shell launcher reports a missing Pi without prescribing a version', t => {
  const options = fixture(t, { missing: true });
  const result = spawnSync('/bin/sh', [launcher], options);
  assert.equal(result.status, 2, result.stderr);
  assert.match(result.stderr, /PI_UNAVAILABLE/);
  assert.doesNotMatch(result.stderr, /1\.3\.0/);
  assert.equal(fs.existsSync(options.env.PI_TEST_REQUESTS), false);
});
