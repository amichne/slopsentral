#!/usr/bin/env node
// Compatibility entry point for callers of the synchronous JavaScript API.
import {spawnSync} from 'node:child_process';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const executable = fileURLToPath(new URL('./project_marketplaces.py', import.meta.url));

export function project({source, harness, out, pkl}) {
  const args = ['--source', source ?? '', '--harness', harness ?? '', '--out', out ?? ''];
  if (pkl !== undefined) args.push('--pkl-bin', pkl);
  const result = spawnSync('python3', [executable, ...args], {encoding:'utf8'});
  if (result.error) throw result.error;
  if (result.status !== 0) {
    const outcome = JSON.parse(result.stderr);
    throw Object.assign(new Error(outcome.message), {outcome});
  }
  return JSON.parse(result.stdout);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const result = spawnSync('python3', [executable, ...process.argv.slice(2)], {stdio:'inherit'});
  process.exitCode = result.status ?? 1;
}
