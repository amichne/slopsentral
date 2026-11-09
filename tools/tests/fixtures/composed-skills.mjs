// Expected discovery identities come from authored composition, not projected output.
import assert from 'node:assert/strict';
import path from 'node:path';
import { loadCatalog, pluginClosure } from '../../catalog.mjs';

const catalog = loadCatalog(path.resolve(import.meta.dirname, '../../..'));

export function pluginSkillNames(name) {
  const plugin = catalog.plugins.find(plugin => plugin.name === name);
  assert.ok(plugin, `Missing authored plugin: ${name}`);
  const closure = pluginClosure(catalog, plugin);
  assert.deepEqual(closure.findings, []);
  return [...closure.refs.values()].filter(ref => ref.type === 'SKILL').map(ref => ref.name).sort();
}

export function composedSkillNames() {
  return [...new Set(catalog.plugins.flatMap(plugin => pluginSkillNames(plugin.name)))].sort();
}
