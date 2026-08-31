import type { BrokerFailure } from "../broker/failure.ts";
import type { Outcome, ReloadableBroker } from "../broker/types.ts";
import type { CodexVersion } from "./codex-protocol.ts";
import { startFederatedBroker } from "./composition.ts";
import { BROKER_VERSION } from "./config.ts";
import type { RuntimeConfig } from "./config.ts";
import type { BrokerLogger } from "./logger.ts";
import { startSocketServer } from "./server.ts";
import { FileThreadCatalogStore } from "./thread-store.ts";
import { startManagedUpstream } from "./upstream-process.ts";

export interface RunningBrokerRuntime {
  readonly broker: ReloadableBroker;
  readonly codexVersion: CodexVersion;
  readonly close: () => Promise<void>;
  readonly protocolDigest: string;
  readonly schemaFileCount: number;
}

export const startBrokerRuntime = async (
  config: RuntimeConfig,
  logger: BrokerLogger,
): Promise<Outcome<RunningBrokerRuntime, BrokerFailure>> => {
  const broker = await startFederatedBroker(config, (observation) =>
    logger.write(observation),
  );
  if (broker.type === "failure") return broker;
  const threadStore = await FileThreadCatalogStore.open(config.threadStorePath);
  if (threadStore.type === "failure") {
    await broker.value.close();
    return threadStore;
  }
  const upstream = await startManagedUpstream(config, logger);
  if (upstream.type === "failure") {
    await broker.value.close();
    return upstream;
  }
  let sockets;
  try {
    sockets = await startSocketServer({
      broker: broker.value,
      connectionInitializationTimeoutMs:
        config.connectionInitializationTimeoutMs,
      logger,
      maximumConnections: config.maximumConnections,
      maximumMessageBytes: config.maximumMessageBytes,
      publicSocketPath: config.publicSocketPath,
      threadStore: threadStore.value,
      upstream: upstream.value.connect,
    });
  } catch {
    await upstream.value.close();
    await broker.value.close();
    return { type: "failure", failure: { type: "UpstreamUnavailable" } };
  }
  logger.write({
    event: "broker.ready",
    brokerVersion: BROKER_VERSION,
    catalogDigest: broker.value.catalog.digest,
    providerNamespaces: broker.value.catalog.namespaces.map(({ name }) => name),
    providerVersions: broker.value.catalog.providers.map(
      ({ namespace, version }) => `${namespace}@${version}`,
    ),
    providerRuntimeStates: broker.value.catalog.providers.map(
      ({ namespace }) => `${namespace}=absent`,
    ),
    codexVersion: upstream.value.codexVersion.value,
    protocolDigest: upstream.value.protocolDigest,
    schemaFileCount: upstream.value.schemaFileCount,
    upstreamPid: upstream.value.pid,
  });

  return {
    type: "success",
    value: {
      broker: broker.value,
      get codexVersion() {
        return upstream.value.codexVersion;
      },
      get protocolDigest() {
        return upstream.value.protocolDigest;
      },
      get schemaFileCount() {
        return upstream.value.schemaFileCount;
      },
      close: async () => {
        await sockets.close();
        await upstream.value.close();
        await broker.value.close();
      },
    },
  };
};
