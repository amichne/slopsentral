// Promptfoo providers that run one isolated turn through the installed Codex and Claude Code CLIs.
// The bundled Codex SDK cannot select newer catalog models for a ChatGPT login, so these adapters
// own the process boundary. Neither adapter reads personal configuration, tools, plugins, or MCP servers.
import { spawn } from "node:child_process";
import { accessSync, constants, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { delimiter, join, sep } from "node:path";
import type { ApiProvider, ProviderResponse } from "promptfoo";
import type { EvalRuntime } from "./runtime.mts";

export type Effort = "low" | "medium" | "high";

const TIMEOUT_MS = 600_000;
const STDERR_LIMIT = 300;

// npm run puts node_modules/.bin first on PATH; that copy is the SDK's older CLI.
export function resolveExecutable(name: string, pathValue: string): string | undefined {
  for (const directory of pathValue.split(delimiter)) {
    if (directory === "" || directory.endsWith(`${sep}node_modules${sep}.bin`)) continue;
    const candidate = join(directory, name);
    try {
      accessSync(candidate, constants.X_OK);
      return candidate;
    } catch {
      continue;
    }
  }
  return undefined;
}

interface Exit {
  readonly code: number | null;
  readonly stdout: string;
  readonly stderr: string;
  readonly timedOut: boolean;
}

function run(command: string, args: readonly string[], input: string, cwd: string, env: NodeJS.ProcessEnv): Promise<Exit> {
  return new Promise((resolve) => {
    const child = spawn(command, args, { cwd, env, stdio: ["pipe", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      child.kill("SIGTERM");
    }, TIMEOUT_MS);
    child.stdout.on("data", (chunk) => { stdout += chunk; });
    child.stderr.on("data", (chunk) => { stderr += chunk; });
    child.on("error", (error) => {
      clearTimeout(timer);
      resolve({ code: null, stdout, stderr: String(error), timedOut });
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      resolve({ code, stdout, stderr, timedOut });
    });
    child.stdin.end(input);
  });
}

function failure(stage: string, exit: Exit): ProviderResponse {
  const detail = exit.timedOut ? "timed out" : `exit ${exit.code}`;
  return { error: `${stage} ${detail}: ${exit.stderr.slice(-STDERR_LIMIT)}` };
}

export function codexArgs(model: string, effort: Effort, outputFile: string): string[] {
  return [
    "exec", "--skip-git-repo-check", "--ephemeral", "--ignore-user-config", "--ignore-rules",
    "-s", "read-only", "-m", model, "-c", `model_reasoning_effort=${effort}`,
    "-c", "project_doc_max_bytes=0", "-c", "features.shell_tool=false", "-c", "features.apps=false",
    "-c", "features.plugins=false", "-c", "features.skip_host_skill_discovery=true",
    "-c", "web_search=disabled", "-o", outputFile, "-",
  ];
}

export function claudeArgs(model: string, effort: Effort): string[] {
  return [
    "-p", "--model", model, "--effort", effort, "--tools", "", "--setting-sources", "",
    "--strict-mcp-config", "--mcp-config", '{"mcpServers":{}}', "--disable-slash-commands",
    "--no-session-persistence", "--output-format", "json",
  ];
}

// Plain objects with own function properties: promptfoo copies the configuration, which drops class prototypes.
export function codexCliProvider(
  runtime: Pick<EvalRuntime, "codexHome" | "workspace">,
  model: string,
  effort: Effort,
  executable: string,
): ApiProvider {
  return {
    label: `${model} / ${effort} / codex-cli`,
    id: () => `codex-cli:${model}:${effort}`,
    callApi: async (prompt: string): Promise<ProviderResponse> => {
      const scratch = mkdtempSync(join(tmpdir(), "slopsentral-codex-turn-"));
      try {
        const outputFile = join(scratch, "last-message.txt");
        const env = Object.fromEntries(
          Object.entries(process.env).filter(([name]) => !name.startsWith("OPENAI_") && !name.startsWith("CODEX_")),
        );
        env.CODEX_HOME = runtime.codexHome;
        const exit = await run(executable, codexArgs(model, effort, outputFile), prompt, runtime.workspace, env);
        if (exit.code !== 0) return failure("codex", exit);
        try {
          return { output: readFileSync(outputFile, "utf8").trim() };
        } catch {
          return failure("codex produced no message", exit);
        }
      } finally {
        rmSync(scratch, { recursive: true, force: true });
      }
    },
  };
}

export function claudeCliProvider(
  runtime: Pick<EvalRuntime, "workspace">,
  model: string,
  effort: Effort,
  executable: string,
): ApiProvider {
  return {
    label: `${model} / ${effort} / claude-cli`,
    id: () => `claude-cli:${model}:${effort}`,
    callApi: async (prompt: string): Promise<ProviderResponse> => {
      // The login may come from the environment, so pass it through; the flags exclude settings and tools.
      const exit = await run(executable, claudeArgs(model, effort), prompt, runtime.workspace, process.env);
      if (exit.code !== 0) return failure("claude", exit);
      let parsed: unknown;
      try {
        parsed = JSON.parse(exit.stdout);
      } catch (error) {
        if (!(error instanceof SyntaxError)) throw error;
        return failure("claude returned non-JSON", exit);
      }
      if (typeof parsed !== "object" || parsed === null || !("result" in parsed) || typeof parsed.result !== "string") {
        return failure("claude returned no result", exit);
      }
      if ("is_error" in parsed && parsed.is_error === true) return { error: `claude error: ${parsed.result.slice(0, STDERR_LIMIT)}` };
      const cost = "total_cost_usd" in parsed && typeof parsed.total_cost_usd === "number" ? parsed.total_cost_usd : undefined;
      return cost === undefined ? { output: parsed.result.trim() } : { output: parsed.result.trim(), cost };
    },
  };
}
