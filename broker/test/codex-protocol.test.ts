import assert from "node:assert/strict";
import { chmod, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, test } from "node:test";

import { qualifyCodexProtocol } from "../src/runtime/codex-protocol.ts";
import { compatibleProtocolSchemas } from "./protocol-schema.fixture.ts";

describe("Codex protocol qualification", () => {
  test("accepts an arbitrary CLI version that emits the owned schemas", async () => {
    const fixture = await fakeCodex("codex-cli 999.42.7");
    try {
      const qualified = await qualifyCodexProtocol({
        codexExecutable: fixture.executable,
        codexHome: join(fixture.directory, "codex-home"),
        maximumSchemaBytes: 1024 * 1024,
        maximumSchemaFiles: 64,
        timeoutMs: 5_000,
      });

      assert.equal(qualified.type, "success");
      if (qualified.type !== "success") return;
      assert.equal(qualified.value.codexVersion.value, "codex-cli 999.42.7");
      assert.match(qualified.value.protocolDigest, /^sha256:[a-f0-9]{64}$/u);
      assert.equal(qualified.value.schemaFileCount, 10);
      assert.equal(
        qualified.value.validators.turnInterruptParams({
          threadId: "thread-1",
          turnId: "turn-1",
        }),
        true,
      );
      assert.deepEqual(await fixture.invocations(), [
        ["--version"],
        ["app-server", "generate-json-schema", "--experimental", "--out"],
      ]);
    } finally {
      await fixture.close();
    }
  });

  test("rejects a CLI whose generated contract omits an owned schema", async () => {
    const fixture = await fakeCodex(
      "codex-cli 1000.0.0",
      "TurnInterruptParams.json",
    );
    try {
      const qualified = await qualifyCodexProtocol({
        codexExecutable: fixture.executable,
        codexHome: join(fixture.directory, "codex-home"),
        maximumSchemaBytes: 1024 * 1024,
        maximumSchemaFiles: 64,
        timeoutMs: 5_000,
      });

      assert.deepEqual(qualified, {
        type: "failure",
        failure: {
          type: "CodexProtocolIncompatible",
          actual: "codex-cli 1000.0.0",
          detail: "missing required schema TurnInterruptParams.json",
        },
      });
    } finally {
      await fixture.close();
    }
  });
});

const fakeCodex = async (version: string, omitted?: string) => {
  const directory = await mkdtemp(join(tmpdir(), "broker-fake-codex-"));
  const executable = join(directory, "codex.mjs");
  const invocationLog = join(directory, "invocations.jsonl");
  await writeFile(
    executable,
    `#!/usr/bin/env node
import { appendFile, mkdir, writeFile } from "node:fs/promises";
const args = process.argv.slice(2);
await appendFile(${JSON.stringify(invocationLog)}, JSON.stringify(args[0] === "app-server" ? args.slice(0, -1) : args) + "\\n");
if (args.length === 1 && args[0] === "--version") {
  process.stdout.write(${JSON.stringify(`${version}\n`)});
  process.exit(0);
}
if (args[0] === "app-server" && args[1] === "generate-json-schema" && args[2] === "--experimental" && args[3] === "--out") {
  const schemas = ${JSON.stringify(compatibleProtocolSchemas)};
  await mkdir(args[4] + "/v1", { recursive: true });
  await mkdir(args[4] + "/v2", { recursive: true });
  for (const [fileName, schema] of Object.entries(schemas)) {
    if (fileName === ${JSON.stringify(omitted)}) continue;
    const directory = fileName === "InitializeParams.json" ? "v1" : "v2";
    await writeFile(args[4] + "/" + directory + "/" + fileName, JSON.stringify(schema) + "\\n");
  }
  process.exit(0);
}
process.exit(64);
`,
    "utf8",
  );
  await chmod(executable, 0o755);
  return {
    close: () => rm(directory, { force: true, recursive: true }),
    directory,
    executable,
    invocations: async (): Promise<readonly (readonly string[])[]> =>
      (await readFile(invocationLog, "utf8"))
        .trim()
        .split("\n")
        .map((line) => parseStringArray(line)),
  };
};

const parseStringArray = (source: string): readonly string[] => {
  const value: unknown = JSON.parse(source);
  assert.ok(Array.isArray(value));
  assert.ok(value.every((item) => typeof item === "string"));
  return value;
};
