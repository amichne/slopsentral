import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { Type } from "@sinclair/typebox";

import {
  createBroker,
  defineProvider,
  defineTool,
} from "../src/broker/index.ts";
import { CodexProtocolAdapter } from "../src/protocol/adapter.ts";
import { MemoryThreadCatalogStore } from "../src/protocol/thread-store.ts";
import { protocolValidators } from "./protocol-schema.fixture.ts";

const registration = (namespace: string, tool: string) =>
  defineProvider({
    namespace,
    version: "1.0.0",
    tools: [
      defineTool({
        name: tool,
        description: `${namespace} ${tool}`,
        input: Type.Object({}, { additionalProperties: false }),
        output: Type.Object(
          { namespace: Type.String() },
          { additionalProperties: false },
        ),
        loading: "deferred",
        invoke: async () => ({ type: "success", value: { namespace } }),
        present: (value) => ({
          success: true,
          contentItems: [{ type: "inputText", text: JSON.stringify(value) }],
        }),
      }),
    ],
    start: async () => ({ type: "success", value: { namespace } }),
  });

const adapter = () => {
  const created = createBroker([
    registration("gradle", "inspect"),
    registration("kast", "symbol_resolve"),
  ]);
  assert.equal(created.type, "success");
  const threadStore = new MemoryThreadCatalogStore();
  return {
    broker: created.value,
    threadStore,
    protocol: new CodexProtocolAdapter({
      broker: created.value,
      threadStore,
      validators: protocolValidators(),
    }),
  };
};

describe("protocol contract", () => {
  test("initialize and thread start preserve unowned fields and inject the federated catalog", async () => {
    const { protocol } = adapter();
    const initialized = await protocol.fromDownstream(
      JSON.stringify({
        id: 1,
        method: "initialize",
        params: {
          clientInfo: {
            name: "managed-codex",
            title: "Managed Codex",
            version: "test-client",
          },
          capabilities: { experimentalApi: false, requestAttestation: true },
        },
      }),
    );
    assert.equal(initialized.type, "forwardUpstream");
    if (initialized.type !== "forwardUpstream") return;
    const initializeDocument = parseRecord(initialized.message);
    const initializeParams = requireRecordProperty(
      initializeDocument,
      "params",
    );
    const capabilities = requireRecordProperty(
      initializeParams,
      "capabilities",
    );
    assert.equal(capabilities.experimentalApi, true);
    assert.equal(capabilities.requestAttestation, true);

    const started = await protocol.fromDownstream(
      JSON.stringify({
        id: 2,
        method: "thread/start",
        params: {
          cwd: "/workspace",
          approvalPolicy: "never",
          sandbox: "read-only",
          experimentalRawEvents: false,
          serviceName: "preserved",
        },
      }),
    );
    assert.equal(started.type, "forwardUpstream");
    if (started.type !== "forwardUpstream") return;
    const startDocument = parseRecord(started.message);
    const startParams = requireRecordProperty(startDocument, "params");
    assert.equal(startParams.serviceName, "preserved");
    const dynamicTools = startParams.dynamicTools;
    assert.ok(Array.isArray(dynamicTools));
    assert.deepEqual(
      dynamicTools.map((tool) => requireRecord(tool).name),
      ["gradle", "kast"],
    );
  });

  test("unowned messages are forwarded byte-for-byte", async () => {
    const message = '{"id":99, "method":"model/list", "params":{"limit":3}}';
    assert.deepEqual(await adapter().protocol.fromDownstream(message), {
      type: "forwardUpstream",
      message,
    });
  });

  test("owned calls are consumed and correlated while unowned calls are preserved", async () => {
    const { broker, protocol, threadStore } = adapter();
    await threadStore.write({
      threadId: "thread-1",
      catalogDigest: broker.catalog.digest,
      cwd: "/workspace",
    });
    const owned = await protocol.fromUpstream(
      JSON.stringify({
        id: "request-7",
        method: "item/tool/call",
        params: {
          threadId: "thread-1",
          turnId: "turn-2",
          callId: "call-3",
          namespace: "gradle",
          tool: "inspect",
          arguments: {},
        },
      }),
    );
    assert.equal(owned.type, "replyUpstream");
    if (owned.type !== "replyUpstream") return;
    const response = parseRecord(owned.message);
    assert.equal(response.id, "request-7");
    const result = requireRecordProperty(response, "result");
    assert.equal(result.success, true);
    const contentItems = result.contentItems;
    assert.ok(Array.isArray(contentItems));
    const firstContent = requireRecord(contentItems[0]);
    assert.equal(firstContent.type, "inputText");
    const contentText = firstContent.text;
    if (typeof contentText !== "string")
      assert.fail("expected inputText content");
    assert.deepEqual(JSON.parse(contentText), {
      namespace: "gradle",
    });

    const unowned =
      '{"id":8,"method":"item/tool/call","params":{"namespace":"client"}}';
    assert.deepEqual(await protocol.fromUpstream(unowned), {
      type: "forwardDownstream",
      message: unowned,
    });
  });

  test("resume fails closed when catalog compatibility is not persisted", async () => {
    const resumed = await adapter().protocol.fromDownstream(
      JSON.stringify({
        id: 41,
        method: "thread/resume",
        params: { threadId: "unqualified-thread" },
      }),
    );
    assert.equal(resumed.type, "replyDownstream");
    if (resumed.type !== "replyDownstream") return;
    assert.match(resumed.message, /CatalogIncompatible/);
    assert.match(resumed.message, /unqualified-thread/);
  });

  test("successful thread creation persists the catalog binding", async () => {
    const { broker, protocol, threadStore } = adapter();
    await protocol.fromDownstream(
      JSON.stringify({
        id: 51,
        method: "thread/start",
        params: {
          cwd: "/workspace",
          approvalPolicy: "never",
          sandbox: "read-only",
        },
      }),
    );
    const response = JSON.stringify({
      id: 51,
      result: {
        thread: {
          id: "thread-created",
          cliVersion: "test-cli",
          createdAt: 1,
          cwd: "/workspace",
          ephemeral: false,
          modelProvider: "openai",
          preview: "",
          projectId: null,
          sessionId: "session-1",
          source: "appServer",
          status: { type: "idle" },
          turns: [],
          updatedAt: 1,
        },
        model: "gpt-5.6-sol",
        modelProvider: "openai",
        cwd: "/workspace",
        approvalPolicy: "never",
        approvalsReviewer: "user",
        sandbox: { type: "readOnly" },
      },
    });
    assert.deepEqual(await protocol.fromUpstream(response), {
      type: "forwardDownstream",
      message: response,
    });
    assert.deepEqual(await threadStore.read("thread-created"), {
      threadId: "thread-created",
      catalogDigest: broker.catalog.digest,
      cwd: "/workspace",
    });
  });

  test("qualified resume and fork persist exact catalog bindings", async () => {
    const { broker, protocol, threadStore } = adapter();
    await threadStore.write({
      threadId: "thread-source",
      catalogDigest: broker.catalog.digest,
      cwd: "/workspace/old",
    });

    const resumed = await protocol.fromDownstream(
      JSON.stringify({
        id: 61,
        method: "thread/resume",
        params: { threadId: "thread-source" },
      }),
    );
    assert.deepEqual(resumed, {
      type: "forwardUpstream",
      message:
        '{"id":61,"method":"thread/resume","params":{"threadId":"thread-source"}}',
    });
    const resumeResponse = JSON.stringify({
      id: 61,
      result: threadOperationResult("thread-source", "/workspace/resumed"),
    });
    assert.deepEqual(await protocol.fromUpstream(resumeResponse), {
      type: "forwardDownstream",
      message: resumeResponse,
    });
    assert.deepEqual(await threadStore.read("thread-source"), {
      threadId: "thread-source",
      catalogDigest: broker.catalog.digest,
      cwd: "/workspace/resumed",
    });

    const forked = await protocol.fromDownstream(
      JSON.stringify({
        id: 62,
        method: "thread/fork",
        params: { threadId: "thread-source" },
      }),
    );
    assert.equal(forked.type, "forwardUpstream");
    const forkResponse = JSON.stringify({
      id: 62,
      result: threadOperationResult("thread-fork", "/workspace/fork"),
    });
    assert.deepEqual(await protocol.fromUpstream(forkResponse), {
      type: "forwardDownstream",
      message: forkResponse,
    });
    assert.deepEqual(await threadStore.read("thread-fork"), {
      threadId: "thread-fork",
      catalogDigest: broker.catalog.digest,
      cwd: "/workspace/fork",
    });
  });

  test("turn interruption cancels the matching in-flight invocation", async () => {
    const invoked = deferred<void>();
    const registration = defineProvider({
      namespace: "fixture",
      version: "1.0.0",
      tools: [
        defineTool({
          name: "wait",
          description: "Wait until interrupted.",
          input: Type.Object({}, { additionalProperties: false }),
          output: Type.Null(),
          loading: "deferred",
          invoke: async (_runtime, _input, context) => {
            invoked.resolve();
            await new Promise<void>((resolve) =>
              context.signal.addEventListener("abort", () => resolve(), {
                once: true,
              }),
            );
            return { type: "success", value: null };
          },
          present: () => ({ success: true, contentItems: [] }),
        }),
      ],
      start: async () => ({ type: "success", value: null }),
    });
    const created = createBroker([registration]);
    assert.equal(created.type, "success");
    const threadStore = new MemoryThreadCatalogStore();
    await threadStore.write({
      threadId: "thread-1",
      catalogDigest: created.value.catalog.digest,
      cwd: "/workspace",
    });
    const protocol = new CodexProtocolAdapter({
      broker: created.value,
      threadStore,
      validators: protocolValidators(),
    });
    const toolCall = protocol.fromUpstream(
      JSON.stringify({
        id: 71,
        method: "item/tool/call",
        params: {
          threadId: "thread-1",
          turnId: "turn-1",
          callId: "call-1",
          namespace: "fixture",
          tool: "wait",
          arguments: {},
        },
      }),
    );
    await invoked.operation;
    const interrupted = await protocol.fromDownstream(
      JSON.stringify({
        id: 72,
        method: "turn/interrupt",
        params: { threadId: "thread-1", turnId: "turn-1" },
      }),
    );
    assert.equal(interrupted.type, "forwardUpstream");
    const reply = await toolCall;
    assert.equal(reply.type, "replyUpstream");
    if (reply.type !== "replyUpstream") return;
    assert.match(reply.message, /InvocationCancelled/);
  });
});

const threadOperationResult = (threadId: string, cwd: string) => ({
  thread: {
    id: threadId,
    cliVersion: "test-cli",
    createdAt: 1,
    cwd,
    ephemeral: false,
    modelProvider: "openai",
    preview: "",
    projectId: null,
    sessionId: "session-1",
    source: "appServer",
    status: { type: "idle" },
    turns: [],
    updatedAt: 1,
  },
  model: "gpt-5.6-sol",
  modelProvider: "openai",
  cwd,
  approvalPolicy: "never",
  approvalsReviewer: "user",
  sandbox: { type: "readOnly" },
});

const deferred = <Value>() => {
  let resolve: (value: Value) => void = (_value) => {};
  const operation = new Promise<Value>((complete) => {
    resolve = complete;
  });
  return { operation, resolve };
};

const parseRecord = (message: string): Readonly<Record<string, unknown>> => {
  const value: unknown = JSON.parse(message);
  return requireRecord(value);
};

const requireRecord = (value: unknown): Readonly<Record<string, unknown>> => {
  assert.ok(isRecord(value));
  return value;
};

const isRecord = (value: unknown): value is Readonly<Record<string, unknown>> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const requireRecordProperty = (
  value: Readonly<Record<string, unknown>>,
  property: string,
): Readonly<Record<string, unknown>> => requireRecord(value[property]);
