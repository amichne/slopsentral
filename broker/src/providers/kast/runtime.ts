import { Value } from "@sinclair/typebox/value";

import type {
  InvocationContext,
  Outcome,
  ProviderCallFailure,
} from "../../broker/types.ts";
import type { ProcessExecutor } from "../process.ts";
import type { KastQualification } from "./qualification.ts";
import { qualifyKast } from "./qualification.ts";
import { KastOutput } from "./schemas.ts";

const MAXIMUM_KAST_OUTPUT_BYTES = 512 * 1024;

export interface KastRuntime {
  readonly qualification: KastQualification;
  readonly execute: (
    arguments_: readonly string[],
    context: InvocationContext,
  ) => Promise<Outcome<typeof KastOutput.static, ProviderCallFailure>>;
}

export interface KastRuntimeOptions {
  readonly executable: string;
  readonly processExecutor: ProcessExecutor;
  readonly qualificationCwd: string;
}

export const startKastRuntime = async (
  options: KastRuntimeOptions,
  signal: AbortSignal,
): Promise<Outcome<KastRuntime, { readonly code: string }>> => {
  const qualification = await qualifyKast(options, signal);
  if (qualification.type === "failure") return qualification;

  return {
    type: "success",
    value: {
      qualification: qualification.value,
      execute: (arguments_, context) =>
        executeKast(options, arguments_, context),
    },
  };
};

const executeKast = async (
  options: KastRuntimeOptions,
  arguments_: readonly string[],
  context: InvocationContext,
): Promise<Outcome<typeof KastOutput.static, ProviderCallFailure>> => {
  const result = await options.processExecutor({
    executable: options.executable,
    arguments: arguments_,
    cwd: context.cwd,
    maximumOutputBytes: MAXIMUM_KAST_OUTPUT_BYTES,
    signal: context.signal,
  });
  if (result.type === "failure") {
    return { type: "failure", failure: { code: result.failure.code } };
  }
  const document = parseJson(
    result.value.exitCode === 0 ? result.value.stdout : result.value.stderr,
  );
  const output: unknown =
    document === undefined
      ? undefined
      : result.value.exitCode === 0
        ? { status: "completed", document }
        : { status: "rejected", diagnostic: document };
  return Value.Check(KastOutput, output)
    ? { type: "success", value: Value.Decode(KastOutput, output) }
    : { type: "failure", failure: { code: "MALFORMED_KAST_OUTPUT" } };
};

const parseJson = (text: string): unknown | undefined => {
  try {
    const value: unknown = JSON.parse(text);
    return value;
  } catch {
    return undefined;
  }
};
