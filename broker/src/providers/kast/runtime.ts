import type {
  InvocationContext,
  Outcome,
  ProviderCallFailure,
} from "../../broker/types.ts";
import type { ProcessExecutor } from "../process.ts";
import type { KastQualification } from "./qualification.ts";
import { qualifyKast } from "./qualification.ts";

const MAXIMUM_KAST_OUTPUT_BYTES = 512 * 1024;

export interface KastRuntime {
  readonly qualification: KastQualification;
  readonly execute: (
    arguments_: readonly string[],
    context: InvocationContext,
  ) => Promise<Outcome<unknown, ProviderCallFailure>>;
}

export interface KastRuntimeOptions {
  readonly executable: string;
  readonly processExecutor: ProcessExecutor;
  readonly qualificationCwd: string;
}

export const startKastRuntime = async (
  options: KastRuntimeOptions,
  expected: KastQualification,
  signal: AbortSignal,
): Promise<Outcome<KastRuntime, { readonly code: string }>> => {
  const qualification = await qualifyKast(options, signal);
  if (qualification.type === "failure") return qualification;
  if (
    qualification.value.cliVersion !== expected.cliVersion ||
    qualification.value.schemaDigest !== expected.schemaDigest
  ) {
    return {
      type: "failure",
      failure: { code: "KAST_CONTRACT_CHANGED" },
    };
  }

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
): Promise<Outcome<unknown, ProviderCallFailure>> => {
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
  if (document.type === "rejected") {
    return { type: "failure", failure: { code: "MALFORMED_KAST_OUTPUT" } };
  }
  return {
    type: "success",
    value:
      result.value.exitCode === 0
        ? { status: "completed", document: document.value }
        : { status: "rejected", diagnostic: document.value },
  };
};

type JsonParsing =
  | { readonly type: "parsed"; readonly value: unknown }
  | { readonly type: "rejected" };

const parseJson = (text: string): JsonParsing => {
  try {
    const value: unknown = JSON.parse(text);
    return { type: "parsed", value };
  } catch {
    return { type: "rejected" };
  }
};
