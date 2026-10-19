import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { loadCatalog, pluginClosure } from '../catalog.mjs';
import { project } from '../project-marketplaces.mjs';

const root = path.resolve(import.meta.dirname, '../..');

test('the default supplies domain design without lifecycle or toolchain policy', () => {
  const catalog = loadCatalog(root);
  const plugin = catalog.plugins.find(p => p.name === 'software-engineering');
  const closure = pluginClosure(catalog, plugin);
  assert.deepEqual(closure.findings, []);
  assert.deepEqual([...closure.refs.keys()], ['SKILL/semantic-ratchet']);
  const profile = catalog.profiles.find(p => p.name === 'local-development-default');
  assert.equal(profile.hookPolicy.mode, 'OFF');
  assert.deepEqual(Object.keys(profile.skills), ['skill:semantic-ratchet']);
});

test('Kotlin guidance declares no bundled service', () => {
  const plugin = JSON.parse(fs.readFileSync(path.join(root, 'source/plugins/kotlin-engineering/plugin.json')));
  assert.equal(plugin.codexMcpServers, undefined);
  assert.equal(fs.existsSync(path.join(root, 'source/plugins/kotlin-engineering/.mcp.json')), false);
});

for (const harness of ['codex', 'github-copilot', 'pi']) {
  test(`${harness} delivers a default without executable hooks or service configuration`, { skip: !process.env.PKL_BIN }, t => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'portable-default-'));
    t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
    const result = project({ source: root, harness, out: path.join(directory, 'projection') });
    const prefix = { codex: '.agents/plugins', 'github-copilot': '.github/plugin', pi: '.pi/slopsentral' }[harness];
    const bundle = path.join(result.out, prefix, 'software-engineering');
    assert.equal(fs.existsSync(path.join(bundle, 'skills/semantic-ratchet/SKILL.md')), true);
    assert.equal(fs.existsSync(path.join(bundle, 'hooks')), false);
    assert.equal(fs.existsSync(path.join(bundle, 'instructions')), false);
    assert.equal(fs.existsSync(path.join(bundle, '.mcp.json')), false);
    const kotlin = path.join(result.out, prefix, 'kotlin-engineering');
    assert.equal(fs.existsSync(path.join(kotlin, '.mcp.json')), false);
    if (harness === 'pi') {
      const inventory = JSON.parse(fs.readFileSync(path.join(result.out, prefix, 'profile-inventory.json')));
      assert.equal(inventory.profile, 'local-development-default');
      assert.deepEqual(inventory.instructions, []);
      assert.equal(fs.existsSync(path.join(result.out, prefix, 'extensions')), false);
    } else {
      const manifest = JSON.parse(fs.readFileSync(path.join(bundle, harness === 'codex' ? '.codex-plugin/plugin.json' : 'plugin.json')));
      assert.equal(manifest.hooks, undefined);
      assert.equal(manifest.mcpServers, undefined);
      assert.ok(manifest.skills);
    }
  });
}
