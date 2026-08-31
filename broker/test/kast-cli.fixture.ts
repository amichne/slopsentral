#!/usr/bin/env -S node --import tsx

import { compatibleKastSchema } from "./kast-schema.fixture.ts";

const command = process.argv[2];

switch (command) {
  case "--version":
    process.stdout.write("kast 999.42.7 (IDE-hosted)\n");
    break;
  case "--schema":
    process.stdout.write(`${JSON.stringify(compatibleKastSchema())}\n`);
    break;
  default:
    process.stderr.write(
      `${JSON.stringify({ code: "UNSUPPORTED_KAST_FIXTURE_COMMAND" })}\n`,
    );
    process.exitCode = 2;
}
