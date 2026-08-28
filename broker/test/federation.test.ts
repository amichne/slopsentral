import assert from "node:assert/strict";
import { chmod, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, test } from "node:test";

import { createBroker } from "../src/broker/index.ts";
import { createGradleRegistration } from "../src/providers/gradle/registration.ts";
import { qualifyKastRegistration } from "../src/providers/kast/registration.ts";
import type {
  ProcessExecutor,
  ProcessRequest,
} from "../src/providers/process.ts";
import type { InvocationContext } from "../src/broker/types.ts";
import { compatibleKastSchema } from "./kast-schema.fixture.ts";

describe("federation contract", () => {
  test("Gradle and Kast compose through provider registration only", async () => {
    const kast = await qualifyKastRegistration(
      {
        processExecutor: async (request) =>
          request.arguments[0] === "--version"
            ? processSuccess("kast 999.42.7 (IDE-hosted)\n")
            : processSuccess(JSON.stringify(compatibleKastSchema())),
        qualificationCwd: "/workspace",
      },
      new AbortController().signal,
    );
    assert.equal(kast.type, "success");
    if (kast.type !== "success") return;
    const created = createBroker([createGradleRegistration(), kast.value]);
    assert.equal(created.type, "success");
    const tools = Object.fromEntries(
      created.value.catalog.namespaces.map((namespace) => [
        namespace.name,
        namespace.tools.map(({ name }) => name),
      ]),
    );
    assert.deepEqual(tools, {
      gradle: ["dependencies", "inspect", "tasks"],
      kast: ["symbol_discover", "symbol_resolve", "traversal_run"],
    });
  });

  test("real Gradle and Kast adapters execute through one unchanged broker", async () => {
    const workspace = await mkdtemp(join(tmpdir(), "broker-federation-"));
    const wrapper = join(workspace, "gradlew");
    await writeFile(wrapper, "#!/bin/sh\nexit 0\n");
    await chmod(wrapper, 0o755);
    const requests: ProcessRequest[] = [];
    const execute: ProcessExecutor = async (request) => {
      requests.push(request);
      if (
        request.executable === "kast" &&
        request.arguments[0] === "--version"
      ) {
        return processSuccess("kast 999.42.7 (IDE-hosted)\n");
      }
      if (
        request.executable === "kast" &&
        request.arguments[0] === "--schema"
      ) {
        return processSuccess(JSON.stringify(compatibleKastSchema()));
      }
      if (request.executable === "kast") {
        return processSuccess('{"selector":"exact:fixture"}');
      }
      return processSuccess("Gradle fixture output\n");
    };
    const kast = await qualifyKastRegistration(
      {
        executable: "kast",
        processExecutor: execute,
        qualificationCwd: workspace,
      },
      new AbortController().signal,
    );
    assert.equal(kast.type, "success");
    if (kast.type !== "success") return;
    const created = createBroker([
      createGradleRegistration({ processExecutor: execute }),
      kast.value,
    ]);
    assert.equal(created.type, "success");

    try {
      assert.deepEqual(
        requests.map(({ executable, arguments: arguments_ }) => [
          executable,
          ...arguments_,
        ]),
        [
          ["kast", "--version"],
          ["kast", "--schema"],
        ],
      );
      const gradle = await created.value.dispatch({
        namespace: "gradle",
        tool: "inspect",
        arguments: {},
        context: invocationContext(workspace, "gradle-call"),
      });
      assert.equal(gradle.type, "success");
      assert.deepEqual(
        requests.map(({ executable }) => executable),
        ["kast", "kast", wrapper],
      );

      const kast = await created.value.dispatch({
        namespace: "kast",
        tool: "symbol_resolve",
        arguments: { candidate: "candidate:fixture" },
        context: invocationContext(workspace, "kast-call"),
      });
      assert.equal(kast.type, "success");
      assert.deepEqual(
        requests.map(({ executable, arguments: arguments_ }) => [
          executable,
          ...arguments_,
        ]),
        [
          ["kast", "--version"],
          ["kast", "--schema"],
          [wrapper, "--console=plain", "--no-daemon", "projects"],
          ["kast", "--version"],
          ["kast", "--schema"],
          ["kast", "symbol", "resolve", "--candidate=candidate:fixture"],
        ],
      );
    } finally {
      await created.value.close();
      await rm(workspace, { recursive: true, force: true });
    }
  });
});

const processSuccess = (stdout: string) => ({
  type: "success" as const,
  value: { exitCode: 0, stdout, stderr: "" },
});

const invocationContext = (cwd: string, callId: string): InvocationContext => ({
  invocationId: `thread-1:turn-1:${callId}`,
  threadId: "thread-1",
  turnId: "turn-1",
  callId,
  cwd,
  signal: new AbortController().signal,
});
