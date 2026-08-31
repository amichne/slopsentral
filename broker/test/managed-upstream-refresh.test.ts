import assert from "node:assert/strict";
import {
  chmod,
  mkdtemp,
  rename,
  rm,
  symlink,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { test } from "node:test";

import type WebSocket from "ws";

import { startBrokerRuntime } from "../src/runtime/broker-runtime.ts";
import { runtimeConfig } from "../src/runtime/config.ts";
import type { LogRecord } from "../src/runtime/logger.ts";
import { connectUnixWebSocket } from "../src/runtime/upstream-connection.ts";
import { compatibleProtocolSchemas } from "./protocol-schema.fixture.ts";

test("new clients share one qualified replacement after Codex changes", async () => {
  const directory = await mkdtemp(join(tmpdir(), "broker-refresh-"));
  const codexExecutable = join(directory, "codex");
  const firstExecutable = join(directory, "codex-first.mjs");
  const secondExecutable = join(directory, "codex-second.mjs");
  const records: LogRecord[] = [];

  await Promise.all([
    writeFakeCodex(firstExecutable, "codex-cli 1.0.0"),
    writeFakeCodex(secondExecutable, "codex-cli 2.0.0"),
  ]);
  await activateExecutable(codexExecutable, firstExecutable);

  const config = runtimeConfig(process.env, {
    codexExecutable,
    codexHome: join(directory, "codex-home"),
    kastExecutable: resolve(import.meta.dirname, "kast-cli.fixture.ts"),
    privateSocketPath: join(directory, "upstream.sock"),
    providerQualificationCwd: import.meta.dirname,
    publicSocketPath: join(directory, "public.sock"),
    threadStorePath: join(directory, "threads.json"),
  });
  assert.equal(config.type, "success");
  const runtime = await startBrokerRuntime(config.value, {
    write: (record) => records.push(record),
  });
  assert.equal(runtime.type, "success", JSON.stringify(runtime));

  try {
    const original = await openInitializedConnection(
      config.value.publicSocketPath,
    );
    try {
      assert.equal(original.userAgent, "codex-cli 1.0.0");

      await activateExecutable(codexExecutable, secondExecutable);

      try {
        assert.deepEqual(
          await Promise.all([
            initialize(config.value.publicSocketPath),
            initialize(config.value.publicSocketPath),
          ]),
          ["codex-cli 2.0.0", "codex-cli 2.0.0"],
        );
      } catch (error) {
        throw new Error(`replacement failed: ${JSON.stringify(records)}`, {
          cause: error,
        });
      }
      try {
        assert.equal(
          await requestUserAgent(original.connection, 2, "fixture/ping", {}),
          "codex-cli 1.0.0",
        );
      } catch (error) {
        throw new Error(
          `original generation failed: ${JSON.stringify(records)}`,
          {
            cause: error,
          },
        );
      }
      assert.equal(runtime.value.codexVersion.value, "codex-cli 2.0.0");
      assert.deepEqual(
        records
          .filter(({ event }) => event === "protocol.qualified")
          .map(({ codexVersion }) => codexVersion),
        ["codex-cli 1.0.0", "codex-cli 2.0.0"],
      );
      assert.equal(
        records.filter(({ event }) => event === "upstream.ready").length,
        2,
      );
      assert.equal(
        records.filter(({ event }) => event === "upstream.replaced").length,
        1,
      );
    } finally {
      original.connection.close(1000, "original generation complete");
    }
  } finally {
    await runtime.value.close();
    await rm(directory, { force: true, recursive: true });
  }
});

const activateExecutable = async (
  codexExecutable: string,
  target: string,
): Promise<void> => {
  const replacement = `${codexExecutable}.replacement`;
  await rm(replacement, { force: true });
  await symlink(target, replacement);
  await rename(replacement, codexExecutable);
};

const writeFakeCodex = async (
  executable: string,
  codexVersion: string,
): Promise<void> => {
  await writeFile(
    executable,
    `#!/usr/bin/env node
import { createServer } from "node:http";
import { mkdir, writeFile } from "node:fs/promises";
import { WebSocketServer } from ${JSON.stringify(import.meta.resolve("ws"))};

const args = process.argv.slice(2);
if (args.length === 1 && args[0] === "--version") {
  process.stdout.write(${JSON.stringify(`${codexVersion}\n`)});
  process.exit(0);
}
if (args[0] === "app-server" && args[1] === "generate-json-schema" && args[2] === "--experimental" && args[3] === "--out") {
  const schemas = ${JSON.stringify(compatibleProtocolSchemas)};
  await mkdir(args[4], { recursive: true });
  for (const [fileName, schema] of Object.entries(schemas)) {
    await writeFile(args[4] + "/" + fileName, JSON.stringify(schema) + "\\n");
  }
  process.exit(0);
}
if (args[0] === "app-server" && args[1] === "--listen" && args[2]?.startsWith("unix://")) {
  const server = createServer();
  const websockets = new WebSocketServer({ server });
  websockets.on("connection", (connection) => {
    connection.on("message", (data) => {
      const request = JSON.parse(data.toString());
      connection.send(JSON.stringify({ id: request.id, result: { userAgent: ${JSON.stringify(codexVersion)} } }));
    });
  });
  server.listen(args[2].slice("unix://".length));
  const close = () => {
    for (const connection of websockets.clients) connection.terminate();
    websockets.close();
    server.close(() => process.exit(0));
  };
  process.once("SIGINT", close);
  process.once("SIGTERM", close);
} else {
  process.exit(64);
}
`,
    "utf8",
  );
  await chmod(executable, 0o755);
};

const initialize = async (socketPath: string): Promise<string> => {
  const initialized = await openInitializedConnection(socketPath);
  initialized.connection.close(1000, "test complete");
  return initialized.userAgent;
};

const openInitializedConnection = async (
  socketPath: string,
): Promise<{ readonly connection: WebSocket; readonly userAgent: string }> => {
  const connection = await connectUnixWebSocket(socketPath, 1024 * 1024, 2_000);
  try {
    return {
      connection,
      userAgent: await requestUserAgent(connection, 1, "initialize", {
        clientInfo: {
          name: "broker-refresh-test",
          title: "Broker Refresh Test",
          version: "test-client",
        },
        capabilities: { experimentalApi: true, requestAttestation: false },
      }),
    };
  } catch (error) {
    connection.close(1011, "initialization failed");
    throw error;
  }
};

const requestUserAgent = async (
  connection: WebSocket,
  id: number,
  method: string,
  params: Readonly<Record<string, unknown>>,
): Promise<string> => {
  const response = nextTextMessage(connection);
  connection.send(JSON.stringify({ id, method, params }));
  const document = parseRecord(await response);
  const result = requireRecord(document.result);
  const userAgent = result.userAgent;
  assert.equal(typeof userAgent, "string");
  if (typeof userAgent !== "string") throw new Error("missing user agent");
  return userAgent;
};

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

const parseRecord = (message: string): Readonly<Record<string, unknown>> =>
  requireRecord(JSON.parse(message));

const requireRecord = (value: unknown): Readonly<Record<string, unknown>> => {
  assert.ok(isRecord(value));
  return value;
};

const isRecord = (value: unknown): value is Readonly<Record<string, unknown>> =>
  typeof value === "object" && value !== null && !Array.isArray(value);
