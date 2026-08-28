import { mkdir, rename, rm, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import {
  generateTemporaryProtocolTree,
  protocolTreeDigest,
  QUALIFICATION_FILE,
  SUPPORTED_CODEX_VERSION,
} from "./protocol-artifacts.mjs";

const packageRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const destination = join(
  packageRoot,
  "generated",
  "protocol",
  SUPPORTED_CODEX_VERSION.replace(" ", "-"),
);
const temporary = await generateTemporaryProtocolTree();
const { digest, files } = await protocolTreeDigest(temporary);
const qualification = {
  codexVersion: SUPPORTED_CODEX_VERSION,
  experimental: true,
  protocolDigest: digest,
  schemaFileCount: files.filter((file) => file.includes("/schema/")).length,
  typescriptFileCount: files.filter((file) => file.includes("/typescript/"))
    .length,
};
await writeFile(
  join(temporary, QUALIFICATION_FILE),
  `${JSON.stringify(qualification, null, 2)}\n`,
  "utf8",
);
await mkdir(dirname(destination), { recursive: true });
await rm(destination, { force: true, recursive: true });
await rename(temporary, destination);
process.stdout.write(`${JSON.stringify(qualification)}\n`);
