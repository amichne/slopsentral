import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import Ajv from 'ajv';
import addFormats from 'ajv-formats';

// Match the release-please dependency bundled by the pinned GitHub action.
const require = createRequire(import.meta.url);
const { Version } = require('release-please/build/src/version.js');
const { GenericJson } = require('release-please/build/src/updaters/generic-json.js');
const { GenericToml } = require('release-please/build/src/updaters/generic-toml.js');
const { PackageJson } = require('release-please/build/src/updaters/node/package-json.js');
const { PackageLockJson } = require('release-please/build/src/updaters/node/package-lock-json.js');
const { ReleasePleaseManifest } = require('release-please/build/src/updaters/release-please-manifest.js');
const { buildVersioningStrategy } = require('release-please/build/src/factories/versioning-strategy-factory.js');
const root = path.resolve(import.meta.dirname, '../..');
const config = JSON.parse(fs.readFileSync(path.join(root, 'release-please-config.json')));

test('Release Please config conforms to the schema bundled with the pinned action dependency', () => {
  const schema = JSON.parse(fs.readFileSync(require.resolve('release-please/schemas/config.json')));
  // Vendor schema composition is not strictTypes-compatible; enforce its actual validation rules.
  const ajv = new Ajv({ strict: false, allErrors: true });
  addFormats(ajv);
  const validate = ajv.compile(schema);
  assert.equal(validate(config), true, JSON.stringify(validate.errors));
  assert.equal(validate({ ...config, 'versioning-strategy': 'always-bump-patch' }), false);
});

test('the actual Release Please updaters advance every product manifest and both locks together', t => {
  const directory = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'slopsentral-release-please-')));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  const current = Version.parse(JSON.parse(fs.readFileSync(path.join(root, 'package.json'))).version);
  const next = buildVersioningStrategy({ type: config.versioning }).bump(current, [{ type: 'feat', breaking: true }]);
  assert.equal(next.toString(), `${current.major}.${current.minor}.${current.patch + 1}`);
  const options = { version: next, versionsMap: new Map([['.', next]]) };
  const updates = [
    ['package.json', new PackageJson(options)],
    ['package-lock.json', new PackageLockJson(options)],
    ['.release-please-manifest.json', new ReleasePleaseManifest(options)],
    ...config.packages['.']['extra-files'].map(file => {
      assert.ok(['json', 'toml'].includes(file.type));
      return [file.path, file.type === 'toml' ? new GenericToml(file.jsonpath, next) : new GenericJson(file.jsonpath, next)];
    }),
  ];
  fs.copyFileSync(path.join(root, 'release-please-config.json'), path.join(directory, 'release-please-config.json'));
  for (const [file, updater] of updates) {
    const target = path.join(directory, file);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, updater.updateContent(fs.readFileSync(path.join(root, file), 'utf8')));
  }
  const check = spawnSync('uv', ['run', '--locked', 'python', '-m', 'tools.release_version', 'check', '--root', directory], { cwd: root, encoding: 'utf8' });
  assert.equal(check.status, 0, check.stdout + check.stderr);
  assert.equal(JSON.parse(check.stdout).version, next.toString());
  const lock = fs.readFileSync(path.join(directory, 'uv.lock'));
  const locked = spawnSync('uv', ['lock', '--check', '--offline', '--directory', directory], { encoding: 'utf8' });
  assert.equal(locked.status, 0, locked.stdout + locked.stderr);
  assert.deepEqual(fs.readFileSync(path.join(directory, 'uv.lock')), lock);
});
