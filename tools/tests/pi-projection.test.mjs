import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import Ajv2020 from 'ajv/dist/2020.js';
import { project } from '../project-marketplaces.mjs';

const root = path.resolve(import.meta.dirname, '../..');

test('current projector emits only the native Pi default, deterministically', { skip: !process.env.PKL_BIN }, t => {
  const directory = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'pi-current-projection-')));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  const first = project({ source: root, harness: 'pi', out: path.join(directory, 'first') });
  const second = project({ source: root, harness: 'pi', out: path.join(directory, 'second') });
  const files = fs.readdirSync(first.out, { recursive: true }).filter(p => fs.statSync(path.join(first.out, p)).isFile()).sort();
  assert.deepEqual(files, fs.readdirSync(second.out, { recursive: true }).filter(p => fs.statSync(path.join(second.out, p)).isFile()).sort());
  for (const file of files) assert.deepEqual(fs.readFileSync(path.join(first.out, file)), fs.readFileSync(path.join(second.out, file)));
  const pkg = path.join(first.out, '.pi/slopsentral');
  const inventory = JSON.parse(fs.readFileSync(path.join(pkg, 'profile-inventory.json')));
  const validate = new Ajv2020({ strict: true }).compile(JSON.parse(fs.readFileSync(path.join(root, 'source/schemas/pi/content-profile.schema.json'))));
  assert.equal(validate(inventory), true, JSON.stringify(validate.errors));
  assert.equal(inventory.profile, 'native-default');
  assert.deepEqual(inventory.skills.map(s => s.name), ['semantic-ratchet']);
  assert.deepEqual(inventory.instructions, []);
  const manifest = JSON.parse(fs.readFileSync(path.join(pkg, 'package.json')));
  assert.deepEqual(manifest.pi, { skills: ['./software-engineering/skills/semantic-ratchet'] });
  assert.equal(manifest.peerDependencies, undefined);
  assert.equal(fs.readFileSync(path.join(pkg, 'AGENTS.md'), 'utf8'), '');
  for (const retired of ['extensions', 'profiles.json', 'capabilities.json', 'kotlin-engineering']) assert.equal(fs.existsSync(path.join(pkg, retired)), false);
  const source = path.join(root, 'source/skills/semantic-ratchet');
  const original = fs.readdirSync(source, { recursive: true }).filter(p => fs.statSync(path.join(source, p)).isFile());
  for (const file of original) assert.deepEqual(fs.readFileSync(path.join(pkg, manifest.pi.skills[0], file)), fs.readFileSync(path.join(source, file)), file);
  const packed = spawnSync('uv', ['run', '--locked', '--script', 'tools/package_pi.py', pkg, path.join(directory, 'archive')], { cwd: root, encoding: 'utf8' });
  assert.equal(packed.status, 0, packed.stdout + packed.stderr);
  assert.equal(JSON.parse(packed.stdout).type, 'PACKAGED');
});

test('Pi workflow-profile emulation remains unsupported', t => {
  const directory = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'pi-profile-rejected-')));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  const out = path.join(directory, 'output');
  const result = spawnSync(process.execPath, ['tools/project-marketplaces.mjs', '--source', root,
    '--harness', 'pi', '--profile', 'local-development-default', '--out', out], { cwd: root, encoding: 'utf8' });
  assert.equal(result.status, 1);
  assert.equal(JSON.parse(result.stderr).code, 'INVALID_INVOCATION');
  assert.equal(fs.existsSync(out), false);
});
