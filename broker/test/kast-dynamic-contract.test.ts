import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { createBroker } from "../src/broker/index.ts";
import { canonicalJson } from "../src/broker/canonical.ts";
import { qualifyKastRegistration } from "../src/providers/kast/registration.ts";
import type {
  ProcessExecutor,
  ProcessRequest,
} from "../src/providers/process.ts";
import type { InvocationContext } from "../src/broker/types.ts";
import {
  dynamicKastSchema,
  projectionV2KastSchema,
} from "./kast-schema.fixture.ts";

describe("installed Kast server contract", () => {
  test("publishes and invokes only the shape emitted by the selected executable", async () => {
    const requests: ProcessRequest[] = [];
    const executable = "/opt/kast/versions/next/bin/kast";
    const schema = dynamicKastSchema();
    const processExecutor: ProcessExecutor = async (request) => {
      requests.push(request);
      if (request.arguments[0] === "--version") {
        return success("kast 1000.0.0 (IDE-hosted)\n");
      }
      if (request.arguments[0] === "--schema") {
        return success(`${JSON.stringify(schema)}\n`);
      }
      return success('{"selector":"exact:installed"}\n');
    };
    const registration = await qualifyKastRegistration(
      {
        executable,
        processExecutor,
        qualificationCwd: "/workspace",
      },
      new AbortController().signal,
    );

    assert.equal(registration.type, "success");
    if (registration.type !== "success") return;
    const created = createBroker([registration.value]);
    assert.equal(created.type, "success");
    if (created.type !== "success") return;
    assert.equal(
      canonicalJson(created.value.catalog.namespaces[0]?.tools),
      canonicalJson([
        {
          type: "function",
          name: "installed_symbol_lookup",
          description:
            "Shape supplied by the selected installed Kast executable.",
          inputSchema: schema.serverProjection.tools[0]?.inputSchema,
          deferLoading: true,
        },
      ]),
    );

    const invoked = await created.value.dispatch({
      namespace: "kast",
      tool: "installed_symbol_lookup",
      arguments: { selection: 0.25 },
      context: invocationContext(),
    });

    assert.equal(invoked.type, "success");
    assert.deepEqual(
      requests.map(({ executable: requested, arguments: arguments_ }) => [
        requested,
        ...arguments_,
      ]),
      [
        [executable, "--version"],
        [executable, "--schema"],
        [executable, "--version"],
        [executable, "--schema"],
        [executable, "symbol", "resolve", "--candidate=0.25"],
      ],
    );
    await created.value.close();
  });

  test("keeps projection v2 explicit tools outside the callable catalog", async () => {
    const schema = projectionV2KastSchema();
    const registration = await qualifyKastRegistration(
      {
        executable: "/opt/kast/versions/next/bin/kast",
        processExecutor: async (request) =>
          request.arguments[0] === "--version"
            ? success("kast 1000.0.0 (IDE-hosted)\n")
            : success(`${JSON.stringify(schema)}\n`),
        qualificationCwd: "/workspace",
      },
      new AbortController().signal,
    );

    assert.equal(registration.type, "success");
    if (registration.type !== "success") return;
    const created = createBroker([registration.value]);
    assert.equal(created.type, "success");
    if (created.type !== "success") return;
    assert.deepEqual(
      created.value.catalog.namespaces[0]?.tools.map(({ name }) => name),
      ["installed_symbol_lookup"],
    );

    const gated = await created.value.dispatch({
      namespace: "kast",
      tool: "change_apply",
      arguments: { plan: "plan:fixture" },
      context: invocationContext(),
    });
    assert.equal(gated.type, "failure");
    await created.value.close();
  });
});

const success = (stdout: string) => ({
  type: "success" as const,
  value: { exitCode: 0, stderr: "", stdout },
});

const invocationContext = (): InvocationContext => ({
  invocationId: "thread-1:turn-1:call-1",
  threadId: "thread-1",
  turnId: "turn-1",
  callId: "call-1",
  cwd: "/workspace",
  signal: new AbortController().signal,
});
