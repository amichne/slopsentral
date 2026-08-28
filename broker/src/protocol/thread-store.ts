import type { Outcome } from "../broker/types.ts";

export interface ThreadCatalogBinding {
  readonly threadId: string;
  readonly catalogDigest: string;
  readonly cwd: string;
}

export interface ThreadCatalogStore {
  readonly read: (
    threadId: string,
  ) => Promise<ThreadCatalogBinding | undefined>;
  readonly write: (binding: ThreadCatalogBinding) => Promise<void>;
}

export class MemoryThreadCatalogStore implements ThreadCatalogStore {
  readonly #bindings = new Map<string, ThreadCatalogBinding>();

  read(threadId: string): Promise<ThreadCatalogBinding | undefined> {
    return Promise.resolve(this.#bindings.get(threadId));
  }

  write(binding: ThreadCatalogBinding): Promise<void> {
    this.#bindings.set(binding.threadId, binding);
    return Promise.resolve();
  }
}

export const compatibleThread = async (
  store: ThreadCatalogStore,
  threadId: string,
  catalogDigest: string,
): Promise<
  Outcome<
    ThreadCatalogBinding,
    { readonly type: "CatalogIncompatible"; readonly threadId: string }
  >
> => {
  const binding = await store.read(threadId);
  return binding !== undefined && binding.catalogDigest === catalogDigest
    ? { type: "success", value: binding }
    : { type: "failure", failure: { type: "CatalogIncompatible", threadId } };
};
