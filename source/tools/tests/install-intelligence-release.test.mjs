import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";

const repoRoot = path.resolve(import.meta.dirname, "../../..");
const installer = path.join(repoRoot, "source/tools/install-intelligence-release");

function writeExecutable(file, contents) {
  fs.writeFileSync(file, contents, { mode: 0o755 });
}

function sandbox(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "install-intelligence-release-test-"));
  const bin = path.join(root, "bin");
  fs.mkdirSync(bin);
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));

  writeExecutable(
    path.join(bin, "gh"),
    `#!/bin/sh
set -eu
printf '%s\\n' "$@" > "$FAKE_GH_ARGS"
destination=
while [ "$#" -gt 0 ]; do
  case "$1" in
    --dir)
      destination=$2
      shift 2
      ;;
    *)
      shift
      ;;
  esac
done
archive="intelligence-$FAKE_VERSION-$FAKE_PLATFORM.tar.gz"
mkdir -p "$destination"
: > "$destination/$archive"
printf 'fake-checksum  %s\\n' "$archive" > "$destination/SHA256SUMS"
`,
  );
  writeExecutable(
    path.join(bin, "sha256sum"),
    `#!/bin/sh
set -eu
input=$(sed -n '1p')
printf '%s\\n' "$input" > "$FAKE_SHA_INPUT"
printf '%s: OK\\n' "$FAKE_ARCHIVE"
`,
  );
  writeExecutable(
    path.join(bin, "tar"),
    `#!/bin/sh
set -eu
destination=
while [ "$#" -gt 0 ]; do
  case "$1" in
    -C)
      destination=$2
      shift 2
      ;;
    *)
      shift
      ;;
  esac
done
mkdir -p "$destination"
printf '%s\\n' '#!/bin/sh' 'printf "intelligence version %s\\n" "$FAKE_VERSION"' > "$destination/intelligence"
`,
  );

  return {
    root,
    bin,
    ghArgs: path.join(root, "gh-args"),
    shaInput: path.join(root, "sha-input"),
  };
}

function run(context, version = "v0.2.3", platform = "linux-x64", destination = "install") {
  const installDirectory = path.join(context.root, destination);
  const archive = `intelligence-${version}-${platform}.tar.gz`;
  return {
    installDirectory,
    result: spawnSync(installer, [version, platform, installDirectory], {
      cwd: repoRoot,
      encoding: "utf8",
      env: {
        ...process.env,
        PATH: `${context.bin}:${process.env.PATH}`,
        TMPDIR: context.root,
        FAKE_VERSION: version,
        FAKE_PLATFORM: platform,
        FAKE_ARCHIVE: archive,
        FAKE_GH_ARGS: context.ghArgs,
        FAKE_SHA_INPUT: context.shaInput,
      },
    }),
  };
}

function diagnostic(result) {
  return result.stdout || result.stderr || result.error?.message || "installer failed without diagnostics";
}

test("downloads one exact asset, verifies it, and reports the installed contract", (t) => {
  const context = sandbox(t);
  const { installDirectory, result } = run(context);

  assert.equal(result.status, 0, diagnostic(result));
  assert.match(result.stdout, /version: v0\.2\.3/);
  assert.match(result.stdout, /platform: linux-x64/);
  assert.ok(fs.existsSync(path.join(installDirectory, "intelligence")));
  assert.match(fs.readFileSync(context.ghArgs, "utf8"), /^release\ndownload\nv0\.2\.3\n/);
  assert.match(fs.readFileSync(context.ghArgs, "utf8"), /intelligence-v0\.2\.3-linux-x64\.tar\.gz/);
  assert.equal(
    fs.readFileSync(context.shaInput, "utf8"),
    "fake-checksum  intelligence-v0.2.3-linux-x64.tar.gz\n",
  );
});

test("rejects a non-semver release tag before invoking GitHub", (t) => {
  const context = sandbox(t);
  const { result } = run(context, "latest");

  assert.equal(result.status, 2);
  assert.match(result.stdout, /error: invalid release version/);
  assert.equal(fs.existsSync(context.ghArgs), false);
});

test("rejects an unsupported platform before invoking GitHub", (t) => {
  const context = sandbox(t);
  const { result } = run(context, "v0.2.3", "windows-x64");

  assert.equal(result.status, 2);
  assert.match(result.stdout, /error: unsupported release platform/);
  assert.equal(fs.existsSync(context.ghArgs), false);
});

test("refuses to merge a release into an existing directory", (t) => {
  const context = sandbox(t);
  fs.mkdirSync(path.join(context.root, "install"));
  const { result } = run(context);

  assert.equal(result.status, 1);
  assert.match(result.stdout, /error: install directory already exists/);
  assert.equal(fs.existsSync(context.ghArgs), false);
});
