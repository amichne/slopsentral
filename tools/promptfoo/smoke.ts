import type { TestCase, UnifiedConfig } from "promptfoo";
import { cases } from "../../source/evals/promptfoo/cases.mts";
import { revisionCases } from "../../source/evals/promptfoo/revisions.mts";
import { gradeDecision } from "./grade.mts";
import { gradeRevision } from "./grade-revision.mts";

const decisionTests: TestCase[] = cases.flatMap((item) => {
  const reason = "Synthetic control for the decision oracle. This is not a model response.";
  const extraChoice = Object.keys(item.choices).find((choice) => !item.expected.includes(choice));
  if (extraChoice === undefined) throw new Error(`${item.id} needs a plausible wrong choice`);
  return [
    { label: "expected choices", selected: item.expected, pass: true },
    { label: "missing choice", selected: item.expected.slice(1), pass: false },
    { label: "extra choice", selected: [...item.expected, extraChoice], pass: false },
  ].map(({ label, selected, pass }) => ({
    description: `${item.id}: ${label}`,
    vars: { answer: JSON.stringify({ selected, reason }) },
    assert: [{ type: "javascript", value: (output: string) => gradeDecision(item, output).pass === pass }],
  }));
});

// Authored revision controls: the accepted text must pass and each nearest error must fail.
const revisionTests: TestCase[] = revisionCases.flatMap((item) => [
  { label: "accepted revision", answer: item.controls.accepted, pass: true },
  ...Object.entries(item.controls.rejected).map(([label, answer]) => ({ label, answer, pass: false })),
].map(({ label, answer, pass }) => ({
  description: `${item.id}: ${label}`,
  vars: { answer },
  assert: [{ type: "javascript", value: (output: string) => gradeRevision(item, output).pass === pass }],
})));

// Replay only. Neither these outputs nor their scores are model evidence.
const config: UnifiedConfig = {
  description: "Offline replay: real promptfoo pipeline, synthetic answers, no model calls",
  sharing: false,
  providers: ["echo"],
  prompts: ["{{answer}}"],
  tests: [...decisionTests, ...revisionTests],
};

export default config;
