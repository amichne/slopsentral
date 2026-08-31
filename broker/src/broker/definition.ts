import type { TSchema } from "@sinclair/typebox";
import { Value } from "@sinclair/typebox/value";

import { canonicalJson, sha256 } from "./canonical.ts";
import type { BrokerFailure } from "./failure.ts";
import { ProviderLifecycle } from "./lifecycle.ts";
import { BoundedSemaphore } from "./semaphore.ts";
import type {
  BrokerLimits,
  BrokerObserver,
  DecodedToolInvocation,
  InvocationContext,
  Outcome,
  ProviderDefinition,
  ProviderRegistration,
  ProviderSchema,
  ProviderSchemaCapability,
  ProviderToolSchema,
  ToolDefinition,
  ToolDefinitionSpec,
} from "./types.ts";

export const defineProviderSchema = <
  const Tool extends ProviderToolSchema,
  const Schema extends ProviderSchema<Tool>,
>(
  schema: Schema,
): Schema => deepFreeze(schema);

export const registerProviderSchema = <
  Runtime,
  const Tool extends ProviderToolSchema,
>(
  schema: ProviderSchema<Tool>,
  capability: ProviderSchemaCapability<Runtime, Tool>,
): ProviderRegistration => {
  const admittedSchema = deepFreeze(schema);
  return defineProvider({
    namespace: admittedSchema.namespace,
    schemaDigest: providerSchemaDigest(admittedSchema),
    version: admittedSchema.version,
    tools: admittedSchema.tools.map((tool) =>
      defineTool<Runtime, TSchema, TSchema>({
        name: tool.name,
        description: tool.description,
        input: tool.inputSchema,
        output: tool.outputSchema,
        loading: tool.loading,
        invoke: (runtime, input, context) =>
          capability.invoke(runtime, tool, input, context),
        present: (output) => capability.present(tool, output),
      }),
    ),
    start: capability.start,
    ...(capability.stop === undefined ? {} : { stop: capability.stop }),
  });
};

export const defineTool = <
  Runtime,
  const InputSchema extends TSchema,
  const OutputSchema extends TSchema,
>(
  spec: ToolDefinitionSpec<Runtime, InputSchema, OutputSchema>,
): ToolDefinition<Runtime> => ({
  name: spec.name,
  description: spec.description,
  inputSchema: spec.input,
  outputSchema: spec.output,
  loading: spec.loading,
  decode: (raw): Outcome<DecodedToolInvocation<Runtime>, string> => {
    if (!Value.Check(spec.input, raw)) {
      const first = Value.Errors(spec.input, raw).First();
      return {
        type: "failure",
        failure:
          first === undefined
            ? "input does not match schema"
            : `${first.path}: ${first.message}`,
      };
    }
    const input = Value.Decode(spec.input, raw);
    return {
      type: "success",
      value: {
        invoke: async (runtime, context) => {
          const result = await spec.invoke(runtime, input, context);
          if (result.type === "failure") {
            return result;
          }
          if (!Value.Check(spec.output, result.value)) {
            return {
              type: "failure",
              failure: { code: "RESULT_SCHEMA_MISMATCH" },
            };
          }
          try {
            return {
              type: "success",
              value: spec.present(Value.Decode(spec.output, result.value)),
            };
          } catch {
            return {
              type: "failure",
              failure: { code: "RESULT_PRESENTATION_FAILED" },
            };
          }
        },
      },
    };
  },
});

export const defineProvider = <Runtime>(
  definition: ProviderDefinition<Runtime>,
): ProviderRegistration => {
  const tools = definition.tools.map((tool) => ({
    name: tool.name,
    description: tool.description,
    inputSchema: tool.inputSchema,
    outputSchema: tool.outputSchema,
    loading: tool.loading,
  }));
  return {
    descriptor: {
      namespace: definition.namespace,
      schemaDigest:
        definition.schemaDigest ??
        providerSchemaDigest({
          namespace: definition.namespace,
          version: definition.version,
          tools,
        }),
      version: definition.version,
      tools,
    },
    bind: (limits, observe) => bindProvider(definition, limits, observe),
  };
};

const providerSchemaDigest = <Tool extends ProviderToolSchema>(
  schema: ProviderSchema<Tool>,
): string =>
  sha256(
    canonicalJson({
      ...schema,
      tools: [...schema.tools].sort((left, right) =>
        left.name.localeCompare(right.name),
      ),
    }),
  );

const deepFreeze = <Value>(value: Value): Value => {
  if (typeof value !== "object" || value === null || Object.isFrozen(value)) {
    return value;
  }
  Object.freeze(value);
  for (const key of Reflect.ownKeys(value)) {
    deepFreeze(Reflect.get(value, key));
  }
  return value;
};

const bindProvider = <Runtime>(
  definition: ProviderDefinition<Runtime>,
  limits: BrokerLimits,
  observe: BrokerObserver,
) => {
  const lifecycle = new ProviderLifecycle(
    definition,
    limits.providerStartupTimeoutMs,
  );
  const semaphore = new BoundedSemaphore(limits.inFlightCallsPerProvider);
  const tools = new Map(
    definition.tools.map((tool) => [
      tool.name,
      {
        dispatch: (raw: unknown, context: InvocationContext) =>
          dispatchTool(
            tool,
            lifecycle,
            semaphore,
            limits,
            observe,
            raw,
            context,
          ),
      },
    ]),
  );
  return {
    namespace: definition.namespace,
    tools,
    close: () => lifecycle.close(),
  };
};

const dispatchTool = async <Runtime>(
  tool: ToolDefinition<Runtime>,
  lifecycle: ProviderLifecycle<Runtime>,
  semaphore: BoundedSemaphore,
  limits: BrokerLimits,
  observe: BrokerObserver,
  raw: unknown,
  context: InvocationContext,
): Promise<Outcome<import("./types.ts").ToolPresentation, BrokerFailure>> => {
  const decoded = tool.decode(raw);
  if (decoded.type === "failure") {
    observe({
      event: "invocation.decode",
      invocationId: context.invocationId,
      outcome: "rejected",
      provider: lifecycle.namespace,
      tool: `${lifecycle.namespace}.${tool.name}`,
    });
    return {
      type: "failure",
      failure: {
        type: "InvalidArguments",
        tool: `${lifecycle.namespace}.${tool.name}`,
        detail: decoded.failure,
      },
    };
  }
  observe({
    event: "invocation.decode",
    invocationId: context.invocationId,
    outcome: "accepted",
    provider: lifecycle.namespace,
    tool: `${lifecycle.namespace}.${tool.name}`,
  });
  if (context.signal.aborted) {
    return cancelled(context);
  }
  const release = semaphore.tryAcquire();
  if (release === undefined) {
    return {
      type: "failure",
      failure: { type: "BrokerOverloaded", limit: "inFlightCallsPerProvider" },
    };
  }

  try {
    const lifecycleBeforeAcquire = lifecycle.status();
    const runtime = await lifecycle.acquire();
    observe({
      event: "provider.acquire",
      invocationId: context.invocationId,
      provider: lifecycle.namespace,
      runtime:
        lifecycleBeforeAcquire === "absent"
          ? "started"
          : lifecycleBeforeAcquire,
    });
    if (runtime.type === "failure") return runtime;
    if (context.signal.aborted) return cancelled(context);
    return await invokeBounded(
      decoded.value,
      runtime.value,
      `${lifecycle.namespace}.${tool.name}`,
      context,
      limits.providerInvocationTimeoutMs,
    );
  } finally {
    release();
  }
};

const cancelled = (
  context: InvocationContext,
): Outcome<never, BrokerFailure> => ({
  type: "failure",
  failure: { type: "InvocationCancelled", invocationId: context.invocationId },
});

const invokeBounded = async <Runtime>(
  invocation: DecodedToolInvocation<Runtime>,
  runtime: Runtime,
  tool: string,
  context: InvocationContext,
  timeoutMs: number,
): Promise<Outcome<import("./types.ts").ToolPresentation, BrokerFailure>> => {
  const timeout = new AbortController();
  const signal = AbortSignal.any([context.signal, timeout.signal]);
  const boundedContext = { ...context, signal };
  const timer = setTimeout(() => timeout.abort(), timeoutMs);
  const operation = invocation
    .invoke(runtime, boundedContext)
    .then((result) => ({ type: "settled" as const, result }))
    .catch(() => ({ type: "unexpected" as const }));
  const aborted = new Promise<{ readonly type: "aborted" }>((resolve) => {
    signal.addEventListener("abort", () => resolve({ type: "aborted" }), {
      once: true,
    });
  });
  const completed = await Promise.race([operation, aborted]);
  clearTimeout(timer);

  if (completed.type === "aborted") {
    return context.signal.aborted
      ? cancelled(context)
      : {
          type: "failure",
          failure: {
            type: "InvocationTimedOut",
            invocationId: context.invocationId,
          },
        };
  }
  if (completed.type === "unexpected") {
    return {
      type: "failure",
      failure: {
        type: "ProviderInvocationFailed",
        tool,
        code: "UNEXPECTED_FAILURE",
      },
    };
  }
  if (completed.result.type === "failure") {
    return completed.result.failure.code === "RESULT_SCHEMA_MISMATCH" ||
      completed.result.failure.code === "RESULT_PRESENTATION_FAILED"
      ? { type: "failure", failure: { type: "ProviderResultInvalid", tool } }
      : {
          type: "failure",
          failure: {
            type: "ProviderInvocationFailed",
            tool,
            code: completed.result.failure.code,
          },
        };
  }
  return completed.result;
};
