import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import test from 'node:test';

const root = path.resolve(import.meta.dirname, '../../..');
function rejects(t, mutate, expected) {
  const fixture = fs.mkdtempSync(path.join(os.tmpdir(), 'catalog-contract-'));
  t.after(() => fs.rmSync(fixture, { recursive: true, force: true }));
  fs.cpSync(path.join(root, 'source'), path.join(fixture, 'source'), { recursive: true });
  const edit = (relative, transform) => {
    const file = path.join(fixture, relative);
    const value = JSON.parse(fs.readFileSync(file, 'utf8'));
    transform(value);
    fs.writeFileSync(file, JSON.stringify(value));
  };
  mutate(edit, fixture);
  const result = spawnSync(process.execPath, [path.join(root, 'source/tools/validate-source-graph.mjs'), '--repo', fixture], { encoding: 'utf8' });
  assert.equal(result.status, 1, result.stdout + result.stderr);
  assert.match(result.stdout + result.stderr, expected);
}

test('rejects duplicate instruction ownership across plugins', t => {
  rejects(t, edit => edit('source/plugins/writing/plugin.json', plugin => {
    plugin.instructions.push({ type: 'INSTRUCTION', name: 'type-safety', path: 'concepts/type-safety/core.md', source: { type: 'LOCAL_SOURCE', path: './' } });
  }), /instruction type-safety.*multiple plugin owners/i);
});

test('rejects duplicate identities in the standalone marketplace', t => {
  rejects(t, edit => edit('source/adaptable.marketplace.json', market => {
    market.skills.push(structuredClone(market.skills[0]));
  }), /duplicate marketplace SKILL/i);
});

test('rejects hidden cross-plugin ownership through a hook dependency', t => {
  rejects(t, edit => edit('source/hooks/required-skill-read.hook.json', hook => {
    hook.dependsOn = [{ type: 'SKILL', name: 'manage-json-schemas', path: 'skills/manage-json-schemas', source: { type: 'LOCAL_SOURCE', path: './' } }];
  }), /skill manage-json-schemas.*multiple plugin owners/i);
});

test('rejects payload copies under a composition-only plugin', t => {
  rejects(t, (_edit, fixture) => {
    const file = path.join(fixture, 'source/plugins/writing/SKILL.md');
    fs.writeFileSync(file, '# Competing payload\n');
  }, /composition-only/i);
});
