import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdtemp, readdir, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, relative } from "node:path";
import { promisify } from "node:util";

export const SUPPORTED_CODEX_VERSION = "codex-cli 0.149.1";
export const QUALIFICATION_FILE = "qualification.json";

const execute = promisify(execFile);

const filesUnder = async (root, current = root) => {
  const entries = await readdir(current, { withFileTypes: true });
  const nested = await Promise.all(
    entries.map(async (entry) => {
      const path = join(current, entry.name);
      return entry.isDirectory() ? filesUnder(root, path) : [path];
    }),
  );
  return nested.flat().sort((left, right) => left.localeCompare(right));
};

export const protocolTreeDigest = async (root) => {
  const digest = createHash("sha256");
  const files = (await filesUnder(root)).filter(
    (file) => relative(root, file) !== QUALIFICATION_FILE,
  );
  for (const file of files) {
    digest.update(relative(root, file));
    digest.update("\0");
    digest.update(await readFile(file));
    digest.update("\0");
  }
  return {
    digest: `sha256:${digest.digest("hex")}`,
    files,
  };
};

export const installedCodexVersion = async () =>
  (await execute("codex", ["--version"], { encoding: "utf8" })).stdout.trim();

export const generateProtocolTree = async (destination) => {
  const version = await installedCodexVersion();
  if (version !== SUPPORTED_CODEX_VERSION) {
    throw new Error(
      `Unsupported Codex version: expected ${SUPPORTED_CODEX_VERSION}, received ${version}`,
    );
  }
  await execute(
    "codex",
    [
      "app-server",
      "generate-ts",
      "--experimental",
      "--out",
      join(destination, "typescript"),
    ],
    { encoding: "utf8", maxBuffer: 16 * 1024 * 1024 },
  );
  await execute(
    "codex",
    [
      "app-server",
      "generate-json-schema",
      "--experimental",
      "--out",
      join(destination, "schema"),
    ],
    { encoding: "utf8", maxBuffer: 16 * 1024 * 1024 },
  );
};

export const generateTemporaryProtocolTree = async () => {
  const directory = await mkdtemp(join(tmpdir(), "broker-protocol-"));
  await generateProtocolTree(directory);
  return directory;
};
