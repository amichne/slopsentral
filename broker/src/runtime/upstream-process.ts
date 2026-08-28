import { spawn } from "node:child_process";
import { chmod, mkdir, rm, stat } from "node:fs/promises";
import { dirname } from "node:path";

import type WebSocket from "ws";

import type { BrokerFailure } from "../broker/failure.ts";
import type { Outcome } from "../broker/types.ts";
import type { CodexProtocolValidators } from "../protocol/validators.ts";
import { qualifyCodexProtocol } from "./codex-protocol.ts";
import type { RuntimeConfig } from "./config.ts";
import type { BrokerLogger } from "./logger.ts";
import { connectUnixWebSocket } from "./upstream-connection.ts";

export interface ManagedUpstream {
  readonly codexVersion: string;
  readonly connect: () => Promise<WebSocket>;
  readonly close: () => Promise<void>;
  readonly pid: number;
  readonly protocolDigest: string;
  readonly schemaFileCount: number;
  readonly validators: CodexProtocolValidators;
}

export const startManagedUpstream = async (
  config: RuntimeConfig,
  logger: BrokerLogger,
): Promise<Outcome<ManagedUpstream, BrokerFailure>> => {
  try {
    return await startManagedUpstreamChecked(config, logger);
  } catch {
    return { type: "failure", failure: { type: "UpstreamUnavailable" } };
  }
};

const startManagedUpstreamChecked = async (
  config: RuntimeConfig,
  logger: BrokerLogger,
): Promise<Outcome<ManagedUpstream, BrokerFailure>> => {
  if (await pathExists(config.privateSocketPath)) {
    return { type: "failure", failure: { type: "UpstreamUnavailable" } };
  }
  await Promise.all([
    mkdir(config.codexHome, { recursive: true }),
    mkdir(dirname(config.privateSocketPath), { recursive: true }),
  ]);
  const qualification = await qualifyCodexProtocol({
    codexExecutable: config.codexExecutable,
    codexHome: config.codexHome,
    maximumSchemaBytes: config.maximumProtocolSchemaBytes,
    maximumSchemaFiles: config.maximumProtocolSchemaFiles,
    timeoutMs: config.protocolQualificationTimeoutMs,
  });
  if (qualification.type === "failure") return qualification;
  logger.write({
    event: "protocol.qualified",
    codexVersion: qualification.value.codexVersion,
    protocolDigest: qualification.value.protocolDigest,
    schemaFileCount: qualification.value.schemaFileCount,
  });
  const child = spawn(
    config.codexExecutable,
    ["app-server", "--listen", `unix://${config.privateSocketPath}`],
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
  const ready = await waitForUpstream(child, config, () => spawnFailed);
  if (!ready) {
    child.kill("SIGTERM");
    return { type: "failure", failure: { type: "UpstreamUnavailable" } };
  }
  const pid = child.pid;
  if (pid === undefined) {
    child.kill("SIGTERM");
    return { type: "failure", failure: { type: "UpstreamUnavailable" } };
  }
  await chmod(config.privateSocketPath, 0o600);
  logger.write({
    event: "upstream.ready",
    codexVersion: qualification.value.codexVersion,
    pid,
  });

  return {
    type: "success",
    value: {
      codexVersion: qualification.value.codexVersion,
      pid,
      protocolDigest: qualification.value.protocolDigest,
      schemaFileCount: qualification.value.schemaFileCount,
      validators: qualification.value.validators,
      connect: () =>
        connectUnixWebSocket(
          config.privateSocketPath,
          config.maximumMessageBytes,
          config.connectionInitializationTimeoutMs,
        ),
      close: async () => {
        if (child.exitCode === null && child.signalCode === null) {
          child.kill("SIGTERM");
          const exited = await waitForExit(child, 2_000);
          if (!exited) child.kill("SIGKILL");
        }
        await rm(config.privateSocketPath, { force: true });
      },
    },
  };
};

const waitForUpstream = async (
  child: ReturnType<typeof spawn>,
  config: RuntimeConfig,
  spawnFailed: () => boolean,
): Promise<boolean> => {
  const deadline = Date.now() + config.upstreamStartupTimeoutMs;
  while (Date.now() < deadline) {
    if (spawnFailed() || child.exitCode !== null || child.signalCode !== null)
      return false;
    if (await pathExists(config.privateSocketPath)) {
      try {
        const probe = await connectUnixWebSocket(
          config.privateSocketPath,
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
