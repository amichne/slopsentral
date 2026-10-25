export type Skill =
  | "semantic-ratchet"
  | "tdd"
  | "git-change-flow"
  | "kotlin-design-practices"
  | "python-tooling"
  | "controlled-technical-writing";

export interface DecisionCase {
  readonly id: string;
  readonly skill: Skill;
  readonly scenario: string;
  readonly choices: Readonly<Record<string, string>>;
  readonly expected: readonly string[];
  readonly rationale: string;
}

// The oracle stays outside the rendered prompt. Change a case ID when its meaning changes.
export const cases: readonly DecisionCase[] = [
  {
    id: "ratchet-consumer-and-construction",
    skill: "semantic-ratchet",
    scenario: "AccountId exposes a public unchecked constructor. A parser returns a validated AccountId. The service unwraps it to String before calling deleteAccount(String). Pick every necessary contract change.",
    choices: {
      A: "Make deleteAccount accept AccountId and carry the parsed value into it.",
      B: "Keep deleteAccount(String) and document the parser precondition.",
      C: "Make unchecked AccountId construction private to the invariant owner.",
      D: "Add a second String validator inside deleteAccount.",
    },
    expected: ["A", "C"],
    rationale: "The consumer must accept the established fact. A comment or another guard loses that fact at the interface.",
  },
  {
    id: "ratchet-capability-limit",
    skill: "semantic-ratchet",
    scenario: "An immutable AuthorizedAccount value proves authorization at lookup time. External permissions can change. Pick the supported conclusion.",
    choices: {
      A: "The type proves that authorization stays current until deletion.",
      B: "The value keeps the lookup fact. Current authorization needs a separate mechanism at the effect.",
      C: "An immutable value automatically proves single use.",
    },
    expected: ["B"],
    rationale: "A type alone cannot prove freshness or single consumption of external state.",
  },
  {
    id: "tdd-empty-selection",
    skill: "tdd",
    scenario: "A runner exits zero but selects zero assertions. The report calls this GREEN for duplicate rejection. Pick the next action.",
    choices: {
      A: "Accept GREEN because the runner returned zero.",
      B: "Add an unrelated failing assertion to manufacture RED.",
      C: "Reject the GREEN claim and run the existing duplicate-rejection assertion with a matching selector.",
    },
    expected: ["C"],
    rationale: "The assertion for the claimed invariant must run. A runner exit alone proves no behavior.",
  },
  {
    id: "tdd-existing-owner",
    skill: "tdd",
    scenario: "A prior plan proposes a second duplicate validator. The current validator already rejects duplicates, and its focused regression passes. Pick every justified action.",
    choices: {
      A: "Report reuse and keep the current owner.",
      B: "Create the second validator because the prior plan calls for it.",
      C: "Call the passing baseline a new RED/GREEN cycle.",
      D: "State the passing assertion and its scope without a production edit.",
    },
    expected: ["A", "D"],
    rationale: "Existing behavior can satisfy acceptance. A passing characterization is not a new RED/GREEN cycle.",
  },
  {
    id: "git-dirty-scoped-commit",
    skill: "git-change-flow",
    scenario: "The user requests a commit for your fix in src/parser.ts. An unrelated user edit exists in notes.md. Pick the safe action.",
    choices: {
      A: "Stage all files because both changes exist in the same worktree.",
      B: "Stage only the fix and its necessary regression. Keep notes.md untouched.",
      C: "Stash notes.md without permission before the commit.",
    },
    expected: ["B"],
    rationale: "The task commit must preserve unrelated user work and use explicit paths.",
  },
  {
    id: "git-local-only-authority",
    skill: "git-change-flow",
    scenario: "The repository normally uses pull requests. The user explicitly requests local edits only, with no commit or publication. The local checks pass. Pick the next action.",
    choices: {
      A: "Commit, push, and open a pull request because the repository normally uses them.",
      B: "Ask again for publication permission before completing the local task.",
      C: "Report the local result and leave the changes uncommitted.",
    },
    expected: ["C"],
    rationale: "Explicit local-only scope governs delivery. Routine publication rules do not override it.",
  },
  {
    id: "kotlin-closed-outcomes",
    skill: "kotlin-design-practices",
    scenario: "A Kotlin adapter receives a nullable SDK lookup. Core code needs Found(Account) or Missing. Pick every justified design decision.",
    choices: {
      A: "Normalize the nullable SDK result into domain-named sealed alternatives at the adapter.",
      B: "Wrap Account? in a data class and pass the nullable payload into core code.",
      C: "Handle both sealed alternatives with an exhaustive when and no else.",
      D: "Use !! in core code after a comment states that the account exists.",
    },
    expected: ["A", "C"],
    rationale: "The adapter owns nullable platform input. Closed non-null outcomes carry the domain fact into exhaustive consumers.",
  },
  {
    id: "kotlin-coroutine-lifetime",
    skill: "kotlin-design-practices",
    scenario: "A screen owns a Flow collector. After the screen closes, the collector must stop. Pick the design that keeps the lifecycle explicit.",
    choices: {
      A: "Launch it in GlobalScope so screen destruction cannot interrupt it.",
      B: "Let the screen scope own the collector and preserve cancellation through the adapter.",
      C: "Catch Throwable and return success when cancellation occurs.",
    },
    expected: ["B"],
    rationale: "The collector needs a lifetime owner. Cancellation must survive the effect adapter.",
  },
  {
    id: "python-portable-script",
    skill: "python-tooling",
    scenario: "A new portable Python utility needs third-party packages. Pick every necessary delivery choice.",
    choices: {
      A: "Use ambient pip packages and silently install missing packages on first use.",
      B: "Declare PEP 723 metadata, a Python range, an index, and tool.uv.no-build = true.",
      C: "Commit a script lock and use uv run --locked --script.",
      D: "Run strict Pyright, Ruff, pytest, and the standalone self-test.",
    },
    expected: ["B", "C", "D"],
    rationale: "The portable script needs declared, locked dependencies plus static and runtime evidence.",
  },
  {
    id: "python-literal-process-input",
    skill: "python-tooling",
    scenario: "A CLI passes a user filename containing spaces and $(touch marker) to another process. Pick every safe implementation choice.",
    choices: {
      A: "Use an argument array and shell=False.",
      B: "Interpolate the filename into a shell command after JSON.stringify.",
      C: "Exercise the real CLI with the literal filename and assert that no marker appears.",
      D: "Catch all process failures and report success.",
    },
    expected: ["A", "C"],
    rationale: "Literal process arguments need an argument array. A real invocation must exercise metacharacters without shell evaluation.",
  },
  {
    id: "writing-preserve-error",
    skill: "controlled-technical-writing",
    scenario: "An incident note quotes the exact error FRESHNESS_REJECTED. A readability tool flags its sentence. Pick the justified edit.",
    choices: {
      A: "Replace FRESHNESS_REJECTED with a simpler invented error name.",
      B: "Delete the failure detail to reduce the grade estimate.",
      C: "Simplify the surrounding prose and keep the exact error and its source meaning.",
    },
    expected: ["C"],
    rationale: "Literal errors and technical facts keep their identity. Readability advice does not authorize a changed fact.",
  },
  {
    id: "writing-assessment-limit",
    skill: "controlled-technical-writing",
    scenario: "The pinned prose tool returns INCOMPLETE because no glossary was supplied. Its grade estimate is 7. Pick every supported report statement.",
    choices: {
      A: "The grade proves that a reader understands the document.",
      B: "The measurements ran, but terminology consistency lacks a glossary assessment.",
      C: "The document passed all prose checks because its grade is less than 8.",
      D: "Reader comprehension remains unassessed.",
    },
    expected: ["B", "D"],
    rationale: "Measurements, terminology coverage, and reader comprehension are separate claims.",
  },
];
