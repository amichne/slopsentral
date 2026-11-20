#!/usr/bin/env node
// One owner for this checkout's external tools: tools/toolchain.json pins each
// version and per-platform SHA-256. Node is the bootstrap because npm already
// requires it; uv, Pkl, Vale, and CI-only tools resolve here instead of through
// a shell-activated version manager or the user's global PATH.
//
//   node tools/toolchain.mjs fetch [--profile core|ci] [NAME...]   download and verify
//   node tools/toolchain.mjs run [--profile core|ci] -- CMD [ARGS]  run with pinned tools first
//   node tools/toolchain.mjs path NAME                            print a fetched executable
//   node tools/toolchain.mjs env|paths [--profile core|ci]        GitHub Actions env and path lines
import { spawnSync } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const manifestPath = path.join(root, 'tools/toolchain.json');
const FORMATS = new Set(['binary', 'tar.gz', 'tar.xz', 'zip']);

export class ToolchainError extends Error {
  constructor(reason, detail = '') {
    super(`${reason}${detail ? `: ${detail}` : ''}`);
    this.reason = reason;
    this.detail = detail;
  }
}

/** Parse the manifest once into checked tool records. */
export function loadManifest(text = fs.readFileSync(manifestPath, 'utf8')) {
  const document = JSON.parse(text);
  if (document?.schemaVersion !== 1 || typeof document.tools !== 'object') throw new ToolchainError('INVALID_MANIFEST');
  for (const [name, tool] of Object.entries(document.tools)) {
    if (!/^[a-z][a-z0-9-]*$/.test(name) || typeof tool.version !== 'string' || !Array.isArray(tool.profiles)) {
      throw new ToolchainError('INVALID_MANIFEST', name);
    }
    for (const [platform, asset] of Object.entries(tool.assets ?? {})) {
      const valid = /^https:\/\/github\.com\//.test(asset.url) && /^[0-9a-f]{64}$/.test(asset.sha256)
        && FORMATS.has(asset.format) && typeof asset.executable === 'string'
        && !asset.executable.split('/').includes('..') && !path.isAbsolute(asset.executable);
      if (!valid) throw new ToolchainError('INVALID_MANIFEST', `${name}/${platform}`);
    }
  }
  return document;
}

export function currentPlatform() {
  return `${process.platform}-${process.arch}`;
}

export function cacheRoot(env = process.env) {
  if (env.SLOPSENTRAL_TOOLCHAIN_CACHE) return path.resolve(env.SLOPSENTRAL_TOOLCHAIN_CACHE);
  const base = env.XDG_CACHE_HOME ? path.resolve(env.XDG_CACHE_HOME) : path.join(os.homedir(), '.cache');
  return path.join(base, 'slopsentral/toolchain');
}

function selectAsset(manifest, name, platform) {
  const tool = manifest.tools[name];
  if (!tool) throw new ToolchainError('UNKNOWN_TOOL', name);
  const asset = tool.assets[platform] ?? tool.assets.any;
  if (!asset) throw new ToolchainError('UNSUPPORTED_PLATFORM', `${name} on ${platform}`);
  return { tool, asset };
}

/** The content-addressed directory for one verified asset. */
export function entryFor(manifest, name, { platform = currentPlatform(), env = process.env } = {}) {
  const { tool, asset } = selectAsset(manifest, name, platform);
  const directory = path.join(cacheRoot(env), `${name}-${tool.version}-${asset.sha256.slice(0, 16)}`);
  return {
    name, tool, asset, directory,
    archive: path.join(directory, path.basename(new URL(asset.url).pathname)),
    executable: path.join(directory, 'root', asset.executable),
    complete: path.join(directory, '.complete'),
  };
}

export function profileTools(manifest, profile, platform = currentPlatform()) {
  return Object.entries(manifest.tools)
    .filter(([, tool]) => tool.profiles.includes(profile) && (tool.assets[platform] || tool.assets.any))
    .map(([name]) => name);
}

function extract(format, archive, destination) {
  fs.mkdirSync(destination, { recursive: true });
  const command = { 'tar.gz': ['tar', ['-xzf', archive, '-C', destination]],
    'tar.xz': ['tar', ['-xJf', archive, '-C', destination]],
    zip: ['unzip', ['-q', archive, '-d', destination]] }[format];
  const result = spawnSync(command[0], command[1], { encoding: 'utf8' });
  if (result.status !== 0) throw new ToolchainError('EXTRACT_FAILED', `${command[0]}: ${result.stderr || result.error}`);
}

async function defaultDownload(url) {
  const response = await fetch(url, { signal: AbortSignal.timeout(300000) });
  if (!response.ok) throw new ToolchainError('DOWNLOAD_FAILED', `${url}: ${response.status}`);
  return Buffer.from(await response.arrayBuffer());
}

/** Download, verify, and publish one tool. Reuses a complete entry without network access. */
export async function fetchTool(manifest, name, { platform = currentPlatform(), env = process.env, download = defaultDownload } = {}) {
  const entry = entryFor(manifest, name, { platform, env });
  if (fs.existsSync(entry.complete) && fs.existsSync(entry.executable)) return entry;
  const bytes = await download(entry.asset.url);
  const digest = crypto.createHash('sha256').update(bytes).digest('hex');
  if (digest !== entry.asset.sha256) throw new ToolchainError('DIGEST_MISMATCH', `${name}: ${digest}`);
  fs.mkdirSync(path.dirname(entry.directory), { recursive: true });
  const stage = fs.mkdtempSync(path.join(path.dirname(entry.directory), `.${name}-`));
  try {
    const archive = path.join(stage, path.basename(entry.archive));
    fs.writeFileSync(archive, bytes);
    const rootDirectory = path.join(stage, 'root');
    if (entry.asset.format === 'binary') {
      fs.mkdirSync(rootDirectory);
      fs.copyFileSync(archive, path.join(rootDirectory, entry.asset.executable));
    } else extract(entry.asset.format, archive, rootDirectory);
    const executable = path.join(rootDirectory, entry.asset.executable);
    if (!fs.existsSync(executable)) throw new ToolchainError('EXECUTABLE_MISSING', `${name}: ${entry.asset.executable}`);
    for (const file of fs.readdirSync(path.dirname(executable))) {
      const candidate = path.join(path.dirname(executable), file);
      if (fs.statSync(candidate).isFile()) fs.chmodSync(candidate, fs.statSync(candidate).mode | 0o755);
    }
    fs.writeFileSync(path.join(stage, '.complete'), JSON.stringify({ name, version: entry.tool.version, sha256: digest }) + '\n');
    try { fs.renameSync(stage, entry.directory); }
    catch (error) {
      // A concurrent fetch may have published the same verified bytes first.
      if (!fs.existsSync(entry.complete)) throw error;
    }
  } finally { fs.rmSync(stage, { recursive: true, force: true }); }
  return entry;
}

/** Environment for a child process: pinned tools first on PATH; explicit overrides win. */
export function toolEnvironment(manifest, names, { platform = currentPlatform(), env = process.env } = {}) {
  const result = { ...env };
  const directories = [];
  for (const name of names) {
    const entry = entryFor(manifest, name, { platform, env });
    if (!fs.existsSync(entry.complete)) throw new ToolchainError('NOT_FETCHED', `${name}; run node tools/toolchain.mjs fetch`);
    directories.push(path.dirname(entry.executable));
    if (entry.tool.environment && !env[entry.tool.environment]) result[entry.tool.environment] = entry.executable;
    if (entry.tool.archiveEnvironment && !env[entry.tool.archiveEnvironment]) result[entry.tool.archiveEnvironment] = entry.archive;
  }
  result.PATH = [path.join(root, 'bin'), ...directories, env.PATH ?? ''].join(path.delimiter);
  return { env: result, directories };
}

function parse(argv) {
  const [command, ...rest] = argv;
  const separator = rest.indexOf('--');
  const options = separator < 0 ? rest : rest.slice(0, separator);
  const child = separator < 0 ? [] : rest.slice(separator + 1);
  let profile = 'core';
  const names = [];
  for (let index = 0; index < options.length; index += 1) {
    if (options[index] === '--profile') profile = options[++index];
    else names.push(options[index]);
  }
  if (!['core', 'ci'].includes(profile)) throw new ToolchainError('INVALID_INVOCATION', `profile ${profile}`);
  return { command, profile, names, child };
}

async function main(argv) {
  const { command, profile, names, child } = parse(argv);
  const manifest = loadManifest();
  const selected = names.length ? names : profileTools(manifest, profile);
  switch (command) {
    case 'fetch':
      for (const name of selected) {
        const entry = await fetchTool(manifest, name);
        console.log(JSON.stringify({ type: 'TOOL_READY', name, version: entry.tool.version, executable: entry.executable }));
      }
      return 0;
    case 'run': {
      if (!child.length) throw new ToolchainError('INVALID_INVOCATION', 'run needs a command after --');
      for (const name of selected) await fetchTool(manifest, name);
      const { env } = toolEnvironment(manifest, selected);
      const result = spawnSync(child[0], child.slice(1), { stdio: 'inherit', env });
      if (result.error) throw new ToolchainError('COMMAND_FAILED', `${child[0]}: ${result.error.message}`);
      return result.status ?? 1;
    }
    case 'path':
      if (names.length !== 1) throw new ToolchainError('INVALID_INVOCATION', 'path needs one tool');
      if (!fs.existsSync(entryFor(manifest, names[0]).complete)) throw new ToolchainError('NOT_FETCHED', names[0]);
      console.log(entryFor(manifest, names[0]).executable);
      return 0;
    case 'env': {
      const { env } = toolEnvironment(manifest, selected, { env: {} });
      for (const [key, value] of Object.entries(env)) if (key !== 'PATH') console.log(`${key}=${value}`);
      return 0;
    }
    case 'paths':
      console.log([path.join(root, 'bin'), ...toolEnvironment(manifest, selected, { env: {} }).directories].join('\n'));
      return 0;
    default:
      throw new ToolchainError('INVALID_INVOCATION', 'use fetch, run, path, env, or paths');
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { process.exitCode = await main(process.argv.slice(2)); }
  catch (error) {
    if (!(error instanceof ToolchainError)) throw error;
    console.error(JSON.stringify({ type: 'TOOLCHAIN_REJECTED', reason: error.reason, detail: error.detail }));
    process.exitCode = ['NOT_FETCHED', 'UNSUPPORTED_PLATFORM', 'DOWNLOAD_FAILED'].includes(error.reason) ? 69 : 2;
  }
}
