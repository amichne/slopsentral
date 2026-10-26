import { createHash } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { Ajv2020 } from "ajv/dist/2020.js";
import type { GradingResult } from "promptfoo";

export const repository = fileURLToPath(new URL("../../", import.meta.url));
export const digest = (bytes: string | Uint8Array) => `sha256:${createHash("sha256").update(bytes).digest("hex")}`;

export interface Benchmark {
  targetName: string;
  runner: { model: string; sandbox: "workspace-write"; approvalPolicy: "never"; extraArgs: [] };
  workspace: { sourcePath: string; setupMode: "git-worktree"; preserve: "never" };
  targetProvisioning: { mode: "workspace-plugin-marketplace" };
  verifiers: { commands: string[] };
  notes: string[];
  setupQuestions: string[];
  scenarios: Scenario[];
}

export interface Scenario {
  id: string;
  title: string;
  purpose: string;
  routingCaseIds: string[];
  expectedPrimitive: { type: string; name: string };
  userInput: string;
  successChecklist: string[];
}

export interface ExecutionCase {
  id: string;
  path: string;
  sha256: string;
  benchmark: Benchmark;
  scenario: Scenario;
}

export interface Fixture {
  caseId: string;
  repository: string;
  revision: string;
  context: string;
  prepare?: { file: string; sha256: string };
  verifier: { file: string; sha256: string };
}

const ajv = new Ajv2020({ strict: true });
const validateFixtures = ajv.compile<Fixture[]>({
  type: "array",
  $defs: {
    script: {
      type: "object", additionalProperties: false, required: ["file", "sha256"],
      properties: {
        file: { type: "string", pattern: "^/.*\\.(?:mjs|mts|js)$" },
        sha256: { type: "string", pattern: "^sha256:[a-f0-9]{64}$" },
      },
    },
  },
  items: {
    type: "object", additionalProperties: false,
    required: ["caseId", "repository", "revision", "context", "verifier"],
    properties: {
      caseId: { type: "string", minLength: 1 },
      repository: { type: "string", pattern: "^/" },
      revision: { type: "string", pattern: "^[a-f0-9]{40}$" },
      context: { type: "string" },
      prepare: { $ref: "#/$defs/script" },
      verifier: { $ref: "#/$defs/script" },
    },
  },
});

export async function loadExecutionCases(): Promise<ExecutionCase[]> {
  const directory = new URL("../../source/evals/promptfoo/execution/", import.meta.url);
  const schema = JSON.parse(await readFile(new URL("../../source/schemas/evals/plugin-eval-benchmark.schema.json", import.meta.url), "utf8"));
  const validate = new Ajv2020({ strict: true }).compile<Benchmark>(schema);
  const cases: ExecutionCase[] = [];
  for (const name of (await readdir(directory)).filter((name) => name.endsWith(".json")).sort()) {
    const bytes = await readFile(new URL(name, directory), "utf8");
    const benchmark: unknown = JSON.parse(bytes);
    if (!validate(benchmark)) throw new Error(`${name}: ${ajv.errorsText(validate.errors)}`);
    for (const scenario of benchmark.scenarios) {
      const id = `${benchmark.targetName}/${scenario.id}`;
      if (cases.some((item) => item.id === id)) throw new Error(`Duplicate execution case: ${id}`);
      cases.push({ id, path: `source/evals/promptfoo/execution/${name}`, sha256: digest(bytes), benchmark, scenario });
    }
  }
  return cases;
}

export async function loadFixtures(path: string | undefined, cases: ExecutionCase[]): Promise<Fixture[]> {
  if (path === undefined) return [];
  const input: unknown = JSON.parse(await readFile(path, "utf8"));
  if (!validateFixtures(input)) throw new Error(`Execution fixtures: ${ajv.errorsText(validateFixtures.errors)}`);
  const seen = new Set<string>();
  for (const fixture of input) {
    if (!cases.some((item) => item.id === fixture.caseId) || seen.has(fixture.caseId)) {
      throw new Error(`Unknown or duplicate fixture: ${fixture.caseId}`);
    }
    seen.add(fixture.caseId);
  }
  return input;
}

interface Finding {
  status: "pass" | "fail" | "unassessed";
  evidence: string[];
}

export interface Verification {
  caseId: string;
  traceSha256: string;
  checks: (Finding & { requirement: string })[];
  route: Finding;
  scope: Finding;
}

const findingProperties = {
  status: { enum: ["pass", "fail", "unassessed"] },
  evidence: { type: "array", uniqueItems: true, items: { type: "string", minLength: 1 } },
};
export const validateVerification = ajv.compile<Verification>({
  type: "object", additionalProperties: false,
  required: ["caseId", "traceSha256", "checks", "route", "scope"],
  properties: {
    caseId: { type: "string" }, traceSha256: { type: "string", pattern: "^sha256:[a-f0-9]{64}$" },
    checks: {
      type: "array", items: {
        type: "object", additionalProperties: false, required: ["requirement", "status", "evidence"],
        properties: { requirement: { type: "string" }, ...findingProperties },
      },
    },
    route: { type: "object", additionalProperties: false, required: ["status", "evidence"], properties: findingProperties },
    scope: { type: "object", additionalProperties: false, required: ["status", "evidence"], properties: findingProperties },
  },
});

// Only the host calls this with independently obtained verification, never model output.
export function gradeExecution(item: ExecutionCase, traceSha256: string, completed: boolean, verification: unknown): GradingResult {
  const reject = (reason: string): GradingResult => ({ pass: false, score: 0, reason });
  if (!completed) return reject("EXECUTION_ERROR: no successful terminal turn; partial evidence retained");
  if (!validateVerification(verification)) return reject("UNASSESSED: invalid or missing independent verification");
  if (verification.caseId !== item.id || verification.traceSha256 !== traceSha256) {
    return reject("UNASSESSED: verification belongs to another case or trace");
  }
  const requirements = item.scenario.successChecklist;
  if (verification.checks.length !== requirements.length || requirements.some((requirement) =>
    verification.checks.filter((check) => check.requirement === requirement).length !== 1)) {
    return reject("UNASSESSED: verifier must cover every exact checklist requirement once");
  }
  const findings = [...verification.checks, verification.route, verification.scope];
  if (findings.some((finding) => finding.status === "fail")) return reject("FAIL: independent verifier rejected execution evidence");
  if (findings.some((finding) => finding.status !== "pass" || finding.evidence.length === 0)) {
    return reject("UNASSESSED: checklist, route or scope evidence is incomplete");
  }
  return { pass: true, score: 1, reason: "PASS: completed execution, independent checklist, route and scope evidence" };
}
