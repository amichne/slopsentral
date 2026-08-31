import { createBroker, startReloadableBroker } from "../broker/index.ts";
import { createGradleRegistration } from "../providers/gradle/registration.ts";
import { qualifyKastRegistration } from "../providers/kast/registration.ts";
import type {
  BrokerObserver,
  BrokerSchemaLoader,
  Outcome,
  ProviderRegistration,
} from "../broker/types.ts";
import type { BrokerFailure } from "../broker/failure.ts";
import type { RuntimeConfig } from "./config.ts";

export const createFederatedBroker = (
  config: RuntimeConfig,
  observe: BrokerObserver = () => {},
) => createFederatedBrokerRuntime(config, observe);

export const startFederatedBroker = (
  config: RuntimeConfig,
  observe: BrokerObserver = () => {},
) =>
  startReloadableBroker(federatedSchemaLoader(config), {
    limits: config.brokerLimits,
    observe,
  });

const createFederatedBrokerRuntime = async (
  config: RuntimeConfig,
  observe: BrokerObserver,
) => {
  const schemas = await federatedSchemaLoader(config)(
    AbortSignal.timeout(config.brokerLimits.providerStartupTimeoutMs),
  );
  if (schemas.type === "failure") return schemas;
  return createBroker(schemas.value, config.brokerLimits, observe);
};

const federatedSchemaLoader =
  (config: RuntimeConfig): BrokerSchemaLoader =>
  async (
    signal,
  ): Promise<Outcome<readonly ProviderRegistration[], BrokerFailure>> => {
    const kast = await qualifyKastRegistration(
      {
        executable: config.kastExecutable,
        qualificationCwd: config.providerQualificationCwd,
      },
      signal,
    );
    if (kast.type === "failure") {
      return {
        type: "failure" as const,
        failure: {
          type: "ProviderStartupFailed" as const,
          namespace: "kast",
          code: kast.failure.code,
        },
      };
    }
    return {
      type: "success",
      value: [createGradleRegistration(), kast.value],
    };
  };
