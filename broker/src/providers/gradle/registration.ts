import { defineProvider } from "../../broker/index.ts";
import type { ProcessExecutor } from "../process.ts";
import { gradleTools } from "./definitions.ts";
import { createGradleRuntime } from "./runtime.ts";

export interface GradleProviderOptions {
  readonly processExecutor?: ProcessExecutor;
}

export const createGradleRegistration = (options: GradleProviderOptions = {}) =>
  defineProvider({
    namespace: "gradle",
    version: "0.3.0",
    tools: gradleTools,
    start: async () => ({
      type: "success",
      value: createGradleRuntime(options.processExecutor),
    }),
  });
