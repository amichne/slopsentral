#!/usr/bin/env node
// Explicit setup boundary. Projection itself never downloads a runtime.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
const lock = JSON.parse(fs.readFileSync(new URL('./projection/pkl-runtime.json', import.meta.url)));
export async function install({ out, platform = process.platform + '-' + process.arch, download = fetch }) {
  const asset = lock.assets[platform];
  if (!asset) return { type: 'PKL_INSTALL_REJECTED', reason: 'UNSUPPORTED_PLATFORM' };
  if (!out || fs.lstatSync(out, { throwIfNoEntry: false })) return { type: 'PKL_INSTALL_REJECTED', reason: 'INVALID_DESTINATION' };
  const response = await download(`https://github.com/${lock.repository}/releases/download/${lock.version}/${asset.name}`, { signal: AbortSignal.timeout(120000) });
  if (!response.ok) return { type: 'PKL_INSTALL_REJECTED', reason: 'DOWNLOAD_FAILED' };
  const bytes = Buffer.from(await response.arrayBuffer());
  if (crypto.createHash('sha256').update(bytes).digest('hex') !== asset.sha256) return { type: 'PKL_INSTALL_REJECTED', reason: 'DIGEST_MISMATCH' };
  fs.mkdirSync(path.dirname(path.resolve(out)), { recursive: true });
  const stage = fs.mkdtempSync(path.join(path.dirname(path.resolve(out)), '.projection-pkl-'));
  try {
    const binary = path.join(stage, 'pkl');
    fs.writeFileSync(binary, bytes, { mode: 0o755 });
    fs.chmodSync(binary, 0o755);
    // A hard link publishes complete bytes and atomically rejects existing paths.
    fs.linkSync(binary, out);
  } finally { fs.rmSync(stage, { recursive: true }); }
  return { type: 'PKL_INSTALLED', version: lock.version, sha256: asset.sha256, out: path.resolve(out) };
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const args = process.argv.slice(2);
    const result = args.length === 2 && args[0] === '--out'
      ? await install({ out: args[1] }) : { type: 'PKL_INSTALL_REJECTED', reason: 'INVALID_INVOCATION' };
    console.log(JSON.stringify(result));
    if (result.type !== 'PKL_INSTALLED') process.exitCode = 1;
  } catch {
    console.error(JSON.stringify({ type: 'PKL_INSTALL_REJECTED', reason: 'EFFECT_FAILED' }));
    process.exitCode = 1;
  }
}
