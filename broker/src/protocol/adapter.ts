import { Buffer } from "node:buffer";

import type { DynamicToolCallResponse } from "../../generated/protocol/codex-cli-0.149.1/typescript/v2/DynamicToolCallResponse";
import { canonicalJson } from "../broker/canonical.ts";
import type { BrokerFailure } from "../broker/failure.ts";
import type { Broker } from "../broker/types.ts";
import type { BrokerObserver } from "../broker/types.ts";
import type { ToolPresentation } from "../broker/types.ts";
import { compatibleThread } from "./thread-store.ts";
import type { ThreadCatalogStore } from "./thread-store.ts";
import {
  validateDynamicToolCallParams,
  validateInitializeParams,
  validateThreadForkParams,
  validateThreadForkResponse,
  validateThreadResumeParams,
  validateThreadResumeResponse,
  validateThreadStartParams,
  validateThreadStartResponse,
  validateTurnInterruptParams,
  validationDetail,
} from "./validators.ts";

export type ProtocolRouting =
  | { readonly type: "forwardUpstream"; readonly message: string }
  | { readonly type: "forwardDownstream"; readonly message: string }
  | { readonly type: "replyUpstream"; readonly message: string }
  | { readonly type: "replyDownstream"; readonly message: string }
  | { readonly type: "close"; readonly detail: string };

export interface CodexProtocolAdapterOptions {
  readonly broker: Broker;
  readonly observe?: BrokerObserver;
  readonly threadStore: ThreadCatalogStore;
}

type PendingThreadOperation =
  | { readonly type: "start" }
  | { readonly type: "resume"; readonly sourceThreadId: string }
  | { readonly type: "fork"; readonly sourceThreadId: string };

interface ActiveInvocation {
  readonly controller: AbortController;
  readonly threadId: string;
  readonly turnId: string;
}

export class CodexProtocolAdapter {
  readonly #broker: Broker;
  readonly #threadStore: ThreadCatalogStore;
  readonly #observe: BrokerObserver;
  readonly #pendingThreadOperations = new Map<string, PendingThreadOperation>();
  readonly #activeInvocations = new Map<string, ActiveInvocation>();

  constructor(options: CodexProtocolAdapterOptions) {
    this.#broker = options.broker;
    this.#threadStore = options.threadStore;
    const observe = options.observe ?? (() => {});
    this.#observe = (observation) => {
      try {
        observe(observation);
      } catch {
        // Logging cannot own protocol behavior.
      }
    };
  }

  async fromDownstream(message: string): Promise<ProtocolRouting> {
    const document = parseObject(message);
    if (document === undefined) {
      return { type: "close", detail: "malformed downstream JSON-RPC message" };
    }
    const method = stringProperty(document, "method");
    if (method === "initialize") {
      return this.#initialize(document);
    }
    if (method === "thread/start") {
      return this.#threadStart(document);
    }
    if (method === "thread/resume") {
      return this.#threadResume(document, message);
    }
    if (method === "thread/fork") {
      return this.#threadFork(document, message);
    }
    if (method === "turn/interrupt") {
      return this.#turnInterrupt(document, message);
    }
    return { type: "forwardUpstream", message };
  }

  close(): void {
    for (const invocation of this.#activeInvocations.values()) {
      invocation.controller.abort();
    }
    this.#activeInvocations.clear();
  }

  async fromUpstream(message: string): Promise<ProtocolRouting> {
    const document = parseObject(message);
    if (document === undefined) {
      return { type: "close", detail: "malformed upstream JSON-RPC message" };
    }
    const requestKey = rpcIdKey(document.id);
    if (requestKey !== undefined) {
      const pending = this.#pendingThreadOperations.get(requestKey);
      if (pending !== undefined) {
        this.#pendingThreadOperations.delete(requestKey);
        return this.#recordThreadOperation(pending, document, message);
      }
    }
    if (stringProperty(document, "method") !== "item/tool/call") {
      return { type: "forwardDownstream", message };
    }
    const rawParams = document.params;
    if (!isRecord(rawParams)) {
      return { type: "forwardDownstream", message };
    }
    const rawNamespace = stringProperty(rawParams, "namespace");
    const owned = this.#broker.catalog.namespaces.some(
      ({ name }) => name === rawNamespace,
    );
    if (!owned) {
      return { type: "forwardDownstream", message };
    }
    if (!validateDynamicToolCallParams(rawParams)) {
      return {
        type: "close",
        detail: validationDetail(validateDynamicToolCallParams.errors),
      };
    }
    if (typeof document.id !== "string" && typeof document.id !== "number") {
      return { type: "close", detail: "owned tool call omitted a request id" };
    }
    const thread = await compatibleThread(
      this.#threadStore,
      rawParams.threadId,
      this.#broker.catalog.digest,
    );
    if (thread.type === "failure") {
      return dynamicToolReply(document.id, failurePresentation(thread.failure));
    }
    if (
      Buffer.byteLength(JSON.stringify(rawParams.arguments), "utf8") >
      this.#broker.limits.maximumToolArgumentBytes
    ) {
      return dynamicToolReply(
        document.id,
        failurePresentation({
          type: "BrokerOverloaded",
          limit: "maximumToolArgumentSize",
        }),
      );
    }
    if (
      this.#activeInvocations.size >=
      this.#broker.limits.inFlightCallsPerConnection
    ) {
      return dynamicToolReply(
        document.id,
        failurePresentation({
          type: "BrokerOverloaded",
          limit: "inFlightCallsPerConnection",
        }),
      );
    }
    const invocationId = `${rawParams.threadId}:${rawParams.turnId}:${rawParams.callId}`;
    if (this.#activeInvocations.has(invocationId)) {
      return dynamicToolReply(
        document.id,
        failurePresentation({
          type: "ProviderInvocationFailed",
          tool: `${rawParams.namespace}.${rawParams.tool}`,
          code: "DUPLICATE_INVOCATION",
        }),
      );
    }
    const controller = new AbortController();
    this.#activeInvocations.set(invocationId, {
      controller,
      threadId: rawParams.threadId,
      turnId: rawParams.turnId,
    });
    let result: Awaited<ReturnType<Broker["dispatch"]>>;
    const startedAt = performance.now();
    try {
      result = await this.#broker.dispatch({
        namespace: rawParams.namespace ?? "",
        tool: rawParams.tool,
        arguments: rawParams.arguments,
        context: {
          invocationId,
          threadId: rawParams.threadId,
          turnId: rawParams.turnId,
          callId: rawParams.callId,
          cwd: thread.value.cwd,
          signal: controller.signal,
        },
      });
    } finally {
      this.#activeInvocations.delete(invocationId);
    }
    this.#observe({
      event: "invocation.terminal",
      durationMs: Math.max(0, Math.round(performance.now() - startedAt)),
      invocationId,
      provider: rawParams.namespace ?? "",
      terminal: result.type === "success" ? "completed" : result.failure.type,
      tool: `${rawParams.namespace}.${rawParams.tool}`,
    });
    const presentation =
      result.type === "success"
        ? result.value
        : failurePresentation(result.failure);
    if (
      Buffer.byteLength(JSON.stringify(presentation), "utf8") >
      this.#broker.limits.maximumToolResultBytes
    ) {
      return dynamicToolReply(
        document.id,
        failurePresentation({
          type: "BrokerOverloaded",
          limit: "maximumToolResultSize",
        }),
      );
    }
    return dynamicToolReply(document.id, presentation);
  }

  #initialize(document: Readonly<Record<string, unknown>>): ProtocolRouting {
    const params = document.params;
    if (!validateInitializeParams(params)) {
      return invalidOwnedRequest(
        document,
        validationDetail(validateInitializeParams.errors),
      );
    }
    const capabilities = params.capabilities ?? {
      experimentalApi: true,
      requestAttestation: false,
    };
    const refined = {
      ...document,
      params: {
        ...params,
        capabilities: { ...capabilities, experimentalApi: true },
      },
    };
    return { type: "forwardUpstream", message: JSON.stringify(refined) };
  }

  #threadStart(document: Readonly<Record<string, unknown>>): ProtocolRouting {
    const params = document.params;
    if (!validateThreadStartParams(params)) {
      return invalidOwnedRequest(
        document,
        validationDetail(validateThreadStartParams.errors),
      );
    }
    const existing = params.dynamicTools ?? [];
    const brokerNamespaces = new Set(
      this.#broker.catalog.namespaces.map(({ name }) => name),
    );
    const conflict = existing.find(
      (tool) => tool.type === "namespace" && brokerNamespaces.has(tool.name),
    );
    if (conflict !== undefined && conflict.type === "namespace") {
      return rpcFailure(document.id, {
        type: "CatalogInvalid",
        issues: [`dynamic tool namespace conflict: ${conflict.name}`],
      });
    }
    const refinedParams: unknown = {
      ...params,
      dynamicTools: [...existing, ...this.#broker.catalog.namespaces],
    };
    if (!validateThreadStartParams(refinedParams)) {
      return invalidOwnedRequest(
        document,
        validationDetail(validateThreadStartParams.errors),
      );
    }
    const requestKey = rpcIdKey(document.id);
    if (requestKey === undefined) {
      return { type: "close", detail: "thread/start omitted a request id" };
    }
    this.#pendingThreadOperations.set(requestKey, { type: "start" });
    this.#observe({
      event: "thread.catalog_injected",
      catalogDigest: this.#broker.catalog.digest,
      namespaces: this.#broker.catalog.namespaces.map(({ name }) => name),
    });
    return {
      type: "forwardUpstream",
      message: JSON.stringify({ ...document, params: refinedParams }),
    };
  }

  async #threadResume(
    document: Readonly<Record<string, unknown>>,
    message: string,
  ): Promise<ProtocolRouting> {
    const params = document.params;
    if (!validateThreadResumeParams(params)) {
      return invalidOwnedRequest(
        document,
        validationDetail(validateThreadResumeParams.errors),
      );
    }
    if (
      (params.path !== undefined &&
        params.path !== null &&
        params.path !== "") ||
      params.history != null
    ) {
      return rpcFailure(document.id, {
        type: "CatalogIncompatible",
        threadId: params.threadId,
      });
    }
    const compatible = await compatibleThread(
      this.#threadStore,
      params.threadId,
      this.#broker.catalog.digest,
    );
    if (compatible.type === "failure")
      return rpcFailure(document.id, compatible.failure);
    const requestKey = rpcIdKey(document.id);
    if (requestKey === undefined) {
      return { type: "close", detail: "thread/resume omitted a request id" };
    }
    this.#pendingThreadOperations.set(requestKey, {
      type: "resume",
      sourceThreadId: params.threadId,
    });
    this.#observe({
      event: "thread.catalog_compatible",
      catalogDigest: this.#broker.catalog.digest,
      operation: "resume",
      threadId: params.threadId,
    });
    return { type: "forwardUpstream", message };
  }

  async #threadFork(
    document: Readonly<Record<string, unknown>>,
    message: string,
  ): Promise<ProtocolRouting> {
    const params = document.params;
    if (!validateThreadForkParams(params)) {
      return invalidOwnedRequest(
        document,
        validationDetail(validateThreadForkParams.errors),
      );
    }
    if (
      params.path !== undefined &&
      params.path !== null &&
      params.path !== ""
    ) {
      return rpcFailure(document.id, {
        type: "CatalogIncompatible",
        threadId: params.threadId,
      });
    }
    const compatible = await compatibleThread(
      this.#threadStore,
      params.threadId,
      this.#broker.catalog.digest,
    );
    if (compatible.type === "failure")
      return rpcFailure(document.id, compatible.failure);
    const requestKey = rpcIdKey(document.id);
    if (requestKey === undefined) {
      return { type: "close", detail: "thread/fork omitted a request id" };
    }
    this.#pendingThreadOperations.set(requestKey, {
      type: "fork",
      sourceThreadId: params.threadId,
    });
    this.#observe({
      event: "thread.catalog_compatible",
      catalogDigest: this.#broker.catalog.digest,
      operation: "fork",
      threadId: params.threadId,
    });
    return { type: "forwardUpstream", message };
  }

  #turnInterrupt(
    document: Readonly<Record<string, unknown>>,
    message: string,
  ): ProtocolRouting {
    const params = document.params;
    if (!validateTurnInterruptParams(params)) {
      return invalidOwnedRequest(
        document,
        validationDetail(validateTurnInterruptParams.errors),
      );
    }
    for (const invocation of this.#activeInvocations.values()) {
      if (
        invocation.threadId === params.threadId &&
        invocation.turnId === params.turnId
      ) {
        invocation.controller.abort();
      }
    }
    return { type: "forwardUpstream", message };
  }

  async #recordThreadOperation(
    pending: PendingThreadOperation,
    document: Readonly<Record<string, unknown>>,
    message: string,
  ): Promise<ProtocolRouting> {
    if (document.error !== undefined) {
      return { type: "forwardDownstream", message };
    }
    const valid =
      pending.type === "start"
        ? validateThreadStartResponse(document.result)
        : pending.type === "resume"
          ? validateThreadResumeResponse(document.result)
          : validateThreadForkResponse(document.result);
    if (!valid) {
      const errors =
        pending.type === "start"
          ? validateThreadStartResponse.errors
          : pending.type === "resume"
            ? validateThreadResumeResponse.errors
            : validateThreadForkResponse.errors;
      return { type: "close", detail: validationDetail(errors) };
    }
    const result = document.result;
    if (!isThreadOperationResult(result)) {
      return {
        type: "close",
        detail: "thread operation response omitted its thread binding",
      };
    }
    if (
      pending.type === "resume" &&
      result.thread.id !== pending.sourceThreadId
    ) {
      return {
        type: "close",
        detail: "thread/resume returned a different thread identity",
      };
    }
    await this.#threadStore.write({
      threadId: result.thread.id,
      catalogDigest: this.#broker.catalog.digest,
      cwd: result.cwd,
    });
    return { type: "forwardDownstream", message };
  }
}

const parseObject = (
  message: string,
): Readonly<Record<string, unknown>> | undefined => {
  try {
    const value: unknown = JSON.parse(message);
    return isRecord(value) ? value : undefined;
  } catch {
    return undefined;
  }
};

const isRecord = (value: unknown): value is Readonly<Record<string, unknown>> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const isThreadOperationResult = (
  value: unknown,
): value is {
  readonly thread: { readonly id: string };
  readonly cwd: string;
} =>
  isRecord(value) &&
  typeof value.cwd === "string" &&
  isRecord(value.thread) &&
  typeof value.thread.id === "string";

const stringProperty = (
  value: Readonly<Record<string, unknown>>,
  name: string,
): string | undefined =>
  typeof value[name] === "string" ? value[name] : undefined;

const rpcIdKey = (id: unknown): string | undefined =>
  typeof id === "string" || typeof id === "number"
    ? `${typeof id}:${id}`
    : undefined;

const invalidOwnedRequest = (
  document: Readonly<Record<string, unknown>>,
  detail: string,
): ProtocolRouting =>
  rpcFailure(document.id, { type: "UpstreamProtocolFailure", detail });

const rpcFailure = (id: unknown, failure: unknown): ProtocolRouting => {
  if (typeof id !== "string" && typeof id !== "number") {
    return { type: "close", detail: "owned JSON-RPC request omitted an id" };
  }
  return {
    type: "replyDownstream",
    message: JSON.stringify({
      id,
      error: {
        code: -32040,
        message: "Broker rejected the request.",
        data: { failure },
      },
    }),
  };
};

const failurePresentation = (failure: BrokerFailure): ToolPresentation => ({
  success: false,
  contentItems: [{ type: "inputText", text: canonicalJson({ failure }) }],
});

const dynamicToolReply = (
  id: string | number,
  presentation: ToolPresentation,
): ProtocolRouting => {
  const result: DynamicToolCallResponse = {
    success: presentation.success,
    contentItems: [...presentation.contentItems],
  };
  return {
    type: "replyUpstream",
    message: JSON.stringify({ id, result }),
  };
};
