#!/usr/bin/env node
// Effect boundary only. Provider shapes and text transformations live in Pkl.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { loadCatalog, auditCatalog, pluginClosure } from './catalog.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ignored = new Set(['.git', '.gradle', '.idea', '__pycache__', 'build', 'dist', 'target']);
const codes = new Set(['INVALID_INVOCATION', 'SOURCE_REJECTED', 'UNSUPPORTED_SOURCE', 'UNSAFE_PATH', 'INPUT_CHANGED', 'PKL_UNAVAILABLE', 'PKL_REJECTED', 'INVALID_PLAN', 'OUTPUT_EXISTS', 'ATOMIC_PUBLISH_UNAVAILABLE', 'WRITE_FAILED']);
class Rejected extends Error {
  constructor(stage, code, message) {
    super(message);
    if (!codes.has(code)) throw new TypeError('Unknown projection failure');
    this.outcome = { type: 'PROJECTION_REJECTED', stage, code, message };
  }
}
function reject(stage, code, message) { throw new Rejected(stage, code, message); }
const sha = (bytes, algorithm = 'sha256') => crypto.createHash(algorithm).update(bytes).digest('hex');
const stable = value => Array.isArray(value) ? value.map(stable) : value && typeof value === 'object'
  ? Object.fromEntries(Object.keys(value).sort().map(key => [key, stable(value[key])])) : value;
const encode = value => JSON.stringify(stable(value), null, 2) + '\n';
const exists = value => fs.lstatSync(value, { throwIfNoEntry: false }) !== undefined;
function relative(value) {
  return typeof value === 'string' && value.length > 0 && !path.isAbsolute(value)
    && !value.includes('\\') && !value.split('/').some(p => p === '..' || p === '' || p === '.');
}
function beneath(base, value) {
  if (!relative(value)) reject('paths', 'UNSAFE_PATH', 'A resource path is not canonical and relative');
  return path.join(base, value);
}
function realDirectory(value) {
  if (!fs.existsSync(value) || !fs.lstatSync(value).isDirectory() || fs.lstatSync(value).isSymbolicLink())
    reject('paths', 'UNSAFE_PATH', 'A required directory is missing or indirect');
  return fs.realpathSync(value);
}

/** Freeze regular files once. No network, ambient environment reads, or symlink traversal. */
function snapshot(sourceRoot) {
  const files = new Map();
  function walk(directory, prefix = '') {
    for (const name of fs.readdirSync(directory).sort()) {
      const key = prefix + name;
      const absolute = path.join(directory, name);
      const stat = fs.lstatSync(absolute);
      if (stat.isSymbolicLink()) reject('source', 'UNSAFE_PATH', 'Source contains a symbolic link');
      if (stat.isDirectory()) { if (!ignored.has(name)) walk(absolute, key + '/'); }
      else if (stat.isFile() && !name.endsWith('.pyc')) files.set('source/' + key, { bytes: fs.readFileSync(absolute), mode: stat.mode & 0o777 });
      else if (!stat.isFile()) reject('source', 'UNSAFE_PATH', 'Source contains a non-regular resource');
    }
  }
  walk(sourceRoot);
  return files;
}
function digest(files, prefix, algorithm = 'sha256') {
  if (files.has(prefix)) return (algorithm === 'sha256' ? 'sha256:' : '') + sha(files.get(prefix).bytes, algorithm);
  const hash = crypto.createHash(algorithm);
  const children = [...files.keys()].filter(key => key.startsWith(prefix + '/')).sort();
  if (!children.length) reject('source', 'SOURCE_REJECTED', 'A referenced payload is missing or empty');
  for (const key of children) hash.update(key.slice(prefix.length + 1)).update('\0').update(files.get(key).bytes).update('\0');
  return (algorithm === 'sha256' ? 'sha256:' : '') + hash.digest('hex');
}
function readJson(files, key) {
  if (!files.has(key)) reject('source', 'SOURCE_REJECTED', 'A required authored manifest is missing');
  try { return JSON.parse(files.get(key).bytes.toString('utf8')); }
  catch { reject('source', 'SOURCE_REJECTED', 'An authored manifest is not valid JSON'); }
}
function exactKeys(value, allowed, required = allowed) {
  return value && typeof value === 'object' && !Array.isArray(value)
    && Object.keys(value).every(key => allowed.includes(key)) && required.every(key => Object.hasOwn(value, key));
}
function freezeInput(repository) {
  const sourceRoot = realDirectory(path.join(repository, 'source'));
  const files = snapshot(sourceRoot);
  const frozenRepository = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'slopsentral-source-')));
  try {
    for (const [key, file] of files) {
      const destination = beneath(frozenRepository, key);
      fs.mkdirSync(path.dirname(destination), { recursive: true });
      fs.writeFileSync(destination, file.bytes, { mode: file.mode });
      fs.chmodSync(destination, file.mode);
    }
    const check = execFileSync(process.execPath, [path.join(root, 'tools/validate-source-graph.mjs'), '--repo', frozenRepository], { encoding: 'utf8', maxBuffer: 4 * 1024 * 1024, stdio: ['ignore', 'pipe', 'pipe'] });
    if (!check.startsWith('OK')) reject('source', 'SOURCE_REJECTED', 'Source graph validation did not establish validity');
    const catalog = loadCatalog(frozenRepository);
    if (auditCatalog(catalog).length) reject('source', 'SOURCE_REJECTED', 'Catalog validation rejected composition');
    const marketplace = readJson(files, 'source/adaptable.marketplace.json');
    if (marketplace.adapters || marketplace.externalMarketplaces?.length)
      reject('source', 'UNSUPPORTED_SOURCE', 'Provider overrides and remote resolution require an explicit projection implementation');
    let generatedAt;
    try { generatedAt = execFileSync('git', ['show', '-s', '--format=%cI', 'HEAD'], { cwd: repository, encoding: 'utf8' }).trim(); }
    catch { reject('source', 'SOURCE_REJECTED', 'Projection provenance requires a Git source revision'); }
    const plugins = marketplace.plugins.map(entry => {
      if (entry.plugin.source.type !== 'LOCAL_SOURCE' || entry.plugin.source.path !== './plugins/' + entry.name)
        reject('source', 'UNSUPPORTED_SOURCE', 'Only canonical repository-local plugin compositions are supported');
      const manifest = readJson(files, 'source/plugins/' + entry.name + '/plugin.json');
      if (manifest.adapters) reject('source', 'UNSUPPORTED_SOURCE', 'Provider overrides require an explicit projection implementation');
      const composition = catalog.plugins.find(p => p.name === manifest.name);
      const closure = pluginClosure(catalog, composition);
      const references = [...closure.refs.values()].map(ref => {
        if (ref.source.type !== 'LOCAL_SOURCE' || ref.source.path !== './')
          reject('source', 'UNSUPPORTED_SOURCE', 'Only canonical repository-local assets are supported');
        const sourcePath = 'source/' + ref.path;
        const result = { type: ref.type, name: ref.name, sourcePath, sha256: digest(files, sourcePath) };
        if (ref.type === 'HOOK') {
          const metadata = readJson(files, sourcePath);
          result.hook = { ...metadata, adapter: readJson(files, 'source/' + metadata.path) };
        }
        if (ref.type === 'AGENT') {
          result.text = files.get(sourcePath).bytes.toString('utf8');
          if (!/^---\n[^]*\n---\n/.test(result.text)) reject('source', 'SOURCE_REJECTED', 'Agent profiles require complete YAML frontmatter');
        }
        return result;
      }).sort((a, b) => (a.type + '/' + a.sourcePath).localeCompare(b.type + '/' + b.sourcePath, 'en'));
      return { name: manifest.name, version: manifest.version, description: manifest.description,
        interface: manifest.interface ?? {}, tags: entry.tags ?? [], references,
        ...(manifest.codexMcpServers ? { mcp: 'source/plugins/' + manifest.name + '/.mcp.json' } : {}) };
    });
    const input = { name: marketplace.name, owner: marketplace.owner, description: marketplace.description,
      generatedAt, sourceSha: digest(files, 'source', 'sha1'), plugins, phase: 'PLAN', projectedDigests: {} };
    // Validate the exact frozen bytes, then prove the live source still matches.
    assertUnchanged(repository, files);
    return { files, input };
  } finally { fs.rmSync(frozenRepository, { recursive: true }); }
}
function assertUnchanged(repository, files) {
  const current = snapshot(path.join(repository, 'source'));
  if (current.size !== files.size || [...files].some(([key, file]) => !current.has(key)
    || current.get(key).mode !== file.mode || !current.get(key).bytes.equals(file.bytes)))
    reject('source', 'INPUT_CHANGED', 'Source changed during projection');
}
function evaluate(pkl, input, harness, models) {
  let version;
  try { version = execFileSync(pkl, ['--version'], { encoding: 'utf8', timeout: 10000 }); }
  catch { reject('evaluate', 'PKL_UNAVAILABLE', 'Pkl 0.32.0 is required; set PKL_BIN or install the pinned CLI'); }
  if (!/^Pkl 0\.32\.0\b/.test(version)) reject('evaluate', 'PKL_UNAVAILABLE', 'The projector requires exactly Pkl 0.32.0');
  const workspace = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'slopsentral-pkl-')));
  const inputPath = path.join(workspace, 'input.json');
  const inputUri = pathToFileURL(inputPath).href;
  for (const [name, bytes] of models) fs.writeFileSync(path.join(workspace, name), bytes);
  fs.writeFileSync(inputPath, encode(input));
  const escapedUri = inputUri.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const args = ['eval', '--no-project', '--no-cache', '--root-dir', workspace,
    '--allowed-modules', '^pkl:,^file:', '--allowed-resources', '^prop:(input|harness)$,^' + escapedUri + '$',
    '--timeout', '60', '--color', 'never', '-p', 'harness=' + harness, '-p', 'input=' + inputUri,
    path.join(workspace, 'Project.pkl')];
  try { return JSON.parse(execFileSync(pkl, args, { cwd: workspace, encoding: 'utf8', timeout: 65000, maxBuffer: 32 * 1024 * 1024, stdio: ['ignore', 'pipe', 'pipe'] })); }
  catch (error) {
    const failure = new Rejected('evaluate', 'PKL_REJECTED', 'Pkl rejected the input or could not render a complete projection plan');
    const location = String(error.stderr ?? '').match(/\/([A-Za-z]+\.pkl), line ([0-9]+)\)/);
    failure.outcome.diagnostic = location && models.has(location[1])
      ? { type: 'MODEL_LOCATION', module: location[1], line: Number(location[2]) }
      : { type: 'EVALUATION_FAILED' };
    throw failure;
  } finally { fs.rmSync(workspace, { recursive: true }); }
}
function outputBytes(file) {
  if (!exactKeys(file, ['path', 'text', 'format']) || !relative(file.path) || typeof file.text !== 'string' || !['JSON', 'TEXT'].includes(file.format))
    reject('plan', 'INVALID_PLAN', 'An output file is not a typed projection operation');
  if (file.format === 'TEXT') return Buffer.from(file.text);
  try { return Buffer.from(encode(JSON.parse(file.text))); }
  catch { reject('plan', 'INVALID_PLAN', 'A projected JSON file is not valid JSON'); }
}
function operations(plan, files, harness, input) {
  if (!exactKeys(plan, ['type', 'schemaVersion', 'harness', 'plugins', 'files']) || plan.type !== 'PROJECTION_PLAN'
    || plan.schemaVersion !== 1 || plan.harness !== harness || !Array.isArray(plan.plugins) || !Array.isArray(plan.files))
    reject('plan', 'INVALID_PLAN', 'The evaluator did not return a complete typed plan');
  const tree = harness === 'codex' ? '.agents/plugins' : '.github/plugin';
  if (plan.plugins.length !== input.plugins.length || new Set(plan.plugins.map(p => p.name)).size !== plan.plugins.length
    || plan.plugins.some(p => !input.plugins.some(expected => expected.name === p.name)))
    reject('plan', 'INVALID_PLAN', 'The plan does not cover every selected plugin exactly once');
  const output = new Map();
  function add(key, bytes, mode) {
    if (!relative(key) || !key.startsWith(tree + '/')) reject('plan', 'UNSAFE_PATH', 'Projection escaped its provider tree');
    const previous = output.get(key);
    if (previous && (previous.mode !== mode || !previous.bytes.equals(bytes))) reject('plan', 'INVALID_PLAN', 'Two resources claim the same target');
    output.set(key, { bytes, mode });
  }
  function copy(source, target) {
    if (!relative(source) || !source.startsWith('source/')) reject('plan', 'UNSAFE_PATH', 'Copy escaped the canonical source');
    if (files.has(source)) { const f = files.get(source); add(target, f.bytes, f.mode); return; }
    const children = [...files.keys()].filter(key => key.startsWith(source + '/'));
    if (!children.length) reject('plan', 'INVALID_PLAN', 'A planned copy has no frozen payload');
    for (const key of children) { const f = files.get(key); add(target + '/' + key.slice(source.length + 1), f.bytes, f.mode); }
  }
  for (const plugin of plan.plugins) {
    if (!exactKeys(plugin, ['name', 'root', 'copies', 'files', 'references']) || !/^[a-z][a-z0-9-]*$/.test(plugin.name)
      || plugin.root !== tree + '/' + plugin.name || !Array.isArray(plugin.copies) || !Array.isArray(plugin.files) || !Array.isArray(plugin.references))
      reject('plan', 'INVALID_PLAN', 'A plugin plan is incomplete');
    const expected = input.plugins.find(p => p.name === plugin.name);
    const identities = expected.references.map(r => r.type + '/' + r.name);
    if (harness === 'codex' && expected.mcp) identities.push('MCP_CONFIGURATION/');
    const actual = plugin.references.map(r => r.type + '/' + (r.name ?? ''));
    if (actual.length !== identities.length || new Set(actual).size !== actual.length || actual.some(id => !identities.includes(id)))
      reject('plan', 'INVALID_PLAN', 'A plugin plan omitted or invented a canonical asset');
    for (const r of plugin.references) {
      if (!exactKeys(r, ['type', 'name', 'sourcePath', 'targetPath', 'sha256'], ['type', 'sourcePath', 'targetPath', 'sha256'])
        || !relative(r.sourcePath) || !relative(r.targetPath) || !/^sha256:[a-f0-9]{64}$/.test(r.sha256))
        reject('plan', 'INVALID_PLAN', 'A projected reference is invalid');
      const authority = expected.references.find(e => e.type === r.type && e.name === r.name);
      if (r.sourcePath !== (r.type === 'MCP_CONFIGURATION' ? expected.mcp : authority?.sourcePath))
        reject('plan', 'INVALID_PLAN', 'A projected reference differs from its source authority');
    }
    for (const operation of plugin.copies) {
      if (!exactKeys(operation, ['source', 'target']) || !relative(operation.target)) reject('plan', 'INVALID_PLAN', 'A copy operation is invalid');
      copy(operation.source, plugin.root + '/' + operation.target);
    }
    for (const file of plugin.files) add(plugin.root + '/' + file.path, outputBytes(file), 0o644);
    // Discover executable resources from authored commands; transformations remain in Pkl.
    for (const ref of plugin.references.filter(r => r.type === 'HOOK')) {
      const metadata = readJson(files, ref.sourcePath);
      const adapter = readJson(files, 'source/' + metadata.path);
      for (const command of Object.values(adapter.hooks).flat().flatMap(group => group.hooks)) {
        for (const match of command.command.matchAll(/\bhooks\/[A-Za-z0-9_.-]+/g)) {
          const source = 'source/' + match[0];
          copy(source, plugin.root + '/' + match[0]);
          const stem = source.slice(0, source.lastIndexOf('.'));
          for (const key of files.keys()) if (key.startsWith(stem + '.') && key.endsWith('.json') && !key.endsWith('.hook.json'))
            copy(key, plugin.root + '/hooks/' + path.posix.basename(key));
        }
      }
    }
  }
  for (const file of plan.files) add(file.path, outputBytes(file), 0o644);
  if (!output.has(tree + '/marketplace.json')) reject('plan', 'INVALID_PLAN', 'Projection omitted its marketplace entrypoint');
  return output;
}
function projectedDigests(plan, output) {
  const result = {};
  for (const p of plan.plugins) for (const r of p.references) {
    const prefix = p.root + '/' + r.targetPath;
    result[p.name + ':' + r.type + (r.name ? '/' + r.name : '')] = digest(output, prefix);
  }
  return result;
}

export function project({ source, harness, out, pkl = process.env.PKL_BIN ?? 'pkl' }) {
  if (!['codex', 'github-copilot'].includes(harness) || !source || !out) reject('invocation', 'INVALID_INVOCATION', 'Use --source <repo> --harness codex|github-copilot --out <new-directory>');
  const repository = realDirectory(path.resolve(source));
  const requested = path.resolve(out);
  const parent = fs.realpathSync(path.dirname(requested));
  if (!fs.statSync(parent).isDirectory()) reject('paths', 'UNSAFE_PATH', 'Output parent is not a directory');
  const target = path.join(parent, path.basename(requested));
  if (target === repository || target.startsWith(repository + path.sep) || repository.startsWith(target + path.sep))
    reject('paths', 'UNSAFE_PATH', 'Projection output must be outside the source repository');
  if (exists(target)) reject('publish', 'OUTPUT_EXISTS', 'Projection output already exists; choose a fresh directory');
  let state;
  try { state = freezeInput(repository); }
  catch (error) { if (error instanceof Rejected) throw error; reject('source', 'SOURCE_REJECTED', 'The authored source did not pass validation'); }
  // Two phases: derive operations, then refine source hashes into actual payload hashes.
  for (const p of state.input.plugins) if (p.mcp) state.input.projectedDigests[p.name + ':MCP_CONFIGURATION'] = digest(state.files, p.mcp);
  const models = new Map(fs.readdirSync(path.join(root, 'tools/projection')).filter(name => name.endsWith('.pkl'))
    .map(name => [name, fs.readFileSync(path.join(root, 'tools/projection', name))]));
  const first = evaluate(pkl, state.input, harness, models);
  const initial = operations(first, state.files, harness, state.input);
  const sealed = evaluate(pkl, { ...state.input, phase: 'SEALED', projectedDigests: projectedDigests(first, initial) }, harness, models);
  const complete = operations(sealed, state.files, harness, state.input);
  if (harness === 'codex' && !complete.has('.agents/plugins/marketplace-lock.json')) reject('seal', 'INVALID_PLAN', 'Projection omitted sealed provenance');
  for (const [key, file] of initial) if (!complete.has(key) || !file.bytes.equals(complete.get(key).bytes) || file.mode !== complete.get(key).mode)
    reject('seal', 'INVALID_PLAN', 'Sealing changed a derived payload');
  for (const p of sealed.plugins) for (const r of p.references) if (r.sha256 !== digest(complete, p.root + '/' + r.targetPath))
    reject('seal', 'INVALID_PLAN', 'A projected provenance hash differs from its payload');
  assertUnchanged(repository, state.files);
  const staging = fs.mkdtempSync(path.join(parent, '.slopsentral-projection-'));
  try {
    for (const [key, file] of [...complete].sort(([a], [b]) => a.localeCompare(b, 'en'))) {
      const destination = beneath(staging, key);
      fs.mkdirSync(path.dirname(destination), { recursive: true });
      fs.writeFileSync(destination, file.bytes, { mode: file.mode });
      fs.chmodSync(destination, file.mode);
    }
    assertUnchanged(repository, state.files);
    let publication;
    try { publication = JSON.parse(execFileSync('python3', [path.join(root, 'tools/projection/publish_directory.py'), staging, target], { encoding: 'utf8', timeout: 10000, maxBuffer: 1024, stdio: ['ignore', 'pipe', 'pipe'] })); }
    catch { reject('publish', 'ATOMIC_PUBLISH_UNAVAILABLE', 'The atomic publication boundary requires Python 3 and a supported native rename operation'); }
    if (publication.type === 'PUBLISH_REJECTED' && ['OUTPUT_EXISTS', 'UNSAFE_PATH', 'ATOMIC_PUBLISH_UNAVAILABLE', 'WRITE_FAILED'].includes(publication.reason))
      reject('publish', publication.reason, 'The complete projection could not be published without replacing a target');
    if (!exactKeys(publication, ['type']) || publication.type !== 'PUBLISHED') reject('publish', 'WRITE_FAILED', 'The publication boundary returned an unknown outcome');
  } catch (error) {
    if (error instanceof Rejected) throw error;
    reject('publish', 'WRITE_FAILED', 'Projection could not publish the complete staged tree');
  } finally { if (fs.existsSync(staging)) fs.rmSync(staging, { recursive: true }); }
  return { type: 'PROJECTED', harness, engine: 'Pkl 0.32.0', plugins: sealed.plugins.length, files: complete.size, sourceSha: state.input.sourceSha, out: target };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const args = process.argv.slice(2);
    const options = {};
    for (let i = 0; i < args.length; i += 2) {
      if (!['--source', '--harness', '--out', '--pkl-bin'].includes(args[i]) || !args[i + 1] || Object.hasOwn(options, args[i]))
        reject('invocation', 'INVALID_INVOCATION', 'Use --source <repo> --harness codex|github-copilot --out <new-directory> [--pkl-bin <path>]');
      options[args[i]] = args[i + 1];
    }
    console.log(JSON.stringify(project({ source: options['--source'], harness: options['--harness'], out: options['--out'], pkl: options['--pkl-bin'] })));
  } catch (error) {
    console.error(JSON.stringify(error instanceof Rejected ? error.outcome : { type: 'PROJECTION_REJECTED', stage: 'boundary', code: 'WRITE_FAILED', message: 'Projection failed at an effect boundary' }));
    process.exitCode = 1;
  }
}
