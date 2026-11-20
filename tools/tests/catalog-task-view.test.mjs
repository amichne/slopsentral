import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import test from 'node:test';
import * as views from '../catalog.mjs';
const { renderCatalog } = views;

function fixture(text = '---\nname: example\ndescription: "Use when changing the existing example owner; preserve its boundary."\n---\n\n# Example\n\nPrivate procedure detail stays in the selected skill.\n') {
  const skill = { type: 'SKILL', name: 'example', path: 'skills/example', source: { type: 'LOCAL_SOURCE', path: './' } };
  const plugin = { name: 'software-engineering', description: 'Shared engineering procedures.',
    metadata: { role: 'default', workstream: 'software-engineering', dailyDriver: 'Choose for software work.', notFor: 'Unrelated setup.' },
    files: ['plugin.json'], skills: [skill], agents: [], hooks: [], instructions: [], resources: [] };
  return { marketplace: { skills: [skill], plugins: [{ name: plugin.name }] }, plugins: [plugin], profiles: [],
    definitions: new Map(), contents: new Map([['SKILL/example', text]]) };
}

test('task selection exposes the canonical trigger once without loading procedure detail', () => {
  const catalog = fixture();
  catalog.plugins[0].skills.push(catalog.marketplace.skills[0]);
  const specialty = { ...catalog.plugins[0], name: 'example-specialty',
    metadata: { ...catalog.plugins[0].metadata, role: 'specialty', workstream: 'example-specialty' } };
  catalog.plugins.push(specialty);
  catalog.marketplace.plugins.push({ name: specialty.name });
  const rendered = renderCatalog(catalog);
  assert.equal(rendered.match(/\]\(skills\/example\/SKILL\.md\)/g)?.length, 1);
  assert.match(rendered, /Use when changing the existing example owner; preserve its boundary\./);
  assert.doesNotMatch(rendered, /Private procedure detail/);
  assert.match(rendered, /global instructions.*first; they take precedence/);
  assert.match(rendered, /before the decision or operation/);
  assert.match(rendered, /Reconsider the selection/);
});

test('task selection follows a changed source trigger without maintaining a second trigger list', () => {
  const catalog = fixture();
  catalog.contents.set('SKILL/example', '---\nname: example\ndescription: Inspect the current owner before introducing a replacement.\n---\n\n# Example\n');
  const rendered = renderCatalog(catalog);
  assert.match(rendered, /Inspect the current owner before introducing a replacement\./);
  assert.doesNotMatch(rendered, /Use when changing the existing example owner/);
});

test('task selection rejects a missing trigger rather than publishing an empty route', () => {
  assert.throws(() => renderCatalog(fixture('---\nname: example\n---\n\n# Example\n')), /description/);
});

test('task selection rejects a mismatched skill identity', () => {
  assert.throws(() => renderCatalog(fixture('---\nname: another\ndescription: Select the procedure before changing its behavior.\n---\n')), /name.*example|identity/);
});

test('task selection preserves supported scalar meaning and Markdown table boundaries', () => {
  const quoted = renderCatalog(fixture('---\nname: "example"\ndescription: "Read the \\"existing\\" owner | preserve its contract."\n---\n'));
  assert.match(quoted, /Read the "existing" owner \\\| preserve its contract\./);
  const single = renderCatalog(fixture("---\nname: 'example'\ndescription: 'Read the owner''s existing contract before changing it.'\n---\n"));
  assert.match(single, /Read the owner's existing contract before changing it\./);
  const plain = renderCatalog(fixture('---\nname: example\ndescription: Read the current owner before changing its contract. # source comment\n---\n'));
  assert.match(plain, /Read the current owner before changing its contract\./);
  assert.doesNotMatch(plain, /source comment/);
});

test('task selection rejects ambiguous or multiline fields instead of truncating their trigger', () => {
  for (const metadata of [
    'name: example\ndescription: Use the first route for this task.\ndescription: Use another route for the same task.',
    'name: example\ndescription: >\n  Read the existing owner before making a change.',
    'name: example\ndescription: Read the existing owner\n  before making a change.',
    'name: example\ndescription: "An unclosed description',
  ]) {
    assert.throws(() => renderCatalog(fixture(`---\n${metadata}\n---\n`)), /description/);
  }
});

test('installation detail has its own view and legacy task-catalog anchors still resolve', () => {
  const catalog = fixture();
  const tasks = renderCatalog(catalog);
  const installation = views.renderInstallationCatalog(catalog);
  assert.match(tasks, /\]\(INSTALLATION\.md\)/);
  assert.match(tasks, /### software-engineering\n/);
  assert.match(tasks, /\]\(INSTALLATION\.md#software-engineering\)/);
  for (const heading of ['Start here', 'Specialties', 'Advanced repository policy', 'Profiles', 'Reused assets', 'Standalone skills', 'Evidence']) {
    assert.ok(tasks.includes(`## ${heading}\n`), heading);
    assert.ok(tasks.includes(`](INSTALLATION.md#${heading.toLowerCase().replaceAll(' ', '-')})`), heading);
  }
  assert.doesNotMatch(tasks, /Shared engineering procedures\./);
  assert.match(installation, /Shared engineering procedures\./);
  assert.doesNotMatch(installation, /Use when changing the existing example owner/);
  assert.match(installation, /\]\(CATALOG\.md\)/);
});

function sourceFixture(t) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'catalog-views-'));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  const catalog = fixture();
  for (const relative of ['source/plugins/software-engineering', 'source/profiles', 'source/skills/example']) {
    fs.mkdirSync(path.join(directory, relative), { recursive: true });
  }
  fs.writeFileSync(path.join(directory, 'source/adaptable.marketplace.json'), JSON.stringify(catalog.marketplace));
  fs.writeFileSync(path.join(directory, 'source/plugins/software-engineering/plugin.json'), JSON.stringify(catalog.plugins[0]));
  fs.writeFileSync(path.join(directory, 'source/skills/example/SKILL.md'), catalog.contents.get('SKILL/example'));
  const run = flag => spawnSync(process.execPath, [path.resolve(import.meta.dirname, '../catalog.mjs'), '--repo', directory, flag], { encoding: 'utf8' });
  return { directory, run };
}

test('write and check cover both generated views while JSON keeps the installation report contract', t => {
  const { directory, run } = sourceFixture(t);
  const written = run('--write');
  assert.equal(written.status, 0, written.stderr);
  assert.equal(run('--check').status, 0);
  for (const name of ['CATALOG.md', 'INSTALLATION.md']) {
    fs.writeFileSync(path.join(directory, 'source', name), 'stale view\n');
    const stale = run('--check');
    assert.equal(stale.status, 1);
    assert.ok(stale.stderr.includes(`source/${name} is stale`));
    assert.equal(run('--write').status, 0);
  }
  const report = JSON.parse(run('--json').stdout);
  assert.equal(report.type, 'CATALOG_REPORT');
  assert.equal(report.schemaVersion, 3);
  assert.deepEqual(report.selection, { type: 'ALL_PLUGINS' });
  assert.deepEqual(report.assets, [{ type: 'CATALOG_ASSET', primitiveType: 'SKILL', name: 'example', path: 'skills/example', plugins: ['software-engineering'] }]);
  assert.equal(Object.hasOwn(report, 'routes'), false);
});

test('invalid task metadata prevents both generated writes', t => {
  const { directory, run } = sourceFixture(t);
  for (const name of ['CATALOG.md', 'INSTALLATION.md']) fs.writeFileSync(path.join(directory, 'source', name), 'retained output\n');
  fs.writeFileSync(path.join(directory, 'source/skills/example/SKILL.md'), '---\nname: example\n---\n');
  const result = run('--write');
  assert.equal(result.status, 1);
  assert.match(result.stderr, /missing description/);
  for (const name of ['CATALOG.md', 'INSTALLATION.md']) assert.equal(fs.readFileSync(path.join(directory, 'source', name), 'utf8'), 'retained output\n');
});
