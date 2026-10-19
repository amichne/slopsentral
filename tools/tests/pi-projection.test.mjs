import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { project } from '../project-marketplaces.mjs';

const root = path.resolve(import.meta.dirname, '../..');
test('both entry points emit only selected native Pi content and repeat byte-for-byte', { skip: !process.env.PKL_BIN }, t => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'native-pi-projection-'));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  const first = project({ source: root, harness: 'pi', out: path.join(directory, 'first') });
  const second = project({ source: root, harness: 'pi', out: path.join(directory, 'second') });
  const files = fs.readdirSync(first.out, { recursive: true }).filter(p => fs.statSync(path.join(first.out, p)).isFile()).sort();
  assert.deepEqual(files, fs.readdirSync(second.out, { recursive: true }).filter(p => fs.statSync(path.join(second.out, p)).isFile()).sort());
  for (const file of files) assert.deepEqual(fs.readFileSync(path.join(first.out, file)), fs.readFileSync(path.join(second.out, file)));
  const pkg = path.join(first.out, '.pi/slopsentral');
  const inventory = JSON.parse(fs.readFileSync(path.join(pkg, 'profile-inventory.json')));
  assert.deepEqual(inventory.skills.map(s => s.name), ['semantic-ratchet']);
  assert.equal(inventory.profile, 'local-development-default');
  assert.deepEqual(JSON.parse(fs.readFileSync(path.join(pkg, 'package.json'))).pi, { skills: ['./software-engineering/skills/semantic-ratchet'] });
  for (const retired of ['extensions', 'profiles.json', 'capabilities.json', 'kotlin-engineering']) assert.equal(fs.existsSync(path.join(pkg, retired)), false);
});
