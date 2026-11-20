#!/usr/bin/env node
// Plugin manifests own composition. This module derives closure, checks, and views.
import fs from 'node:fs';
import { validateResourceReference } from './resource-contract.mjs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const fields = ['skills', 'agents', 'hooks', 'instructions', 'resources'];
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
    if (ref.type === 'RESOURCE' && validateResourceReference(ref).type !== 'RESOURCE_REFERENCE_VALID') findings.push(`${plugin.name}: invalid resource reference ${id}`);
    if (active.has(id)) { findings.push(`${plugin.name}: dependency cycle at ${id}`); return; }
    const expected = canonical.get(id);
    if (!expected) findings.push(`${plugin.name}: ${id} is not marketplace-visible`);
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

/** Source reuse is independent of selection. Hooks need one activation per profile. */
export function auditProfileComposition(catalog, profile) {
  const findings = [];
  const hooks = new Map();
  if (new Set(profile.plugins).size !== profile.plugins.length) findings.push(`${profile.name}: duplicate plugin selection`);
  for (const name of new Set(profile.plugins)) {
    const plugin = catalog.plugins.find(p => p.name === name);
    if (!plugin) { findings.push(`${profile.name}: profile references missing plugin ${name}`); continue; }
    const closure = pluginClosure(catalog, plugin);
    findings.push(...closure.findings);
    for (const [id, ref] of closure.refs) {
      if (ref.type !== 'HOOK') continue;
      if (!catalog.definitions.has(id)) findings.push(`${profile.name}: missing canonical hook definition for ${id}`);
      const composedBy = hooks.get(id) ?? [];
      composedBy.push(name);
      hooks.set(id, composedBy);
    }
  }
  for (const [id, composedBy] of hooks) {
    if (composedBy.length > 1) findings.push(`${profile.name}: selected plugins activate ${id} multiple times via [${ordered(composedBy).join(', ')}]`);
  }
  for (const ref of profile.hooks ?? []) {
    if (!hooks.has(key(ref))) findings.push(`${profile.name}: profile hook ${ref.name} is not composed by a selected plugin`);
  }
  return ordered(new Set(findings));
}

/** Structural checks only. These findings do not claim successful model routing. */
export function auditCatalog(catalog) {
  const findings = [];
  const canonical = new Map();
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
  for (const ref of catalog.marketplace.resources ?? []) if (validateResourceReference(ref).type !== 'RESOURCE_REFERENCE_VALID') findings.push('marketplace has an invalid resource reference');
  for (const plugin of catalog.plugins) for (const ref of plugin.resources ?? []) if (validateResourceReference(ref).type !== 'RESOURCE_REFERENCE_VALID') findings.push(`${plugin.name}: invalid direct resource reference`);
  const pluginNames = new Set();
  for (const entry of catalog.marketplace.plugins ?? []) {
    if (pluginNames.has(entry.name)) findings.push(`duplicate marketplace PLUGIN ${entry.name}`);
    pluginNames.add(entry.name);
  }
  for (const plugin of catalog.plugins) {
    if (plugin.metadata?.workstream !== plugin.name) findings.push(`${plugin.name}: metadata.workstream must equal its plugin name`);
    if (!['default', 'specialty', 'advanced'].includes(plugin.metadata?.role)) {
      findings.push(`${plugin.name}: metadata.role must be default, specialty, or advanced`);
    }
    const packagingFiles = plugin.codexMcpServers === './.mcp.json' ? ['.mcp.json'] : [];
    if (plugin.files.some(file => file !== 'plugin.json' && !packagingFiles.includes(file))) {
      findings.push(`${plugin.name}: plugin directories are composition-only except declared packaging files`);
    }
    if (packagingFiles.some(file => !plugin.files.includes(file))) {
      findings.push(`${plugin.name}: declared Codex MCP packaging file is missing`);
    }
    const closure = pluginClosure(catalog, plugin);
    findings.push(...closure.findings);
    for (const [id, ref] of closure.refs) {
      const expected = canonical.get(id);
      if (!expected) findings.push(`${plugin.name}: ${id} is not marketplace-visible`);
      else if (!sameLocation(ref, expected)) {
        findings.push(`${plugin.name}: ${id} differs from its canonical marketplace reference`);
      }
    }
  }
  if (catalog.plugins.filter(plugin => plugin.metadata?.role === 'default').length !== 1) {
    findings.push('catalog must expose exactly one default plugin');
  }
  for (const profile of catalog.profiles) {
    findings.push(...auditProfileComposition(catalog, profile));
  }
  return ordered(new Set(findings));
}

/** A provider-neutral inventory and word count, not a tokenizer or live usage metric. */
export function catalogReport(catalog, profileName) {
  const findings = auditCatalog(catalog);
  if (findings.length) throw new Error(findings.join('\n'));
  const profile = profileName ? catalog.profiles.find(p => p.name === profileName) : undefined;
  if (profileName && !profile) throw new Error(`unknown profile: ${profileName}`);
  const selected = catalog.plugins.filter(p => !profile || profile.plugins.includes(p.name));
  const all = new Map();
  const compositions = new Map();
  const plugins = selected.sort((a, b) => a.name.localeCompare(b.name, 'en')).map(plugin => {
    const closure = pluginClosure(catalog, plugin);
    for (const [id, ref] of closure.refs) {
      all.set(id, ref);
      const composedBy = compositions.get(id) ?? [];
      composedBy.push(plugin.name);
      compositions.set(id, composedBy);
    }
    return {
      type: 'CATALOG_PLUGIN', name: plugin.name, description: plugin.description, notFor: plugin.metadata.notFor,
      primitives: ordered(closure.refs.keys()),
      instructionWords: [...closure.refs.keys()].filter(id => id.startsWith('INSTRUCTION/'))
        .reduce((sum, id) => sum + words(catalog.contents.get(id) ?? ''), 0),
    };
  });
  const composed = new Set(catalog.plugins.flatMap(p => [...pluginClosure(catalog, p).refs.keys()]));
  return {
    type: 'CATALOG_REPORT', schemaVersion: 3,
    selection: profileName ? { type: 'WORKFLOW_PROFILE', name: profileName } : { type: 'ALL_PLUGINS' },
    measurement: 'Source word counts and install closure; not model tokens, routing accuracy, or runtime load.',
    plugins,
    assets: ordered(all.keys()).map(id => {
      const ref = all.get(id);
      return { type: 'CATALOG_ASSET', primitiveType: ref.type, name: ref.name, path: ref.path,
        plugins: ordered(compositions.get(id)) };
    }),
    totals: { type: 'CATALOG_TOTALS', plugins: plugins.length, primitives: all.size,
      instructionWords: [...all.keys()].filter(id => id.startsWith('INSTRUCTION/'))
        .reduce((sum, id) => sum + words(catalog.contents.get(id) ?? ''), 0) },
    standaloneSkills: ordered((catalog.marketplace.skills ?? []).filter(ref => !composed.has(key(ref))).map(ref => ref.name)),
  };
}

/** Catalog descriptions use the source's single-line YAML scalar fields. */
function skillTrigger(catalog, ref) {
  const source = `${ref.path}/SKILL.md`;
  const text = catalog.contents.get(key(ref));
  const frontmatter = typeof text === 'string' && text.match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/u);
  if (!frontmatter) throw new Error(`${source}: missing or unclosed skill frontmatter`);
  const lines = frontmatter[1].split(/\r?\n/u);
  const values = new Map();
  for (let index = 0; index < lines.length; index += 1) {
    const field = lines[index].match(/^(name|description):[ \t]*(.*)$/u);
    if (!field) continue;
    const [, name, raw] = field;
    if (values.has(name)) throw new Error(`${source}: duplicate ${name}`);
    for (let next = index + 1; next < lines.length && !/^[A-Za-z0-9_-]+:/u.test(lines[next]); next += 1) {
      if (lines[next].trim() && !/^\s*#/u.test(lines[next])) {
        throw new Error(`${source}: ${name} must be a single-line scalar`);
      }
    }
    const scalar = raw.trim();
    let value;
    if (scalar.startsWith('"')) {
      const quoted = scalar.match(/^("(?:[^"\\]|\\.)*")(?:[ \t]+#.*)?$/u);
      if (!quoted) throw new Error(`${source}: invalid quoted ${name}`);
      try { value = JSON.parse(quoted[1]); }
      catch { throw new Error(`${source}: unsupported quoted ${name}`); }
    } else if (scalar.startsWith("'")) {
      const quoted = scalar.match(/^('(?:[^']|'')*')(?:[ \t]+#.*)?$/u);
      if (!quoted) throw new Error(`${source}: invalid quoted ${name}`);
      value = quoted[1].slice(1, -1).replaceAll("''", "'");
    } else {
      if (/^[>|\[{]/u.test(scalar)) throw new Error(`${source}: ${name} must be a single-line scalar`);
      value = scalar.replace(/(?:^|[ \t]+)#.*$/u, '').trim();
    }
    if (typeof value !== 'string' || !value.trim() || /[\r\n]/u.test(value)) {
      throw new Error(`${source}: ${name} must be nonempty single-line text`);
    }
    values.set(name, value);
  }
  if (values.get('name') !== ref.name) throw new Error(`${source}: frontmatter name must match ${ref.name}`);
  if (!values.has('description')) throw new Error(`${source}: missing description`);
  return values.get('description');
}

function tableCell(value) {
  return value.replaceAll('\\', '\\\\').replaceAll('|', '\\|');
}

/** Task selection reads canonical triggers; install closure is a separate view. */
export function renderCatalog(catalog) {
  const report = catalogReport(catalog);
  const routes = [...catalog.marketplace.skills].sort((a, b) => a.name.localeCompare(b.name, 'en'))
    .map(ref => ({ ref, trigger: skillTrigger(catalog, ref) }));
  const lines = ['# Catalog', '',
    'Generated from canonical skill descriptions and identities by `node tools/catalog.mjs --write`.', '',
    'Choose the procedures that govern the actions you intend to take, and read each one before the decision or operation it governs. A task can need more than one.',
    'Each trigger comes from the owning skill. Follow a procedure\'s references only when their stated conditions apply.', '',
    '## Select by action', '',
    '| When the task involves | Read |', '| --- | --- |'];
  for (const { ref, trigger } of routes) {
    lines.push(`| ${tableCell(trigger)} | [\`${ref.name}\`](${ref.path}/SKILL.md) |`);
  }
  lines.push('', '## Plugin installation', '',
    'When choosing or changing installed capabilities, use the [installation catalog](INSTALLATION.md). It owns plugin composition, profiles, and shared-asset inventory.',
    'These links preserve the earlier entry points for installation details.', '');
  for (const [role, heading] of [['default', 'Start here'], ['specialty', 'Specialties'], ['advanced', 'Advanced repository policy']]) {
    lines.push(`## ${heading}`, '', `[Installation choices](INSTALLATION.md#${heading.toLowerCase().replaceAll(' ', '-')}).`, '');
    for (const plugin of report.plugins.filter(p => catalog.plugins.find(source => source.name === p.name).metadata.role === role)) {
      lines.push(`### ${plugin.name}`, '', `[Composition and scope](INSTALLATION.md#${plugin.name}).`, '');
    }
  }
  for (const heading of ['Profiles', 'Reused assets', 'Standalone skills']) {
    lines.push(`## ${heading}`, '', `[${heading}](INSTALLATION.md#${heading.toLowerCase().replaceAll(' ', '-')}).`, '');
  }
  lines.push('## Evidence', '',
    'This view establishes discoverable source descriptions and links. It does not prove that a host loaded a skill or that a model selected or followed it.',
    'See [installation measurements](INSTALLATION.md#evidence) for source counts and [skill evaluations](../docs/skill-evals.md) for the evidence appropriate to the claim.', '');
  return lines.join('\n');
}

export const GLOBAL_INSTRUCTION_SOURCES = ['source/instructions/agent-execution.md', 'source/instructions/engineering-design.md'];
const CATALOG_URL = 'https://raw.githubusercontent.com/amichne/slopsentral/refs/heads/main/source/CATALOG.md';

/** The portable global file is a view of the shared session instructions, never a second owner. */
export function renderGlobalInstructions(sources) {
  const body = text => text.replace(/^# [^\n]*\n+/, '').trimEnd();
  const [execution, design] = sources;
  return ['# Engineering principles', '',
    'Generated from `source/instructions` by `node tools/catalog.mjs --write`. The Software Engineering plugin delivers the same text as session context; install one of the two.', '',
    '## Select guidance', '',
    `Use the [task catalog](${CATALOG_URL}) to select the procedure for the intended action. Installed profiles describe available capabilities; they do not require reading every packaged procedure.`, '',
    '## Execute the authorized outcome', '',
    body(execution), '',
    body(design), ''].join('\n');
}

export function renderInstallationCatalog(catalog) {
  const report = catalogReport(catalog);
  const lines = ['# Plugin installation catalog', '',
    'Generated from canonical manifests by `node tools/catalog.mjs --write`.',
    'Use the [task catalog](CATALOG.md) when selecting guidance for an action. Use this view when choosing or changing installed capabilities.', '',
    'For code work, start with Software Engineering and add only the specialties your task needs.',
    'Keep that selection for the repository. Describe the outcome; the agent selects relevant skills within the installed plugins.',
    'Installing a plugin makes its capabilities available; it does not require every skill to run or authorize publication.', '',
    'For documentation alone, choose Repository Knowledge. Knowledge generation remains optional.',
    'Profiles provide repeatable setup selections. See [migration](MIGRATION.md) before replacing older installations.', ''];
  for (const [role, heading] of [['default', 'Start here'], ['specialty', 'Specialties'], ['advanced', 'Advanced repository policy']]) {
    lines.push(`## ${heading}`, '');
    for (const plugin of report.plugins.filter(p => catalog.plugins.find(source => source.name === p.name).metadata.role === role)) {
      const manifest = catalog.plugins.find(source => source.name === plugin.name);
      lines.push(`### ${plugin.name}`, '', plugin.description, '', manifest.metadata.dailyDriver, '', `Outside this plugin: ${plugin.notFor}`, '');
      for (const field of fields) {
        const refs = plugin.primitives.filter(id => id.startsWith({skills:'SKILL/', agents:'AGENT/',hooks:'HOOK/',instructions:'INSTRUCTION/', resources:'RESOURCE/'}[field]));
        if (refs.length) lines.push(`**${field[0].toUpperCase() + field.slice(1)}:** ${refs.map(id => {
          const [type, name] = id.split('/');
          const ref = catalog.marketplace[field].find(r => r.type === type && r.name === name);
          return `[\`${name}\`](${ref.path}${type === 'SKILL' ? '/SKILL.md' : ''})`;
        }).join(', ')}.`, '');
      }
    }
  }
  lines.push('## Profiles', '');
  for (const profile of [...catalog.profiles].sort((a,b) => a.name.localeCompare(b.name,'en'))) {
    const view = catalogReport(catalog, profile.name);
    lines.push(`- [\`${profile.name}\`](profiles/${profile.name}.json): ${profile.plugins.join(' + ')}. ${view.totals.instructionWords} instruction words.`, '');
  }
  lines.push('## Reused assets', '',
    'Each asset has one canonical source. Plugins may compose it in several bundles.',
    'Profiles may share skills, agents, and instructions. Select each hook through one plugin to avoid duplicate execution.', '',
    '| Asset | Composed by |', '| --- | --- |');
  for (const asset of report.assets.filter(asset => asset.plugins.length > 1)) {
    lines.push(`| [\`${asset.primitiveType}/${asset.name}\`](${asset.path}${asset.primitiveType === 'SKILL' ? '/SKILL.md' : ''}) | ${asset.plugins.join(', ')} |`);
  }
  lines.push('', '## Standalone skills', '',
    'Advanced alternatives outside the plugin chooser. They require explicit standalone setup; normal plugin selection does not depend on installing individual skills.', '',
    report.standaloneSkills.map(name => `[\`${name}\`](skills/${name}/SKILL.md)`).join(', ') + '.', '',
    '## Evidence', '',
    'Counts describe source instruction text, not actual prompt loading or token use.',
    'The graph gate checks canonical identity, dependencies, profile hook activation, and projection inputs.',
    'Report v3 totals count each instruction once; per-plugin counts describe each bundle separately.',
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
  if (args.includes('--write') || args.includes('--check')) {
    const outputs = [
      ['source/CATALOG.md', renderCatalog(catalog)],
      ['source/INSTALLATION.md', renderInstallationCatalog(catalog)],
      ['docs/examples/global/AGENTS.md', renderGlobalInstructions(GLOBAL_INSTRUCTION_SOURCES.map(relative => fs.readFileSync(path.join(root, relative), 'utf8')))],
    ];
    for (const [relative, rendered] of outputs) {
      const output = path.join(root, relative);
      if (args.includes('--write')) fs.writeFileSync(output, rendered);
      else if (!fs.existsSync(output) || fs.readFileSync(output, 'utf8') !== rendered) {
        throw new Error(`${relative} is stale; run node tools/catalog.mjs --write`);
      }
    }
    if (!args.includes('--write')) console.log('OK generated task catalog, installation catalog, and global instructions');
  } else if (args.includes('--json') || args.includes('--profile')) console.log(JSON.stringify(catalogReport(catalog, value('--profile')), null, 2));
  else process.stdout.write(renderCatalog(catalog));
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { main(); } catch (error) { console.error(error.message); process.exitCode = 1; }
}
