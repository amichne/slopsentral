import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { Type } from "@sinclair/typebox";

import {
  defineProvider,
  defineTool,
  startReloadableBroker,
} from "../src/broker/index.ts";
import type {
  BrokerInvocationRequest,
  BrokerSchemaLoader,
  InvocationContext,
  ProviderRegistration,
} from "../src/broker/types.ts";

const context: InvocationContext = {
  invocationId: "thread-1:turn-1:call-1",
  threadId: "thread-1",
  turnId: "turn-1",
  callId: "call-1",
  cwd: "/workspace",
  signal: new AbortController().signal,
};

const request = (tool: string): BrokerInvocationRequest => ({
  namespace: "fixture",
  tool,
  arguments: {},
  context,
});

describe("reloadable broker generations", () => {
  test("atomically replaces the catalog while acquired generations drain", async () => {
    let selected = 0;
    let stoppedOldRuntime = 0;
    const schemas = [
      provider("1.0.0", "old_tool", () => {
        stoppedOldRuntime += 1;
      }),
      provider("2.0.0", "new_tool"),
    ] as const;
    const loader: BrokerSchemaLoader = async () => ({
      type: "success",
      value: [schemas[selected] ?? schemas[0]],
    });
    const started = await startReloadableBroker(loader);
    assert.equal(started.type, "success");
    if (started.type !== "success") return;

    const oldGeneration = started.value.acquire();
    assert.equal(oldGeneration.type, "success");
    if (oldGeneration.type !== "success") return;
    assert.equal(
      (await oldGeneration.value.broker.dispatch(request("old_tool"))).type,
      "success",
    );

    selected = 1;
    const reloaded = await started.value.reload();
    assert.deepEqual(reloaded, {
      type: "success",
      value: {
        type: "replaced",
        previousCatalogDigest: oldGeneration.value.broker.catalog.digest,
        catalogDigest: started.value.catalog.digest,
      },
    });
    assert.notEqual(
      started.value.catalog.digest,
      oldGeneration.value.broker.catalog.digest,
    );

    const newGeneration = started.value.acquire();
    assert.equal(newGeneration.type, "success");
    if (newGeneration.type !== "success") return;
    assert.equal(
      (await newGeneration.value.broker.dispatch(request("new_tool"))).type,
      "success",
    );
    assert.equal(
      (await oldGeneration.value.broker.dispatch(request("old_tool"))).type,
      "success",
    );
    assert.equal(stoppedOldRuntime, 0);

    await oldGeneration.value.release();
    assert.equal(stoppedOldRuntime, 1);
    await newGeneration.value.release();
    await started.value.close();
  });

  test("rejects an invalid replacement without weakening the admitted catalog", async () => {
    const initial = provider("1.0.0", "stable_tool");
    let schemas: readonly ProviderRegistration[] = [initial];
    const loader: BrokerSchemaLoader = async () => ({
      type: "success",
      value: schemas,
    });
    const started = await startReloadableBroker(loader);
    assert.equal(started.type, "success");
    if (started.type !== "success") return;
    const admittedDigest = started.value.catalog.digest;

    schemas = [initial, provider("2.0.0", "conflicting_tool")];
    const rejected = await started.value.reload();
    assert.deepEqual(rejected, {
      type: "failure",
      failure: {
        type: "CatalogInvalid",
        issues: ["duplicate namespace: fixture"],
      },
    });
    assert.equal(started.value.catalog.digest, admittedDigest);

    const generation = started.value.acquire();
    assert.equal(generation.type, "success");
    if (generation.type !== "success") return;
    assert.equal(
      (await generation.value.broker.dispatch(request("stable_tool"))).type,
      "success",
    );
    await generation.value.release();
    await started.value.close();
  });

  test("drains an in-flight dispatch before stopping a retired provider", async () => {
    let finishInvocation: () => void = () => {};
    let invocationStarted: () => void = () => {};
    const startedInvocation = new Promise<void>((resolve) => {
      invocationStarted = resolve;
    });
    const finish = new Promise<void>((resolve) => {
      finishInvocation = resolve;
    });
    let stopped = 0;
    let selected = 0;
    const schemas = [
      defineProvider({
        namespace: "fixture",
        version: "1.0.0",
        tools: [
          defineTool({
            name: "blocking_tool",
            description: "Block until the test releases the invocation.",
            input: Type.Object({}, { additionalProperties: false }),
            output: Type.Null(),
            loading: "deferred",
            invoke: async () => {
              invocationStarted();
              await finish;
              return { type: "success", value: null };
            },
            present: () => ({ success: true, contentItems: [] }),
          }),
        ],
        start: async () => ({ type: "success", value: null }),
        stop: async () => {
          stopped += 1;
        },
      }),
      provider("2.0.0", "replacement_tool"),
    ] as const;
    const loader: BrokerSchemaLoader = async () => ({
      type: "success",
      value: [schemas[selected] ?? schemas[0]],
    });
    const broker = await startReloadableBroker(loader);
    assert.equal(broker.type, "success");
    if (broker.type !== "success") return;
    const generation = broker.value.acquire();
    assert.equal(generation.type, "success");
    if (generation.type !== "success") return;

    const invocation = generation.value.broker.dispatch(
      request("blocking_tool"),
    );
    await startedInvocation;
    selected = 1;
    assert.equal((await broker.value.reload()).type, "success");
    const released = generation.value.release();
    await Promise.resolve();
    assert.equal(stopped, 0);

    finishInvocation();
    assert.equal((await invocation).type, "success");
    await released;
    assert.equal(stopped, 1);
    await broker.value.close();
  });
});

const provider = (
  version: string,
  toolName: string,
  stopped: () => void = () => {},
) =>
  defineProvider({
    namespace: "fixture",
    version,
    tools: [
      defineTool({
        name: toolName,
        description: `${toolName} description`,
        input: Type.Object({}, { additionalProperties: false }),
        output: Type.Null(),
        loading: "deferred",
        invoke: async () => ({ type: "success", value: null }),
        present: () => ({ success: true, contentItems: [] }),
      }),
    ],
    start: async () => ({ type: "success", value: null }),
    stop: async () => stopped(),
  });
