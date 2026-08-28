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
      contract: qualified.value.contract,
      schemaDigest: qualified.value.schemaDigest,
      schemaVersion: 42,
      serverProjectionVersion: 1,
      toolCount: 3,
    });
    assert.deepEqual(
      qualified.value.contract.tools.map(({ name }) => name),
      ["symbol_discover", "symbol_resolve", "traversal_run"],
    );
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

  test("rejects a projected input field without a CLI binding", async () => {
    const schema = compatibleKastSchema();
    const resolve = schema.serverProjection.tools[1];
    assert.ok(resolve);
    resolve.invocation.bindings = [];
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

  test("rejects a CLI binding without a projected input field", async () => {
    const schema = compatibleKastSchema();
    const resolve = schema.serverProjection.tools[1];
    assert.ok(resolve);
    resolve.invocation.bindings = [
      ...resolve.invocation.bindings,
      { type: "OPTION", inputField: "ghost", option: "--ghost" },
    ];
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

  test("rejects an OPTION binding whose admitted field is not scalar", async () => {
    const schema = compatibleKastSchema();
    const resolve = schema.serverProjection.tools[1];
    assert.ok(resolve);
    resolve.inputSchema = {
      type: "object",
      additionalProperties: false,
      properties: {
        candidate: { type: "array", items: { type: "string" } },
      },
      required: ["candidate"],
    };
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

  test("accepts independently versioned opaque Kast components", async () => {
    const schema = compatibleKastSchema(7);
    schema.operationRegistry.schemaVersion = 11;
    schema.wireSchema.schemaVersion = 8;
    const qualified = await qualifyKast(
      {
        executable: "kast",
        processExecutor: fixtureExecutor([], "kast 1000.0.0", schema),
        qualificationCwd: "/workspace",
      },
      new AbortController().signal,
    );

    assert.equal(qualified.type, "success");
    if (qualified.type !== "success") return;
    assert.equal(qualified.value.schemaVersion, 7);
    assert.equal(qualified.value.serverProjectionVersion, 1);
  });

  test("accepts a server projection without legacy Kast components", async () => {
    const schema = compatibleKastSchema();
    Reflect.deleteProperty(schema, "operationRegistry");
    Reflect.deleteProperty(schema, "wireSchema");
    Reflect.deleteProperty(schema, "cliProjection");
    const qualified = await qualifyKast(
      {
        executable: "kast",
        processExecutor: fixtureExecutor([], "kast 1000.0.0", schema),
        qualificationCwd: "/workspace",
      },
      new AbortController().signal,
    );

    assert.equal(qualified.type, "success");
  });

  test("rejects a schema without an installed server projection", async () => {
    const schema = compatibleKastSchema();
    Reflect.deleteProperty(schema, "serverProjection");
    const qualified = await qualifyKast(
      {
        executable: "/opt/kast/versions/next/bin/kast",
        processExecutor: fixtureExecutor([], "kast 1000.0.0", schema),
        qualificationCwd: "/workspace",
      },
      new AbortController().signal,
    );

    assert.deepEqual(qualified, {
      type: "failure",
      failure: { code: "KAST_SCHEMA_INVALID" },
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
