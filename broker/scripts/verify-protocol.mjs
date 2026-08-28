import { readFile, rm } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import {
  generateTemporaryProtocolTree,
  protocolTreeDigest,
  QUALIFICATION_FILE,
  SUPPORTED_CODEX_VERSION,
} from "./protocol-artifacts.mjs";

const packageRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const qualifiedRoot = join(
  packageRoot,
  "generated",
  "protocol",
  SUPPORTED_CODEX_VERSION.replace(" ", "-"),
);
let qualification;
try {
  qualification = JSON.parse(
    await readFile(join(qualifiedRoot, QUALIFICATION_FILE), "utf8"),
  );
} catch {
  throw new Error(`Protocol qualification is missing at ${qualifiedRoot}`);
}
if (
  typeof qualification !== "object" ||
  qualification === null ||
  qualification.codexVersion !== SUPPORTED_CODEX_VERSION ||
  typeof qualification.protocolDigest !== "string"
) {
  throw new Error("Protocol qualification has an invalid contract.");
}

const temporary = await generateTemporaryProtocolTree();
try {
  const checkedIn = await protocolTreeDigest(qualifiedRoot);
  const generated = await protocolTreeDigest(temporary);
  if (checkedIn.digest !== qualification.protocolDigest) {
    throw new Error(
      `Checked-in protocol digest ${checkedIn.digest} does not match qualification ${qualification.protocolDigest}.`,
    );
  }
  if (generated.digest !== qualification.protocolDigest) {
    throw new Error(
      `Installed Codex generated ${generated.digest}; expected ${qualification.protocolDigest}.`,
    );
  }
  process.stdout.write(`${qualification.protocolDigest}\n`);
} finally {
  await rm(temporary, { force: true, recursive: true });
}
