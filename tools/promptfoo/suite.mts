import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import type { TestCase, UnifiedConfig } from "promptfoo";
import { cases, type DecisionCase } from "../../source/evals/promptfoo/cases.mts";
import { decisionSchema, gradeDecision } from "./grade.mts";
import type { EvalRuntime } from "./runtime.mts";

const root = new URL("../../", import.meta.url);
// The prefix distinguishes a content digest from a secret in promptfoo's report sanitizer.
const hash = (text: string) => `sha256:${createHash("sha256").update(text).digest("hex")}`;
const graderHash = hash(readFileSync(new URL("./grade.mts", import.meta.url), "utf8"));
const suiteHash = hash(JSON.stringify(cases));

export function renderTask(item: DecisionCase, skillText: string): string {
  return [
    "Decide how to handle the case. If skill instructions are supplied, apply them. Use only the supplied evidence.",
    "Do not use tools or read other files. Do not claim that commands or edits occurred.",
    "Select every justified choice and no other choice. Choice order has no meaning.",
    'Return only JSON with exactly two fields: "selected" as an array of choice IDs, and "reason" as a short explanation.',
    "The explanation must contain at least 20 characters.",
    "<skill>", skillText, "</skill>",
    "<case>", item.scenario,
    ...Object.entries(item.choices).map(([id, text]) => `${id}: ${text}`),
    "</case>",
  ].join("\n\n");
}

export function buildTests(): TestCase[] {
  return cases.map((item) => {
    const skillPath = `source/skills/${item.skill}/SKILL.md`;
    const skillText = readFileSync(new URL(skillPath, root), "utf8");
    const task = renderTask(item, skillText);
    const controlTask = renderTask(item, "No skill instructions are supplied. Use your usual engineering judgment.");
    return {
      description: `${item.skill}: ${item.id}`,
      vars: { task, controlTask },
      metadata: {
        evidenceKind: "skill-decision-with-control",
        caseId: item.id,
        skill: item.skill,
        skillPath,
        skillSha256: hash(skillText),
        suiteSha256: suiteHash,
        graderSha256: graderHash,
        taskSha256: hash(task),
        controlTaskSha256: hash(controlTask),
      },
      assert: [{ type: "javascript", metric: "decision", value: (output) => gradeDecision(item, output) }],
      options: { disableVarExpansion: true },
    };
  });
}

export function createConfig(runtime: Pick<EvalRuntime, "codexHome" | "workspace">): UnifiedConfig {
  return {
    description: "Core skills v1: paired decisions, not tool execution or automatic routing",
    sharing: false,
    prompts: [
      { id: "loaded-skill-v1", label: "Loaded skill", raw: "{{task}}" },
      { id: "without-skill-v1", label: "Without skill control", raw: "{{controlTask}}" },
    ],
    providers: [{
      id: "openai:codex-sdk",
      label: "gpt-6-sol / low / codex-sdk-0.156.1",
      config: {
        model: "gpt-6-sol",
        model_reasoning_effort: "low",
        sandbox_mode: "read-only",
        approval_policy: "never",
        working_dir: runtime.workspace,
        skip_git_repo_check: true,
        network_access_enabled: false,
        web_search_mode: "disabled",
        persist_threads: false,
        inherit_process_env: false,
        cli_env: { CODEX_HOME: runtime.codexHome },
        maxRetries: 0,
        output_schema: decisionSchema,
        cli_config: {
          project_doc_max_bytes: 0,
          suppress_unstable_features_warning: true,
          features: { shell_tool: false, apps: false, plugins: false, skip_host_skill_discovery: true },
        },
      },
    }],
    tests: buildTests(),
    evaluateOptions: { maxConcurrency: 2, cache: false },
  };
}
