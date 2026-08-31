import type { BrokerLimits } from "./types.ts";

export const DEFAULT_BROKER_LIMITS: BrokerLimits = Object.freeze({
  inFlightCallsPerConnection: 8,
  inFlightCallsPerProvider: 4,
  maximumCatalogBytes: 1024 * 1024,
  maximumDescriptorCount: 64,
  maximumToolArgumentBytes: 64 * 1024,
  maximumToolResultBytes: 1024 * 1024,
  providerInvocationTimeoutMs: 30_000,
  providerStartupTimeoutMs: 10_000,
});
