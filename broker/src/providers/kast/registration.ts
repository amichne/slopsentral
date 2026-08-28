import { defineProvider } from "../../broker/index.ts";
import type { Outcome, ProviderRegistration } from "../../broker/types.ts";
import { executeProcess } from "../process.ts";
import type { ProcessExecutor } from "../process.ts";
import { createKastTools } from "./definitions.ts";
import type { KastQualificationFailure } from "./qualification.ts";
import { qualifyKast } from "./qualification.ts";
import { startKastRuntime } from "./runtime.ts";

export interface KastProviderOptions {
  readonly executable?: string;
  readonly processExecutor?: ProcessExecutor;
  readonly qualificationCwd: string;
}

export const qualifyKastRegistration = async (
  options: KastProviderOptions,
  signal: AbortSignal,
): Promise<Outcome<ProviderRegistration, KastQualificationFailure>> => {
  const runtimeOptions = {
    executable: options.executable ?? "kast",
    processExecutor: options.processExecutor ?? executeProcess,
    qualificationCwd: options.qualificationCwd,
  };
  const qualification = await qualifyKast(runtimeOptions, signal);
  if (qualification.type === "failure") return qualification;
  const tools = createKastTools(qualification.value.contract);
  return {
    type: "success",
    value: defineProvider({
      namespace: qualification.value.contract.namespace,
      version:
        `${qualification.value.cliVersion}+server` +
        `${qualification.value.serverProjectionVersion}`,
      tools,
      start: (startupSignal) =>
        startKastRuntime(runtimeOptions, qualification.value, startupSignal),
    }),
  };
};
