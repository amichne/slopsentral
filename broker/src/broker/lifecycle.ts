import type { BrokerFailure } from "./failure.ts";
import type {
  Outcome,
  ProviderDefinition,
  ProviderStartFailure,
} from "./types.ts";

type RuntimeState<Runtime> =
  | { readonly type: "absent" }
  | {
      readonly type: "starting";
      readonly operation: Promise<Outcome<Runtime, BrokerFailure>>;
    }
  | { readonly type: "ready"; readonly runtime: Runtime }
  | { readonly type: "failed"; readonly failure: BrokerFailure }
  | { readonly type: "closed" };

export class ProviderLifecycle<Runtime> {
  readonly namespace: string;
  readonly #definition: ProviderDefinition<Runtime>;
  readonly #startupTimeoutMs: number;
  readonly #shutdown = new AbortController();
  #state: RuntimeState<Runtime> = { type: "absent" };

  constructor(
    definition: ProviderDefinition<Runtime>,
    startupTimeoutMs: number,
  ) {
    this.namespace = definition.namespace;
    this.#definition = definition;
    this.#startupTimeoutMs = startupTimeoutMs;
  }

  status(): RuntimeState<Runtime>["type"] {
    return this.#state.type;
  }

  acquire(): Promise<Outcome<Runtime, BrokerFailure>> {
    switch (this.#state.type) {
      case "ready":
        return Promise.resolve({ type: "success", value: this.#state.runtime });
      case "failed":
        return Promise.resolve({
          type: "failure",
          failure: this.#state.failure,
        });
      case "closed":
        return Promise.resolve({
          type: "failure",
          failure: { type: "ProviderUnavailable", namespace: this.namespace },
        });
      case "starting":
        return this.#state.operation;
      case "absent": {
        const operation = this.#start();
        this.#state = { type: "starting", operation };
        return operation;
      }
    }
  }

  async close(): Promise<void> {
    if (this.#state.type === "closed") return;
    this.#shutdown.abort();
    const state = this.#state;
    if (state.type === "starting") {
      await state.operation;
    }
    const settled = this.#state;
    if (settled.type === "ready" && this.#definition.stop !== undefined) {
      await this.#definition.stop(settled.runtime);
    }
    this.#state = { type: "closed" };
  }

  async #start(): Promise<Outcome<Runtime, BrokerFailure>> {
    const timeout = new AbortController();
    const signal = AbortSignal.any([this.#shutdown.signal, timeout.signal]);
    const timer = setTimeout(() => timeout.abort(), this.#startupTimeoutMs);
    const operation = this.#definition
      .start(signal)
      .then((result) => ({ type: "settled" as const, result }))
      .catch(() => ({
        type: "settled" as const,
        result: {
          type: "failure" as const,
          failure: {
            code: "UNEXPECTED_STARTUP_FAILURE",
          } satisfies ProviderStartFailure,
        },
      }));
    const timedOut = new Promise<{ readonly type: "timeout" }>((resolve) => {
      signal.addEventListener("abort", () => resolve({ type: "timeout" }), {
        once: true,
      });
    });
    const completed = await Promise.race([operation, timedOut]);
    clearTimeout(timer);

    if (completed.type === "timeout") {
      operation
        .then(async (late) => {
          if (
            late.result.type === "success" &&
            this.#definition.stop !== undefined
          ) {
            await this.#definition.stop(late.result.value);
          }
        })
        .catch(() => undefined);
    }

    const result: Outcome<Runtime, BrokerFailure> =
      completed.type === "timeout"
        ? {
            type: "failure",
            failure: {
              type: "ProviderStartupFailed",
              namespace: this.#definition.namespace,
              code: this.#shutdown.signal.aborted
                ? "BROKER_SHUTDOWN"
                : "STARTUP_TIMEOUT",
            },
          }
        : completed.result.type === "failure"
          ? {
              type: "failure",
              failure: {
                type: "ProviderStartupFailed",
                namespace: this.#definition.namespace,
                code: completed.result.failure.code,
              },
            }
          : completed.result;
    this.#state =
      result.type === "success"
        ? { type: "ready", runtime: result.value }
        : { type: "failed", failure: result.failure };
    return result;
  }
}
