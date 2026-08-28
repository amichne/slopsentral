import { defineProvider } from "../../broker/index.ts";
import { executeProcess } from "../process.ts";
import type { ProcessExecutor } from "../process.ts";
import { kastTools } from "./definitions.ts";
import { startKastRuntime } from "./runtime.ts";

export interface KastProviderOptions {
  readonly executable?: string;
  readonly processExecutor?: ProcessExecutor;
  readonly qualificationCwd?: string;
}

export const createKastRegistration = (options: KastProviderOptions = {}) =>
  defineProvider({
    namespace: "kast",
    version: "runtime-qualified",
    tools: kastTools,
    start: (signal) => {
      if (options.qualificationCwd === undefined) {
        return Promise.resolve({
          type: "failure" as const,
          failure: { code: "KAST_CONFIGURATION_MISSING" },
        });
      }
      return startKastRuntime(
        {
          executable: options.executable ?? "kast",
          processExecutor: options.processExecutor ?? executeProcess,
          qualificationCwd: options.qualificationCwd,
        },
        signal,
      );
    },
  });
