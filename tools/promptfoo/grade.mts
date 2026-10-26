import Ajv from "ajv";
import type { GradingResult } from "promptfoo";
import type { DecisionCase } from "../../source/evals/promptfoo/cases.mts";

interface Decision {
  selected: string[];
  reason: string;
}

export const decisionSchema = {
  type: "object",
  additionalProperties: false,
  required: ["selected", "reason"],
  properties: {
    selected: { type: "array", minItems: 1, items: { type: "string" } },
    reason: { type: "string", minLength: 20, pattern: "\\S" },
  },
};

const parseDecision = new Ajv({ allErrors: true, strict: true }).compile<Decision>(decisionSchema);

export function gradeDecision(test: DecisionCase, output: unknown): GradingResult {
  let decision: unknown = output;
  if (typeof output === "string") {
    try {
      decision = JSON.parse(output);
    } catch (error) {
      if (!(error instanceof SyntaxError)) throw error;
      return { pass: false, score: 0, reason: "The response is not JSON." };
    }
  }
  if (!parseDecision(decision)) {
    return { pass: false, score: 0, reason: "The response does not match the decision schema." };
  }
  const actual = [...decision.selected].sort();
  const expected = [...test.expected].sort();
  const pass = actual.length === expected.length && actual.every((value, index) => value === expected[index]);
  return {
    pass,
    score: pass ? 1 : 0,
    reason: pass ? test.rationale : `Expected ${expected.join(", ")}. Got ${actual.join(", ")}. ${test.rationale}`,
  };
}
