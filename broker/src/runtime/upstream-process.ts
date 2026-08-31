import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { chmod, mkdir, rm, stat } from "node:fs/promises";
import { dirname, join } from "node:path";

import type WebSocket from "ws";

import type { BrokerFailure } from "../broker/failure.ts";
import type { Outcome } from "../broker/types.ts";
import type { CodexProtocolValidators } from "../protocol/validators.ts";
import type {
  CodexProtocolQualification,
  CodexVersion,
} from "./codex-protocol.ts";
import { qualifyCodexProtocol, readCodexVersion } from "./codex-protocol.ts";
import type { RuntimeConfig } from "./config.ts";
import type { BrokerLogger } from "./logger.ts";
import type { QualifiedUpstreamConnector } from "./upstream-connection.ts";
import { connectUnixWebSocket } from "./upstream-connection.ts";

export interface ManagedUpstream {
  readonly codexVersion: CodexVersion;
  readonly connect: QualifiedUpstreamConnector;
  readonly close: () => Promise<void>;
  readonly pid: number;
  readonly protocolDigest: string;
  readonly schemaFileCount: number;
}

interface RunningUpstreamProcess {
  readonly codexVersion: CodexVersion;
  readonly connect: () => Promise<WebSocket>;
  readonly close: () => Promise<void>;
  readonly pid: number;
  readonly protocolDigest: string;
  readonly retire: () => Promise<void>;
  readonly schemaFileCount: number;
  readonly validators: CodexProtocolValidators;
}

export const startManagedUpstream = async (
  config: RuntimeConfig,
  logger: BrokerLogger,
): Promise<Outcome<ManagedUpstream, BrokerFailure>> => {
  try {
    const initial = await qualifyAndStartUpstream(config, logger);
    if (initial.type === "failure") return initial;
    let active: RunningUpstreamProcess | undefined = initial.value;
    let lastRunning = initial.value;
    const retired = new Set<RunningUpstreamProcess>();
    let transition:
      Promise<Outcome<RunningUpstreamProcess, BrokerFailure>> | undefined;
    let closed = false;

    const ensureCurrent = (): Promise<
      Outcome<RunningUpstreamProcess, BrokerFailure>
    > => {
      if (transition !== undefined) return transition;
      const operation = refreshUpstream().catch(
        (): Outcome<never, BrokerFailure> => ({
          type: "failure",
          failure: { type: "UpstreamUnavailable" },
        }),
      );
      transition = operation;
      void operation.then(() => {
        if (transition === operation) transition = undefined;
      });
      return operation;
    };

    const refreshUpstream = async (): Promise<
      Outcome<RunningUpstreamProcess, BrokerFailure>
    > => {
      if (closed) return unavailable();
      const version = await readCodexVersion({
        codexExecutable: config.codexExecutable,
        codexHome: config.codexHome,
        timeoutMs: config.protocolQualificationTimeoutMs,
      });
      if (version.type === "failure") return version;
      if (active !== undefined && version.value.equals(active.codexVersion)) {
        return { type: "success", value: active };
      }
      const qualification = await qualifyCodexProtocol({
        codexExecutable: config.codexExecutable,
        codexHome: config.codexHome,
        maximumSchemaBytes: config.maximumProtocolSchemaBytes,
        maximumSchemaFiles: config.maximumProtocolSchemaFiles,
        timeoutMs: config.protocolQualificationTimeoutMs,
      });
      if (qualification.type === "failure") return qualification;
      if (closed) return unavailable();

      const previous = active;
      const replacement = await startQualifiedUpstream(
        config,
        logger,
        qualification.value,
        replacementSocketPath(config),
      );
      if (replacement.type === "failure") return replacement;
      if (closed) {
        await replacement.value.close();
        return unavailable();
      }
      active = replacement.value;
      lastRunning = replacement.value;
      if (previous !== undefined) {
        retired.add(previous);
        void previous.retire().then(
          () => {
            retired.delete(previous);
            logger.write({
              event: "upstream.retired",
              codexVersion: previous.codexVersion.value,
              pid: previous.pid,
            });
          },
          () => {
            logger.write({
              event: "upstream.retirement_failed",
              codexVersion: previous.codexVersion.value,
              pid: previous.pid,
            });
          },
        );
        logger.write({
          event: "upstream.replaced",
          previousCodexVersion: previous.codexVersion.value,
          previousPid: previous.pid,
          codexVersion: replacement.value.codexVersion.value,
          pid: replacement.value.pid,
        });
      }
      return replacement;
    };

    return {
      type: "success",
      value: {
        get codexVersion() {
          return lastRunning.codexVersion;
        },
        get pid() {
          return lastRunning.pid;
        },
        get protocolDigest() {
          return lastRunning.protocolDigest;
        },
        get schemaFileCount() {
          return lastRunning.schemaFileCount;
        },
        connect: async () => {
          const current = await ensureCurrent();
          if (current.type === "failure") return current;
          try {
            return {
              type: "success",
              value: {
                connection: await current.value.connect(),
                validators: current.value.validators,
              },
            };
          } catch {
            return unavailable();
          }
        },
        close: async () => {
          closed = true;
          await transition;
          const current = active;
          active = undefined;
          const processes = [
            ...retired,
            ...(current === undefined ? [] : [current]),
          ];
          retired.clear();
          await Promise.all(processes.map((process) => process.close()));
        },
      },
    };
  } catch {
    return unavailable();
  }
};

const qualifyAndStartUpstream = async (
  config: RuntimeConfig,
  logger: BrokerLogger,
): Promise<Outcome<RunningUpstreamProcess, BrokerFailure>> => {
  const qualification = await qualifyCodexProtocol({
    codexExecutable: config.codexExecutable,
    codexHome: config.codexHome,
    maximumSchemaBytes: config.maximumProtocolSchemaBytes,
    maximumSchemaFiles: config.maximumProtocolSchemaFiles,
    timeoutMs: config.protocolQualificationTimeoutMs,
  });
  if (qualification.type === "failure") return qualification;
  return startQualifiedUpstream(
    config,
    logger,
    qualification.value,
    config.privateSocketPath,
  );
};

const startQualifiedUpstream = async (
  config: RuntimeConfig,
  logger: BrokerLogger,
  qualification: CodexProtocolQualification,
  socketPath: string,
): Promise<Outcome<RunningUpstreamProcess, BrokerFailure>> => {
  if (await pathExists(socketPath)) return unavailable();
  await Promise.all([
    mkdir(config.codexHome, { recursive: true }),
    mkdir(dirname(socketPath), { recursive: true }),
  ]);
  logger.write({
    event: "protocol.qualified",
    codexVersion: qualification.codexVersion.value,
    protocolDigest: qualification.protocolDigest,
    schemaFileCount: qualification.schemaFileCount,
  });
  const child = spawn(
    config.codexExecutable,
    ["app-server", "--listen", `unix://${socketPath}`],
    {
      env: { ...process.env, CODEX_HOME: config.codexHome },
      stdio: ["ignore", "ignore", "pipe"],
    },
  );
  let spawnFailed = false;
  child.once("error", () => {
    spawnFailed = true;
  });
  child.stderr.on("data", (chunk: Buffer) => {
    logger.write({ event: "upstream.stderr", bytes: chunk.byteLength });
  });
  const ready = await waitForUpstream(
    child,
    config,
    socketPath,
    () => spawnFailed,
  );
  if (!ready) {
    child.kill("SIGTERM");
    return { type: "failure", failure: { type: "UpstreamUnavailable" } };
  }
  const pid = child.pid;
  if (pid === undefined) {
    child.kill("SIGTERM");
    return { type: "failure", failure: { type: "UpstreamUnavailable" } };
  }
  await chmod(socketPath, 0o600);
  logger.write({
    event: "upstream.ready",
    codexVersion: qualification.codexVersion.value,
    pid,
  });

  const connections = new Set<WebSocket>();
  let pendingConnections = 0;
  let retired = false;
  let closing: Promise<void> | undefined;
  let completeRetirement: () => void = () => {};
  let failRetirement: (error: unknown) => void = () => {};
  const retirement = new Promise<void>((resolve, reject) => {
    completeRetirement = resolve;
    failRetirement = reject;
  });
  const stopProcess = (): Promise<void> => {
    if (closing !== undefined) return closing;
    closing = (async () => {
      if (child.exitCode === null && child.signalCode === null) {
        child.kill("SIGTERM");
        const exited = await waitForExit(child, 2_000);
        if (!exited) child.kill("SIGKILL");
      }
      await rm(socketPath, { force: true });
    })();
    return closing;
  };
  const stopWhenDrained = () => {
    if (!retired || pendingConnections > 0 || connections.size > 0) return;
    void stopProcess().then(completeRetirement, failRetirement);
  };

  return {
    type: "success",
    value: {
      codexVersion: qualification.codexVersion,
      pid,
      protocolDigest: qualification.protocolDigest,
      schemaFileCount: qualification.schemaFileCount,
      validators: qualification.validators,
      connect: async () => {
        if (retired) throw new Error("upstream generation is retired");
        pendingConnections += 1;
        try {
          const connection = await connectUnixWebSocket(
            socketPath,
            config.maximumMessageBytes,
            config.connectionInitializationTimeoutMs,
          );
          if (retired) {
            connection.terminate();
            throw new Error("upstream generation retired during connection");
          }
          connections.add(connection);
          connection.once("close", () => {
            connections.delete(connection);
            stopWhenDrained();
          });
          return connection;
        } finally {
          pendingConnections -= 1;
          stopWhenDrained();
        }
      },
      retire: () => {
        retired = true;
        stopWhenDrained();
        return retirement;
      },
      close: async () => {
        retired = true;
        for (const connection of connections) connection.terminate();
        connections.clear();
        await stopProcess();
        completeRetirement();
      },
    },
  };
};

const replacementSocketPath = (config: RuntimeConfig): string =>
  join(
    dirname(config.privateSocketPath),
    `u-${randomUUID().replaceAll("-", "").slice(0, 10)}`,
  );

const unavailable = (): Outcome<never, BrokerFailure> => ({
  type: "failure",
  failure: { type: "UpstreamUnavailable" },
});

const waitForUpstream = async (
  child: ReturnType<typeof spawn>,
  config: RuntimeConfig,
  socketPath: string,
  spawnFailed: () => boolean,
): Promise<boolean> => {
  const deadline = Date.now() + config.upstreamStartupTimeoutMs;
  while (Date.now() < deadline) {
    if (spawnFailed() || child.exitCode !== null || child.signalCode !== null)
      return false;
    if (await pathExists(socketPath)) {
      try {
        const probe = await connectUnixWebSocket(
          socketPath,
          config.maximumMessageBytes,
          Math.min(500, config.connectionInitializationTimeoutMs),
        );
        probe.close(1000, "readiness probe");
        return true;
      } catch {
        // The socket exists before the listener is always ready to upgrade.
      }
    }
    await new Promise<void>((resolve) => setTimeout(resolve, 25));
  }
  return false;
};

const waitForExit = (
  child: ReturnType<typeof spawn>,
  timeoutMs: number,
): Promise<boolean> =>
  new Promise((resolve) => {
    if (child.exitCode !== null || child.signalCode !== null) {
      resolve(true);
      return;
    }
    const timer = setTimeout(() => {
      child.removeListener("exit", exited);
      resolve(false);
    }, timeoutMs);
    const exited = () => {
      clearTimeout(timer);
      resolve(true);
    };
    child.once("exit", exited);
  });

const pathExists = async (path: string): Promise<boolean> => {
  try {
    await stat(path);
    return true;
  } catch (error) {
    if (isNodeError(error) && error.code === "ENOENT") return false;
    throw error;
  }
};

const isNodeError = (error: unknown): error is NodeJS.ErrnoException =>
  error instanceof Error && "code" in error;
