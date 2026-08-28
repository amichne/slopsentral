import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { qualifyKast } from "../src/providers/kast/qualification.ts";
import type {
  ProcessExecutor,
  ProcessRequest,
} from "../src/providers/process.ts";
import { compatibleKastSchema } from "./kast-schema.fixture.ts";

describe("Kast qualification", () => {
  test("accepts arbitrary CLI and schema versions with compatible capabilities", async () => {
    const requests: ProcessRequest[] = [];
    const qualified = await qualifyKast(
      {
        executable: "kast-next",
        processExecutor: fixtureExecutor(
          requests,
          "kast 999.42.7 (IDE-hosted)",
          compatibleKastSchema(42),
        ),
        qualificationCwd: "/workspace",
      },
      new AbortController().signal,
    );

    assert.equal(qualified.type, "success");
    if (qualified.type !== "success") return;
    assert.deepEqual(qualified.value, {
      cliVersion: "kast 999.42.7 (IDE-hosted)",
      schemaDigest: qualified.value.schemaDigest,
      schemaVersion: 42,
      wireSchemaId: "kast-wire-v42",
    });
    assert.match(qualified.value.schemaDigest, /^sha256:[a-f0-9]{64}$/u);
    assert.deepEqual(
      requests.map(({ executable, arguments: arguments_ }) => [
        executable,
        ...arguments_,
      ]),
      [
        ["kast-next", "--version"],
        ["kast-next", "--schema"],
      ],
    );
  });

  test("rejects a live schema missing one broker-owned operation", async () => {
    const schema = compatibleKastSchema();
    schema.operationRegistry.operationIds =
      schema.operationRegistry.operationIds.filter(
        (operation) => operation !== "traversal.run",
      );
    const qualified = await qualifyKast(
      {
        executable: "kast",
        processExecutor: fixtureExecutor([], "kast 1000.0.0", schema),
        qualificationCwd: "/workspace",
      },
      new AbortController().signal,
    );

    assert.deepEqual(qualified, {
      type: "failure",
      failure: { code: "KAST_SCHEMA_INCOMPATIBLE" },
    });
  });

  test("rejects inconsistent schema and wire versions", async () => {
    const schema = compatibleKastSchema(7);
    schema.wireSchema.schemaVersion = 8;
    const qualified = await qualifyKast(
      {
        executable: "kast",
        processExecutor: fixtureExecutor([], "kast 1000.0.0", schema),
        qualificationCwd: "/workspace",
      },
      new AbortController().signal,
    );

    assert.deepEqual(qualified, {
      type: "failure",
      failure: { code: "KAST_SCHEMA_INCOMPATIBLE" },
    });
  });
});

const fixtureExecutor =
  (
    requests: ProcessRequest[],
    version: string,
    schema: unknown,
  ): ProcessExecutor =>
  async (request) => {
    requests.push(request);
    return {
      type: "success",
      value: {
        exitCode: 0,
        stderr: "",
        stdout:
          request.arguments[0] === "--version"
            ? `${version}\n`
            : `${JSON.stringify(schema)}\n`,
      },
    };
  };
