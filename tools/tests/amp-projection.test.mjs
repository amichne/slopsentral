import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { spawnSync } from 'node:child_process';
import test from 'node:test';
import { project } from '../project-marketplaces.mjs';
import { loadCatalog, pluginClosure } from '../catalog.mjs';

const root = path.resolve(import.meta.dirname, '../..');

test('Amp registers complete skill packages and supplies canonical instructions without activating foreign hooks', {
  skip: !process.env.PKL_BIN && !process.env.SLOPSENTRAL_AMP_ROOT,
}, async t => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'slopsentral-amp-'));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  const projected = process.env.SLOPSENTRAL_AMP_ROOT ?? path.join(
    project({ source: root, harness: 'amp', out: path.join(directory, 'out') }).out, '.amp/plugins');
  const output = path.join(directory, 'consumer/.amp/plugins');
  fs.cpSync(projected, output, { recursive: true });
  const catalog = loadCatalog(root);
  let discovered;
  if (process.env.AMP_BIN) {
    const native = spawnSync(process.env.AMP_BIN, ['skill', 'list', '--json'],
      { cwd: path.resolve(output, '../..'), encoding: 'utf8', timeout: 60_000 });
    assert.equal(native.status, 0, native.stdout + native.stderr);
    discovered = JSON.parse(native.stdout).skills;
  }
  for (const plugin of catalog.plugins) {
    const pluginRoot = path.join(output, plugin.name);
    const refs = [...pluginClosure(catalog, plugin).refs.values()];
    const skills = refs.filter(ref => ref.type === 'SKILL').sort((a, b) => a.name.localeCompare(b.name));
    const instructions = refs.filter(ref => ref.type === 'INSTRUCTION').sort((a, b) => a.name.localeCompare(b.name));
    const registered = [];
    const handlers = new Map();
    const module = await import(pathToFileURL(path.join(pluginRoot, 'index.js')));
    await module.default({
      async registerSkill({ path: skillPath }) {
        registered.push(skillPath);
        assert.ok(fs.statSync(path.join(pluginRoot, skillPath, 'SKILL.md')).isFile());
      },
      on(event, handler) { handlers.set(event, handler); },
    });
    assert.deepEqual(registered, skills.map(ref => 'skills/' + ref.name));
    assert.deepEqual([...handlers.keys()], instructions.length ? ['agent.start'] : []);
    if (instructions.length) {
      const result = await handlers.get('agent.start')();
      for (const instruction of instructions)
        assert.ok(result.message.content.includes(fs.readFileSync(path.join(root, 'source', instruction.path), 'utf8').trim()));
      assert.equal(result.message.display, false);
    }
    const support = JSON.parse(fs.readFileSync(path.join(pluginRoot, 'capabilities.json')));
    assert.equal(support.skills, 'REGISTERED');
    assert.equal(support.instructions, 'AGENT_START_CONTEXT');
    assert.equal(support.hooks, 'REFERENCE_ONLY');
    assert.equal(support.agents, 'REFERENCE_ONLY');
    assert.equal(support.mcp, 'REFERENCE_ONLY');
    assert.equal(support.profiles, 'UNSUPPORTED');
    assert.equal(fs.existsSync(path.join(pluginRoot, '.codex-plugin')), false);
    assert.equal(fs.existsSync(path.join(pluginRoot, 'AGENTS.md')), false);

    if (process.env.AMP_BIN) {
      const native = spawnSync(process.env.AMP_BIN, ['plugins', 'exec', pluginRoot, 'agent.start', '--data',
        JSON.stringify({ thread: { id: 'T-00000000-0000-0000-0000-000000000000' }, message: 'Adapter check', id: 'check' })],
      { cwd: directory, encoding: 'utf8', timeout: 60_000 });
      assert.equal(native.status, 0, native.stdout + native.stderr);
      assert.doesNotMatch(native.stdout + native.stderr, /Failed to load|Plugin error|Error executing/i);
      for (const skill of skills) {
        const qualified = plugin.name + ':' + skill.name;
        const loaded = discovered.find(item => item.name === qualified);
        assert.ok(loaded, qualified);
        assert.equal(fs.realpathSync(new URL(loaded.baseDir)), fs.realpathSync(path.join(pluginRoot, 'skills', skill.name)));
      }
    }
  }
  const broken = path.join(directory, 'broken');
  fs.mkdirSync(broken);
  for (const name of ['index.js', 'package.json'])
    fs.copyFileSync(path.join(output, 'software-engineering', name), path.join(broken, name));
  const incomplete = await import(pathToFileURL(path.join(broken, 'index.js')));
  await assert.rejects(incomplete.default({
    registerSkill() { assert.fail('Missing context must reject before skills are advertised'); },
  }), { code: 'ENOENT' });
});
