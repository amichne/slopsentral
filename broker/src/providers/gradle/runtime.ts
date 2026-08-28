import { constants } from "node:fs";
import { access } from "node:fs/promises";
import { join } from "node:path";

import type {
  InvocationContext,
  Outcome,
  ProviderCallFailure,
} from "../../broker/types.ts";
import { executeProcess } from "../process.ts";
import type { ProcessExecutor, ProcessResult } from "../process.ts";

const MAXIMUM_GRADLE_OUTPUT_BYTES = 512 * 1024;

export interface GradleRuntime {
  readonly execute: (
    arguments_: readonly string[],
    context: InvocationContext,
  ) => Promise<Outcome<ProcessResult, ProviderCallFailure>>;
}

export const createGradleRuntime = (
  processExecutor: ProcessExecutor = executeProcess,
): GradleRuntime => ({
  execute: async (arguments_, context) => {
    const executable = join(context.cwd, "gradlew");
    try {
      await access(executable, constants.X_OK);
    } catch {
      return {
        type: "failure",
        failure: { code: "GRADLE_WRAPPER_UNAVAILABLE" },
      };
    }
    const result = await processExecutor({
      executable,
      arguments: ["--console=plain", "--no-daemon", ...arguments_],
      cwd: context.cwd,
      maximumOutputBytes: MAXIMUM_GRADLE_OUTPUT_BYTES,
      signal: context.signal,
    });
    return result.type === "success"
      ? result
      : { type: "failure", failure: { code: result.failure.code } };
  },
});
