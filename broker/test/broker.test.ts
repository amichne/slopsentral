import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { Type } from "@sinclair/typebox";

import {
  createBroker,
  defineProvider,
  defineTool,
} from "../src/broker/index.ts";
import type {
  Broker,
  BrokerLimits,
  InvocationContext,
  ProviderDefinition,
  ProviderRegistration,
} from "../src/broker/types.ts";

const limits = {
  inFlightCallsPerConnection: 2,
  inFlightCallsPerProvider: 2,
  maximumCatalogBytes: 1024 * 1024,
  maximumDescriptorCount: 8,
  maximumToolArgumentBytes: 64 * 1024,
  maximumToolResultBytes: 1024 * 1024,
  providerInvocationTimeoutMs: 50,
  providerStartupTimeoutMs: 50,
} as const;

const context = (signal = new AbortController().signal): InvocationContext => ({
  invocationId: "thread-1:turn-1:call-1",
  threadId: "thread-1",
  turnId: "turn-1",
  callId: "call-1",
  cwd: "/workspace",
  signal,
});

const provider = (namespace: string, toolNames: readonly string[]) =>
  defineProvider({
    namespace,
    version: "1.0.0",
    tools: toolNames.map((name) =>
      defineTool({
        name,
        description: `${namespace} ${name}`,
        input: Type.Object(
          { value: Type.Integer() },
          { additionalProperties: false },
        ),
        output: Type.Null(),
        loading: "deferred",
        invoke: async () => ({ type: "success", value: null }),
        present: () => ({ success: true, contentItems: [] }),
      }),
    ),
    start: async () => ({ type: "success", value: null }),
  });

const requireBroker = (
  registration: ProviderRegistration,
  customLimits: BrokerLimits = limits,
): Broker => {
  const created = createBroker([registration], customLimits);
  assert.equal(created.type, "success");
  return created.value;
};

describe("catalog contract", () => {
  test("catalog and digest are deterministic across provider registration order", () => {
    const first = createBroker([
      provider("kast", ["symbol_resolve"]),
      provider("gradle", ["tasks", "inspect"]),
    ]);
    const second = createBroker([
      provider("gradle", ["inspect", "tasks"]),
      provider("kast", ["symbol_resolve"]),
    ]);

    assert.equal(first.type, "success");
    assert.equal(second.type, "success");
    assert.deepEqual(first.value.catalog, second.value.catalog);
    assert.match(first.value.catalog.digest, /^sha256:[0-9a-f]{64}$/);
  });

  test("duplicate namespaces and tools are rejected", () => {
    const duplicateNamespace = createBroker([
      provider("gradle", ["inspect"]),
      provider("gradle", ["tasks"]),
    ]);
    assert.equal(duplicateNamespace.type, "failure");
    assert.deepEqual(duplicateNamespace.failure, {
      type: "CatalogInvalid",
      issues: ["duplicate namespace: gradle"],
    });

    const duplicateTool = createBroker([
      provider("gradle", ["inspect", "inspect"]),
    ]);
    assert.equal(duplicateTool.type, "failure");
    assert.deepEqual(duplicateTool.failure, {
      type: "CatalogInvalid",
      issues: ["duplicate tool: gradle.inspect"],
    });

    const protocolInvalidTool = createBroker([
      provider("kast", ["symbol.discover"]),
    ]);
    assert.equal(protocolInvalidTool.type, "failure");
    assert.deepEqual(protocolInvalidTool.failure, {
      type: "CatalogInvalid",
      issues: ["invalid tool: kast.symbol.discover"],
    });
  });

  test("invalid schemas and finite catalog limits fail closed", () => {
    const registration = provider("gradle", ["inspect"]);
    const [tool] = registration.descriptor.tools;
    assert.notEqual(tool, undefined);
    Object.defineProperty(tool, "inputSchema", { value: { arbitrary: true } });
    const invalidSchema = createBroker([registration]);
    assert.equal(invalidSchema.type, "failure");
    assert.deepEqual(invalidSchema.failure, {
      type: "CatalogInvalid",
      issues: ["invalid schema: gradle.inspect"],
    });

    const invalidOutputRegistration = provider("gradle", ["inspect"]);
    const [invalidOutputTool] = invalidOutputRegistration.descriptor.tools;
    assert.notEqual(invalidOutputTool, undefined);
    Object.defineProperty(invalidOutputTool, "outputSchema", {
      value: { arbitrary: true },
    });
    const invalidOutputSchema = createBroker([invalidOutputRegistration]);
    assert.equal(invalidOutputSchema.type, "failure");
    assert.deepEqual(invalidOutputSchema.failure, {
      type: "CatalogInvalid",
      issues: ["invalid output schema: gradle.inspect"],
    });

    const tooMany = createBroker([provider("gradle", ["inspect"])], {
      ...limits,
      maximumDescriptorCount: 0,
    });
    assert.equal(tooMany.type, "failure");
    assert.deepEqual(tooMany.failure, {
      type: "BrokerOverloaded",
      limit: "maximumDescriptorCount",
    });
  });
});

describe("routing and validation contract", () => {
  test("unknown namespace and unknown tool are finite failures", async () => {
    const broker = requireBroker(provider("gradle", ["inspect"]));
    assert.deepEqual(
      await broker.dispatch({
        namespace: "kast",
        tool: "inspect",
        arguments: { value: 1 },
        context: context(),
      }),
      {
        type: "failure",
        failure: { type: "UnknownNamespace", namespace: "kast" },
      },
    );
    assert.deepEqual(
      await broker.dispatch({
        namespace: "gradle",
        tool: "missing",
        arguments: { value: 1 },
        context: context(),
      }),
      {
        type: "failure",
        failure: { type: "UnknownTool", namespace: "gradle", tool: "missing" },
      },
    );
  });

  test("valid typed input reaches the provider exactly once", async () => {
    let received = 0;
    const registration = typedValidationProvider(() => {
      received += 1;
    });
    const broker = requireBroker(registration);
    const result = await broker.dispatch({
      namespace: "kast",
      tool: "traversal_run",
      arguments: {
        mode: "bounded",
        bounds: { maximumDepth: 5 },
        relation: "callers",
      },
      context: context(),
    });
    assert.equal(result.type, "success");
    assert.equal(received, 1);
  });

  test("wrong, missing, enum, nested, and unknown values invoke no provider", async () => {
    let received = 0;
    const broker = requireBroker(
      typedValidationProvider(() => {
        received += 1;
      }),
    );
    const invalidArguments: readonly unknown[] = [
      {
        mode: "bounded",
        bounds: { maximumDepth: "five" },
        relation: "callers",
      },
      { mode: "bounded", bounds: {}, relation: "callers" },
      { mode: "bounded", bounds: { maximumDepth: 5 }, relation: "unknown" },
      { mode: "bounded", bounds: 5, relation: "callers" },
      {
        mode: "bounded",
        bounds: { maximumDepth: 5 },
        relation: "callers",
        extra: true,
      },
    ];

    for (const arguments_ of invalidArguments) {
      const result = await broker.dispatch({
        namespace: "kast",
        tool: "traversal_run",
        arguments: arguments_,
        context: context(),
      });
      assert.equal(result.type, "failure");
      assert.equal(result.failure.type, "InvalidArguments");
    }
    assert.equal(received, 0);
  });
});

describe("provider lifecycle contract", () => {
  test("descriptors are inert and subsequent calls reuse one lazy runtime", async () => {
    let starts = 0;
    let invocations = 0;
    const registration = lifecycleProvider({
      start: async () => {
        starts += 1;
        return { type: "success", value: { identity: "only-runtime" } };
      },
      invoke: async (runtime) => {
        assert.equal(runtime.identity, "only-runtime");
        invocations += 1;
        return { type: "success", value: null };
      },
    });
    const broker = requireBroker(registration);
    assert.equal(starts, 0);

    await dispatchRead(broker, "call-1");
    await dispatchRead(broker, "call-2");
    assert.equal(starts, 1);
    assert.equal(invocations, 2);
  });

  test("concurrent first calls await one shared startup", async () => {
    const startup = deferred<{ readonly identity: string }>();
    let starts = 0;
    const registration = lifecycleProvider({
      start: () => {
        starts += 1;
        return startup.operation.then((value) => ({
          type: "success" as const,
          value,
        }));
      },
      invoke: async () => ({ type: "success", value: null }),
    });
    const broker = requireBroker(registration);
    const first = dispatchRead(broker, "call-1");
    const second = dispatchRead(broker, "call-2");
    await Promise.resolve();
    assert.equal(starts, 1);
    startup.resolve({ identity: "shared-runtime" });
    assert.equal((await first).type, "success");
    assert.equal((await second).type, "success");
  });

  test("failed startup remains a classified failure", async () => {
    let starts = 0;
    const broker = requireBroker(
      lifecycleProvider({
        start: async () => {
          starts += 1;
          return { type: "failure", failure: { code: "QUALIFICATION_FAILED" } };
        },
        invoke: async () => ({ type: "success", value: null }),
      }),
    );
    const expected = {
      type: "failure" as const,
      failure: {
        type: "ProviderStartupFailed" as const,
        namespace: "fixture",
        code: "QUALIFICATION_FAILED",
      },
    };
    assert.deepEqual(await dispatchRead(broker, "call-1"), expected);
    assert.deepEqual(await dispatchRead(broker, "call-2"), expected);
    assert.equal(starts, 1);
  });

  test("invocation timeout is terminal and discards a late result", async () => {
    const invocation = deferred<null>();
    let presentations = 0;
    const broker = requireBroker(
      lifecycleProvider({
        start: async () => ({
          type: "success",
          value: { identity: "runtime" },
        }),
        invoke: () =>
          invocation.operation.then((value) => ({
            type: "success" as const,
            value,
          })),
        present: () => {
          presentations += 1;
          return { success: true, contentItems: [] };
        },
      }),
      { ...limits, providerInvocationTimeoutMs: 5 },
    );
    const result = await dispatchRead(broker, "late-call");
    assert.deepEqual(result, {
      type: "failure",
      failure: {
        type: "InvocationTimedOut",
        invocationId: "thread-1:turn-1:late-call",
      },
    });
    invocation.resolve(null);
    await new Promise<void>((resolve) => setImmediate(resolve));
    assert.equal(presentations, 1);
  });

  test("late startup after timeout is discarded and stopped", async () => {
    const startup = deferred<{ readonly identity: string }>();
    let stops = 0;
    const broker = requireBroker(
      lifecycleProvider({
        start: () =>
          startup.operation.then((value) => ({
            type: "success" as const,
            value,
          })),
        invoke: async () => ({ type: "success", value: null }),
        stop: async () => {
          stops += 1;
        },
      }),
      { ...limits, providerStartupTimeoutMs: 5 },
    );
    const result = await dispatchRead(broker, "late-start");
    assert.equal(result.type, "failure");
    assert.equal(result.failure.type, "ProviderStartupFailed");
    startup.resolve({ identity: "late-runtime" });
    await new Promise<void>((resolve) => setImmediate(resolve));
    assert.equal(stops, 1);
  });
});

const typedValidationProvider = (
  received: () => void,
): ProviderRegistration => {
  const input = Type.Object(
    {
      mode: Type.Literal("bounded"),
      bounds: Type.Object(
        { maximumDepth: Type.Integer({ minimum: 1, maximum: 1_000 }) },
        { additionalProperties: false },
      ),
      relation: Type.Union([Type.Literal("callers"), Type.Literal("callees")]),
    },
    { additionalProperties: false },
  );
  return defineProvider({
    namespace: "kast",
    version: "1.0.0",
    tools: [
      defineTool({
        name: "traversal_run",
        description: "Run a bounded traversal.",
        input,
        output: Type.Null(),
        loading: "deferred",
        invoke: async () => {
          received();
          return { type: "success", value: null };
        },
        present: () => ({ success: true, contentItems: [] }),
      }),
    ],
    start: async () => ({ type: "success", value: null }),
  });
};

interface FixtureRuntime {
  readonly identity: string;
}

interface LifecycleOptions {
  readonly start: ProviderDefinition<FixtureRuntime>["start"];
  readonly invoke: (
    runtime: FixtureRuntime,
  ) => Promise<
    | { readonly type: "success"; readonly value: null }
    | { readonly type: "failure"; readonly failure: { readonly code: string } }
  >;
  readonly present?: () => {
    readonly success: boolean;
    readonly contentItems: readonly [];
  };
  readonly stop?: (runtime: FixtureRuntime) => Promise<void>;
}

const lifecycleProvider = (options: LifecycleOptions): ProviderRegistration =>
  defineProvider({
    namespace: "fixture",
    version: "1.0.0",
    tools: [
      defineTool({
        name: "read",
        description: "Read the fixture.",
        input: Type.Object({}, { additionalProperties: false }),
        output: Type.Null(),
        loading: "deferred",
        invoke: (runtime: FixtureRuntime) => options.invoke(runtime),
        present:
          options.present ?? (() => ({ success: true, contentItems: [] })),
      }),
    ],
    start: options.start,
    ...(options.stop === undefined ? {} : { stop: options.stop }),
  });

const dispatchRead = (broker: Broker, callId: string) =>
  broker.dispatch({
    namespace: "fixture",
    tool: "read",
    arguments: {},
    context: {
      ...context(),
      invocationId: `thread-1:turn-1:${callId}`,
      callId,
    },
  });

const deferred = <Value>() => {
  let resolve: (value: Value) => void = (_value) => {};
  const operation = new Promise<Value>((complete) => {
    resolve = complete;
  });
  return { operation, resolve };
};
