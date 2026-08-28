import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";

import { FileThreadCatalogStore } from "../src/runtime/thread-store.ts";

test("thread catalog bindings survive broker restart and malformed state fails closed", async () => {
  const directory = await mkdtemp(join(tmpdir(), "broker-thread-store-"));
  const path = join(directory, "threads.json");
  try {
    const opened = await FileThreadCatalogStore.open(path);
    assert.equal(opened.type, "success");
    await opened.value.write({
      threadId: "thread-1",
      catalogDigest: `sha256:${"a".repeat(64)}`,
      cwd: "/workspace",
    });

    const reopened = await FileThreadCatalogStore.open(path);
    assert.equal(reopened.type, "success");
    assert.deepEqual(await reopened.value.read("thread-1"), {
      threadId: "thread-1",
      catalogDigest: `sha256:${"a".repeat(64)}`,
      cwd: "/workspace",
    });
    assert.match(await readFile(path, "utf8"), /"version": 1/);

    await writeFile(path, '{"version":1,"bindings":[{"threadId":"unsafe"}]}\n');
    const malformed = await FileThreadCatalogStore.open(path);
    assert.deepEqual(malformed, {
      type: "failure",
      failure: {
        type: "CatalogInvalid",
        issues: ["thread catalog store violates its schema"],
      },
    });
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
