import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { promisify } from 'node:util';

const execute = promisify(execFile);
const launcher = path.resolve(import.meta.dirname, '../install-pi.sh');

function fixture(t, failure = '', version = '0.1.999') {
  const directory = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'pi-bootstrap-')));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  const bin = path.join(directory, 'bin');
  fs.mkdirSync(bin);
  fs.symlinkSync('/usr/bin/true', path.join(bin, 'pi'));
  const preload = path.join(directory, 'network.mjs');
  fs.writeFileSync(preload, `
import crypto from 'node:crypto';
import fs from 'node:fs';
import childProcess from 'node:child_process';
import { syncBuiltinESMExports } from 'node:module';
const originalSpawn = childProcess.spawnSync;
const response = bytes => ({ status: 0, stdout: Buffer.concat([Buffer.from(bytes), Buffer.from('\\n200')]) });
const missing = () => ({ status: 22, stdout: Buffer.from('\\n404') });
const bytes = Buffer.from('console.log(JSON.stringify(process.argv.slice(2))); process.exit(23);');
const tag = 'slopsentral-v' + ${JSON.stringify(version)};
const url = 'https://github.com/amichne/slopsentral/releases/download/' + tag + '/setup-pi.mts';
globalThis.fetch = async () => { throw new TypeError('fetch failed'); };
childProcess.spawnSync = (command, args, options) => {
  if (command !== 'curl') return originalSpawn(command, args, options);
  const input = args.at(-1);
  const expected = input.startsWith('https://api.github.com/') ? 'Authorization: Bearer fixture_token\\n' : '';
  if (options.input !== expected || args.some(value => value.includes('fixture_token'))) throw Error('Credential scope differs.');
  fs.appendFileSync(process.env.REQUEST_LOG, input + '\\n');
  if (input.startsWith('https://api.github.com/repos/amichne/slopsentral/releases/')) {
    if (process.env.FIXTURE_FAILURE === '404') return missing();
    return response(JSON.stringify({ tag_name: tag, draft: false, prerelease: false,
      assets: [{ name: 'setup-pi.mts', browser_download_url: url, size: bytes.length,
        digest: 'sha256:' + (process.env.FIXTURE_FAILURE === 'digest' ? '0'.repeat(64) : crypto.createHash('sha256').update(bytes).digest('hex')) }] }));
  }
  if (input === url) return response(bytes);
  throw Error('Unexpected network request: ' + input);
};
syncBuiltinESMExports();
`);
  return {
    cwd: directory,
    env: { ...process.env, HOME: directory, PATH: `${bin}:${path.dirname(process.execPath)}:/usr/bin:/bin`,
      GH_TOKEN: 'fixture_token', NODE_OPTIONS: `--import=${preload}`, REQUEST_LOG: path.join(directory, 'requests'), FIXTURE_FAILURE: failure },
  };
}

for (const args of [[], ['--project'], ['--version', '0.1.999']]) {
  test(`documented shell launcher selects a release and preserves ${JSON.stringify(args)}`, async t => {
    const options = fixture(t);
    await assert.rejects(execute('/bin/sh', [launcher, ...args], options), error => {
      assert.equal(error.code, 23);
      assert.deepEqual(JSON.parse(error.stdout), args.includes('--version') ? args : [...args, '--version', '0.1.999']);
      return true;
    });
    assert.equal(fs.readFileSync(options.env.REQUEST_LOG, 'utf8').split('\n')[0],
      'https://api.github.com/repos/amichne/slopsentral/releases/' + (args.includes('--version') ? 'tags/slopsentral-v0.1.999' : 'latest'));
  });
}

for (const [failure, message] of [['404', 'DOWNLOAD_FAILED: HTTP 404'], ['digest', 'CHECKSUM_MISMATCH']]) {
  test(`the launcher rejects ${failure} before installer effects`, async t => {
    await assert.rejects(execute('/bin/sh', [launcher], fixture(t, failure)), error => {
      assert.equal(error.code, 1);
      assert.equal(error.stdout, '');
      assert.ok(error.stderr.includes(message), error.stderr);
      return true;
    });
  });
}

test('the launcher admits a pinned unified release version', async t => {
  await assert.rejects(execute('/bin/sh', [launcher, '--version', '4.0.1'], fixture(t, '', '4.0.1')), error => {
    assert.equal(error.code, 23);
    assert.deepEqual(JSON.parse(error.stdout), ['--version', '4.0.1']);
    return true;
  });
});

test('the documented curl-to-shell entry point has local help', async t => {
  const { stdout } = await execute('/bin/sh', [launcher, '--help'], fixture(t));
  assert.ok(stdout.includes('Slopsentral native Pi setup'));
});

test('the launcher rejects malformed credentials before a request', async t => {
  const options = fixture(t);
  options.env.GH_TOKEN = 'invalid\nheader';
  await assert.rejects(execute('/bin/sh', [launcher], options), error => {
    assert.match(error.stderr, /INVALID_CREDENTIAL/);
    assert.equal(error.stdout, '');
    return true;
  });
  assert.equal(fs.existsSync(options.env.REQUEST_LOG), false);
});
