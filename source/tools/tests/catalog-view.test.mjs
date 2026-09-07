import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { auditCatalog, catalogReport, loadCatalog, pluginClosure, renderCatalog } from '../catalog.mjs';
const root = path.resolve(import.meta.dirname, '../../..');
const catalog = loadCatalog(root);

test('current catalog has no ownership or closure failures', () => {
  assert.deepEqual(auditCatalog(catalog), []);
});

test('generated catalog matches its manifest-derived view', () => {
  assert.equal(fs.readFileSync(path.join(root, 'source/CATALOG.md'), 'utf8'), renderCatalog(catalog));
});

test('a profile includes exactly its selected plugins and rejects unknown profiles', () => {
  const profile = catalog.profiles.find(p => p.name === 'documentation-default');
  const report = catalogReport(catalog, profile.name);
  assert.deepEqual(report.plugins.map(p => p.name).sort(), [...profile.plugins].sort());
  assert.ok(!report.plugins.some(p => p.name === 'effective-delivery'));
  assert.throws(() => catalogReport(catalog, 'unknown-profile'), /unknown profile/);
});

test('repeated dependency edges inside one owner are idempotent', () => {
  const kotlin = catalog.plugins.find(p => p.name === 'kotlin-engineering');
  const before = pluginClosure(catalog, kotlin);
  const after = pluginClosure(catalog, { ...kotlin, skills: [...kotlin.skills, ...kotlin.skills] });
  assert.deepEqual([...after.refs.keys()], [...before.refs.keys()]);
  assert.deepEqual(after.findings, []);
});

test('a dependency cycle is rejected, not silently truncated', () => {
  const modified = { ...catalog, definitions: new Map(catalog.definitions) };
  const hook = structuredClone(modified.definitions.get('HOOK/required-skill-read'));
  hook.dependsOn = [structuredClone(hook)];
  modified.definitions.set('HOOK/required-skill-read', hook);
  assert.ok(auditCatalog(modified).some(f => /dependency cycle/.test(f)));
});

test('Astra defaults do not require unrelated skill reads', () => {
  for (const name of ['kotlin-repo-default', 'intellij-plugin-default', 'local-development-default', 'documentation-default']) {
    const profile = catalog.profiles.find(p => p.name === name);
    assert.ok(!profile.hooks.some(h => h.name === 'required-skill-read'));
  }
  const config = JSON.parse(fs.readFileSync(path.join(root, 'source/hooks/required-skill-read.requirements.json'), 'utf8'));
  assert.equal(config.mode, 'ADVISORY');
  assert.deepEqual(config.skills, []);
});

test('new standalone skills have bounded procedures and portable local references', () => {
  for (const name of ['kotlin-branching', 'cli-data-pipelines', 'shell-session-integration', 'mise-project-tooling', 'delivery-pipeline-design', 'technical-documentation', 'bounded-delegation']) {
    const folder = path.join(root, 'source/skills', name);
    const text = fs.readFileSync(path.join(folder, 'SKILL.md'), 'utf8');
    assert.ok(text.trim().split(/\s+/u).length <= 550, `${name}: move details to references`);
    for (const match of text.matchAll(/\]\((references\/[^)#]+)(?:#[^)]*)?\)/g)) {
      assert.ok(fs.existsSync(path.join(folder, match[1])), `${name}: missing ${match[1]}`);
    }
  }
});


test('canonical dependencies are traversed even when the plugin reference omits them', () => {
  const marketplace = structuredClone(catalog.marketplace);
  const target = marketplace.skills.find(ref => ref.name === 'mise-project-tooling');
  target.dependsOn = [marketplace.skills.find(ref => ref.name === 'manage-json-schemas')];
  const modified = { ...catalog, marketplace };
  assert.ok(auditCatalog(modified).some(f => /skill manage-json-schemas has multiple plugin owners/.test(f)));
});

test('a repeated dependency identity cannot hide a conflicting source location', () => {
  const plugin = catalog.plugins.find(p => p.name === 'developer-tools');
  const ref = plugin.skills[0];
  const closure = pluginClosure(catalog, { ...plugin, skills: [ref, { ...ref, path: 'skills/not-canonical' }] });
  assert.ok(closure.findings.some(f => /conflicting dependency locations/.test(f)));
});

test('catalog reports distinguish all-plugin and profile selections', () => {
  assert.deepEqual(catalogReport(catalog).selection, { type: 'ALL_PLUGINS' });
  const report = catalogReport(catalog, 'documentation-default');
  assert.deepEqual(report.selection, { type: 'WORKFLOW_PROFILE', name: 'documentation-default' });
  assert.equal(report.type, 'CATALOG_REPORT');
  assert.equal(report.totals.type, 'CATALOG_TOTALS');
  assert.equal(report.totals.instructionWords, report.plugins.reduce((sum, p) => sum + p.instructionWords, 0));
});

test('a repeated identity cannot hide additional dependency edges', () => {
  const plugin = catalog.plugins.find(p => p.name === 'developer-tools');
  const repeated = plugin.skills.find(ref => ref.name === 'cli-creator');
  const foreign = catalog.marketplace.skills.find(ref => ref.name === 'manage-json-schemas');
  const modified = { ...catalog, plugins: catalog.plugins.map(p => p !== plugin ? p : {
    ...p, skills: [repeated, ...p.skills.filter(ref => ref !== repeated).map(ref => ref.name !== 'mise-project-tooling' ? ref : {
      ...ref, dependsOn: [{ ...repeated, dependsOn: [foreign] }],
    })],
  }) };
  assert.ok(auditCatalog(modified).some(f => /skill manage-json-schemas has multiple plugin owners/.test(f)));
});
