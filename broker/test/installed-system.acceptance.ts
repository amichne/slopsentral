import { execFile } from "node:child_process";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { promisify } from "node:util";

import type WebSocket from "ws";

import type { InvocationContext } from "../src/broker/types.ts";
import { startBrokerRuntime } from "../src/runtime/broker-runtime.ts";
import { BROKER_VERSION, runtimeConfig } from "../src/runtime/config.ts";
import type { LogRecord } from "../src/runtime/logger.ts";
import { connectUnixWebSocket } from "../src/runtime/upstream-connection.ts";

const execute = promisify(execFile);
const runInstalledAcceptance = async (): Promise<void> => {
  const directory = await mkdtemp(join(tmpdir(), "broker-installed-"));
  const workspace = join(directory, "consumer");
  const codexHome = join(directory, "codex-home");
  const logs: LogRecord[] = [];
  let running: Awaited<ReturnType<typeof startBrokerRuntime>> | undefined;
  let connection: WebSocket | undefined;

  try {
    await createConsumerWorkspace(workspace);
    const config = runtimeConfig(process.env, {
      codexHome,
      privateSocketPath: join(directory, "private.sock"),
      providerQualificationCwd: workspace,
      publicSocketPath: join(directory, "public.sock"),
      threadStorePath: join(directory, "threads.json"),
    });
    if (config.type === "failure") throw new Error(config.failure.detail);
    running = await startBrokerRuntime(config.value, {
      write: (record) => logs.push(record),
    });
    if (running.type === "failure")
      throw new Error(JSON.stringify(running.failure));

    connection = await connectUnixWebSocket(
      config.value.publicSocketPath,
      config.value.maximumMessageBytes,
      config.value.connectionInitializationTimeoutMs,
    );
    const rpc = new RpcClient(connection);
    await rpc.request("initialize", {
      clientInfo: {
        name: "broker-installed-acceptance",
        title: "Broker Installed Acceptance",
        version: BROKER_VERSION,
      },
      capabilities: { experimentalApi: true, requestAttestation: false },
    });
    const started = await rpc.request("thread/start", {
      cwd: workspace,
      approvalPolicy: "never",
      sandbox: "read-only",
    });
    const startedThread = threadIdentity(started);

    const gradle = await running.value.broker.dispatch({
      namespace: "gradle",
      tool: "inspect",
      arguments: {},
      context: invocationContext(workspace, startedThread, "gradle-inspect"),
    });
    const kast = await running.value.broker.dispatch({
      namespace: "kast",
      tool: "symbol_discover",
      arguments: {
        mode: "name",
        query: "AcceptanceFixture",
        kind: "symbol",
        match: "fuzzy",
        limit: 1,
      },
      context: invocationContext(workspace, startedThread, "kast-discover"),
    });
    const invalid = await running.value.broker.dispatch({
      namespace: "kast",
      tool: "traversal_run",
      arguments: {
        selector: "fixture",
        relation: "callers",
        maximumDepth: "five",
        maximumResults: 1,
      },
      context: invocationContext(workspace, startedThread, "invalid-decode"),
    });

    const interruption = new AbortController();
    const interruptedOperation = running.value.broker.dispatch({
      namespace: "gradle",
      tool: "tasks",
      arguments: { all: true },
      context: invocationContext(
        workspace,
        startedThread,
        "gradle-interrupt",
        interruption.signal,
      ),
    });
    setTimeout(() => interruption.abort(), 10);
    const interrupted = await interruptedOperation;

    const resumeDisposition = await qualifiedThreadOperation(
      rpc.request("thread/resume", { threadId: startedThread }),
    );
    const forkDisposition = await qualifiedThreadOperation(
      rpc.request("thread/fork", { threadId: startedThread }),
    );

    const proofs = {
      protocolQualified: countLogs(logs, "protocol.qualified") === 1,
      upstreamReady: countLogs(logs, "upstream.ready") === 1,
      catalogInjected: countLogs(logs, "thread.catalog_injected") === 1,
      gradleTypedRoute: gradle.type === "success" && gradle.value.success,
      kastTypedRoute: kast.type === "success",
      invalidRejected:
        invalid.type === "failure" &&
        invalid.failure.type === "InvalidArguments",
      invalidDidNotAcquire: !logs.some(
        (record) =>
          record.event === "provider.acquire" &&
          record.invocationId === "invalid-decode",
      ),
      gradleStartedOnce:
        countProviderStarts(logs, "gradle") === 1 &&
        countProviderStarts(logs, "kast") === 1,
      interrupted:
        interrupted.type === "failure" &&
        interrupted.failure.type === "InvocationCancelled",
      resumeQualified:
        resumeDisposition !== "unexpected-failure" &&
        logs.some(
          (record) =>
            record.event === "thread.catalog_compatible" &&
            record.operation === "resume",
        ),
      forkQualified:
        forkDisposition !== "unexpected-failure" &&
        logs.some(
          (record) =>
            record.event === "thread.catalog_compatible" &&
            record.operation === "fork",
        ),
    };
    const accepted = Object.values(proofs).every((proof) => proof);
    const receipt = {
      brokerVersion: BROKER_VERSION,
      codexVersion: running.value.codexVersion,
      protocolDigest: running.value.protocolDigest,
      schemaFileCount: running.value.schemaFileCount,
      catalogDigest: running.value.broker.catalog.digest,
      providers: Object.fromEntries(
        running.value.broker.catalog.providers.map(({ namespace, version }) => [
          namespace,
          { version },
        ]),
      ),
      toolsExercised: [
        "gradle.inspect",
        "gradle.tasks",
        "kast.symbol_discover",
      ],
      routingProofs: [
        {
          proof: "runtime-schema-qualified",
          accepted: proofs.protocolQualified,
        },
        {
          proof: "public-socket-to-one-private-upstream",
          accepted: proofs.upstreamReady,
        },
        { proof: "gradle-typed-route", accepted: proofs.gradleTypedRoute },
        { proof: "kast-typed-route", accepted: proofs.kastTypedRoute },
      ],
      decodeProofs: [
        { proof: "invalid-input-rejected", accepted: proofs.invalidRejected },
        {
          proof: "decode-failure-acquires-no-provider",
          accepted: proofs.invalidDidNotAcquire,
        },
      ],
      lifecycleProofs: [
        { proof: "one-start-per-provider", accepted: proofs.gradleStartedOnce },
        { proof: "interrupt-terminal", accepted: proofs.interrupted },
      ],
      threadProofs: [
        { proof: "catalog-injected", accepted: proofs.catalogInjected },
        {
          proof: `resume-compatible-upstream-${resumeDisposition}`,
          accepted: proofs.resumeQualified,
        },
        {
          proof: `fork-compatible-upstream-${forkDisposition}`,
          accepted: proofs.forkQualified,
        },
      ],
      upstreamProcessCount: countLogs(logs, "upstream.ready"),
      accepted,
    };
    const serializedReceipt = `${JSON.stringify(receipt, null, 2)}\n`;
    const receiptPath = resolve(
      import.meta.dirname,
      "../dist/installed-system-acceptance-receipt.json",
    );
    await mkdir(dirname(receiptPath), { recursive: true });
    await writeFile(receiptPath, serializedReceipt);
    process.stdout.write(serializedReceipt);
    if (!accepted) process.exitCode = 1;
  } finally {
    connection?.close(1000, "installed acceptance complete");
    if (running?.type === "success") await running.value.close();
    await rm(directory, { recursive: true, force: true });
  }
};

const createConsumerWorkspace = async (workspace: string): Promise<void> => {
  await mkdir(join(workspace, "src/main/kotlin"), { recursive: true });
  await Promise.all([
    writeFile(
      join(workspace, "settings.gradle.kts"),
      'rootProject.name = "acceptance"\n',
    ),
    writeFile(
      join(workspace, "build.gradle.kts"),
      'plugins { base }\ntasks.register("acceptanceRead") { doLast { println("accepted") } }\n',
    ),
    writeFile(
      join(workspace, "src/main/kotlin/AcceptanceFixture.kt"),
      "class AcceptanceFixture\n",
    ),
  ]);
  await execute("git", ["init", "--quiet"], { cwd: workspace });
  await execute(
    "gradle",
    ["wrapper", "--gradle-version", "8.14.3", "--no-daemon"],
    {
      cwd: workspace,
      maxBuffer: 1024 * 1024,
    },
  );
};

class RpcClient {
  readonly #websocket: WebSocket;
  readonly #pending = new Map<
    number,
    {
      readonly resolve: (value: Readonly<Record<string, unknown>>) => void;
      readonly reject: (error: Error) => void;
      readonly timer: NodeJS.Timeout;
    }
  >();
  #nextId = 1;

  constructor(websocket: WebSocket) {
    this.#websocket = websocket;
    websocket.on("message", (data, binary) => {
      if (binary) return;
      const document = parseRecord(data.toString());
      if (typeof document.id !== "number") return;
      const pending = this.#pending.get(document.id);
      if (pending === undefined) return;
      this.#pending.delete(document.id);
      clearTimeout(pending.timer);
      if (document.error !== undefined) {
        pending.reject(new Error(JSON.stringify(document.error)));
      } else {
        pending.resolve(requireRecord(document.result));
      }
    });
  }

  request(
    method: string,
    params: Readonly<Record<string, unknown>>,
  ): Promise<Readonly<Record<string, unknown>>> {
    const id = this.#nextId;
    this.#nextId += 1;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.#pending.delete(id);
        reject(new Error(`JSON-RPC request timed out: ${method}`));
      }, 30_000);
      this.#pending.set(id, { resolve, reject, timer });
      this.#websocket.send(JSON.stringify({ id, method, params }));
    });
  }
}

const threadIdentity = (result: Readonly<Record<string, unknown>>): string => {
  const thread = requireRecord(result.thread);
  if (typeof thread.id !== "string")
    throw new Error("thread response omitted its identity");
  return thread.id;
};

const qualifiedThreadOperation = async (
  operation: Promise<Readonly<Record<string, unknown>>>,
): Promise<"completed" | "no-rollout" | "unexpected-failure"> => {
  try {
    await operation;
    return "completed";
  } catch (error) {
    return error instanceof Error &&
      error.message.includes("no rollout found for thread id")
      ? "no-rollout"
      : "unexpected-failure";
  }
};

const invocationContext = (
  cwd: string,
  threadId: string,
  callId: string,
  signal = new AbortController().signal,
): InvocationContext => ({
  invocationId: callId,
  threadId,
  turnId: "installed-acceptance-turn",
  callId,
  cwd,
  signal,
});

const countLogs = (logs: readonly LogRecord[], event: string): number =>
  logs.filter((record) => record.event === event).length;

const countProviderStarts = (
  logs: readonly LogRecord[],
  provider: string,
): number =>
  logs.filter(
    (record) =>
      record.event === "provider.acquire" &&
      record.provider === provider &&
      record.runtime === "started",
  ).length;

const parseRecord = (text: string): Readonly<Record<string, unknown>> => {
  const value: unknown = JSON.parse(text);
  return requireRecord(value);
};

const requireRecord = (value: unknown): Readonly<Record<string, unknown>> => {
  if (!isRecord(value)) throw new Error("expected a JSON object");
  return value;
};

const isRecord = (value: unknown): value is Readonly<Record<string, unknown>> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

await runInstalledAcceptance();
