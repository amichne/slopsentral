import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createServer } from "node:http";
import type { Server } from "node:http";
import { mkdtemp, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";

import { createBroker } from "../src/broker/index.ts";
import { MemoryThreadCatalogStore } from "../src/protocol/thread-store.ts";
import { startSocketServer } from "../src/runtime/server.ts";
import type { QualifiedUpstreamConnector } from "../src/runtime/upstream-connection.ts";
import { connectUnixWebSocket } from "../src/runtime/upstream-connection.ts";

const unavailableUpstream: QualifiedUpstreamConnector = async () => ({
  type: "failure",
  failure: { type: "UpstreamUnavailable" },
});

test("socket path ownership recovers a socket left by an unclean stop", async () => {
  const directory = await mkdtemp(join(tmpdir(), "broker-stale-socket-"));
  const publicSocketPath = join(directory, "public.sock");
  await leaveStaleSocket(publicSocketPath);
  const broker = createBroker([]);
  assert.equal(broker.type, "success");

  try {
    const running = await startSocketServer({
      broker: broker.value,
      connectionInitializationTimeoutMs: 1_000,
      logger: { write: () => {} },
      maximumConnections: 1,
      maximumMessageBytes: 1024 * 1024,
      publicSocketPath,
      threadStore: new MemoryThreadCatalogStore(),
      upstream: unavailableUpstream,
    });
    try {
      const connection = await connectUnixWebSocket(
        publicSocketPath,
        1024 * 1024,
      );
      connection.close(1000, "ownership proven");
    } finally {
      await running.close();
    }
  } finally {
    await broker.value.close();
    await rm(directory, { force: true, recursive: true });
  }
});

test("socket path ownership refuses to replace a live listener", async () => {
  const directory = await mkdtemp(join(tmpdir(), "broker-live-socket-"));
  const publicSocketPath = join(directory, "public.sock");
  const owner = createServer();
  await listen(owner, publicSocketPath);
  const broker = createBroker([]);
  assert.equal(broker.type, "success");

  try {
    await assert.rejects(
      startSocketServer({
        broker: broker.value,
        connectionInitializationTimeoutMs: 1_000,
        logger: { write: () => {} },
        maximumConnections: 1,
        maximumMessageBytes: 1024 * 1024,
        publicSocketPath,
        threadStore: new MemoryThreadCatalogStore(),
        upstream: unavailableUpstream,
      }),
      /Socket path already/u,
    );
  } finally {
    await close(owner);
    await broker.value.close();
    await rm(directory, { force: true, recursive: true });
  }
});

const leaveStaleSocket = async (socketPath: string): Promise<void> => {
  const child = spawn(
    process.execPath,
    [
      "-e",
      'require("node:net").createServer().listen(process.argv[1], () => process.stdout.write("ready\\n"))',
      socketPath,
    ],
    { stdio: ["ignore", "pipe", "pipe"] },
  );
  try {
    await new Promise<void>((resolve, reject) => {
      child.once("error", reject);
      child.stdout.once("data", (chunk: Buffer) => {
        if (chunk.toString() === "ready\n") resolve();
        else reject(new Error("stale socket fixture did not become ready"));
      });
    });
    assert.equal(child.kill("SIGKILL"), true);
    await new Promise<void>((resolve) => child.once("exit", () => resolve()));
    assert.equal((await stat(socketPath)).isSocket(), true);
  } finally {
    if (child.exitCode === null && child.signalCode === null) {
      child.kill("SIGKILL");
    }
  }
};

const listen = (server: Server, socketPath: string): Promise<void> =>
  new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(socketPath, () => {
      server.removeListener("error", reject);
      resolve();
    });
  });

const close = (server: Server): Promise<void> =>
  new Promise((resolve, reject) =>
    server.close((error) =>
      error === undefined || error === null ? resolve() : reject(error),
    ),
  );
