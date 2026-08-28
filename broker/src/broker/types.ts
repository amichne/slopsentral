import type { Static, TSchema } from "@sinclair/typebox";

import type { BrokerFailure } from "./failure.ts";

export type Outcome<Value, Failure> =
  | { readonly type: "success"; readonly value: Value }
  | { readonly type: "failure"; readonly failure: Failure };

export interface InvocationContext {
  readonly invocationId: string;
  readonly threadId: string;
  readonly turnId: string;
  readonly callId: string;
  readonly cwd: string;
  readonly signal: AbortSignal;
}

export interface ToolPresentation {
  readonly contentItems: readonly ToolContentItem[];
  readonly success: boolean;
}

export type ToolContentItem =
  | { readonly type: "inputText"; readonly text: string }
  | { readonly type: "inputImage"; readonly imageUrl: string }
  | { readonly type: "inputAudio"; readonly audioUrl: string };

export interface ProviderCallFailure {
  readonly code: string;
}

export interface ToolDefinition<Runtime> {
  readonly name: string;
  readonly description: string;
  readonly inputSchema: TSchema;
  readonly loading: "eager" | "deferred";
  readonly decode: (
    raw: unknown,
  ) => Outcome<DecodedToolInvocation<Runtime>, string>;
}

export interface DecodedToolInvocation<Runtime> {
  readonly invoke: (
    runtime: Runtime,
    context: InvocationContext,
  ) => Promise<Outcome<ToolPresentation, ProviderCallFailure>>;
}

export interface ToolDefinitionSpec<
  Runtime,
  InputSchema extends TSchema,
  OutputSchema extends TSchema,
> {
  readonly name: string;
  readonly description: string;
  readonly input: InputSchema;
  readonly output: OutputSchema;
  readonly loading: "eager" | "deferred";
  readonly invoke: (
    runtime: Runtime,
    input: Static<InputSchema>,
    context: InvocationContext,
  ) => Promise<Outcome<Static<OutputSchema>, ProviderCallFailure>>;
  readonly present: (output: Static<OutputSchema>) => ToolPresentation;
}

export interface ProviderRegistration {
  readonly descriptor: {
    readonly namespace: string;
    readonly version: string;
    readonly tools: readonly {
      readonly name: string;
      readonly description: string;
      readonly inputSchema: TSchema;
      readonly loading: "eager" | "deferred";
    }[];
  };
  readonly bind: (
    limits: BrokerLimits,
    observe: BrokerObserver,
  ) => RegisteredProvider;
}

export interface BrokerObservation {
  readonly event: string;
  readonly [key: string]: string | number | boolean | readonly string[];
}

export type BrokerObserver = (observation: BrokerObservation) => void;

export interface RegisteredProvider {
  readonly namespace: string;
  readonly tools: ReadonlyMap<string, RegisteredTool>;
  readonly close: () => Promise<void>;
}

export interface RegisteredTool {
  readonly dispatch: (
    raw: unknown,
    context: InvocationContext,
  ) => Promise<Outcome<ToolPresentation, BrokerFailure>>;
}

export interface BrokerLimits {
  readonly inFlightCallsPerConnection: number;
  readonly inFlightCallsPerProvider: number;
  readonly maximumCatalogBytes: number;
  readonly maximumDescriptorCount: number;
  readonly maximumToolArgumentBytes: number;
  readonly maximumToolResultBytes: number;
  readonly providerInvocationTimeoutMs: number;
  readonly providerStartupTimeoutMs: number;
}

export interface ProviderStartFailure {
  readonly code: string;
}

export interface ProviderDefinition<Runtime> {
  readonly namespace: string;
  readonly version: string;
  readonly tools: readonly ToolDefinition<Runtime>[];
  readonly start: (
    signal: AbortSignal,
  ) => Promise<Outcome<Runtime, ProviderStartFailure>>;
  readonly stop?: (runtime: Runtime) => Promise<void>;
}

export interface Broker {
  readonly catalog: import("./catalog.ts").Catalog;
  readonly limits: BrokerLimits;
  readonly dispatch: (
    request: BrokerInvocationRequest,
  ) => Promise<Outcome<ToolPresentation, BrokerFailure>>;
  readonly close: () => Promise<void>;
}

export interface BrokerInvocationRequest {
  readonly namespace: string;
  readonly tool: string;
  readonly arguments: unknown;
  readonly context: InvocationContext;
}
