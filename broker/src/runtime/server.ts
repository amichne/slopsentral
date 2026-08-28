import { createServer } from "node:http";
import { randomUUID } from "node:crypto";
import { chmod, mkdir, rm, stat } from "node:fs/promises";
import { dirname } from "node:path";

import type WebSocket from "ws";
import { WebSocketServer } from "ws";

import type { Broker } from "../broker/types.ts";
import { CodexProtocolAdapter } from "../protocol/adapter.ts";
import type { ProtocolRouting } from "../protocol/adapter.ts";
import type { ThreadCatalogStore } from "../protocol/thread-store.ts";
import type { CodexProtocolValidators } from "../protocol/validators.ts";
import type { BrokerLogger } from "./logger.ts";

export interface SocketServerOptions {
  readonly broker: Broker;
  readonly connectionInitializationTimeoutMs: number;
  readonly logger: BrokerLogger;
  readonly maximumConnections: number;
  readonly maximumMessageBytes: number;
  readonly publicSocketPath: string;
  readonly threadStore: ThreadCatalogStore;
  readonly upstream: () => Promise<WebSocket>;
  readonly validators: CodexProtocolValidators;
}

export interface RunningSocketServer {
  readonly close: () => Promise<void>;
}

export const startSocketServer = async (
  options: SocketServerOptions,
): Promise<RunningSocketServer> => {
  await requireAbsent(options.publicSocketPath);
  await mkdir(dirname(options.publicSocketPath), { recursive: true });
  const server = createServer((_request, response) => {
    response.writeHead(426, { connection: "upgrade", upgrade: "websocket" });
    response.end();
  });
  const websockets = new WebSocketServer({
    noServer: true,
    maxPayload: options.maximumMessageBytes,
  });
  const connections = new Set<WebSocket>();
  server.on("upgrade", (request, socket, head) => {
    if (connections.size >= options.maximumConnections) {
      socket.write(
        "HTTP/1.1 503 Service Unavailable\r\nConnection: close\r\n\r\n",
      );
      socket.destroy();
      return;
    }
    websockets.handleUpgrade(request, socket, head, (downstream) => {
      connections.add(downstream);
      downstream.once("close", () => connections.delete(downstream));
      bridgeConnection(downstream, options).catch(() =>
        downstream.close(1011, "bridge failed"),
      );
    });
  });
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(options.publicSocketPath, () => {
      server.removeListener("error", reject);
      resolve();
    });
  });
  await chmod(options.publicSocketPath, 0o600);
  options.logger.write({
    event: "broker.listening",
    catalogDigest: options.broker.catalog.digest,
    publicSocket: options.publicSocketPath,
  });

  return {
    close: async () => {
      for (const connection of connections) connection.terminate();
      websockets.close();
      const closed = new Promise<void>((resolve, reject) =>
        server.close((error) =>
          error === undefined || error === null ? resolve() : reject(error),
        ),
      );
      server.closeAllConnections();
      await closed;
      await rm(options.publicSocketPath, { force: true });
    },
  };
};

const bridgeConnection = async (
  downstream: WebSocket,
  options: SocketServerOptions,
): Promise<void> => {
  const connectionId = randomUUID();
  const adapter = new CodexProtocolAdapter({
    broker: options.broker,
    observe: (observation) =>
      options.logger.write({ ...observation, connectionId }),
    threadStore: options.threadStore,
    validators: options.validators,
  });
  let upstream: WebSocket | undefined;
  let connectionState: "accepted" | "initializing" | "active" = "accepted";
  let downstreamInFlight = 0;
  let initialization: InitializationGate | undefined;

  downstream.on("message", (data, binary) => {
    if (
      downstreamInFlight >= options.broker.limits.inFlightCallsPerConnection ||
      (connectionState !== "active" && downstreamInFlight > 0)
    ) {
      closeBoth(
        downstream,
        upstream,
        1013,
        "connection concurrency limit exceeded",
      );
      return;
    }
    downstreamInFlight += 1;
    const operation = async () => {
      if (binary) throw new Error("binary frames are unsupported");
      const message = data.toString();
      if (upstream === undefined) {
        if (!isInitializeRequest(message))
          throw new Error("initialize must be first");
        const initializeKey = requestKey(message);
        if (initializeKey === undefined)
          throw new Error("initialize request omitted an id");
        initialization = createInitializationGate();
        connectionState = "initializing";
        upstream = await options.upstream();
        upstream.on("message", (incoming, upstreamBinary) => {
          if (upstreamBinary) {
            closeBoth(
              downstream,
              upstream,
              1003,
              "binary frames are unsupported",
            );
            return;
          }
          adapter
            .fromUpstream(incoming.toString())
            .then((routing) =>
              applyRouting(
                routing,
                downstream,
                upstream,
                options.maximumMessageBytes,
              ),
            )
            .then(() => {
              const status = initializationResponse(
                incoming.toString(),
                initializeKey,
              );
              if (status === "success") initialization?.succeed();
              if (status === "failure")
                initialization?.fail(
                  new Error("upstream initialization failed"),
                );
            })
            .catch((error: unknown) => {
              initialization?.fail(error);
              options.logger.write({
                event: "connection.protocol_failed",
                connectionId,
                phase: "upstream",
                detail: errorDetail(error),
              });
              closeBoth(downstream, upstream, 1011, "protocol failure");
            });
        });
        upstream.once("close", () => {
          adapter.close();
          initialization?.fail(
            new Error("upstream closed during initialization"),
          );
          downstream.close(1011, "upstream closed");
        });
        upstream.once("error", () => {
          adapter.close();
          initialization?.fail(
            new Error("upstream failed during initialization"),
          );
          downstream.close(1011, "upstream failed");
        });
      }
      const routing = await adapter.fromDownstream(message);
      await applyRouting(
        routing,
        downstream,
        upstream,
        options.maximumMessageBytes,
      );
      if (connectionState === "initializing" && initialization !== undefined) {
        await withTimeout(
          initialization.operation,
          options.connectionInitializationTimeoutMs,
          "upstream initialization timed out",
        );
        connectionState = "active";
        options.logger.write({
          event: "connection.initialized",
          connectionId,
          catalogDigest: options.broker.catalog.digest,
          protocolInitialization: "success",
        });
      }
    };
    operation()
      .catch((error: unknown) => {
        options.logger.write({
          event: "connection.protocol_failed",
          connectionId,
          phase: "downstream",
          detail: errorDetail(error),
        });
        closeBoth(downstream, upstream, 1011, "protocol failure");
      })
      .finally(() => {
        downstreamInFlight -= 1;
      });
  });
  downstream.once("close", () => {
    adapter.close();
    initialization?.fail(new Error("downstream closed during initialization"));
    upstream?.close(1001, "downstream closed");
  });
};

const applyRouting = async (
  routing: ProtocolRouting,
  downstream: WebSocket,
  upstream: WebSocket | undefined,
  maximumMessageBytes: number,
): Promise<void> => {
  switch (routing.type) {
    case "forwardUpstream":
    case "replyUpstream":
      if (upstream === undefined) throw new Error("upstream is unavailable");
      await send(upstream, routing.message, maximumMessageBytes);
      return;
    case "forwardDownstream":
    case "replyDownstream":
      await send(downstream, routing.message, maximumMessageBytes);
      return;
    case "close":
      closeBoth(downstream, upstream, 1002, routing.detail);
  }
};

const send = (
  websocket: WebSocket,
  message: string,
  maximumMessageBytes: number,
): Promise<void> =>
  new Promise((resolve, reject) => {
    if (
      Buffer.byteLength(message, "utf8") + websocket.bufferedAmount >
      maximumMessageBytes
    ) {
      reject(new Error("WebSocket output limit exceeded"));
      return;
    }
    websocket.send(message, (error) =>
      error === undefined || error === null ? resolve() : reject(error),
    );
  });

const closeBoth = (
  downstream: WebSocket,
  upstream: WebSocket | undefined,
  code: number,
  reason: string,
) => {
  downstream.close(code, reason.slice(0, 123));
  upstream?.close(code, reason.slice(0, 123));
};

const isInitializeRequest = (message: string): boolean => {
  try {
    const value: unknown = JSON.parse(message);
    return isRecord(value) && value.method === "initialize";
  } catch {
    return false;
  }
};

interface InitializationGate {
  readonly operation: Promise<void>;
  readonly succeed: () => void;
  readonly fail: (error: unknown) => void;
}

const createInitializationGate = (): InitializationGate => {
  let succeed: () => void = () => {};
  let fail: (error: unknown) => void = (_error) => {};
  const operation = new Promise<void>((resolve, reject) => {
    succeed = resolve;
    fail = reject;
  });
  return { operation, succeed, fail };
};

const requestKey = (message: string): string | undefined => {
  try {
    const value: unknown = JSON.parse(message);
    if (!isRecord(value)) return undefined;
    return rpcIdKey(value.id);
  } catch {
    return undefined;
  }
};

const initializationResponse = (
  message: string,
  initializeKey: string,
): "success" | "failure" | "unrelated" => {
  try {
    const value: unknown = JSON.parse(message);
    if (!isRecord(value) || rpcIdKey(value.id) !== initializeKey)
      return "unrelated";
    return value.error === undefined && value.result !== undefined
      ? "success"
      : "failure";
  } catch {
    return "unrelated";
  }
};

const rpcIdKey = (id: unknown): string | undefined =>
  typeof id === "string" || typeof id === "number"
    ? `${typeof id}:${id}`
    : undefined;

const withTimeout = async <Value>(
  operation: Promise<Value>,
  timeoutMs: number,
  detail: string,
): Promise<Value> => {
  let timer: NodeJS.Timeout | undefined;
  const timeout = new Promise<never>((_resolve, reject) => {
    timer = setTimeout(() => reject(new Error(detail)), timeoutMs);
  });
  try {
    return await Promise.race([operation, timeout]);
  } finally {
    if (timer !== undefined) clearTimeout(timer);
  }
};

const isRecord = (value: unknown): value is Readonly<Record<string, unknown>> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const requireAbsent = async (path: string): Promise<void> => {
  try {
    await stat(path);
  } catch (error) {
    if (isNodeError(error) && error.code === "ENOENT") return;
    throw error;
  }
  throw new Error(`Socket path already exists: ${path}`);
};

const isNodeError = (error: unknown): error is NodeJS.ErrnoException =>
  error instanceof Error && "code" in error;

const errorDetail = (error: unknown): string =>
  error instanceof Error ? error.message : "unknown failure";
