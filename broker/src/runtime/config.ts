import { homedir } from "node:os";
import { join, resolve } from "node:path";

import type { BrokerLimits, Outcome } from "../broker/types.ts";

export const BROKER_VERSION = "0.5.0";

export interface RuntimeConfig {
  readonly brokerLimits: BrokerLimits;
  readonly codexExecutable: string;
  readonly codexHome: string;
  readonly connectionInitializationTimeoutMs: number;
  readonly kastExecutable: string;
  readonly maximumConnections: number;
  readonly maximumMessageBytes: number;
  readonly maximumProtocolSchemaBytes: number;
  readonly maximumProtocolSchemaFiles: number;
  readonly privateSocketPath: string;
  readonly protocolQualificationTimeoutMs: number;
  readonly providerQualificationCwd: string;
  readonly publicSocketPath: string;
  readonly threadStorePath: string;
  readonly upstreamStartupTimeoutMs: number;
}

export interface ConfigFailure {
  readonly type: "ConfigInvalid";
  readonly detail: string;
}

export const runtimeConfig = (
  environment: Readonly<NodeJS.ProcessEnv>,
  overrides: Partial<RuntimeConfig> = {},
): Outcome<RuntimeConfig, ConfigFailure> => {
  const codexHome = resolve(
    overrides.codexHome ?? environment.CODEX_HOME ?? join(homedir(), ".codex"),
  );
  const stateDirectory = join(codexHome, "broker");
  const config: RuntimeConfig = {
    brokerLimits: overrides.brokerLimits ?? {
      inFlightCallsPerConnection: 8,
      inFlightCallsPerProvider: 4,
      maximumCatalogBytes: 1024 * 1024,
      maximumDescriptorCount: 64,
      maximumToolArgumentBytes: 64 * 1024,
      maximumToolResultBytes: 1024 * 1024,
      providerInvocationTimeoutMs: 30_000,
      providerStartupTimeoutMs: 10_000,
    },
    codexExecutable:
      overrides.codexExecutable ?? environment.CODEX_EXECUTABLE ?? "codex",
    codexHome,
    connectionInitializationTimeoutMs:
      overrides.connectionInitializationTimeoutMs ?? 10_000,
    kastExecutable:
      overrides.kastExecutable ?? environment.KAST_EXECUTABLE ?? "kast",
    maximumConnections: overrides.maximumConnections ?? 8,
    maximumMessageBytes: overrides.maximumMessageBytes ?? 1024 * 1024,
    maximumProtocolSchemaBytes:
      overrides.maximumProtocolSchemaBytes ?? 32 * 1024 * 1024,
    maximumProtocolSchemaFiles: overrides.maximumProtocolSchemaFiles ?? 2_048,
    privateSocketPath: resolve(
      overrides.privateSocketPath ?? join(stateDirectory, "upstream.sock"),
    ),
    protocolQualificationTimeoutMs:
      overrides.protocolQualificationTimeoutMs ?? 30_000,
    providerQualificationCwd: resolve(
      overrides.providerQualificationCwd ??
        environment.BROKER_PROVIDER_CWD ??
        process.cwd(),
    ),
    publicSocketPath: resolve(
      overrides.publicSocketPath ??
        join(codexHome, "app-server-control", "app-server-control.sock"),
    ),
    threadStorePath: resolve(
      overrides.threadStorePath ?? join(stateDirectory, "threads.json"),
    ),
    upstreamStartupTimeoutMs: overrides.upstreamStartupTimeoutMs ?? 10_000,
  };
  const positive = [
    config.maximumConnections,
    config.maximumMessageBytes,
    config.maximumProtocolSchemaBytes,
    config.maximumProtocolSchemaFiles,
    config.connectionInitializationTimeoutMs,
    config.protocolQualificationTimeoutMs,
    config.upstreamStartupTimeoutMs,
    config.brokerLimits.inFlightCallsPerProvider,
    config.brokerLimits.inFlightCallsPerConnection,
    config.brokerLimits.maximumCatalogBytes,
    config.brokerLimits.maximumDescriptorCount,
    config.brokerLimits.maximumToolArgumentBytes,
    config.brokerLimits.maximumToolResultBytes,
    config.brokerLimits.providerInvocationTimeoutMs,
    config.brokerLimits.providerStartupTimeoutMs,
  ].every((value) => Number.isSafeInteger(value) && value > 0);
  if (!positive) {
    return {
      type: "failure",
      failure: {
        type: "ConfigInvalid",
        detail: "all limits must be positive integers",
      },
    };
  }
  if (config.publicSocketPath === config.privateSocketPath) {
    return {
      type: "failure",
      failure: {
        type: "ConfigInvalid",
        detail: "public and private sockets must differ",
      },
    };
  }
  return { type: "success", value: config };
};
