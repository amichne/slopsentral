import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

import { Type } from "@sinclair/typebox";
import { Value } from "@sinclair/typebox/value";

import type { Outcome } from "../broker/types.ts";
import type {
  ThreadCatalogBinding,
  ThreadCatalogStore,
} from "../protocol/thread-store.ts";

const ThreadStoreDocument = Type.Object(
  {
    version: Type.Literal(1),
    bindings: Type.Array(
      Type.Object(
        {
          threadId: Type.String({ minLength: 1 }),
          catalogDigest: Type.String({ pattern: "^sha256:[0-9a-f]{64}$" }),
          cwd: Type.String({ minLength: 1 }),
        },
        { additionalProperties: false },
      ),
    ),
  },
  { additionalProperties: false },
);

type ThreadStoreFailure = {
  readonly type: "CatalogInvalid";
  readonly issues: readonly string[];
};

export class FileThreadCatalogStore implements ThreadCatalogStore {
  readonly #path: string;
  readonly #bindings: Map<string, ThreadCatalogBinding>;
  #pendingWrite = Promise.resolve();

  private constructor(path: string, bindings: readonly ThreadCatalogBinding[]) {
    this.#path = path;
    this.#bindings = new Map(
      bindings.map((binding) => [binding.threadId, binding]),
    );
  }

  static async open(
    path: string,
  ): Promise<Outcome<FileThreadCatalogStore, ThreadStoreFailure>> {
    let text: string;
    try {
      text = await readFile(path, "utf8");
    } catch (error) {
      if (isNodeError(error) && error.code === "ENOENT") {
        return { type: "success", value: new FileThreadCatalogStore(path, []) };
      }
      return {
        type: "failure",
        failure: {
          type: "CatalogInvalid",
          issues: ["thread catalog store is unreadable"],
        },
      };
    }
    let document: unknown;
    try {
      document = JSON.parse(text);
    } catch {
      return {
        type: "failure",
        failure: {
          type: "CatalogInvalid",
          issues: ["thread catalog store is malformed"],
        },
      };
    }
    if (!Value.Check(ThreadStoreDocument, document)) {
      return {
        type: "failure",
        failure: {
          type: "CatalogInvalid",
          issues: ["thread catalog store violates its schema"],
        },
      };
    }
    const decoded = Value.Decode(ThreadStoreDocument, document);
    const threadIds = new Set(decoded.bindings.map(({ threadId }) => threadId));
    if (threadIds.size !== decoded.bindings.length) {
      return {
        type: "failure",
        failure: {
          type: "CatalogInvalid",
          issues: ["thread catalog store contains duplicate thread identities"],
        },
      };
    }
    return {
      type: "success",
      value: new FileThreadCatalogStore(path, decoded.bindings),
    };
  }

  read(threadId: string): Promise<ThreadCatalogBinding | undefined> {
    return Promise.resolve(this.#bindings.get(threadId));
  }

  write(binding: ThreadCatalogBinding): Promise<void> {
    this.#bindings.set(binding.threadId, binding);
    this.#pendingWrite = this.#pendingWrite.then(() => this.#flush());
    return this.#pendingWrite;
  }

  async #flush(): Promise<void> {
    const temporary = `${this.#path}.${process.pid}.tmp`;
    const document = {
      version: 1 as const,
      bindings: [...this.#bindings.values()].sort((left, right) =>
        left.threadId.localeCompare(right.threadId),
      ),
    };
    await mkdir(dirname(this.#path), { recursive: true });
    await writeFile(temporary, `${JSON.stringify(document, null, 2)}\n`, {
      mode: 0o600,
    });
    await rename(temporary, this.#path);
  }
}

const isNodeError = (error: unknown): error is NodeJS.ErrnoException =>
  error instanceof Error && "code" in error;
