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
    return [
      {
        description: `${item.id}: accepted control`,
        vars: { answer: JSON.stringify({ selected: item.expected, reason }) },
        assert: [{ type: "javascript", value: (output: string) => gradeDecision(item, output) }],
      },
      {
        description: `${item.id}: rejected control`,
        vars: { answer: JSON.stringify({ selected: ["WRONG"], reason }) },
        assert: [{ type: "javascript", value: (output: string) => !gradeDecision(item, output).pass }],
      },
    ];
  }),
};

export default config;
