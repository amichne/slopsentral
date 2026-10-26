#!/bin/sh
# Bootstrap the exact tested installer from a stable qualified GitHub release.
set -eu
if [ "${1-}" = --help ]; then
  printf '%s\n' 'Slopsentral native Pi setup' \
    'Usage: install-pi.sh [--project] [--version X.Y.Z] [--rollback]' \
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
  command -v pi >/dev/null 2>&1 || { printf '%s\n' 'PI_UNAVAILABLE: install Pi and ensure pi is on PATH; see https://slopsentral.michne.com/guides/pi.' >&2; exit 2; }
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
const releaseVersion = /^(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)$/;
try {
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--version') { version = args[++i]; if (!releaseVersion.test(version ?? '')) throw Error('INVALID_VERSION: use a published X.Y.Z version.'); }
    else if (!['--project', '--rollback'].includes(args[i])) throw Error('INVALID_INVOCATION: unknown argument ' + args[i]);
  }
  const repository = 'amichne/slopsentral';
  async function get(url) {
    const maxBytes = 2 * 1024 * 1024;
    const token = new URL(url).origin === 'https://api.github.com' ? process.env.GH_TOKEN || process.env.GITHUB_TOKEN : undefined;
    if (token && !/^[A-Za-z0-9_.-]+$/.test(token)) throw Error('INVALID_CREDENTIAL: GitHub token contains unsupported characters.');
    const result = spawnSync('curl', ['--fail', '--silent', '--show-error',
      '--no-insecure', '--no-proxy-insecure', '--no-location-trusted', '--location',
      '--proto', '=https', '--proto-redir', '=https', '--max-time', '30',
      '--max-filesize', String(maxBytes), '--user-agent', 'slopsentral-setup',
      '--write-out', '\n%{http_code}', ...(token ? ['--header', '@-'] : []), url],
      { maxBuffer: maxBytes + 4, timeout: 35000, input: token ? 'Authorization: Bearer ' + token + '\n' : '' });
    const host = new URL(url).hostname;
    if (result.error) throw Error('DOWNLOAD_FAILED: curl could not complete the request to ' + host + '. Examine curl availability and response size.');
    const status = result.stdout.subarray(-3).toString();
    if (result.status !== 0) throw Error('DOWNLOAD_FAILED: ' + (result.status === 22 ? 'HTTP ' + status : 'curl exit ' + result.status) + ' from ' + host + '. Examine curl proxy and certificate settings. For GitHub API limits, supply GH_TOKEN or GITHUB_TOKEN.');
    const bytes = result.stdout.subarray(0, -4);
    if (bytes.length > maxBytes) throw Error('DOWNLOAD_FAILED: bootstrap response too large.');
    return bytes;
  }
  const release = JSON.parse((await get('https://api.github.com/repos/' + repository + (version ? '/releases/tags/slopsentral-v' + version : '/releases/latest'))).toString());
  if (typeof release.tag_name !== 'string' || !release.tag_name.startsWith('slopsentral-v') || !releaseVersion.test(release.tag_name.slice('slopsentral-v'.length)) || release.draft !== false || release.prerelease !== false) throw Error('INVALID_RELEASE: stable native setup release required.');
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
