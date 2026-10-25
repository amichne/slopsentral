#!/usr/bin/env node
// Consumer setup uses the Node runtime already required by Pi. No npm scripts run.
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { gunzipSync } from 'node:zlib';

type ObjectValue = Record<string, unknown>;
type Snapshot = { path: string; before: string | null; after: string | null; mode: number };
type Scope = { agentDir: string; cwd: string; project: boolean };
type Transaction = { schemaVersion: 1; status: 'pending' | 'applied' | 'restored'; version: string; scope: Scope; files: Snapshot[] };
export type Client = { json: (route: string) => Promise<unknown>; bytes: (url: string) => Promise<Buffer> };
const qualification = Symbol('qualified-main-release');
export type Qualified = { readonly [qualification]: true; version: string; revision: string; archive: Buffer; setup: Buffer; candidate: Buffer; promotion: Buffer };
const repository = 'amichne/slopsentral';
const api = 'https://api.github.com/repos/' + repository;
const self = fileURLToPath(import.meta.url);
const maxBytes = 64 * 1024 * 1024;
const hash = (value: Buffer | string): string => crypto.createHash('sha256').update(value).digest('hex');
function reject(code: string, message: string): never { throw new Error(code + ': ' + message); }
function object(value: unknown): ObjectValue {
  if (!value || typeof value !== 'object' || Array.isArray(value)) reject('INVALID_RECORD', 'Expected an object.');
  return value as ObjectValue;
}
function list(value: unknown): unknown[] { if (!Array.isArray(value)) reject('INVALID_RECORD', 'Expected an array.'); return value as unknown[]; }
function text(value: unknown): string { if (typeof value !== 'string') reject('INVALID_RECORD', 'Expected text.'); return value; }
function parse(bytes: Buffer): ObjectValue { return object(JSON.parse(bytes.toString('utf8').replace(/^\uFEFF/, '')) as unknown); }
function same(left: unknown, right: unknown, message: string): void { if (left !== right) reject('PROVENANCE_MISMATCH', message); }
async function download(url: string): Promise<Buffer> {
  if (!url.startsWith('https://')) reject('INVALID_ORIGIN', 'HTTPS is required.');
  const response = await fetch(url, { signal: AbortSignal.timeout(30000), headers: { 'User-Agent': 'slopsentral-setup', Accept: 'application/vnd.github+json' } });
  if (!response.ok) reject('DOWNLOAD_FAILED', 'HTTP ' + response.status + ' from ' + new URL(url).hostname);
  if (Number(response.headers.get('content-length')) > maxBytes) reject('DOWNLOAD_FAILED', 'Response is too large.');
  const bytes = Buffer.from(await response.arrayBuffer());
  if (bytes.length > maxBytes) reject('DOWNLOAD_FAILED', 'Response is too large.');
  return bytes;
}
const live: Client = { json: async route => JSON.parse((await download(api + route)).toString()) as unknown, bytes: download };

export async function qualify(client: Client = live, requested?: string): Promise<Qualified> {
  if (requested && !/^0\.1\.[1-9][0-9]*$/.test(requested)) reject('INVALID_VERSION', 'Use a published 0.1.N version.');
  const release = object(await client.json(requested ? '/releases/tags/slopsentral-v' + requested : '/releases/latest'));
  const tag = text(release.tag_name);
  if (!/^slopsentral-v0\.1\.[1-9][0-9]*$/.test(tag) || release.draft !== false || release.prerelease !== false) reject('INVALID_RELEASE', 'A qualified stable release is required.');
  const version = tag.slice('slopsentral-v'.length);
  if (requested) same(version, requested, 'Requested version differs.');
  async function asset(name: string): Promise<Buffer> {
    const matches = list(release.assets).map(object).filter(item => item.name === name);
    if (matches.length !== 1) reject('INVALID_RELEASE', 'Missing unique ' + name + '. Use the current native setup release.');
    const metadata = matches[0]!;
    const url = 'https://github.com/' + repository + '/releases/download/' + tag + '/' + name;
    same(metadata.browser_download_url, url, 'Foreign download URL.');
    const bytes = await client.bytes(url);
    same(metadata.size, bytes.length, 'Asset size differs.');
    same(metadata.digest, 'sha256:' + hash(bytes), 'GitHub asset digest differs.');
    return bytes;
  }
  const setup = await asset('setup.json');
  const record = parse(setup);
  same(record.schema_version, 1, 'Unknown setup schema.');
  same(record.repository, repository, 'Foreign setup repository.');
  same(record.version, version, 'Setup version differs.');
  const revision = text(record.source_revision);
  if (!/^[a-f0-9]{40}$/.test(revision)) reject('INVALID_RECORD', 'Invalid source revision.');
  const own = list(record.files).map(object).find(item => item.file === 'setup-pi.mts');
  if (!own) reject('INVALID_RECORD', 'Installer is absent from its receipt.');
  same(own.sha256, hash(fs.readFileSync(self)), 'Installer bytes differ from the tested setup.');
  const candidate = await asset('candidate.json');
  const promotion = await asset('promotion.json');
  const c = parse(candidate), p = parse(promotion);
  same(record.candidate_sha256, hash(candidate), 'Candidate receipt differs.');
  same(p.candidate_sha256, hash(candidate), 'Promotion candidate differs.');
  for (const field of ['source_revision', 'merged_revision']) same(p[field], revision, 'Promotion source differs.');
  same(c.source_revision, revision, 'Candidate source differs.');
  same(c.repository, repository, 'Foreign candidate repository.');
  same(p.repository, repository, 'Foreign promotion repository.');
  same(c.version, version, 'Candidate version differs.');
  same(p.version, version, 'Promotion version differs.');
  same(c.event, 'push', 'Candidate is not a main push.');
  same(version, '0.1.' + String(c.run_number), 'Producer version differs.');
  same(c.run_id, p.main_run_id, 'Main run differs.');
  same(c.run_id, p.build_run_id, 'Build run differs.');
  same(c.run_attempt, p.main_run_attempt, 'Main attempt differs.');
  same(c.run_attempt, p.build_run_attempt, 'Build attempt differs.');
  const run = object(await client.json('/actions/runs/' + String(c.run_id) + '/attempts/' + String(c.run_attempt)));
  for (const field of ['run_id', 'run_number', 'run_attempt']) if (!Number.isSafeInteger(c[field]) || Number(c[field]) < 1) reject('INVALID_RECORD', 'Invalid producer number.');
  for (const [field, expected] of Object.entries({ id: c.run_id, head_sha: revision, status: 'completed', conclusion: 'success', event: 'push', head_branch: 'main', path: '.github/workflows/validate-source.yml', run_attempt: c.run_attempt, run_number: c.run_number })) same(run[field], expected, 'Unqualified producer: ' + field);
  same(object(run.repository).full_name, repository, 'Foreign producer repository.');
  const jobs = list(object(await client.json('/actions/runs/' + String(c.run_id) + '/attempts/' + String(c.run_attempt) + '/jobs?per_page=100')).jobs).map(object);
  for (const [name, required] of [
    ['Validate marketplace source', ['Compile Kotlin concepts and forbidden calls', 'Validate Pkl facade against native Pkl', 'Project both providers and execute projected hook contracts']],
    ['Retain tested Pi candidate', ['Examine every Pi contract through the native host', 'Install the candidate archive through the native Pi CLI', 'Test native setup and recovery', 'Retain the tested setup installer']],
  ] as const) {
    const selected = jobs.filter(job => job.name === name);
    if (selected.length !== 1 || selected[0]!.conclusion !== 'success') reject('PRODUCER_NOT_SUCCESSFUL', 'Required job did not pass: ' + name);
    const steps = list(selected[0]!.steps).map(object);
    for (const step of required) if (steps.filter(item => item.name === step && item.conclusion === 'success').length !== 1) reject('PRODUCER_NOT_SUCCESSFUL', 'Required step did not run: ' + step);
  }
  const commit = object(await client.json('/git/commits/' + revision));
  same(object(commit.tree).sha, c.source_tree, 'Source tree differs.');
  same(c.source_tree, p.source_tree, 'Promotion tree differs.');
  const ref = object(await client.json('/git/ref/tags/' + tag));
  same(object(ref.object).type, 'commit', 'Expected a source commit tag.');
  same(object(ref.object).sha, revision, 'Release tag differs from qualified source.');
  const name = 'slopsentral-pi-' + version + '.tgz';
  same(c.archive, name, 'Unexpected archive name.');
  const archive = await asset(name);
  same(c.sha256, hash(archive), 'Candidate archive checksum differs.');
  same(p.archive_sha256, hash(archive), 'Promoted archive checksum differs.');
  same(c.size, archive.length, 'Candidate archive size differs.');
  return { [qualification]: true, version, revision, archive, setup, candidate, promotion };
}

function snapshot(file: string): { bytes: Buffer | null; mode: number } {
  direct(file);
  const info = fs.lstatSync(file, { throwIfNoEntry: false });
  if (!info) return { bytes: null, mode: 0o600 };
  if (!info.isFile() || info.isSymbolicLink() || info.size > 2 * 1024 * 1024) reject('UNSAFE_CONFIG', 'Expected a small regular file: ' + file);
  return { bytes: fs.readFileSync(file), mode: info.mode & 0o777 };
}
function encode(bytes: Buffer | null): string | null { return bytes === null ? null : bytes.toString('base64'); }
function matches(item: Snapshot, image: string | null): boolean {
  const observed = snapshot(item.path);
  return encode(observed.bytes) === image && (image === null || observed.mode === item.mode);
}
function direct(file: string): void {
  const absolute = path.resolve(file);
  const parent = path.dirname(absolute);
  if (parent !== absolute) direct(parent);
  const info = fs.lstatSync(absolute, { throwIfNoEntry: false });
  if (info?.isSymbolicLink()) reject('UNSAFE_CONFIG', 'Symlink scope component: ' + absolute);
}
function directory(folder: string): void {
  direct(folder);
  const info = fs.lstatSync(folder, { throwIfNoEntry: false });
  if (info && (!info.isDirectory() || info.isSymbolicLink())) reject('UNSAFE_CONFIG', 'Directory is indirect: ' + folder);
  if (!info) { directory(path.dirname(folder)); fs.mkdirSync(folder, { mode: 0o700 }); }
}
function atomic(file: string, bytes: Buffer | null, mode: number): void {
  direct(file);
  if (bytes === null) { if (fs.existsSync(file)) fs.unlinkSync(file); return; }
  directory(path.dirname(file));
  const temporary = file + '.' + crypto.randomUUID() + '.tmp';
  try { fs.writeFileSync(temporary, bytes, { flag: 'wx', mode }); fs.chmodSync(temporary, mode); fs.renameSync(temporary, file); }
  finally { if (fs.existsSync(temporary)) fs.unlinkSync(temporary); }
}
function jsonBytes(value: unknown): Buffer { return Buffer.from(JSON.stringify(value, null, 2) + '\n'); }
function settings(file: string): { value: ObjectValue; bytes: Buffer | null; mode: number } {
  const saved = snapshot(file);
  const value = saved.bytes === null ? {} : parse(saved.bytes);
  for (const field of ['packages', 'extensions', 'skills']) if (value[field] !== undefined) list(value[field]);
  return { value, ...saved };
}
function localManifest(source: string, base: string): ObjectValue | null {
  if (/^(npm:|git:|https?:)/.test(source)) return null;
  let target = source.startsWith('~/') ? path.join(os.homedir(), source.slice(2)) : path.resolve(base, source);
  for (let count = 0; count < 7; count++, target = path.dirname(target)) {
    const manifest = path.join(target, 'package.json');
    if (fs.existsSync(manifest)) {
      try { return parse(fs.readFileSync(manifest)); } catch { return null; }
    }
    if (path.dirname(target) === target) break;
  }
  return null;
}
export function slopsentralSource(value: unknown, base: string): boolean {
  const source = typeof value === 'string' ? value : text(object(value).source);
  if (/^npm:slopsentral-pi(?:@[^\s]+)?$/.test(source)) return true;
  return localManifest(source, base)?.name === 'slopsentral-pi';
}
function narrowed(value: ObjectValue, base: string): ObjectValue {
  const next = { ...value };
  for (const field of ['packages', 'extensions', 'skills']) {
    if (next[field] !== undefined) next[field] = list(next[field]).filter(item => !slopsentralSource(item, base));
  }
  return next;
}
function ownedInstruction(before: string, instruction: string): string {
  const start = '<!-- slopsentral:begin -->', end = '<!-- slopsentral:end -->';
  const at = before.indexOf(start), until = before.indexOf(end);
  if ((at < 0) !== (until < 0) || (at >= 0 && (until < at || before.indexOf(start, at + start.length) >= 0 || before.indexOf(end, until + end.length) >= 0))) reject('UNSAFE_CONFIG', 'Conflicting Slopsentral instruction markers.');
  const block = instruction ? start + '\n' + instruction.trimEnd() + '\n' + end : '';
  if (at >= 0) return before.slice(0, at) + block + before.slice(until + end.length);
  return block ? before + (before && !before.endsWith('\n') ? '\n' : '') + '\n' + block + '\n' : before;
}
function unpack(archive: Buffer, temporary: string): string {
  gunzipSync(archive, { maxOutputLength: maxBytes });
  const file = path.join(temporary, 'package.tgz'); fs.writeFileSync(file, archive);
  const listing = spawnSync('tar', ['-tzf', file], { encoding: 'utf8', maxBuffer: maxBytes });
  if (listing.status !== 0) reject('ARCHIVE_REJECTED', 'Cannot list the package archive.');
  const names = listing.stdout.trim().split('\n');
  if (new Set(names).size !== names.length || names.some(name => !name.startsWith('package/') || name.split('/').some(part => part === '..' || part === '.') || /[\x00-\x1f\\]/.test(name))) reject('ARCHIVE_REJECTED', 'Unsafe archive members.');
  const types = spawnSync('tar', ['-tvzf', file], { encoding: 'utf8', maxBuffer: maxBytes });
  if (types.status !== 0 || types.stdout.trim().split('\n').some(line => !line.startsWith('-') && !line.startsWith('d'))) reject('ARCHIVE_REJECTED', 'Links and special files are unsupported.');
  const extraction = spawnSync('tar', ['-xzf', file, '-C', temporary], { encoding: 'utf8' });
  if (extraction.status !== 0) reject('ARCHIVE_REJECTED', 'Cannot unpack the package.');
  const root = path.join(temporary, 'package');
  const manifest = parse(fs.readFileSync(path.join(root, 'package.json')));
  same(manifest.name, 'slopsentral-pi', 'Unexpected package identity.');
  if (Object.keys(object(manifest.pi)).join() !== 'skills' || !list(object(manifest.pi).skills).length || manifest.peerDependencies || manifest.dependencies || manifest.scripts) reject('ARCHIVE_REJECTED', 'Only native content is supported.');
  for (const name of ['extensions', 'profiles.json', 'capabilities.json']) if (fs.existsSync(path.join(root, name))) reject('ARCHIVE_REJECTED', 'Legacy runtime payload.');
  return root;
}
function normalized(scope: Scope): Scope {
  const value = { agentDir: path.resolve(scope.agentDir), cwd: path.resolve(scope.cwd), project: scope.project };
  direct(value.agentDir); direct(value.cwd); direct(path.join(value.cwd, '.pi'));
  return value;
}
function stateOf(scope: Scope): string { return path.join(scope.project ? path.join(scope.cwd, '.pi') : scope.agentDir, 'slopsentral-setup'); }
function recordOf(scope: Scope): string {
  // Recovery authority belongs to the personal home, never to a cloned project.
  const home = fs.realpathSync(os.homedir());
  const root = path.join(home, '.pi', 'slopsentral-recovery');
  if (scope.cwd !== home && (root === scope.cwd || root.startsWith(scope.cwd + path.sep))) reject('UNSAFE_CONFIG', 'Personal recovery storage is inside this project.');
  direct(root);
  if (fs.existsSync(root)) { const info = fs.statSync(root); if (info.uid !== process.getuid?.() || (info.mode & 0o077)) reject('UNSAFE_CONFIG', 'Personal recovery directory must be private and owned by you.'); }
  return path.join(root, hash(stateOf(scope)), 'transaction.json');
}
function allowed(scope: Scope, item: Snapshot): boolean {
  const fixed = [path.join(scope.agentDir, 'settings.json'), path.join(scope.cwd, '.pi/settings.json'), path.join(scope.agentDir, 'AGENTS.md'), path.join(scope.cwd, 'AGENTS.md')];
  if (fixed.includes(item.path)) return true;
  return [path.join(scope.agentDir, 'extensions'), path.join(scope.cwd, '.pi/extensions')].some(root => item.path.startsWith(root + path.sep)) && item.before !== null && item.after === null && legacyHashes.has(hash(Buffer.from(item.before, 'base64')));
}
// Recognized bytes from the archived Pi releases listed in the migration inventory.
const legacyHashes = new Set([
  '0cbfc9ea70b2d60d43f75714f0ee7ae64b858aa3d1577b1e508b184ef5bb1940',
  '10f90ed3074175de1dbdd913e9860224c9bc35ad5581ee8d22d86c8b5193cc84',
  '1593b9c41103fa93d166cee50b76870fe6a12fee822421defeb3f8f59d6c5362',
  '15baba48ae188b5674b6714168eefe69b094b2d99f52038fb8c5eaf207611eb0',
  '1d2234397c5127c51237070b25b96461c6063809c6cf1e32124cfd5ccd29f81b',
  '55e6ee78146529f6e1a7d1adb12322943932e610d7faf657a70752ad9cf669bf',
  '59d053371c88a44326b7ae6d9d01b844187029416c6d7a32c2ee1286b7cbeb5b',
  '664c86500e4f270d8597cf764cc73e31c879e7ec1962cc2e63efe32ca6fab667',
  '6a3f1b9a3049520cca04d6b71262a17fbeabf6347000ab7c9d329ceb4a905465',
  '8239b3f899bc23b8efb550be89e537f75df89ce982023758711dabdb819943a0',
  '85ec1ce9b51ae4456f53c05147f86cc5d2f98af74cf3dbb91a0ed5abb093fd2e',
  '8ffe30fde7f9e53b7f61b95bfa0e393d342c0496eb80a9fe584ea2f298575073',
  'ad691cb5cd75eb277a19122def59418d3d781666a9081ae9e114330b78f42d5e',
  'afe1473a0dd3c4f451075a95e807f6aec9a3bcacc0bd524fdb64cac8ca97278c',
  'ce1fda806b7bc799b99c54ddee74d2d50c2f8622d70b58e879843003ec6af494',
  'd4b3b42ee8425bb41ed1a74e4e1b659c6521b9487582c606bc2e607137ef5413',
  'e1032e4c1117c14ffd9bd11350721dbe1937c71a130bb3b62ac872786151c7ad',
  'f39c1c24c69d47e88cbc0aa9cc677ae54bf2445835136153840b88a07f216a38',
]);
function legacyFiles(scope: Scope): Snapshot[] {
  const result: Snapshot[] = [];
  for (const root of [path.join(scope.agentDir, 'extensions'), path.join(scope.cwd, '.pi/extensions')]) {
    direct(root);
    if (!fs.existsSync(root)) continue;
    for (const name of fs.readdirSync(root, { recursive: true })) {
      const file = path.join(root, text(name)); direct(file);
      const info = fs.lstatSync(file);
      if (!info.isFile()) continue;
      const bytes = fs.readFileSync(file);
      if (legacyHashes.has(hash(bytes))) result.push({ path: file, before: encode(bytes), after: null, mode: info.mode & 0o777 });
      else if (/slopsentral/i.test(path.basename(file)) || bytes.includes(Buffer.from('slopsentral-profile')) || bytes.includes(Buffer.from('slopsentral.json'))) reject('AMBIGUOUS_LEGACY_EXTENSION', 'Unrecognized Slopsentral extension; move it out of native discovery before setup: ' + file);
    }
  }
  return result;
}
function decodeTransaction(value: unknown, scope: Scope): Transaction {
  const record = object(value); same(record.schemaVersion, 1, 'Unknown recovery format.');
  const savedScope = object(record.scope);
  for (const key of ['agentDir', 'cwd', 'project'] as const) same(savedScope[key], scope[key], 'Recovery scope differs: ' + key);
  if (!['pending', 'applied', 'restored'].includes(text(record.status))) reject('INVALID_RECORD', 'Unknown recovery state.');
  const version = text(record.version);
  if (!/^0\.1\.[1-9][0-9]*$/.test(version)) reject('INVALID_RECORD', 'Invalid recovery version.');
  const image = (value: unknown): string | null => {
    if (value === null) return null;
    const result = text(value);
    if (result.length > 3 * 1024 * 1024 || Buffer.from(result, 'base64').toString('base64') !== result) reject('INVALID_RECORD', 'Invalid recovery image.');
    return result;
  };
  const files = list(record.files).map(item => {
    const f = object(item);
    const result = { path: text(f.path), before: image(f.before), after: image(f.after), mode: Number(f.mode) };
    if (path.resolve(result.path) !== result.path || !Number.isInteger(result.mode) || result.mode < 0 || result.mode > 0o777 || !allowed(scope, result)) reject('INVALID_RECORD', 'Recovery target is outside the admitted scope.');
    direct(result.path);
    return result;
  });
  if (new Set(files.map(item => item.path)).size !== files.length) reject('INVALID_RECORD', 'Duplicate recovery target.');
  return { schemaVersion: 1, version, status: record.status as Transaction['status'], scope, files };
}
function trustedRecord(scope: Scope, exact = true): { file: string; transaction: Transaction } {
  const file = recordOf(scope);
  if (!fs.existsSync(file)) reject('NO_RECOVERY', 'No personally admitted setup transaction for this scope.');
  direct(file);
  const info = fs.statSync(file);
  if (info.uid !== process.getuid?.() || (info.mode & 0o077)) reject('UNSAFE_CONFIG', 'Recovery evidence must be private and owned by you.');
  const value = parse(fs.readFileSync(file));
  const saved = object(value.scope);
  const recorded = normalized({ agentDir: text(saved.agentDir), cwd: text(saved.cwd), project: saved.project === true });
  same(stateOf(recorded), stateOf(scope), 'Recovery state differs.');
  same(recorded.agentDir, scope.agentDir, 'Personal recovery scope differs.');
  return { file, transaction: decodeTransaction(value, exact ? scope : recorded) };
}
function saveTransaction(scope: Scope, transaction: Transaction): void {
  const file = recordOf(scope);
  atomic(file, jsonBytes(transaction), 0o600);
  // This mirror is useful for inspection; recovery never treats it as authority.
  atomic(path.join(stateOf(scope), 'transaction.json'), jsonBytes(transaction), 0o600);
}
function restore(scope: Scope): void {
  const { file, transaction } = trustedRecord(scope);
  for (const item of transaction.files) if (!matches(item, item.after) && !matches(item, item.before)) reject('CONFIG_CHANGED', 'Later edits require manual recovery; preserved backup: ' + file);
  for (const item of [...transaction.files].reverse()) if (!matches(item, item.before)) atomic(item.path, item.before === null ? null : Buffer.from(item.before, 'base64'), item.mode);
  saveTransaction(scope, { ...transaction, status: 'restored' });
}
function acquire(lock: string): () => void {
  directory(path.dirname(lock));
  const owner = path.join(lock, 'owner.json');
  if (fs.existsSync(lock)) {
    const info = fs.lstatSync(lock);
    if (!info.isDirectory() || info.isSymbolicLink()) reject('SETUP_BUSY', 'Indirect lock: ' + lock);
    let pid: unknown;
    if (fs.existsSync(owner)) pid = parse(fs.readFileSync(owner)).pid;
    if (!Number.isSafeInteger(pid) || Number(pid) < 1 || fs.readdirSync(lock).some(name => name !== 'owner.json')) reject('SETUP_BUSY', 'Another writer owns ' + lock);
    try { process.kill(Number(pid), 0); reject('SETUP_BUSY', 'Another writer owns ' + lock); }
    catch (error) { if (object(error).code !== 'ESRCH') throw error; }
    fs.unlinkSync(owner); fs.rmdirSync(lock);
  }
  try { fs.mkdirSync(lock, { mode: 0o700 }); } catch { reject('SETUP_BUSY', 'Another writer owns ' + lock); }
  try { fs.writeFileSync(owner, jsonBytes({ pid: process.pid }), { mode: 0o600, flag: 'wx' }); }
  catch (error) { fs.rmdirSync(lock); throw error; }
  return () => { fs.unlinkSync(owner); fs.rmdirSync(lock); };
}
export function rollback(options: Scope): void {
  const scope = normalized(options);
  const admitted = trustedRecord(scope);
  const release = acquire(path.join(stateOf(scope), 'setup.lock'));
  const locks: (() => void)[] = [];
  try {
    for (const item of admitted.transaction.files.filter(item => path.basename(item.path) === 'settings.json').sort((a, b) => a.path.localeCompare(b.path))) locks.push(acquire(item.path + '.lock'));
    restore(scope);
  } finally { for (const unlock of locks.reverse()) unlock(); release(); }
}

function tree(root: string): Map<string, string> {
  const result = new Map<string, string>();
  const info = fs.lstatSync(root);
  if (!info.isDirectory() || info.isSymbolicLink()) reject('UNSAFE_CONFIG', 'Package root is indirect.');
  for (const name of fs.readdirSync(root, { recursive: true })) {
    const relative = text(name), file = path.join(root, relative), stat = fs.lstatSync(file);
    if (stat.isSymbolicLink() || (!stat.isFile() && !stat.isDirectory())) reject('UNSAFE_CONFIG', 'Package contains an indirect file.');
    if (stat.isFile()) result.set(relative, String(stat.mode & 0o777) + ':' + hash(fs.readFileSync(file)));
  }
  return result;
}
export function shellQuote(value: string): string { return "'" + value.replaceAll("'", "'\"'\"'") + "'"; }

export async function install(qualified: Qualified, options: { agentDir: string; cwd: string; project: boolean; beforeCommit?: () => void; stage?: (source: string, target: string) => void; write?: (file: string, bytes: Buffer | null, mode: number) => void }): Promise<{ status: string; version: string; state: string }> {
  if (qualified[qualification] !== true) reject('UNQUALIFIED_RELEASE', 'Setup requires an admitted release.');
  options = { ...options, ...normalized(options) };
  const context: Scope = { agentDir: options.agentDir, cwd: options.cwd, project: options.project };
  const record = recordOf(context);
  const projectDir = path.join(options.cwd, '.pi');
  const scope = options.project ? projectDir : options.agentDir;
  const state = stateOf(context);
  directory(state);
  if (fs.statSync(state).uid !== process.getuid?.() || (fs.statSync(state).mode & 0o022)) reject('UNSAFE_CONFIG', 'Setup state must be owned by you and not writable by others.');
  const release = acquire(path.join(state, 'setup.lock'));
  const locks: (() => void)[] = [];
  const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'slopsentral-native-'));
  try {
    const previous = record;
    if (fs.existsSync(previous) && trustedRecord(context, false).transaction.status === 'pending') reject('RECOVERY_REQUIRED', 'Run the installer with --rollback.');
    const targets = [...new Set([path.join(options.agentDir, 'settings.json'), path.join(projectDir, 'settings.json')])];
    for (const file of targets.filter(file => fs.existsSync(file) || file === path.join(scope, 'settings.json')).sort()) locks.push(acquire(file + '.lock'));
    const originals = targets.map(file => ({ file, ...settings(file) }));
    const pkg = unpack(qualified.archive, temporary);
    same(parse(fs.readFileSync(path.join(pkg, 'package.json'))).version, qualified.version, 'Archive version differs.');
    const destination = path.join(state, 'packages', qualified.version);
    const instruction = fs.readFileSync(path.join(pkg, 'AGENTS.md'), 'utf8');
    const files: Snapshot[] = originals.map(saved => {
      const value = narrowed(saved.value, path.dirname(saved.file));
      if (saved.file === path.join(scope, 'settings.json')) value.packages = [...(value.packages === undefined ? [] : list(value.packages)), destination];
      const changed = JSON.stringify(value) !== JSON.stringify(saved.value);
      return { path: saved.file, before: encode(saved.bytes), after: changed ? encode(jsonBytes(value)) : encode(saved.bytes), mode: saved.mode };
    });
    const selectedInstruction = options.project ? path.join(options.cwd, 'AGENTS.md') : path.join(options.agentDir, 'AGENTS.md');
    for (const instructionPath of [...new Set([path.join(options.cwd, 'AGENTS.md'), path.join(options.agentDir, 'AGENTS.md')])]) {
      const instructions = snapshot(instructionPath), original = instructions.bytes?.toString('utf8') ?? '';
      const selected = instructionPath === selectedInstruction;
      if (selected && instruction && (fs.existsSync(path.join(path.dirname(instructionPath), 'AGENTS.override.md')) || instructions.bytes === null && ['AGENTS.MD', 'CLAUDE.md', 'CLAUDE.MD'].some(name => fs.existsSync(path.join(path.dirname(instructionPath), name))))) reject('INSTRUCTION_SCOPE_CONFLICT', 'An alternate native context file owns this scope.');
      if (!selected && instruction && original.includes(instruction.trim()) && !original.includes('<!-- slopsentral:begin -->')) reject('INSTRUCTION_SCOPE_CONFLICT', 'The instruction already has an unmanaged owner in another scope.');
      const updated = selected && instruction && original.includes(instruction.trim()) && !original.includes('<!-- slopsentral:begin -->') ? original : ownedInstruction(original, selected ? instruction : '');
      files.push({ path: instructionPath, before: encode(instructions.bytes), after: updated === original ? encode(instructions.bytes) : encode(Buffer.from(updated)), mode: instructions.mode });
    }
    files.push(...legacyFiles(context));
    const changes = files.filter(item => item.before !== item.after);
    if (!fs.existsSync(destination)) {
      directory(path.dirname(destination));
      const staging = fs.mkdtempSync(path.join(path.dirname(destination), '.staging-'));
      const staged = path.join(staging, 'package');
      try {
        if (options.stage) options.stage(pkg, staged);
        else fs.cpSync(pkg, staged, { recursive: true, errorOnExist: true, force: false });
        const expected = tree(pkg), actual = tree(staged);
        if (expected.size !== actual.size || [...expected].some(([name, value]) => actual.get(name) !== value)) reject('STAGING_FAILED', 'Staged package differs.');
        // The private setup lock serializes publication; a complete version is never copied over.
        if (fs.existsSync(destination)) reject('CONFIG_CHANGED', 'Package destination appeared during staging.');
        fs.renameSync(staged, destination);
      } finally { fs.rmSync(staging, { recursive: true, force: true }); }
    } else {
      // A version never replaces bytes. A damaged installation is an explicit recovery case.
      const expected = tree(pkg), actual = tree(destination);
      if (expected.size !== actual.size || [...expected].some(([name, value]) => actual.get(name) !== value)) reject('INSTALLED_BYTES_CHANGED', 'The existing version differs; preserve it and use recovery.');
    }
    atomic(path.join(state, 'setup-pi.mts'), fs.readFileSync(self), 0o600);
    atomic(path.join(state, 'setup.json'), qualified.setup, 0o600);
    if (!changes.length) return { status: 'CURRENT', version: qualified.version, state };
    options.beforeCommit?.();
    for (const item of changes) if (!matches(item, item.before)) reject('CONFIG_CHANGED', 'Configuration changed during setup: ' + item.path);
    if (fs.existsSync(previous)) { const history = path.join(path.dirname(previous), 'history'); directory(history); fs.copyFileSync(previous, path.join(history, crypto.randomUUID() + '.json')); }
    const transaction: Transaction = { schemaVersion: 1, status: 'pending', version: qualified.version, scope: context, files: changes };
    saveTransaction(context, transaction);
    try {
      for (const item of changes) { if (!matches(item, item.before)) reject('CONFIG_CHANGED', 'Configuration changed during commit.'); (options.write ?? atomic)(item.path, item.after === null ? null : Buffer.from(item.after, 'base64'), item.mode); }
      saveTransaction(context, { ...transaction, status: 'applied' });
    } catch (error) { restore(context); throw error; }
    return { status: 'INSTALLED', version: qualified.version, state };
  } finally { fs.rmSync(temporary, { recursive: true, force: true }); for (const unlock of locks.reverse()) unlock(); release(); }
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  if (args.includes('--help')) { console.log('Slopsentral native Pi setup\nUsage: install-pi.sh [--project] [--version 0.1.N] [--rollback]\nGlobal by default; migrates Slopsentral registrations in personal and current-project scope.\nDocumentation: https://slopsentral.michne.com/guides/pi'); return; }
  let version: string | undefined;
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--version') { version = args[++i]; if (!version) reject('INVALID_INVOCATION', 'Missing version.'); }
    else if (!['--project', '--rollback'].includes(args[i]!)) reject('INVALID_INVOCATION', 'Unknown argument: ' + args[i]);
  }
  const agentDir = path.resolve(process.env.PI_CODING_AGENT_DIR ?? path.join(os.homedir(), '.pi/agent'));
  const cwd = fs.realpathSync(process.cwd());
  const project = args.includes('--project');
  if (args.includes('--rollback')) { await qualify(live, version); rollback({ agentDir, cwd, project }); console.log('RESTORED: prior configuration. Restart Pi.'); return; }
  if (!['darwin', 'linux'].includes(process.platform)) reject('UNSUPPORTED_PLATFORM', 'Use macOS or Linux.');
  const pi = spawnSync('pi', ['--version'], { encoding: 'utf8', timeout: 10000 });
  if (pi.status !== 0) reject('PI_UNAVAILABLE', 'Ensure pi --version succeeds within 10 seconds; see https://slopsentral.michne.com/guides/pi.');
  // A version string cannot prove native package or skill discovery support.
  console.error('PI_COMPATIBILITY_UNVERIFIED: using installed Pi best-effort. Restart Pi after setup and verify native skill discovery.');
  const result = await install(await qualify(live, version), { agentDir, cwd, project });
  console.log(result.status + ': Slopsentral ' + result.version + '. Restart Pi for native discovery.');
  console.log('Recovery: rerun the documented installer in this directory with' + (project ? ' --project' : '') + ' --rollback.');
}
if (process.argv[1] && path.resolve(process.argv[1]) === self) main().catch(error => { console.error(error instanceof Error ? error.message : 'SETUP_FAILED'); process.exitCode = 1; });
