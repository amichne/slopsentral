import { buildCatalog } from "./catalog.ts";
import type {
  Broker,
  BrokerLimits,
  BrokerObserver,
  ProviderRegistration,
} from "./types.ts";

export { defineProvider, defineTool } from "./definition.ts";

const DEFAULT_LIMITS: BrokerLimits = {
  inFlightCallsPerConnection: 8,
  inFlightCallsPerProvider: 4,
  maximumCatalogBytes: 1024 * 1024,
  maximumDescriptorCount: 64,
  maximumToolArgumentBytes: 64 * 1024,
  maximumToolResultBytes: 1024 * 1024,
  providerInvocationTimeoutMs: 30_000,
  providerStartupTimeoutMs: 10_000,
};

export const createBroker = (
  providers: readonly ProviderRegistration[],
  limits: BrokerLimits = DEFAULT_LIMITS,
  observe: BrokerObserver = () => {},
) => {
  const catalog = buildCatalog(providers, limits);
  if (catalog.type === "failure") {
    return catalog;
  }
  const safelyObserve: BrokerObserver = (observation) => {
    try {
      observe(observation);
    } catch {
      // Observability must not alter broker semantics.
    }
  };

  const registry = new Map(
    providers.map((provider) => {
      const registered = provider.bind(limits, safelyObserve);
      return [registered.namespace, registered] as const;
    }),
  );
  const broker: Broker = {
    catalog: catalog.value,
    limits,
    dispatch: async (request) => {
      const provider = registry.get(request.namespace);
      if (provider === undefined) {
        return {
          type: "failure",
          failure: { type: "UnknownNamespace", namespace: request.namespace },
        };
      }
      const tool = provider.tools.get(request.tool);
      if (tool === undefined) {
        return {
          type: "failure",
          failure: {
            type: "UnknownTool",
            namespace: request.namespace,
            tool: request.tool,
          },
        };
      }
      return tool.dispatch(request.arguments, request.context);
    },
    close: async () => {
      await Promise.all(
        [...registry.values()].map((provider) => provider.close()),
      );
    },
  };
  return { type: "success" as const, value: broker };
};
