import type { UnifiedConfig } from "promptfoo";
import { cases } from "../../source/evals/promptfoo/cases.mts";
import { gradeDecision } from "./grade.mts";

// Replay only. Neither these outputs nor their scores are model evidence.
const config: UnifiedConfig = {
  description: "Offline replay: real promptfoo pipeline, synthetic answers, no model calls",
  sharing: false,
  providers: ["echo"],
  prompts: ["{{answer}}"],
  tests: cases.flatMap((item) => {
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
  }),
};

export default config;
