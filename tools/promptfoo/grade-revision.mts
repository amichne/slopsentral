import type { GradingResult } from "promptfoo";
import type { RevisionCase } from "../../source/evals/promptfoo/revisions.mts";

// A gap is marked when the sentence flags the claim for the author or says the evidence does not establish it.
export const gapMarker = new RegExp(
  [
    "\\[(?:source needed|missing|author|todo|tbd|citation needed)",
    "\\bnot (?:been |yet )?(?:established|confirmed|documented|verified)\\b",
    "\\b(?:unverified|unconfirmed|uncertain|unknown)\\b",
    "\\bisn['’]t (?:established|confirmed|documented)\\b",
    "\\b(?:needs|requires) (?:confirmation|verification)\\b",
    "\\bconfirm whether\\b",
    "\\bdoes not (?:establish|say|state)\\b",
  ].join("|"),
  "iu",
);

const numberPattern = /\d+(?:\.\d+)?/gu;
// Ordered-list markers are formatting, not claims.
const listMarker = /^\s*\d+[.)]\s+/gmu;
// "me" is excluded: "let me know" is residue that each case's forbid list owns.
const firstPerson = /\b(?:I|I'm|I’m|I've|I’ve|my)\b/u;

// Split on line breaks and on sentence ends that start a new sentence or bracketed note.
export function sentences(text: string): string[] {
  return text
    .split(/\n+|(?<=[.!?])\s+(?=[A-Z[`])/u)
    .map((part) => part.trim())
    .filter((part) => part.length > 0);
}

interface Check {
  readonly name: string;
  readonly failures: readonly string[];
}

export function revisionChecks(item: RevisionCase, output: string): readonly Check[] {
  const lower = output.toLowerCase();
  const sourceNumbers = new Set(item.passage.match(numberPattern) ?? []);
  const parts = sentences(output);
  return [
    {
      name: "keptFacts",
      failures: item.facts
        .filter((spellings) => !spellings.some((spelling) => lower.includes(spelling.toLowerCase())))
        .map((spellings) => `missing fact: ${spellings.join(" | ")}`),
    },
    {
      name: "noNewNumbers",
      failures: [...new Set(output.replace(listMarker, "").match(numberPattern) ?? [])]
        .filter((value) => !sourceNumbers.has(value))
        .map((value) => `new number: ${value}`),
    },
    {
      name: "noAddedFirstPerson",
      failures: !firstPerson.test(item.passage) && firstPerson.test(output) ? ["added first person"] : [],
    },
    {
      name: "noForbidden",
      failures: item.forbid
        .filter((source) => new RegExp(source, "iu").test(output))
        .map((source) => `forbidden: ${source}`),
    },
    {
      name: "claimsOmittedOrMarked",
      failures: item.omitOrMark.flatMap((source) => {
        const claim = new RegExp(source, "iu");
        return parts
          .filter((part) => claim.test(part) && !gapMarker.test(part))
          .map((part) => `unmarked claim /${source}/: ${part.slice(0, 120)}`);
      }),
    },
  ];
}

export function gradeRevision(item: RevisionCase, output: unknown): GradingResult {
  if (typeof output !== "string" || output.trim().length === 0) {
    return { pass: false, score: 0, reason: "The response is empty or not text." };
  }
  const checks = revisionChecks(item, output);
  const failures = checks.flatMap((check) => check.failures);
  const namedScores = Object.fromEntries(checks.map((check) => [check.name, check.failures.length === 0 ? 1 : 0]));
  const passed = checks.filter((check) => check.failures.length === 0).length;
  return {
    pass: failures.length === 0,
    score: passed / checks.length,
    namedScores,
    reason: failures.length === 0 ? "Kept every fact and added no unsupported claim." : failures.join("; "),
  };
}
