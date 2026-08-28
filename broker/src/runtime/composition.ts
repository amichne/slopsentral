import { createBroker } from "../broker/index.ts";
import { createGradleRegistration } from "../providers/gradle/registration.ts";
import { createKastRegistration } from "../providers/kast/registration.ts";
import type { BrokerObserver } from "../broker/types.ts";
import type { RuntimeConfig } from "./config.ts";

export const createFederatedBroker = (
  config: RuntimeConfig,
  observe: BrokerObserver = () => {},
) =>
  createBroker(
    [
      createGradleRegistration(),
      createKastRegistration({
        executable: config.kastExecutable,
        qualificationCwd: config.providerQualificationCwd,
      }),
    ],
    config.brokerLimits,
    observe,
  );
