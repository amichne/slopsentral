import { createBroker } from "../broker/index.ts";
import { createGradleRegistration } from "../providers/gradle/registration.ts";
import { qualifyKastRegistration } from "../providers/kast/registration.ts";
import type { BrokerObserver } from "../broker/types.ts";
import type { RuntimeConfig } from "./config.ts";

export const createFederatedBroker = (
  config: RuntimeConfig,
  observe: BrokerObserver = () => {},
) => createFederatedBrokerRuntime(config, observe);

const createFederatedBrokerRuntime = async (
  config: RuntimeConfig,
  observe: BrokerObserver,
) => {
  const kast = await qualifyKastRegistration(
    {
      executable: config.kastExecutable,
      qualificationCwd: config.providerQualificationCwd,
    },
    AbortSignal.timeout(config.brokerLimits.providerStartupTimeoutMs),
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
  return createBroker(
    [createGradleRegistration(), kast.value],
    config.brokerLimits,
    observe,
  );
};
