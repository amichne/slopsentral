import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';

const root = path.resolve(import.meta.dirname, '../..');
const reused = [
  { name: 'shell-script-safety', plugins: ['software-engineering', 'personal-setup'] },
  { name: 'manage-json-schemas', plugins: ['api-contracts', 'personal-setup'] },
];

for (const [provider, variable, tree] of [
  ['Codex', 'REUSE_CODEX_PROJECTION', '.agents/plugins'],
  ['GitHub Copilot', 'REUSE_COPILOT_PROJECTION', '.github/plugin'],
]) {
  test(`${provider} projects reused skill payloads from one canonical source`,
    { skip: !process.env[variable] }, () => {
      for (const asset of reused) {
        const source = path.join(root, 'source/skills', asset.name);
        const files = fs.readdirSync(source, { recursive: true })
          .filter(file => fs.statSync(path.join(source, file)).isFile());
        assert.ok(files.includes('SKILL.md'));
        for (const plugin of asset.plugins) {
          const projected = path.join(process.env[variable], tree, plugin, 'skills', asset.name);
          for (const file of files) {
            assert.deepEqual(fs.readFileSync(path.join(projected, file)), fs.readFileSync(path.join(source, file)),
              `${provider}: ${plugin}/${asset.name}/${file} must preserve its source`);
          }
        }
      }
    });
}
