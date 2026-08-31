import { canonicalJson } from "../../broker/canonical.ts";
import type {
  InvocationContext,
  Outcome,
  ToolPresentation,
} from "../../broker/types.ts";
import type { KastCliInvocation, KastServerTool } from "./contract.ts";
import type { KastRuntime } from "./runtime.ts";

export const invokeKastTool = async (
  runtime: KastRuntime,
  tool: KastServerTool,
  input: unknown,
  context: InvocationContext,
) => {
  const arguments_ = bindCliInvocation(tool.invocation, input);
  if (arguments_.type === "failure") return arguments_;
  return runtime.execute(arguments_.value, context);
};

export const presentKastOutput = (
  _tool: KastServerTool,
  output: unknown,
): ToolPresentation => ({
  success: isRecord(output) && output.status === "completed",
  contentItems: [{ type: "inputText", text: canonicalJson(output) }],
});

const bindCliInvocation = (
  invocation: KastCliInvocation,
  input: unknown,
): Outcome<readonly string[], { readonly code: string }> => {
  if (!isRecord(input)) {
    return { type: "failure", failure: { code: "KAST_INPUT_NOT_OBJECT" } };
  }
  const bindings = new Map(
    invocation.bindings.map(
      (binding) => [binding.inputField, binding] as const,
    ),
  );
  if (Object.keys(input).some((field) => !bindings.has(field))) {
    return { type: "failure", failure: { code: "KAST_BINDING_MISMATCH" } };
  }
  const arguments_: string[] = [...invocation.command];
  for (const binding of invocation.bindings) {
    if (!Object.hasOwn(input, binding.inputField)) continue;
    const value = cliScalar(input[binding.inputField]);
    if (value.type === "failure") return value;
    arguments_.push(`${binding.option}=${value.value}`);
  }
  return { type: "success", value: arguments_ };
};

type CliScalar =
  | { readonly type: "encoded"; readonly value: string }
  | { readonly type: "failure"; readonly failure: { readonly code: string } };

const cliScalar = (value: unknown): CliScalar => {
  if (typeof value === "string") return { type: "encoded", value };
  if (typeof value === "boolean") {
    return { type: "encoded", value: value ? "true" : "false" };
  }
  if (typeof value === "number" && Number.isFinite(value)) {
    return { type: "encoded", value: String(value) };
  }
  return { type: "failure", failure: { code: "KAST_OPTION_NOT_SCALAR" } };
};

const isRecord = (value: unknown): value is Readonly<Record<string, unknown>> =>
  typeof value === "object" && value !== null && !Array.isArray(value);
