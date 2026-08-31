import assert from "node:assert/strict";
import { createServer } from "node:http";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";

import { Type } from "@sinclair/typebox";
import type WebSocket from "ws";
import { WebSocketServer } from "ws";

import {
  defineProvider,
  defineTool,
  startReloadableBroker,
} from "../src/broker/index.ts";
import type { BrokerSchemaLoader } from "../src/broker/types.ts";
import { MemoryThreadCatalogStore } from "../src/protocol/thread-store.ts";
import type { LogRecord } from "../src/runtime/logger.ts";
import { startSocketServer } from "../src/runtime/server.ts";
import { connectUnixWebSocket } from "../src/runtime/upstream-connection.ts";
import { protocolValidators } from "./protocol-schema.fixture.ts";

test("new connections pin atomically refreshed broker generations", async () => {
  const directory = await mkdtemp(join(tmpdir(), "broker-live-reload-"));
  const publicSocket = join(directory, "public.sock");
  const privateSocket = join(directory, "private.sock");
  const upstream = await fakeUpstream(privateSocket);
  const logs: LogRecord[] = [];
  let selected = 0;
  let loads = 0;
  const schemas = [
    provider("1.0.0", "old_tool"),
    provider("2.0.0", "new_tool"),
  ] as const;
  const loader: BrokerSchemaLoader = async () => {
    loads += 1;
    return { type: "success", value: [schemas[selected] ?? schemas[0]] };
  };
  const broker = await startReloadableBroker(loader, {
    observe: (observation) => logs.push(observation),
  });
  assert.equal(broker.type, "success");
  if (broker.type !== "success") return;
  const firstDigest = broker.value.catalog.digest;
  const server = await startSocketServer({
    broker: broker.value,
    connectionInitializationTimeoutMs: 1_000,
    logger: { write: (record) => logs.push(record) },
    maximumConnections: 2,
    maximumMessageBytes: 1024 * 1024,
    publicSocketPath: publicSocket,
    threadStore: new MemoryThreadCatalogStore(),
    upstream: async () => ({
      type: "success",
      value: {
        connection: await connectUnixWebSocket(privateSocket, 1024 * 1024),
        validators: protocolValidators(),
      },
    }),
  });

  let first: WebSocket | undefined;
  let second: WebSocket | undefined;
  try {
    first = await connectUnixWebSocket(publicSocket, 1024 * 1024);
    await initialize(first, 1);
    selected = 1;
    second = await connectUnixWebSocket(publicSocket, 1024 * 1024);
    await initialize(second, 2);

    assert.equal(loads, 3);
    assert.notEqual(broker.value.catalog.digest, firstDigest);
    assert.deepEqual(
      logs
        .filter(({ event }) => event === "connection.initialized")
        .map(({ catalogDigest }) => catalogDigest),
      [firstDigest, broker.value.catalog.digest],
    );
  } finally {
    first?.close();
    second?.close();
    await server.close();
    await broker.value.close();
    await upstream.close();
    await rm(directory, { force: true, recursive: true });
  }
});

const provider = (version: string, toolName: string) =>
  defineProvider({
    namespace: "fixture",
    version,
    tools: [
      defineTool({
        name: toolName,
        description: toolName,
        input: Type.Object({}, { additionalProperties: false }),
        output: Type.Null(),
        loading: "deferred",
        invoke: async () => ({ type: "success", value: null }),
        present: () => ({ success: true, contentItems: [] }),
      }),
    ],
    start: async () => ({ type: "success", value: null }),
  });

const initialize = async (websocket: WebSocket, id: number): Promise<void> => {
  const response = nextMessage(websocket);
  websocket.send(
    JSON.stringify({
      id,
      method: "initialize",
      params: {
        clientInfo: {
          name: "managed",
          title: "Managed",
          version: "test-client",
        },
        capabilities: { experimentalApi: false, requestAttestation: false },
      },
    }),
  );
  await response;
};

const fakeUpstream = async (socketPath: string) => {
  const server = createServer();
  const websockets = new WebSocketServer({ server });
  websockets.on("connection", (connection) => {
    connection.on("message", (data) => {
      const request: unknown = JSON.parse(data.toString());
      const id =
        typeof request === "object" && request !== null
          ? Reflect.get(request, "id")
          : null;
      connection.send(JSON.stringify({ id, result: { userAgent: "fixture" } }));
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
      await new Promise<void>((resolve, reject) =>
        server.close((error) =>
          error === undefined || error === null ? resolve() : reject(error),
        ),
      );
    },
  };
};

const nextMessage = (websocket: WebSocket): Promise<void> =>
  new Promise((resolve, reject) => {
    websocket.once("message", () => resolve());
    websocket.once("error", reject);
    websocket.once("close", () => reject(new Error("closed before response")));
  });
