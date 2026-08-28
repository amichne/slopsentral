import { Value } from "@sinclair/typebox/value";

import { canonicalJson } from "../../broker/canonical.ts";
import type {
  InvocationContext,
  Outcome,
  ProviderCallFailure,
} from "../../broker/types.ts";
import type { ProcessExecutor } from "../process.ts";
import qualification from "./contract/qualification.json" with { type: "json" };
import { KastOutput } from "./schemas.ts";

const MAXIMUM_KAST_OUTPUT_BYTES = 512 * 1024;

export interface KastRuntime {
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
  const version = await options.processExecutor({
    executable: options.executable,
    arguments: ["--version"],
    cwd: options.qualificationCwd,
    maximumOutputBytes: MAXIMUM_KAST_OUTPUT_BYTES,
    signal,
  });
  if (version.type === "failure" || version.value.exitCode !== 0) {
    return { type: "failure", failure: { code: "KAST_VERSION_UNAVAILABLE" } };
  }
  if (version.value.stdout.trim() !== qualification.cliVersion) {
    return { type: "failure", failure: { code: "KAST_VERSION_INCOMPATIBLE" } };
  }
  const schema = await options.processExecutor({
    executable: options.executable,
    arguments: ["--schema"],
    cwd: options.qualificationCwd,
    maximumOutputBytes: MAXIMUM_KAST_OUTPUT_BYTES,
    signal,
  });
  if (schema.type === "failure" || schema.value.exitCode !== 0) {
    return { type: "failure", failure: { code: "KAST_SCHEMA_UNAVAILABLE" } };
  }
  const schemaDocument = parseJson(schema.value.stdout);
  if (
    schemaDocument === undefined ||
    canonicalJson(schemaDocument) !== canonicalJson(qualification.schema)
  ) {
    return { type: "failure", failure: { code: "KAST_SCHEMA_INCOMPATIBLE" } };
  }

  return {
    type: "success",
    value: {
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
