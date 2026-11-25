import { execFile } from "node:child_process";
import { randomUUID } from "node:crypto";
import { appendFile, cp, mkdir, mkdtemp, readFile, realpath, rm, stat, symlink, writeFile } from "node:fs/promises";
import { homedir, tmpdir } from "node:os";
import { isAbsolute, join, relative, sep } from "node:path";
import { promisify } from "node:util";
import { Codex } from "@openai/codex-sdk";
import type { ApiProvider, GradingResult, TokenUsage, UnifiedConfig } from "promptfoo";
import { digest, gradeExecution, loadExecutionCases, loadFixtures, repository, validateVerification } from "./execution.mts";
import type { ExecutionCase, Fixture } from "./execution.mts";

const execute = promisify(execFile);
const cli = join(repository, "node_modules/@openai/codex/bin/codex.js");
const timeoutMs = 10 * 60 * 1000;
type ExecutionHost = "codex" | "amp";

// No shell interpolation. Nonzero child outcomes remain evidence, never success.
async function command(file: string, args: string[], cwd: string, env: NodeJS.ProcessEnv, signal: AbortSignal) {
  try {
    const execution = execute(file, args, { cwd, env, signal, timeout: timeoutMs, maxBuffer: 16 * 1024 * 1024 });
    execution.child.stdin?.end();
    const result = await execution;
    return { file, args, code: 0, stdout: result.stdout, stderr: result.stderr };
  } catch (error) {
    if (!(error instanceof Error) || !("code" in error) || !("stdout" in error) || !("stderr" in error)) throw error;
    return { file, args, code: error.code, stdout: String(error.stdout), stderr: String(error.stderr) };
  }
}

async function required(file: string, args: string[], cwd: string, env: NodeJS.ProcessEnv, signal: AbortSignal) {
  const result = await command(file, args, cwd, env, signal);
  if (result.code !== 0) throw new Error(`Required command failed: ${file} ${args.join(" ")}; exit ${String(result.code)}; ${result.stderr.slice(-2000)}`);
  return result;
}

export async function retainEvidence(directory: string, references: string[]): Promise<Record<string, string>> {
  const root = await realpath(directory);
  const hashes: Record<string, string> = {};
  for (const reference of new Set(references)) {
    if (isAbsolute(reference) || reference.split(/[\\/]/u).some((part) => part === ".." || part === "")) {
      throw new Error(`Unsafe evidence reference: ${reference}`);
    }
    const path = await realpath(join(root, reference));
    if (!path.startsWith(root + sep) || !(await stat(path)).isFile()) throw new Error(`Evidence escapes archive: ${reference}`);
    hashes[reference] = digest(await readFile(path));
  }
  return hashes;
}

async function runExecution(host: ExecutionHost, item: ExecutionCase, fixture: Fixture, signal: AbortSignal): Promise<{ output: string; grade: GradingResult; artifacts: string; tokenUsage?: TokenUsage; sessionId?: string }> {
  const parent = join(repository, ".promptfoo/execution");
  await mkdir(parent, { recursive: true });
  const artifacts = await mkdtemp(join(parent, "run-"));
  const temporary = await mkdtemp(join(tmpdir(), "slopsentral-execution-"));
  let stage = "fixture";
  const save = (name: string, value: unknown) => writeFile(join(artifacts, name), JSON.stringify(value, null, 2) + "\n");
  try {
    const verifier = await realpath(fixture.verifier.file);
    const verifierBytes = await readFile(verifier);
    if (digest(verifierBytes) !== fixture.verifier.sha256) throw new Error("Independent verifier digest mismatch");
    await writeFile(join(artifacts, "verifier-source.txt"), verifierBytes);
    const home = join(temporary, "home");
    const codexHome = join(home, ".codex");
    const env: Record<string, string> = { PATH: process.env.PATH ?? "", HOME: home, CODEX_HOME: codexHome, XDG_CONFIG_HOME: join(home, ".config"), TMPDIR: join(temporary, "tmp") };
    for (const key of ["OPENAI_API_KEY", "CODEX_API_KEY", "PKL_BIN", "UV_BIN", "VALE_BIN"]) {
      const value = process.env[key];
      if (value !== undefined) env[key] = value;
    }
    await mkdir(codexHome, { recursive: true });
    await mkdir(env.TMPDIR ?? temporary, { recursive: true });
    if (host === "codex") {
      const auth = join(process.env.CODEX_HOME ?? join(homedir(), ".codex"), "auth.json");
      try { await symlink(await realpath(auth), join(codexHome, "auth.json")); }
      catch (error) { if (!(error instanceof Error) || !("code" in error) || error.code !== "ENOENT") throw error; }
    }

    // Private Git metadata: agent staging cannot touch the operator's index or refs.
    const clone = join(temporary, "repository");
    const workspace = join(temporary, "workspace");
    await required("git", ["clone", "--no-hardlinks", "--no-checkout", "--", fixture.repository, clone], home, env, signal);
    await required("git", ["remote", "remove", "origin"], clone, env, signal);
    await required("git", ["worktree", "add", "--detach", workspace, fixture.revision], clone, env, signal);
    const revision = (await required("git", ["rev-parse", "HEAD"], workspace, env, signal)).stdout.trim();
    if (revision !== fixture.revision) throw new Error("Fixture revision mismatch");
    await save("fixture.json", { ...fixture, resolvedRevision: revision });
    if (fixture.prepare) {
      stage = "preparation";
      const bytes = await readFile(fixture.prepare.file);
      if (digest(bytes) !== fixture.prepare.sha256) throw new Error("Fixture preparation digest mismatch");
      await writeFile(join(artifacts, "prepare-source.txt"), bytes);
      await save("prepare-request.json", { fixture, workspace, artifacts });
      const result = await command(process.execPath, [fixture.prepare.file, join(artifacts, "prepare-request.json")], workspace, env, signal);
      await save("prepare-process.json", result);
      if (result.code !== 0) throw new Error("Fixture preparation failed; inspect prepare-process.json");
    }
    // Runtime scratch is writable without appearing as unrelated task work.
    env.TMPDIR = join(workspace, ".promptfoo-tmp");
    await mkdir(env.TMPDIR);
    await appendFile(join(clone, ".git/info/exclude"), host === "amp" ? "\n/.promptfoo-tmp/\n/.amp/\n" : "\n/.promptfoo-tmp/\n");
    await save("initial-status.json", await required("git", ["status", "--porcelain=v1", "--untracked-files=all"], workspace, env, signal));

    stage = "provisioning";
    const marketplace = join(temporary, "marketplace");
    await save("projection.json", await required("python3", [join(repository, "tools/project_marketplaces.py"), "--source", repository, "--harness", host, "--out", marketplace], home, env, signal));
    await cp(marketplace, join(artifacts, "marketplace"), { recursive: true });
    const provision = [];
    const amp = process.env.AMP_BIN ?? "amp";
    const ampSettings = join(temporary, "amp.json");
    const ampFlags = ["--settings-file", ampSettings, "--no-ide", "--no-notifications"];
    if (host === "codex") {
      for (const args of [
        ["plugin", "marketplace", "add", marketplace, "--json"],
        ["plugin", "add", `${item.benchmark.targetName}@slopsentral`, "--json"],
        ["plugin", "list", "--json"],
      ]) provision.push(await required(process.execPath, [cli, ...args], home, env, signal));
    } else {
      if (!fixture.ampCommands) throw new Error("Amp requires explicit fixture commands");
      if (item.scenario.expectedPrimitive.type !== "SKILL") throw new Error("Amp fixture must select a skill");
      await mkdir(join(workspace, ".amp"));
      const plugins = join(workspace, ".amp/plugins");
      await mkdir(plugins);
      await cp(join(marketplace, ".amp/plugins", item.benchmark.targetName), join(plugins, item.benchmark.targetName), { recursive: true });
      env.XDG_DATA_HOME = join(home, ".local/share");
      env.XDG_CACHE_HOME = join(home, ".cache");
      const ampData = join(env.XDG_DATA_HOME, "amp");
      await mkdir(ampData, { recursive: true, mode: 0o700 });
      const authState = process.env.SLOPSENTRAL_AMP_AUTH_STATE;
      if (authState) {
        for (const name of ["secrets.json", "accounts.json", "session.json", "device-id.json"]) {
          try {
            const bytes = await readFile(join(authState, name));
            await writeFile(join(ampData, name), bytes, { mode: 0o600 });
          } catch (error) {
            if (!(error instanceof Error) || !("code" in error) || error.code !== "ENOENT") throw error;
          }
        }
      } else if (process.env.AMP_API_KEY) env.AMP_API_KEY = process.env.AMP_API_KEY;
      else throw new Error("Amp requires AMP_API_KEY or SLOPSENTRAL_AMP_AUTH_STATE");
      const skill = `${item.benchmark.targetName}:${item.scenario.expectedPrimitive.name}`;
      const settings = {
        "amp.updates.mode": "disabled",
        "amp.skills.disableClaudeCodeSkills": true,
        "amp.skills.disableGlobalAgentsSkills": true,
        "amp.tools.enable": ["*fixture_command", "skill"],
      };
      const fixtureTool = join(plugins, "execution-fixture");
      await mkdir(fixtureTool);
      const toolSource = await readFile(join(repository, "tools/promptfoo/fixtures/amp-tool.mjs"));
      await writeFile(join(fixtureTool, "index.js"), toolSource);
      await writeFile(join(fixtureTool, "package.json"), JSON.stringify({ type: "module" }));
      const toolConfig = { node: process.execPath, workspace, commands: fixture.ampCommands };
      await writeFile(join(fixtureTool, "fixture.json"), JSON.stringify(toolConfig));
      await writeFile(join(artifacts, "amp-fixture-tool.mjs"), toolSource);
      await save("amp-fixture-tool.json", toolConfig);
      await writeFile(ampSettings, JSON.stringify(settings));
      await save("amp-settings.json", settings);
      provision.push(await required(amp, ["--version"], workspace, env, signal));
      provision.push(await required(amp, [...ampFlags, "skill", "info", skill, "--json"], workspace, env, signal));
    }
    await save("provisioning.json", provision);

    const task = [item.scenario.userInput, "<fixture-context>", fixture.context, "</fixture-context>"].join("\n\n");
    const threadOptions = {
      model: item.benchmark.runner.model, workingDirectory: workspace,
      sandboxMode: item.benchmark.runner.sandbox, approvalPolicy: item.benchmark.runner.approvalPolicy,
      networkAccessEnabled: false, webSearchMode: "disabled", skipGitRepoCheck: false,
    } as const;
    const harnessSources = await retainEvidence(join(repository, "tools/promptfoo"), [
      "execution.mts", "execution-runtime.mts", ...(host === "amp" ? ["fixtures/amp-tool.mjs"] : []),
    ]);
    await save("request.json", { schemaVersion: 1, host, case: item, fixture, workspace, artifacts, task, taskSha256: digest(task), ...(host === "codex" ? { threadOptions, sdkVersion: "0.156.1" } : { model: `openai/${item.benchmark.runner.model}` }), verifierSha256: fixture.verifier.sha256, harnessSources });
    stage = "execution";
    const tracePath = join(artifacts, "events.jsonl");
    await writeFile(tracePath, "");
    let completed = false;
    let failed = false;
    let output = "";
    let tokenUsage: TokenUsage | undefined;
    let sessionId: string | undefined;
    try {
      if (host === "amp") {
        const result = await command(amp, [...ampFlags, "--visibility", "private", "--model",
          `openai/${item.benchmark.runner.model}`, "--plugin-ready-timeout", "15", "--stream-json", "--execute", task], workspace, env, signal);
        await writeFile(tracePath, result.stdout);
        if (result.stderr) await writeFile(join(artifacts, "amp-stderr.txt"), result.stderr);
        for (const event of result.stdout.trim().split("\n").filter(Boolean).map(line => JSON.parse(line))) {
          if (event.type === "result") {
            completed = event.subtype === "success" && event.is_error === false;
            if (typeof event.result === "string") output = event.result;
            if (typeof event.session_id === "string") sessionId = event.session_id;
          }
        }
        failed = result.code !== 0;
      } else {
        const thread = new Codex({ env, config: {
          features: { plugins: true, apps: false, skip_host_skill_discovery: true },
          sandbox_workspace_write: { exclude_tmpdir_env_var: true, exclude_slash_tmp: true },
        } }).startThread(threadOptions);
        const { events } = await thread.runStreamed(task, { signal });
        for await (const event of events) {
          // Preserve the original sequence, including unfamiliar and partial events.
          await appendFile(tracePath, JSON.stringify(event) + "\n");
          if (event.type === "turn.completed") {
            completed = true;
            tokenUsage = {
              prompt: event.usage.input_tokens, completion: event.usage.output_tokens,
              total: event.usage.input_tokens + event.usage.output_tokens,
              cached: event.usage.cached_input_tokens, numRequests: 1,
            };
          }
          if (event.type === "turn.failed" || event.type === "error") failed = true;
          if (event.type === "item.completed" && event.item.type === "agent_message") output = event.item.text;
        }
        sessionId = thread.id ?? undefined;
      }
    } catch (error) {
      await save("stream-error.json", { stage, message: error instanceof Error ? error.message.slice(0, 2000) : "Unknown stream error" });
      failed = true;
    }
    completed = completed && !failed && !signal.aborted;
    await writeFile(join(artifacts, "final-response.txt"), output);
    await save("final-status.json", await required("git", ["status", "--porcelain=v1", "--untracked-files=all"], workspace, env, AbortSignal.timeout(30_000)));
    await save("final-diff.json", await required("git", ["diff", fixture.revision, "--binary"], workspace, env, AbortSignal.timeout(30_000)));
    await save("final-head.json", await required("git", ["rev-parse", "HEAD"], workspace, env, AbortSignal.timeout(30_000)));
    const traceSha256 = digest(await readFile(tracePath));
    const requestPath = join(artifacts, "verification-request.json");
    await save("verification-request.json", { schemaVersion: 1, host, case: item, fixture, workspace, artifacts, traceSha256, completed });
    stage = "verification";
    const commands = [];
    for (const specification of item.scenario.verifierCommands ?? item.benchmark.verifiers.commands) {
      commands.push(await command("/bin/sh", ["-c", specification], workspace, env, AbortSignal.timeout(60_000)));
    }
    await save("benchmark-verifiers.json", commands);
    // Recheck outside the agent's writable root; do not execute a verifier it edited.
    if (digest(await readFile(verifier)) !== fixture.verifier.sha256) throw new Error("Verifier changed during execution");
    const verificationProcess = await command(process.execPath, [verifier, requestPath], home, env, AbortSignal.timeout(60_000));
    await save("verifier-process.json", verificationProcess);
    const verification: unknown = verificationProcess.code === 0 ? JSON.parse(verificationProcess.stdout) : null;
    let evidence: Record<string, string> = {};
    if (validateVerification(verification)) {
      evidence = await retainEvidence(artifacts, [...verification.checks, verification.route, verification.scope].flatMap((finding) => finding.evidence));
    }
    const grade = commands.some((result) => result.code !== 0)
      ? { pass: false, score: 0, reason: "UNASSESSED: required benchmark command failed; inspect benchmark-verifiers.json before attributing cause" }
      : gradeExecution(item, traceSha256, completed, verification);
    await save("receipt.json", { schemaVersion: 1, host, caseId: item.id, traceSha256, completed, sessionId, verification, evidence, grade });
    return { output, grade, artifacts, ...(tokenUsage ? { tokenUsage } : {}), ...(sessionId ? { sessionId } : {}) };
  } catch (error) {
    const reason = `${stage === "execution" || stage === "verification" ? "EXECUTION_ERROR" : "BLOCKED_SETUP"}: ${stage}: ${error instanceof Error ? error.message.slice(0, 3000) : "unknown adapter failure"}`;
    const grade = { pass: false, score: 0, reason };
    await save("receipt.json", { schemaVersion: 1, caseId: item.id, grade });
    return { output: reason, grade, artifacts };
  } finally {
    await rm(temporary, { recursive: true, force: true });
  }
}

// promptfoo's loader supports ApiProvider instances; UnifiedConfig's generated
// schema type omits that runtime-supported array member.
export async function createExecutionConfig(fixturePath: string | undefined, host: string = "codex"): Promise<Omit<UnifiedConfig, "providers"> & { providers: ApiProvider[] }> {
  if (host !== "codex" && host !== "amp") throw new Error(`Unsupported execution host: ${host}`);
  const cases = await loadExecutionCases();
  const fixtures = await loadFixtures(fixturePath, cases);
  // This map belongs to the host closure. Model-authored receipts cannot populate it.
  const grades = new Map<string, GradingResult>();
  const provider: ApiProvider = {
    id: () => host === "codex" ? "slopsentral:codex-execution-0.156.1" : "slopsentral:amp-execution",
    label: "Pinned benchmark execution / native marketplace / independent verifier",
    handlesOwnRetries: true,
    async callApi(_prompt, context, options) {
      const item = cases.find((item) => item.id === context?.vars.caseId);
      if (!item) return { error: "Unknown execution case" };
      const executionRunId = randomUUID();
      const fixture = fixtures.find((fixture) => fixture.caseId === item.id);
      if (!fixture || (host === "amp" && !fixture.ampCommands)) {
        const requirement = fixture ? "supply Amp fixture commands" : "supply a pinned fixture and independent verifier";
        const grade = { pass: false, score: 0, reason: `BLOCKED_SETUP: ${requirement}; no model call made` };
        grades.set(executionRunId, grade);
        return { output: grade.reason, metadata: { evidenceKind: "blocked-execution", caseId: item.id, executionRunId } };
      }
      const signal = AbortSignal.any([AbortSignal.timeout(timeoutMs), ...(options?.abortSignal ? [options.abortSignal] : [])]);
      const result = await runExecution(host, item, fixture, signal);
      grades.set(executionRunId, result.grade);
      return {
        output: result.output,
        ...(result.tokenUsage ? { tokenUsage: result.tokenUsage } : {}),
        ...(result.sessionId ? { sessionId: result.sessionId } : {}),
        metadata: { evidenceKind: "plugin-execution", host, caseId: item.id, executionRunId, artifacts: relative(repository, result.artifacts), grade: result.grade },
      };
    },
  };
  return {
    description: "Execution benchmarks: fixture, native delivery, tool trace, independent effects and scope",
    sharing: false, providers: [provider], prompts: ["{{task}}"],
    tests: cases.map((item) => ({
      description: item.id,
      vars: { caseId: item.id, task: item.scenario.userInput },
      metadata: { evidenceKind: "plugin-execution", caseId: item.id, benchmarkPath: item.path, benchmarkSha256: item.sha256, successChecklist: item.scenario.successChecklist, expectedPrimitive: item.scenario.expectedPrimitive, routingCaseIds: item.scenario.routingCaseIds },
      options: { disableVarExpansion: true },
      assert: [{ type: "javascript", metric: "execution", value: (_output, context) => {
        const runId: unknown = context.providerResponse?.metadata?.executionRunId;
        const caseId: unknown = context.providerResponse?.metadata?.caseId;
        const grade = typeof runId === "string" && caseId === item.id ? grades.get(runId) : undefined;
        if (typeof runId === "string") grades.delete(runId);
        return grade ?? { pass: false, score: 0, reason: "UNASSESSED: no fresh host-produced result" };
      } }],
    })),
    evaluateOptions: { cache: false, maxConcurrency: 1, timeoutMs: timeoutMs + 120_000 },
  };
}
