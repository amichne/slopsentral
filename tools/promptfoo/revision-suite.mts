import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import type { ApiProvider, TestCase, UnifiedConfig } from "promptfoo";
import { revisionCases, type RevisionCase } from "../../source/evals/promptfoo/revisions.mts";
import { claudeCliProvider, codexCliProvider, type Effort } from "./cli-providers.mts";
import { gradeRevision } from "./grade-revision.mts";
import type { EvalRuntime } from "./runtime.mts";

const root = new URL("../../", import.meta.url);
const hash = (text: string) => `sha256:${createHash("sha256").update(text).digest("hex")}`;
const read = (path: string) => readFileSync(new URL(path, root), "utf8");

export const SKILL_ROOT = "source/skills/controlled-technical-writing";
// The examples arm adds only the pattern reference, so the paired arms isolate its effect.
export const SKILL_FILES = [`${SKILL_ROOT}/SKILL.md`, `${SKILL_ROOT}/references/grounding.md`] as const;
export const EXAMPLE_FILES = [`${SKILL_ROOT}/references/writing-patterns.md`] as const;

export const MODELS: readonly { readonly host: "codex" | "claude"; readonly model: string; readonly effort: Effort }[] = [
  { host: "codex", model: "gpt-6.1-sol", effort: "low" },
  { host: "codex", model: "gpt-6.1-terra", effort: "low" },
  { host: "claude", model: "claude-sonnet-5-5", effort: "low" },
];

export function renderRevisionTask(item: RevisionCase, skillText: string): string {
  const parts = [
    `Revise the passage below for publication as a ${item.context}. If skill instructions are supplied, apply them.`,
    "Use only the supplied evidence. Do not use tools or read files.",
    "Return only the revised passage, with no preamble or commentary.",
  ];
  if (skillText !== "") parts.push("<skill>", skillText, "</skill>");
  parts.push("<passage>", item.passage, "</passage>");
  return parts.join("\n\n");
}

function supplied(paths: readonly string[]): { text: string; sources: { path: string; sha256: string }[] } {
  const files = paths.map((path) => ({ path, text: read(path) }));
  return {
    text: files.map(({ path, text }) => `${path}\n\n${text}`).join("\n\n"),
    sources: files.map(({ path, text }) => ({ path, sha256: hash(text) })),
  };
}

export function buildRevisionTests(): TestCase[] {
  const skill = supplied(SKILL_FILES);
  const examples = supplied([...SKILL_FILES, ...EXAMPLE_FILES]);
  const graderHash = hash(read("tools/promptfoo/grade-revision.mts"));
  const suiteHash = hash(JSON.stringify(revisionCases));
  return revisionCases.map((item) => {
    const examplesTask = renderRevisionTask(item, examples.text);
    const skillTask = renderRevisionTask(item, skill.text);
    const controlTask = renderRevisionTask(item, "");
    return {
      description: `controlled-technical-writing: ${item.id}`,
      vars: { examplesTask, skillTask, controlTask },
      metadata: {
        evidenceKind: "skill-revision-with-ablation-and-control",
        caseId: item.id,
        skillSources: skill.sources,
        exampleSources: examples.sources,
        suiteSha256: suiteHash,
        graderSha256: graderHash,
        examplesTaskSha256: hash(examplesTask),
        skillTaskSha256: hash(skillTask),
        controlTaskSha256: hash(controlTask),
      },
      assert: [{ type: "javascript", metric: "revision", value: (output) => gradeRevision(item, output) }],
      options: { disableVarExpansion: true },
    };
  });
}

export interface Executables {
  readonly codex: string;
  readonly claude: string;
}

// promptfoo accepts ApiProvider objects at runtime, but UnifiedConfig's inferred type omits them.
export type RevisionConfig = Omit<UnifiedConfig, "providers"> & { providers: ApiProvider[] };

export function createRevisionConfig(runtime: Pick<EvalRuntime, "codexHome" | "workspace">, executables: Executables): RevisionConfig {
  return {
    description: "Writing revisions v1: skill with examples, skill without examples, and no-skill control",
    sharing: false,
    prompts: [
      { id: "skill-with-examples-v1", label: "Skill with examples", raw: "{{examplesTask}}" },
      { id: "skill-without-examples-v1", label: "Skill without examples", raw: "{{skillTask}}" },
      { id: "without-skill-v1", label: "Without skill control", raw: "{{controlTask}}" },
    ],
    providers: MODELS.map(({ host, model, effort }) =>
      host === "codex"
        ? codexCliProvider(runtime, model, effort, executables.codex)
        : claudeCliProvider(runtime, model, effort, executables.claude)),
    tests: buildRevisionTests(),
    evaluateOptions: { maxConcurrency: 3, cache: false },
  };
}
