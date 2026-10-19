#!/bin/sh
# Bootstrap the exact tested installer from a stable qualified GitHub release.
set -eu
if [ "${1-}" = --help ]; then
  printf '%s\n' 'Slopsentral native Pi setup' \
    'Usage: install-pi.sh [--project] [--version 0.1.N] [--rollback]' \
    'Global by default. Migrates Slopsentral registrations in personal and current-project scope.' \
    'Documentation: https://slopsentral.michne.com/guides/pi'
  exit 0
fi
case "$(uname -s)" in Darwin|Linux) ;; *) printf '%s\n' 'UNSUPPORTED_PLATFORM: use macOS or Linux.' >&2; exit 2 ;; esac
command -v node >/dev/null 2>&1 || { printf '%s\n' 'NODE_UNAVAILABLE: Pi setup requires Node.js 22.19 or later.' >&2; exit 2; }
node -e 'const [major, minor] = process.versions.node.split(".").map(Number); process.exit(major > 22 || major === 22 && minor >= 19 ? 0 : 1)' || { printf '%s\n' 'NODE_UNSUPPORTED: use Node.js 22.19 or later.' >&2; exit 2; }
rollback=no
for argument in "$@"; do [ "$argument" != --rollback ] || rollback=yes; done
if [ "$rollback" = no ]; then
  command -v pi >/dev/null 2>&1 || { printf '%s\n' 'PI_UNAVAILABLE: install Pi 1.3.0; see https://slopsentral.michne.com/guides/pi.' >&2; exit 2; }
  command -v tar >/dev/null 2>&1 || { printf '%s\n' 'TAR_UNAVAILABLE: install the system tar utility.' >&2; exit 2; }
fi
node --input-type=module - "$@" <<'BOOTSTRAP'
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';
const args = process.argv.slice(2);
let version;
try {
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--version') { version = args[++i]; if (!/^0\.1\.[1-9][0-9]*$/.test(version ?? '')) throw Error('INVALID_VERSION: use a published 0.1.N version.'); }
    else if (!['--project', '--rollback'].includes(args[i])) throw Error('INVALID_INVOCATION: unknown argument ' + args[i]);
  }
  const repository = 'amichne/slopsentral';
  async function get(url) {
    const response = await fetch(url, { signal: AbortSignal.timeout(30000), headers: { 'User-Agent': 'slopsentral-setup' } });
    if (!response.ok) throw Error('DOWNLOAD_FAILED: HTTP ' + response.status);
    if (Number(response.headers.get('content-length')) > 2 * 1024 * 1024) throw Error('DOWNLOAD_FAILED: bootstrap response too large.');
    const bytes = Buffer.from(await response.arrayBuffer());
    if (bytes.length > 2 * 1024 * 1024) throw Error('DOWNLOAD_FAILED: bootstrap response too large.');
    return bytes;
  }
  const release = JSON.parse((await get('https://api.github.com/repos/' + repository + (version ? '/releases/tags/slopsentral-v' + version : '/releases/latest'))).toString());
  if (!/^slopsentral-v0\.1\.[1-9][0-9]*$/.test(release.tag_name) || release.draft !== false || release.prerelease !== false) throw Error('INVALID_RELEASE: stable native setup release required.');
  const matches = release.assets.filter(item => item.name === 'setup-pi.mts');
  if (matches.length !== 1) throw Error('INVALID_RELEASE: current release has no native installer. Configuration was not changed.');
  const asset = matches[0];
  const url = 'https://github.com/' + repository + '/releases/download/' + release.tag_name + '/setup-pi.mts';
  if (asset.browser_download_url !== url) throw Error('INVALID_ORIGIN: foreign installer source.');
  const bytes = await get(url);
  if (asset.size !== bytes.length || asset.digest !== 'sha256:' + crypto.createHash('sha256').update(bytes).digest('hex')) throw Error('CHECKSUM_MISMATCH: installer bytes differ.');
  const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'slopsentral-bootstrap-'));
  try {
    const file = path.join(temporary, 'setup-pi.mts');
    fs.writeFileSync(file, bytes, { mode: 0o600 });
    const result = spawnSync(process.execPath, [file, ...args, ...(version ? [] : ['--version', release.tag_name.slice('slopsentral-v'.length)])], { stdio: 'inherit' });
    process.exitCode = result.status ?? 1;
  } finally { fs.rmSync(temporary, { recursive: true, force: true }); }
} catch (error) { console.error(error instanceof Error ? error.message : 'SETUP_FAILED'); process.exitCode = 1; }
BOOTSTRAP
