#!/usr/bin/env node
// Plugin manifests own composition. This module derives closure, checks, and views.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const fields = ['skills', 'agents', 'hooks', 'instructions'];
const key = ref => `${ref.type}/${ref.name}`;
const sameLocation = (a, b) => a.path === b.path && a.source?.type === b.source?.type && a.source?.path === b.source?.path;
const ordered = values => [...values].sort((a, b) => a.localeCompare(b, 'en'));
const words = text => text.trim().split(/\s+/u).filter(Boolean).length;
const readJson = file => JSON.parse(fs.readFileSync(file, 'utf8'));

/** Read source once; the remaining operations do not mutate files. */
export function loadCatalog(repoRoot) {
  const source = path.resolve(repoRoot, 'source');
  const marketplace = readJson(path.join(source, 'adaptable.marketplace.json'));
  const plugins = fs.readdirSync(path.join(source, 'plugins'), { withFileTypes: true })
    .filter(entry => entry.isDirectory()).map(entry => {
      const directory = path.join(source, 'plugins', entry.name);
      return { ...readJson(path.join(directory, 'plugin.json')), directoryName: entry.name,
        files: fs.readdirSync(directory) };
    });
  const profiles = fs.readdirSync(path.join(source, 'profiles')).filter(name => name.endsWith('.json'))
    .map(name => readJson(path.join(source, 'profiles', name)));
  const definitions = new Map();
  const contents = new Map();
  for (const field of fields) {
    for (const ref of marketplace[field] ?? []) {
      if (typeof ref.path !== 'string') continue; // Shape errors belong to source validation.
      const target = path.resolve(source, ref.path);
      if (!target.startsWith(source + path.sep) || !fs.existsSync(target)) continue;
      if (ref.type === 'HOOK') definitions.set(key(ref), readJson(target));
      if (ref.type === 'INSTRUCTION') contents.set(key(ref), fs.readFileSync(target, 'utf8'));
      if (ref.type === 'SKILL') {
        const file = path.join(target, 'SKILL.md');
        if (fs.existsSync(file)) contents.set(key(ref), fs.readFileSync(file, 'utf8'));
      }
    }
  }
  return { marketplace, plugins, profiles, definitions, contents };
}

/** Compute one plugin's transitive install surface; repeated edges are idempotent. */
export function pluginClosure(catalog, plugin) {
  const refs = new Map();
  const active = new Set();
  const findings = [];
  const canonical = new Map(fields.flatMap(field => (catalog.marketplace[field] ?? []).map(ref => [key(ref), ref])));
  function visit(ref) {
    const id = key(ref);
    if (active.has(id)) { findings.push(`${plugin.name}: dependency cycle at ${id}`); return; }
    const expected = canonical.get(id);
    if (expected && !sameLocation(ref, expected)) findings.push(`${plugin.name}: ${id} differs from its canonical marketplace reference`);
    if (refs.has(id)) {
      if (!sameLocation(ref, refs.get(id))) findings.push(`${plugin.name}: conflicting dependency locations for ${id}`);
      // Identity is deduplicated, but each occurrence can declare new inline edges.
      active.add(id);
      for (const child of ref.dependsOn ?? []) visit(child);
      active.delete(id);
      return;
    }
    refs.set(id, ref);
    active.add(id);
    for (const child of ref.dependsOn ?? []) visit(child);
    for (const child of expected?.dependsOn ?? []) visit(child);
    for (const child of catalog.definitions.get(id)?.dependsOn ?? []) visit(child);
    active.delete(id);
  }
  for (const field of fields) for (const ref of plugin[field] ?? []) visit(ref);
  return { refs, findings };
}

/** Structural checks only. These findings do not claim successful model routing. */
export function auditCatalog(catalog) {
  const findings = [];
  const canonical = new Map();
  const owners = new Map();
  const paths = new Map();
  for (const field of fields) for (const ref of catalog.marketplace[field] ?? []) {
    const id = key(ref);
    if (canonical.has(id)) findings.push(`duplicate marketplace ${ref.type} ${ref.name}`);
    canonical.set(id, ref);
    const location = `${ref.type}/${ref.path}`;
    if (paths.has(location) && paths.get(location) !== id) {
      findings.push(`marketplace path ${ref.path} has conflicting identities`);
    }
    paths.set(location, id);
  }
  const pluginNames = new Set();
  for (const entry of catalog.marketplace.plugins ?? []) {
    if (pluginNames.has(entry.name)) findings.push(`duplicate marketplace PLUGIN ${entry.name}`);
    pluginNames.add(entry.name);
  }
  for (const plugin of catalog.plugins) {
    if (plugin.metadata?.workstream !== plugin.name) findings.push(`${plugin.name}: metadata.workstream must equal its plugin name`);
    if (plugin.files.some(file => file !== 'plugin.json')) findings.push(`${plugin.name}: plugin directories are composition-only`);
    const closure = pluginClosure(catalog, plugin);
    findings.push(...closure.findings);
    for (const [id, ref] of closure.refs) {
      const expected = canonical.get(id);
      if (!expected) findings.push(`${plugin.name}: ${id} is not marketplace-visible`);
      else if (!sameLocation(ref, expected)) {
        findings.push(`${plugin.name}: ${id} differs from its canonical marketplace reference`);
      }
      const installedBy = owners.get(id) ?? [];
      installedBy.push(plugin.name);
      owners.set(id, installedBy);
    }
  }
  for (const [id, installedBy] of owners) {
    if (installedBy.length > 1) {
      const [type, name] = id.split('/');
      findings.push(`${type.toLowerCase()} ${name} has multiple plugin owners: ${ordered(installedBy).join(', ')}`);
    }
  }
  for (const profile of catalog.profiles) {
    if (new Set(profile.plugins).size !== profile.plugins.length) findings.push(`${profile.name}: duplicate plugin selection`);
  }
  return ordered(new Set(findings));
}

/** A provider-neutral inventory and word count, not a tokenizer or live usage metric. */
export function catalogReport(catalog, profileName) {
  const profile = profileName ? catalog.profiles.find(p => p.name === profileName) : undefined;
  if (profileName && !profile) throw new Error(`unknown profile: ${profileName}`);
  const selected = catalog.plugins.filter(p => !profile || profile.plugins.includes(p.name));
  const all = new Map();
  const plugins = selected.sort((a, b) => a.name.localeCompare(b.name, 'en')).map(plugin => {
    const closure = pluginClosure(catalog, plugin);
    for (const [id, ref] of closure.refs) all.set(id, ref);
    return {
      type: 'CATALOG_PLUGIN', name: plugin.name, description: plugin.description, notFor: plugin.metadata.notFor,
      primitives: ordered(closure.refs.keys()),
      instructionWords: [...closure.refs.keys()].filter(id => id.startsWith('INSTRUCTION/'))
        .reduce((sum, id) => sum + words(catalog.contents.get(id) ?? ''), 0),
    };
  });
  const owned = new Set(catalog.plugins.flatMap(p => [...pluginClosure(catalog, p).refs.keys()]));
  return {
    type: 'CATALOG_REPORT', schemaVersion: 1,
    selection: profileName ? { type: 'WORKFLOW_PROFILE', name: profileName } : { type: 'ALL_PLUGINS' },
    measurement: 'Source word counts and install closure; not model tokens, routing accuracy, or runtime load.',
    plugins,
    totals: { type: 'CATALOG_TOTALS', plugins: plugins.length, primitives: all.size,
      instructionWords: plugins.reduce((sum, p) => sum + p.instructionWords, 0) },
    standaloneSkills: ordered((catalog.marketplace.skills ?? []).filter(ref => !owned.has(key(ref))).map(ref => ref.name)),
  };
}

export function renderCatalog(catalog) {
  const report = catalogReport(catalog);
  const lines = ['# Catalog', '',
    'Generated from canonical manifests by `node source/tools/catalog.mjs --write`.',
    'Choose a workstream by its outcome. A profile composes workstreams; it does not copy them.', '',
    '## Workstreams', ''];
  for (const plugin of report.plugins) {
    lines.push(`### ${plugin.name}`, '', plugin.description, '', `Outside this workstream: ${plugin.notFor}`, '');
    for (const field of fields) {
      const refs = plugin.primitives.filter(id => id.startsWith({skills:'SKILL/', agents:'AGENT/',hooks:'HOOK/',instructions:'INSTRUCTION/'}[field]));
      if (refs.length) lines.push(`**${field[0].toUpperCase() + field.slice(1)}:** ${refs.map(id => {
        const [type, name] = id.split('/');
        const ref = catalog.marketplace[field].find(r => r.type === type && r.name === name);
        return `[${name}](${ref.path}${type === 'SKILL' ? '/SKILL.md' : ''})`;
      }).join(', ')}.`, '');
    }
  }
  lines.push('## Profiles', '');
  for (const profile of [...catalog.profiles].sort((a,b) => a.name.localeCompare(b.name,'en'))) {
    const view = catalogReport(catalog, profile.name);
    lines.push(`- [${profile.name}](profiles/${profile.name}.json): ${profile.plugins.join(' + ')}. ${view.totals.instructionWords} instruction words.`, '');
  }
  lines.push('## Standalone skills', '',
    'These optional specialties are outside the default workstreams. They remain independently installable.', '',
    report.standaloneSkills.map(name => `[${name}](skills/${name}/SKILL.md)`).join(', ') + '.', '',
    '## Evidence', '',
    'Counts describe source instruction text, not actual prompt loading or token use.',
    'The graph gate checks identity, ownership, dependencies, and projection inputs.',
    'Behavioral scenarios and golden replay are specifications, not observed Astra results.', '');
  return lines.join('\n');
}

function main() {
  const args = process.argv.slice(2);
  const value = flag => {
    const index = args.indexOf(flag);
    if (index < 0) return undefined;
    const result = args[index + 1];
    if (!result || result.startsWith('--')) throw new Error(`${flag} requires a value`);
    return result;
  };
  const known = new Set(['--repo','--profile','--json','--write','--check']);
  for (const arg of args.filter(arg => arg.startsWith('--'))) if (!known.has(arg)) throw new Error(`unknown option: ${arg}`);
  if (args.includes('--write') && args.includes('--check')) throw new Error('choose --write or --check');
  const root = path.resolve(value('--repo') ?? process.cwd());
  const catalog = loadCatalog(root);
  const findings = auditCatalog(catalog);
  if (findings.length) throw new Error(findings.join('\n'));
  const output = path.join(root, 'source/CATALOG.md');
  if (args.includes('--write')) fs.writeFileSync(output, renderCatalog(catalog));
  else if (args.includes('--check')) {
    if (!fs.existsSync(output) || fs.readFileSync(output, 'utf8') !== renderCatalog(catalog)) throw new Error('source/CATALOG.md is stale; run node source/tools/catalog.mjs --write');
    console.log('OK generated catalog');
  } else if (args.includes('--json') || args.includes('--profile')) console.log(JSON.stringify(catalogReport(catalog, value('--profile')), null, 2));
  else process.stdout.write(renderCatalog(catalog));
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { main(); } catch (error) { console.error(error.message); process.exitCode = 1; }
}
