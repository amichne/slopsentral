import { spawn } from "node:child_process";

import type { Outcome } from "../broker/types.ts";

export interface ProcessRequest {
  readonly executable: string;
  readonly arguments: readonly string[];
  readonly cwd: string;
  readonly maximumOutputBytes: number;
  readonly signal: AbortSignal;
}

export interface ProcessResult {
  readonly exitCode: number;
  readonly stdout: string;
  readonly stderr: string;
}

export interface ProcessFailure {
  readonly code: "ABORTED" | "OUTPUT_LIMIT" | "SPAWN_FAILED" | "TERMINATED";
}

export type ProcessExecutor = (
  request: ProcessRequest,
) => Promise<Outcome<ProcessResult, ProcessFailure>>;

export const executeProcess: ProcessExecutor = (request) =>
  new Promise((resolve) => {
    if (request.signal.aborted) {
      resolve({ type: "failure", failure: { code: "ABORTED" } });
      return;
    }

    let settled = false;
    let outputBytes = 0;
    let killTimer: NodeJS.Timeout | undefined;
    const stdout: Buffer[] = [];
    const stderr: Buffer[] = [];
    const child = spawn(request.executable, [...request.arguments], {
      cwd: request.cwd,
      shell: false,
      stdio: ["ignore", "pipe", "pipe"],
    });
    const settle = (result: Outcome<ProcessResult, ProcessFailure>) => {
      if (settled) return;
      settled = true;
      request.signal.removeEventListener("abort", abort);
      resolve(result);
    };
    const abort = () => {
      terminate();
      settle({ type: "failure", failure: { code: "ABORTED" } });
    };
    const terminate = () => {
      child.kill("SIGTERM");
      killTimer = setTimeout(() => {
        if (child.exitCode === null && child.signalCode === null)
          child.kill("SIGKILL");
      }, 1_000);
      killTimer.unref();
    };
    const collect = (target: Buffer[], chunk: Buffer) => {
      if (settled) return;
      outputBytes += chunk.byteLength;
      if (outputBytes > request.maximumOutputBytes) {
        terminate();
        settle({ type: "failure", failure: { code: "OUTPUT_LIMIT" } });
        return;
      }
      target.push(chunk);
    };

    request.signal.addEventListener("abort", abort, { once: true });
    child.stdout.on("data", (chunk: Buffer) => collect(stdout, chunk));
    child.stderr.on("data", (chunk: Buffer) => collect(stderr, chunk));
    child.on("error", () =>
      settle({ type: "failure", failure: { code: "SPAWN_FAILED" } }),
    );
    child.on("close", (exitCode, signal) => {
      if (killTimer !== undefined) clearTimeout(killTimer);
      if (signal !== null) {
        settle({ type: "failure", failure: { code: "TERMINATED" } });
        return;
      }
      settle({
        type: "success",
        value: {
          exitCode: exitCode ?? 1,
          stdout: Buffer.concat(stdout).toString("utf8"),
          stderr: Buffer.concat(stderr).toString("utf8"),
        },
      });
    });
  });
