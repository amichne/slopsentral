import assert from "node:assert/strict";
import { createServer } from "node:http";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, test } from "node:test";

import { Type } from "@sinclair/typebox";
import type WebSocket from "ws";
import { WebSocketServer } from "ws";

import {
  createBroker,
  defineProvider,
  defineTool,
} from "../src/broker/index.ts";
import { MemoryThreadCatalogStore } from "../src/protocol/thread-store.ts";
import type { LogRecord } from "../src/runtime/logger.ts";
import { startSocketServer } from "../src/runtime/server.ts";
import { connectUnixWebSocket } from "../src/runtime/upstream-connection.ts";

describe("socket proxy contract", () => {
  test("one downstream connection receives an independent transparent upstream connection", async () => {
    const directory = await mkdtemp(join(tmpdir(), "broker-socket-test-"));
    const publicSocket = join(directory, "public.sock");
    const privateSocket = join(directory, "private.sock");
    const upstreamMessages: string[] = [];
    const logs: LogRecord[] = [];
    const fake = await within(
      fakeUpstream(privateSocket, upstreamMessages),
      "fake upstream start",
    );
    const created = createBroker([
      defineProvider({
        namespace: "fixture",
        version: "1.0.0",
        tools: [
          defineTool({
            name: "read",
            description: "fixture",
            input: Type.Object({}, { additionalProperties: false }),
            output: Type.Null(),
            loading: "eager",
            invoke: async () => ({ type: "success", value: null }),
            present: () => ({ success: true, contentItems: [] }),
          }),
        ],
        start: async () => ({ type: "success", value: null }),
      }),
    ]);
    assert.equal(created.type, "success");
    const brokerServer = await within(
      startSocketServer({
        broker: created.value,
        connectionInitializationTimeoutMs: 1_000,
        logger: { write: (record) => logs.push(record) },
        maximumConnections: 2,
        maximumMessageBytes: 1024 * 1024,
        publicSocketPath: publicSocket,
        threadStore: new MemoryThreadCatalogStore(),
        upstream: () => connectUnixWebSocket(privateSocket, 1024 * 1024),
      }),
      "broker socket start",
    );

    try {
      const downstream = await within(
        connectUnixWebSocket(publicSocket, 1024 * 1024),
        "downstream connect",
      );
      const response = nextTextMessage(downstream);
      downstream.send(
        JSON.stringify({
          id: 1,
          method: "initialize",
          params: {
            clientInfo: {
              name: "managed",
              title: "Managed",
              version: "0.149.1",
            },
            capabilities: { experimentalApi: false, requestAttestation: false },
          },
        }),
      );
      let initializeResponse: string;
      try {
        initializeResponse = await within(response, "initialize response");
      } catch (error) {
        throw new Error(
          `initialize failed after upstream messages ${JSON.stringify(upstreamMessages)} and logs ${JSON.stringify(logs)}`,
          {
            cause: error,
          },
        );
      }
      assert.equal(
        initializeResponse,
        '{"id":1,"result":{"userAgent":"fake-upstream"}}',
      );
      const initialized = parseRecord(upstreamMessages[0] ?? "null");
      const params = requireRecord(initialized.params);
      const capabilities = requireRecord(params.capabilities);
      assert.equal(capabilities.experimentalApi, true);
      downstream.close();
    } finally {
      await within(brokerServer.close(), "broker socket close");
      await created.value.close();
      await within(fake.close(), "fake upstream close");
      await rm(directory, { force: true, recursive: true });
    }
  });
});

const fakeUpstream = async (socketPath: string, messages: string[]) => {
  const server = createServer();
  const websockets = new WebSocketServer({ server });
  websockets.on("connection", (connection) => {
    connection.on("message", (data) => {
      messages.push(data.toString());
      connection.send('{"id":1,"result":{"userAgent":"fake-upstream"}}');
    });
  });
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(socketPath, resolve);
  });
  return {
    close: async () => {
      for (const connection of websockets.clients) connection.terminate();
      websockets.close();
      const closed = new Promise<void>((resolve, reject) =>
        server.close((error) =>
          error === undefined || error === null ? resolve() : reject(error),
        ),
      );
      server.closeAllConnections();
      await closed;
    },
  };
};

const nextTextMessage = (websocket: WebSocket): Promise<string> =>
  new Promise((resolve, reject) => {
    websocket.once("message", (data, binary) =>
      binary ? reject(new Error("expected text")) : resolve(data.toString()),
    );
    websocket.once("error", reject);
    websocket.once("close", (code, reason) =>
      reject(new Error(`closed before message: ${code} ${reason.toString()}`)),
    );
  });

const within = async <Value>(
  promise: Promise<Value>,
  stage: string,
): Promise<Value> => {
  let timer: NodeJS.Timeout | undefined;
  const timeout = new Promise<never>((_resolve, reject) => {
    timer = setTimeout(
      () => reject(new Error(`timed out during ${stage}`)),
      2_000,
    );
  });
  try {
    return await Promise.race([promise, timeout]);
  } finally {
    if (timer !== undefined) clearTimeout(timer);
  }
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
