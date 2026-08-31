import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { Type } from "@sinclair/typebox";

import {
  createBroker,
  defineProviderSchema,
  registerProviderSchema,
} from "../src/broker/index.ts";
import type { InvocationContext } from "../src/broker/types.ts";

const context: InvocationContext = {
  invocationId: "thread-1:turn-1:call-1",
  threadId: "thread-1",
  turnId: "turn-1",
  callId: "call-1",
  cwd: "/workspace",
  signal: new AbortController().signal,
};

describe("common provider schema registration", () => {
  test("derives catalog, validation, and dispatch from one schema instance", async () => {
    const schema = defineProviderSchema({
      namespace: "fixture",
      version: "1.0.0",
      tools: [
        {
          operation: "DOUBLE",
          name: "double",
          description: "Double a bounded integer.",
          inputSchema: Type.Object(
            { value: Type.Integer({ minimum: 0, maximum: 10 }) },
            { additionalProperties: false },
          ),
          outputSchema: Type.Object(
            { value: Type.Integer({ minimum: 0, maximum: 20 }) },
            { additionalProperties: false },
          ),
          loading: "deferred",
        },
      ],
    });
    assert.equal(Object.isFrozen(schema), true);
    assert.equal(Object.isFrozen(schema.tools), true);
    assert.equal(Object.isFrozen(schema.tools[0]), true);
    assert.equal(Object.isFrozen(schema.tools[0]?.inputSchema), true);
    assert.equal(
      Reflect.set(schema.tools[0] ?? {}, "operation", "TRIPLE"),
      false,
    );
    let invocations = 0;
    const registration = registerProviderSchema(schema, {
      start: async () => ({ type: "success", value: null }),
      invoke: async (_runtime, tool, input) => {
        invocations += 1;
        if (tool.operation !== "DOUBLE" || !isValueRecord(input)) {
          return { type: "failure", failure: { code: "INVALID_OPERATION" } };
        }
        return { type: "success", value: { value: input.value * 2 } };
      },
      present: (_tool, output) => ({
        success: true,
        contentItems: [{ type: "inputText", text: JSON.stringify(output) }],
      }),
    });
    const created = createBroker([registration]);
    assert.equal(created.type, "success");
    if (created.type !== "success") return;

    assert.deepEqual(created.value.catalog.namespaces[0]?.tools, [
      {
        type: "function",
        name: "double",
        description: "Double a bounded integer.",
        inputSchema: schema.tools[0]?.inputSchema,
        deferLoading: true,
      },
    ]);
    const accepted = await created.value.dispatch({
      namespace: "fixture",
      tool: "double",
      arguments: { value: 4 },
      context,
    });
    assert.deepEqual(accepted, {
      type: "success",
      value: {
        success: true,
        contentItems: [{ type: "inputText", text: '{"value":8}' }],
      },
    });
    const rejected = await created.value.dispatch({
      namespace: "fixture",
      tool: "double",
      arguments: { value: 11 },
      context,
    });
    assert.equal(rejected.type, "failure");
    assert.equal(invocations, 1);
    await created.value.close();
  });

  test("includes the complete common schema in catalog identity", async () => {
    const doubled = schemaRegistration("DOUBLE");
    const tripled = schemaRegistration("TRIPLE");
    const first = createBroker([doubled]);
    const second = createBroker([tripled]);
    assert.equal(first.type, "success");
    assert.equal(second.type, "success");
    if (first.type !== "success" || second.type !== "success") return;

    assert.notEqual(first.value.catalog.digest, second.value.catalog.digest);
    await first.value.close();
    await second.value.close();
  });
});

const schemaRegistration = (operation: "DOUBLE" | "TRIPLE") => {
  const schema = defineProviderSchema({
    namespace: "identity",
    version: "1.0.0",
    tools: [
      {
        operation,
        name: "calculate",
        description: "Calculate a value.",
        inputSchema: Type.Object({}, { additionalProperties: false }),
        outputSchema: Type.Null(),
        loading: "deferred",
      },
    ],
  });
  return registerProviderSchema(schema, {
    start: async () => ({ type: "success", value: null }),
    invoke: async () => ({ type: "success", value: null }),
    present: () => ({ success: true, contentItems: [] }),
  });
};

const isValueRecord = (value: unknown): value is { readonly value: number } =>
  typeof value === "object" &&
  value !== null &&
  !Array.isArray(value) &&
  typeof Reflect.get(value, "value") === "number";
