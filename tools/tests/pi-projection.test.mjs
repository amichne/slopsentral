import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import test from 'node:test';
import { project } from '../project-marketplaces.mjs';
import { auditProfileComposition, loadCatalog } from '../catalog.mjs';
import { validateWorkflowProfile } from '../validate-profile-contracts.mjs';

const root = path.resolve(import.meta.dirname, '../..');
function tree(directory) {
  return new Map(fs.readdirSync(directory, { recursive: true }).filter(name => fs.statSync(path.join(directory, name)).isFile()).sort()
    .map(name => [name, { bytes: fs.readFileSync(path.join(directory, name)), mode: fs.statSync(path.join(directory, name)).mode & 0o777 }]));
}

test('Pi projects an installable package with source-derived profiles and focused skills', { skip: !process.env.PKL_BIN }, t => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'slopsentral-pi-proof-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const result = project({ source: root, harness: 'pi', out: path.join(dir, 'out') });
  assert.equal(result.type, 'PROJECTED');
  const pkg = path.join(result.out, '.pi/slopsentral');
  const manifest = JSON.parse(fs.readFileSync(path.join(pkg, 'package.json')));
  assert.deepEqual(manifest.pi.extensions, ['./extensions/slopsentral.ts']);
  assert.equal(manifest.peerDependencies['@earendil-works/pi-coding-agent'], '*');
  assert.equal(manifest.peerDependencies['@earendil-works/pi-tui'], '*');
  assert.deepEqual(manifest.pi.skills, []);
  const config = JSON.parse(fs.readFileSync(path.join(pkg, 'profiles.json')));
  const capabilities = JSON.parse(fs.readFileSync(path.join(pkg, 'capabilities.json')));
  assert.equal(capabilities.schemaVersion, 1);
  assert.ok(capabilities.capabilities.some(cap => cap.id === 'skill:pkl-engineering' && cap.type === 'SKILL'));
  assert.ok(capabilities.capabilities.find(cap => cap.id === 'hook:gradle-check-green').dependencies.includes('instruction:kotlin-engineering'));
  assert.equal(capabilities.capabilities.some(cap => cap.id === 'hook:agents-md-scope'), false);
  for (const name of ['settings.schema.json', 'capabilities.schema.json', 'scope-assessment.schema.json'])
    assert.deepEqual(fs.readFileSync(path.join(pkg, 'schemas', name)), fs.readFileSync(path.join(root, 'source/schemas/pi', name)));
  for (const name of ['control.ts', 'settings.ts', 'skills.ts', 'journal.ts', 'coordinator.ts', 'menu.ts'])
    assert.ok(fs.statSync(path.join(pkg, 'extensions', name)).isFile());
  assert.equal(config.defaultProfile, 'local-development-default');
  const local = config.profiles.find(p => p.name === 'local-development-default');
  const authoredLocal = JSON.parse(fs.readFileSync(path.join(root, 'source/profiles/local-development-default.json')));
  assert.deepEqual(local.skills.map(skill => 'skill:' + skill.name).sort(), Object.keys(authoredLocal.skills).sort());
  assert.ok(config.profiles.every(profile => profile.skills.every(skill => skill.invocation === 'either')));
  const kotlin = config.profiles.find(p => p.name === 'kotlin-type-design');
  assert.deepEqual(kotlin.skills.map(s => s.name).sort(), ['kotlin-design-practices', 'kotlin-review', 'negative-capability-proof', 'semantic-ratchet']);
  const broad = config.profiles.find(p => p.name === 'type-design');
  assert.ok(broad.skills.some(s => s.name === 'openapi-contract-authoring'));
  assert.ok(broad.skills.some(s => s.name === 'manage-json-schemas'));
  assert.ok(broad.skills.some(s => s.name === 'pkl-engineering'));
  assert.equal(kotlin.instructions.some(i => i.name === 'engineering-design'), false);
  assert.ok(kotlin.instructions.some(i => i.name === 'kotlin-engineering'));
  for (const profile of config.profiles) for (const ref of [...profile.skills, ...profile.instructions]) {
    assert.ok(fs.statSync(path.join(pkg, ref.path)).isFile(), ref.path);
  }
  const lock = JSON.parse(fs.readFileSync(path.join(pkg, 'marketplace-lock.json')));
  assert.equal(lock.plugins.length, result.plugins);
  const repeat = project({ source: root, harness: 'pi', out: path.join(dir, 'repeat') });
  assert.deepEqual(tree(result.out), tree(repeat.out));
  const files = tree(pkg);
  for (const plugin of lock.plugins) for (const ref of plugin.references) {
    const prefix = plugin.name + '/' + ref.targetPath;
    const digest = crypto.createHash('sha256');
    if (files.has(prefix)) digest.update(files.get(prefix).bytes);
    else for (const [name, file] of files) if (name.startsWith(prefix + '/')) digest.update(name.slice(prefix.length + 1)).update('\0').update(file.bytes).update('\0');
    assert.equal(ref.sha256, 'sha256:' + digest.digest('hex'), prefix);
  }
  for (const profile of config.profiles) for (const ref of profile.skills)
    assert.ok(!manifest.pi.skills.includes('./' + path.posix.dirname(ref.path)), `${profile.name}: ${ref.name}`);
});

test('profile focus rejects empty selections and skills outside selected plugin closures', () => {
  const catalog = loadCatalog(root);
  const original = catalog.profiles.find(p => p.name === 'kotlin-repo-default');
  assert.throws(() => validateWorkflowProfile({ ...original, focusSkills: [] }));
  assert.throws(() => validateWorkflowProfile({ ...original, focusSkills: ['semantic-ratchet', 'semantic-ratchet'] }));
  assert.deepEqual(auditProfileComposition(catalog, { ...original, focusSkills: ['semantic-ratchet'] }), []);
  assert.ok(auditProfileComposition(catalog, { ...original, focusSkills: ['openapi-contract-authoring'] }).some(finding => finding.includes('not composed')));
});

test('native Pkl rejects unsupported Pi events and compound commands before a plan exists', { skip: !process.env.PKL_BIN }, t => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'pi-plan-rejection-'));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  for (const [event, command] of [
    ['UnknownEvent', 'uv run --locked --script hooks/inject-instruction-context.py --instruction engineering-design'],
    ['SessionStart', 'uv run --locked --script hooks/inject-instruction-context.py --instruction engineering-design ; unsafe'],
    ['Stop', 'uv run --locked --script hooks/probe.py | cat'],
  ]) {
    const hook = { type: 'HOOK', name: 'fixture', sourcePath: 'source/hooks/fixture.hook.json', sha256: 'sha256:' + 'a'.repeat(64),
      hook: { type: 'HOOK', name: 'fixture', source: { type: 'LOCAL_SOURCE', path: './' }, path: 'hooks/fixture.json',
        adapter: { hooks: { [event]: [{ hooks: [{ type: 'command', command }] }] } } } };
    const input = { name: 'fixture', owner: { name: 'Fixture' }, description: 'Fixture', generatedAt: '2026-10-15T00:00:00Z', sourceSha: 'a'.repeat(40),
      plugins: [{ name: 'fixture', version: '1.0.0', description: 'Fixture', interface: {}, tags: [], references: [hook] }],
      profiles: [{ name: 'local-development-default', description: 'Fixture', plugins: ['fixture'], hookPolicy: 'ADVISORY' }] };
    const file = path.join(directory, 'input.json');
    fs.writeFileSync(file, JSON.stringify(input));
    const result = spawnSync(process.env.PKL_BIN, ['eval', '--no-project', '-p', 'harness=pi', '-p', 'input=' + pathToFileURL(file).href, 'tools/projection/Project.pkl'], { cwd: root, encoding: 'utf8' });
    assert.notEqual(result.status, 0);
    assert.equal(result.stdout, '');
    assert.match(result.stderr, /Unsupported Pi hook/);
  }
});
