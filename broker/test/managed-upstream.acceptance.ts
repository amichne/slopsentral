import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";

import type WebSocket from "ws";

import { startBrokerRuntime } from "../src/runtime/broker-runtime.ts";
import { runtimeConfig } from "../src/runtime/config.ts";
import type { LogRecord } from "../src/runtime/logger.ts";
import { connectUnixWebSocket } from "../src/runtime/upstream-connection.ts";

test("supported installed Codex starts one qualified App Server process", async () => {
  const directory = await mkdtemp(join(tmpdir(), "broker-upstream-"));
  const config = runtimeConfig(process.env, {
    codexHome: join(directory, "codex-home"),
    privateSocketPath: join(directory, "upstream.sock"),
    publicSocketPath: join(directory, "public.sock"),
    threadStorePath: join(directory, "threads.json"),
  });
  assert.equal(config.type, "success");
  const records: LogRecord[] = [];
  const runtime = await startBrokerRuntime(config.value, {
    write: (record) => records.push(record),
  });
  assert.equal(runtime.type, "success");

  try {
    const connection = await connectUnixWebSocket(
      config.value.publicSocketPath,
      config.value.maximumMessageBytes,
      config.value.connectionInitializationTimeoutMs,
    );
    try {
      const response = nextTextMessage(connection);
      connection.send(
        JSON.stringify({
          id: 1,
          method: "initialize",
          params: {
            clientInfo: {
              name: "broker-acceptance",
              title: "Broker Acceptance",
              version: "0.3.0",
            },
            capabilities: { experimentalApi: true, requestAttestation: false },
          },
        }),
      );
      const initialized = parseRecord(await response);
      assert.equal(initialized.id, 1);
      assert.equal(typeof initialized.result, "object");
    } finally {
      connection.close(1000, "acceptance complete");
    }
  } finally {
    await runtime.value.close();
    assert.deepEqual(
      records
        .filter(({ event }) =>
          [
            "upstream.ready",
            "broker.ready",
            "broker.listening",
            "connection.initialized",
          ].includes(event),
        )
        .map(({ event }) => event)
        .sort(),
      [
        "broker.listening",
        "broker.ready",
        "connection.initialized",
        "upstream.ready",
      ],
    );
    assert.equal(
      records.filter(({ event }) => event === "upstream.ready").length,
      1,
    );
    assert.equal(
      records.some(({ event }) => event === "provider.acquire"),
      false,
    );
    await rm(directory, { recursive: true, force: true });
  }
});

const nextTextMessage = (websocket: WebSocket): Promise<string> =>
  new Promise((resolve, reject) => {
    websocket.once("message", (data, binary) =>
      binary ? reject(new Error("expected text")) : resolve(data.toString()),
    );
    websocket.once("error", reject);
    websocket.once("close", (code, reason) =>
      reject(new Error(`closed before response: ${code} ${reason.toString()}`)),
    );
  });

const parseRecord = (message: string): Readonly<Record<string, unknown>> => {
  const value: unknown = JSON.parse(message);
  assert.ok(isRecord(value));
  return value;
};

const isRecord = (value: unknown): value is Readonly<Record<string, unknown>> =>
  typeof value === "object" && value !== null && !Array.isArray(value);
