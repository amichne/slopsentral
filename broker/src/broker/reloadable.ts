import type { Catalog } from "./catalog.ts";
import { createBroker } from "./create.ts";
import { DEFAULT_BROKER_LIMITS } from "./defaults.ts";
import type { BrokerFailure } from "./failure.ts";
import type {
  Broker,
  BrokerGenerationLease,
  BrokerLimits,
  BrokerObserver,
  BrokerReload,
  BrokerSchemaLoader,
  Outcome,
  ReloadableBroker,
} from "./types.ts";

export interface ReloadableBrokerOptions {
  readonly limits?: BrokerLimits;
  readonly observe?: BrokerObserver;
}

export const startReloadableBroker = async (
  loadSchemas: BrokerSchemaLoader,
  options: ReloadableBrokerOptions = {},
): Promise<Outcome<ReloadableBroker, BrokerFailure>> => {
  const limits = options.limits ?? DEFAULT_BROKER_LIMITS;
  const observe = safeObserver(options.observe ?? (() => {}));
  const shutdown = new AbortController();
  const initial = await loadBroker(
    loadSchemas,
    limits,
    observe,
    shutdown.signal,
  );
  if (initial.type === "failure") return initial;

  let active: BrokerGeneration | undefined = new BrokerGeneration(
    initial.value,
  );
  let lastCatalog = initial.value.catalog;
  let transition: Promise<Outcome<BrokerReload, BrokerFailure>> | undefined;
  let closeOperation: Promise<void> | undefined;
  let closed = false;
  const retired = new Set<BrokerGeneration>();

  const reload = (): Promise<Outcome<BrokerReload, BrokerFailure>> => {
    if (transition !== undefined) return transition;
    const operation = performReload().catch((): Outcome<never, BrokerFailure> =>
      reloadFailed(),
    );
    transition = operation;
    void operation.then(() => {
      if (transition === operation) transition = undefined;
    });
    return operation;
  };

  const performReload = async (): Promise<
    Outcome<BrokerReload, BrokerFailure>
  > => {
    if (closed) return brokerClosed();
    const candidate = await loadBroker(
      loadSchemas,
      limits,
      observe,
      shutdown.signal,
    );
    if (candidate.type === "failure") {
      observe({
        event: "catalog.reload_rejected",
        failureType: candidate.failure.type,
      });
      return candidate;
    }
    if (closed) {
      await candidate.value.close();
      return brokerClosed();
    }
    const current = active;
    if (current === undefined) {
      await candidate.value.close();
      return brokerClosed();
    }
    if (candidate.value.catalog.digest === current.broker.catalog.digest) {
      await candidate.value.close();
      return {
        type: "success",
        value: {
          type: "unchanged",
          catalogDigest: current.broker.catalog.digest,
        },
      };
    }

    const replacement = new BrokerGeneration(candidate.value);
    active = replacement;
    lastCatalog = replacement.broker.catalog;
    retired.add(current);
    void current.retire().then(
      () => {
        retired.delete(current);
        observe({
          event: "catalog.generation_retired",
          catalogDigest: current.broker.catalog.digest,
        });
      },
      () => {
        retired.delete(current);
        observe({
          event: "catalog.generation_retirement_failed",
          catalogDigest: current.broker.catalog.digest,
        });
      },
    );
    observe({
      event: "catalog.reloaded",
      catalogDigest: replacement.broker.catalog.digest,
      previousCatalogDigest: current.broker.catalog.digest,
    });
    return {
      type: "success",
      value: {
        type: "replaced",
        previousCatalogDigest: current.broker.catalog.digest,
        catalogDigest: replacement.broker.catalog.digest,
      },
    };
  };

  return {
    type: "success",
    value: {
      get catalog(): Catalog {
        return lastCatalog;
      },
      limits,
      acquire: () => {
        if (closed || active === undefined) return brokerClosed();
        return active.acquire();
      },
      dispatch: async (request) => {
        const generation =
          closed || active === undefined ? brokerClosed() : active.acquire();
        if (generation.type === "failure") return generation;
        try {
          return await generation.value.broker.dispatch(request);
        } finally {
          await generation.value.release();
        }
      },
      reload,
      close: () => {
        if (closeOperation !== undefined) return closeOperation;
        closed = true;
        shutdown.abort();
        closeOperation = (async () => {
          await transition;
          const current = active;
          active = undefined;
          await Promise.all([
            ...[...retired].map((generation) => generation.retire()),
            ...(current === undefined ? [] : [current.retire()]),
          ]);
          retired.clear();
        })();
        return closeOperation;
      },
    },
  };
};

class BrokerGeneration {
  readonly broker: Broker;
  #leases = 0;
  #retired = false;
  #closing: Promise<void> | undefined;
  readonly #retirement: Promise<void>;
  readonly #completeRetirement: () => void;
  readonly #failRetirement: (error: unknown) => void;

  constructor(broker: Broker) {
    this.broker = broker;
    let completeRetirement: () => void = () => {};
    let failRetirement: (error: unknown) => void = () => {};
    this.#retirement = new Promise<void>((resolve, reject) => {
      completeRetirement = resolve;
      failRetirement = reject;
    });
    this.#completeRetirement = completeRetirement;
    this.#failRetirement = failRetirement;
  }

  acquire(): Outcome<BrokerGenerationLease, BrokerFailure> {
    if (this.#retired) return reloadFailed("GENERATION_RETIRED");
    this.#leases += 1;
    let released = false;
    return {
      type: "success",
      value: {
        broker: this.broker,
        release: async () => {
          if (released) return;
          released = true;
          this.#leases -= 1;
          if (this.#retired && this.#leases === 0) {
            await this.#close();
          }
        },
      },
    };
  }

  retire(): Promise<void> {
    this.#retired = true;
    if (this.#leases === 0) void this.#close();
    return this.#retirement;
  }

  #close(): Promise<void> {
    if (this.#closing === undefined) {
      this.#closing = this.broker.close();
      void this.#closing.then(this.#completeRetirement, this.#failRetirement);
    }
    return this.#closing;
  }
}

const loadBroker = async (
  loadSchemas: BrokerSchemaLoader,
  limits: BrokerLimits,
  observe: BrokerObserver,
  shutdownSignal: AbortSignal,
): Promise<Outcome<Broker, BrokerFailure>> => {
  try {
    const timeout = AbortSignal.timeout(limits.providerStartupTimeoutMs);
    const loaded = await loadSchemas(
      AbortSignal.any([shutdownSignal, timeout]),
    );
    if (loaded.type === "failure") return loaded;
    return createBroker(loaded.value, limits, observe);
  } catch {
    return reloadFailed();
  }
};

const safeObserver =
  (observe: BrokerObserver): BrokerObserver =>
  (observation) => {
    try {
      observe(observation);
    } catch {
      // Observability cannot own reload behavior.
    }
  };

const brokerClosed = (): Outcome<never, BrokerFailure> => ({
  type: "failure",
  failure: { type: "BrokerClosed" },
});

const reloadFailed = (
  code = "UNEXPECTED_RELOAD_FAILURE",
): Outcome<never, BrokerFailure> => ({
  type: "failure",
  failure: { type: "CatalogReloadFailed", code },
});
