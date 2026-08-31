import { buildCatalog } from "./catalog.ts";
import { DEFAULT_BROKER_LIMITS } from "./defaults.ts";
import type {
  Broker,
  BrokerLimits,
  BrokerObserver,
  ProviderRegistration,
} from "./types.ts";

export const createBroker = (
  providers: readonly ProviderRegistration[],
  limits: BrokerLimits = DEFAULT_BROKER_LIMITS,
  observe: BrokerObserver = () => {},
) => {
  const catalog = buildCatalog(providers, limits);
  if (catalog.type === "failure") return catalog;
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
  let acceptingDispatch = true;
  let activeDispatches = 0;
  let completeDrain: (() => void) | undefined;
  let closeOperation: Promise<void> | undefined;
  const broker: Broker = {
    catalog: catalog.value,
    limits,
    dispatch: async (request) => {
      if (!acceptingDispatch) {
        return { type: "failure", failure: { type: "BrokerClosed" } };
      }
      activeDispatches += 1;
      try {
        const provider = registry.get(request.namespace);
        if (provider === undefined) {
          return {
            type: "failure",
            failure: {
              type: "UnknownNamespace",
              namespace: request.namespace,
            },
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
        return await tool.dispatch(request.arguments, request.context);
      } finally {
        activeDispatches -= 1;
        if (activeDispatches === 0) completeDrain?.();
      }
    },
    close: () => {
      if (closeOperation !== undefined) return closeOperation;
      acceptingDispatch = false;
      closeOperation = (async () => {
        if (activeDispatches > 0) {
          await new Promise<void>((resolve) => {
            completeDrain = resolve;
          });
        }
        await Promise.all(
          [...registry.values()].map((provider) => provider.close()),
        );
      })();
      return closeOperation;
    },
  };
  return { type: "success" as const, value: broker };
};
