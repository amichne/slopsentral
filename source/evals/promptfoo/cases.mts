export type Skill =
  | "semantic-ratchet"
  | "tdd"
  | "git-change-flow"
  | "github-ci-operations"
  | "pull-request-lifecycle"
  | "kotlin-design-practices"
  | "python-tooling"
  | "controlled-technical-writing"
  | "technical-documentation"
  | "skill-primitive-authoring"
  | "code-knowledge-base"
  | "personal-setup-management";

export interface DecisionCase {
  readonly id: string;
  readonly skill: Skill;
  readonly references?: readonly string[];
  readonly scenario: string;
  readonly choices: Readonly<Record<string, string>>;
  readonly expected: readonly string[];
  readonly rationale: string;
}

// The oracle stays outside the rendered prompt. Change a case ID when its meaning changes.
export const cases: readonly DecisionCase[] = [
  {
    id: "roi-ci-empty-is-not-success",
    skill: "github-ci-operations",
    scenario: "A new PR has head abc123. Its required-check query returns an empty array before Actions starts. The observer reports success because no failed rows exist. Pick every justified action.",
    choices: {
      A: "Report that the current revision passed its required checks.",
      B: "Keep the result unresolved until evidence establishes the expected checks and their terminal states.",
      C: "Repair the empty-result classification and preserve the observed head in its regression.",
      D: "Disable required checks to make the empty result authoritative.",
    },
    expected: ["B", "C"],
    rationale: "An empty inventory proves no check outcome. The revision and expected evidence must remain explicit.",
  },
  {
    id: "roi-ci-changed-head",
    skill: "pull-request-lifecycle",
    scenario: "Required checks passed for PR head abc123. A later push changes its head to def456 while the observer waits. Pick the supported delivery statement.",
    choices: {
      A: "The PR is green because its previous revision passed.",
      B: "The checks prove abc123 only. Get fresh evidence for def456 before a green claim.",
      C: "Use the branch name as proof that both revisions have the same check outcome.",
    },
    expected: ["B"],
    rationale: "A terminal result belongs to its observed revision. A branch name cannot transfer that result to a later commit.",
  },
  {
    id: "roi-ci-timeout-continuation",
    skill: "github-ci-operations",
    scenario: "A bounded observer times out while checks remain queued. Its saved request binds a PR head, baseline, and completion predicate. An explicit resume command exists. Pick every justified action.",
    choices: {
      A: "Resume the saved request with the same identity and predicate after reporting the timeout as unresolved.",
      B: "Treat the timeout as a successful completion because no failing check appeared.",
      C: "Start several independent status loops so each agent can watch the same target.",
      D: "Keep one observer owner and preserve evidence that separates timeout from a terminal result.",
    },
    expected: ["A", "D"],
    rationale: "Timeout limits a wait, not the target identity. One owner and a preserved request avoid duplicate observation and false completion.",
  },
  {
    id: "roi-validation-coverage-equivalence",
    skill: "github-ci-operations",
    references: ["references/workflow-graph-optimization.md"],
    scenario: "An old qualification takes 50 minutes with semantic fixtures enabled. A new routine gate takes 7 minutes with those fixtures disabled. Both runs pass. Pick every supported conclusion.",
    choices: {
      A: "The qualification became seven times faster with equal coverage.",
      B: "The timings describe different proof sets and cannot establish an equal-coverage speedup.",
      C: "Keep routine and qualification evidence distinct, then compare matched proof sets before a performance claim.",
      D: "Delete the qualification because the faster gate passed.",
    },
    expected: ["B", "C"],
    rationale: "Latency and proof coverage must share a comparison contract. A smaller proof set cannot establish a faster equivalent gate.",
  },
  {
    id: "roi-validation-stop-at-scope",
    skill: "tdd",
    scenario: "A one-module parser fix passes its independent regression, nearest invalid case, and every required repository check. No unresolved consumer or platform risk remains. Pick the next action.",
    choices: {
      A: "Run every broad suite repeatedly because more tests always strengthen this specific claim.",
      B: "Stop validation and deliver the scoped result with the exact checks and their limits.",
      C: "Add assertions that mirror production branches to raise the test count before delivery.",
    },
    expected: ["B"],
    rationale: "The task ends when its decisive proof and required checks pass. More execution needs a named unresolved risk.",
  },
  {
    id: "roi-delivery-standing-authority",
    skill: "pull-request-lifecycle",
    scenario: "The user requests implementation. Repository instructions explicitly authorize task commits, branch pushes, and PR creation after local checks. Checks pass. No instruction authorizes a merge or release. Pick every justified action.",
    choices: {
      A: "Commit the scoped files, push the task branch, and create the PR under the existing authority.",
      B: "Stop at an uncommitted diff and request the same publication permission again.",
      C: "Merge and release because PR creation authority includes those actions.",
      D: "Report the PR, its revision, and check evidence while leaving merge and release untouched.",
    },
    expected: ["A", "D"],
    rationale: "Standing authority covers its named delivery steps. It neither needs repetition nor grants unnamed merge or release actions.",
  },
  {
    id: "roi-eval-tied-control",
    skill: "skill-primitive-authoring",
    scenario: "A decision evaluation scores 12 of 12 for both the loaded skill and the no-skill control. No tool executes. Pick every supported report statement.",
    choices: {
      A: "The skill caused better real-world task completion.",
      B: "Both variants passed these decision cases. The result shows no measured advantage for the skill.",
      C: "Tool execution and host behavior remain unmeasured by this suite.",
      D: "Convert the tied result into a percentage improvement from the skill quality score.",
    },
    expected: ["B", "C"],
    rationale: "A tied paired decision result establishes neither uplift nor executed behavior. Those claims need separate evidence.",
  },
  {
    id: "roi-token-cache-accounting",
    skill: "github-ci-operations",
    scenario: "A transcript reports 100 million cumulative input tokens, including 98 million cached input tokens, across repeated tool turns. No billing statement or price contract is supplied. Pick the supported conclusion.",
    choices: {
      A: "The transcript proves payment for 100 million uncached tokens.",
      B: "Report the recorded total and cached categories separately. Neither alone proves money spent or avoidable waste.",
      C: "Assume all cached input is free and all remaining tokens are unnecessary.",
    },
    expected: ["B"],
    rationale: "Usage categories are evidence of recorded consumption. Billing and counterfactual waste need their own inputs.",
  },
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
  {
    id: "writing-bootstrap-missing-glossary",
    skill: "controlled-technical-writing",
    references: ["references/glossary-authoring.md", "references/glossary-contract.md"],
    scenario: "The user authorizes a repository documentation rewrite. Repository rules and documentation roots contain no glossary. Current local contracts and examined domain references support three specialist concepts; a fourth term has conflicting meanings. Pick every justified action.",
    choices: {
      A: "Create a minimal provisional glossary.json for the three supported concepts, scope it to the requested documents, validate it, and generate its GLOSSARY.md reader view before assessment.",
      B: "Omit glossary creation because it was not separately requested, even though the documentation rewrite is authorized.",
      C: "Invent the fourth definition and synonym replacements so terminology assessment can pass.",
      D: "Report the unresolved fourth term and keep unsupported replacements out of the glossary.",
    },
    expected: ["A", "D"],
    rationale: "Authorized durable rewriting includes a missing-glossary bootstrap, but definitions and substitutions still require evidence.",
  },
  {
    id: "writing-assessment-no-bootstrap",
    skill: "controlled-technical-writing",
    scenario: "The user asks only to measure an existing runbook and forbids file changes. No glossary exists. The fixed tool can report measurements with terminology marked INCOMPLETE. Pick the justified action.",
    choices: {
      A: "Create a provisional glossary before measurement because every documentation task requires one.",
      B: "Run the requested measurement without a glossary, report INCOMPLETE terminology coverage, and change no repository files.",
      C: "Treat a grade estimate below 8 as complete terminology coverage.",
    },
    expected: ["B"],
    rationale: "Assessment alone does not authorize glossary creation and cannot prove missing terminology coverage.",
  },
  {
    id: "knowledge-openwiki-existing-glossary",
    skill: "code-knowledge-base",
    references: ["references/knowledge-backend-handoff.md"],
    scenario: "The user requests an OKF rewrite through the existing external OpenWiki integration. A canonical docs/glossary.json and generated reader view already exist. The native page queue has assigned one page, and finish has not run. Pick every justified action.",
    choices: {
      A: "Reuse the glossary, include the wiki in its controlled scope before the run, then write only the assigned page and submit sparse Claim decisions through OpenWiki.",
      B: "Create openwiki/glossary.json and hand-edit Claim sidecars to make the wiki self-contained.",
      C: "Run the standalone OKF checker instead of OpenWiki submission and report the rewrite complete.",
      D: "Continue the native queue and report completion only after OpenWiki finish returns complete.",
    },
    expected: ["A", "D"],
    rationale: "A backend change does not create another glossary owner; OpenWiki owns page assignment, Claims persistence, and completion.",
  },
  // Decision adaptations of PR #102's fixed C1–C5N execution rubrics.
  // Historical tool-run results remain in docs/session-grounded-skill-campaign.md.
  {
    id: "session-c1-live-interface",
    skill: "tdd",
    references: ["references/real-interface-proof.md"],
    scenario: "The user requests a read-only multi-hop smoke test of the actual integration, with no installation or restart. Unit tests pass. A cached status command says unavailable, but an already-connected public reader answers. An independent fixture expects account A → team B → owner C; the public reader returns account A → team B → owner D. Pick every justified action.",
    choices: {
      A: "Use passing unit tests as proof that the actual integration is correct.",
      B: "Retain both readiness observations, exercise the bounded public read, and report the incorrect second-hop identity against the independent fixture.",
      C: "Restart or reinstall the host to reconcile the status signal before reporting.",
      D: "Name the process or artifact tested and distinguish the live mismatch from supporting unit-test results.",
    },
    expected: ["B", "D"],
    rationale: "The requested public path and relationship identities decide live correctness. Contradictory readiness is not authority to mutate the host or replace live proof with unit results.",
  },
  {
    id: "session-c1n-explain-unit-evidence",
    skill: "tdd",
    scenario: "The user supplies existing passing unit-test results and asks only what they prove. The user forbids commands and changes. Pick the justified response.",
    choices: {
      A: "Explain that the supplied results support the exercised isolated assertions, not an unobserved live integration; run nothing and change nothing.",
      B: "Start the service and run a multi-hop probe because stronger evidence is always required.",
      C: "Create a failing test so the explanation includes a RED/GREEN cycle.",
    },
    expected: ["A"],
    rationale: "A bounded explanation preserves the requested evidence level and no-execution scope; stronger unrequested proof would expand the task.",
  },
  {
    id: "session-c2-published-docs",
    skill: "technical-documentation",
    references: ["references/rendered-site-proof.md"],
    scenario: "The user requests a real-browser comparison of local docs revision R2 and a published URL, including architecture navigation, with no deployment. The local build passes and both URLs return HTTP 200. Browser observations show the new architecture page and navigation locally, but old navigation and no architecture route remotely. Remote deployment revision metadata is unavailable. Pick every supported action or conclusion.",
    choices: {
      A: "Report a published match because the local build and both HTTP responses succeeded.",
      B: "Deploy R2 immediately to eliminate the observed difference.",
      C: "Report the inspected page and navigation mismatch while leaving remote deployment identity and its cause unresolved.",
      D: "Compare the same distinctive content, links, and rendered navigation on both destinations; retain the no-deployment boundary.",
    },
    expected: ["C", "D"],
    rationale: "Build, rendering, and deployment establish different facts. Observed remote differences do not identify a deployment revision or authorize publication.",
  },
  {
    id: "session-c2n-readme-typo",
    skill: "technical-documentation",
    scenario: "A repository contains a documentation website. The user asks to fix one typo in the local README only and forbids publication. Pick the appropriate scope.",
    choices: {
      A: "Build the website and open local and remote browsers because this is documentation work.",
      B: "Correct only the typo, inspect the scoped diff, and use the appropriate existing prose checks without starting a browser or deploying.",
      C: "Deploy the website after the README correction so published documentation stays current.",
    },
    expected: ["B"],
    rationale: "A site marker alone does not require rendered-site proof for a local typo; validation follows the actual changed claim.",
  },
  {
    id: "session-c3-evidence-not-distribution",
    skill: "skill-primitive-authoring",
    scenario: "An existing invariant-design skill owns the requested rule. The user supplies three notes containing private examples to explain the intended standard and asks for a focused local clarification. No bundled resources or model runs are requested. Pick every justified action.",
    choices: {
      A: "Classify the notes as explanatory evidence and amend the existing owner with the smallest necessary rule.",
      B: "Bundle all notes and private examples as references because attribution makes distribution appropriate.",
      C: "Check the shipped file set and local validation; keep evidence-only notes and raw traces outside the package.",
      D: "Create a new skill, hook, evidence framework, and fresh model campaign to preserve the supplied workflow.",
    },
    expected: ["A", "C"],
    rationale: "Supplied evidence clarifies intent but does not authorize distribution or extra workflows. The existing owner and local checks satisfy the scoped request.",
  },
  {
    id: "session-c3n-authorized-reference",
    skill: "skill-primitive-authoring",
    scenario: "The user explicitly asks to package a supplied public example as a bundled reference, preserve attribution, and link it only for the relevant task. All work must remain local. Pick the justified action.",
    choices: {
      A: "Refuse all attachments because supplied notes can never be distributed.",
      B: "Copy an upstream system skill and all its examples into a new local canonical owner.",
      C: "Package the requested public example with provenance and a conditional reference link, validate locally, and do not publish.",
    },
    expected: ["C"],
    rationale: "Explicit inclusion authority and public provenance permit this scoped resource. The evidence-only rule is not a blanket ban on bundled examples.",
  },
  {
    id: "session-c4-functional-depth",
    skill: "code-knowledge-base",
    scenario: "The user asks to deepen an existing local OKF knowledge base across functional packages. Its pages list entrypoints but omit worker cancellation and persistence recovery. Representative source, tests, the existing index, and native writer and validator are supplied. Pick every justified action.",
    choices: {
      A: "Declare depth established when page count doubles and metadata validation passes.",
      B: "Map requested functional areas to existing explanations or named gaps, tracing representative owners, state, dependencies, failures, and recovery from source.",
      C: "Create a separate OpenWiki store because adding a second backend increases coverage.",
      D: "Update the existing backend and index together and validate natively, without treating valid links or package counts alone as explanatory depth.",
    },
    expected: ["B", "D"],
    rationale: "Depth requires explanations of requested behavior grounded in source, not an inventory metric or a replacement knowledge backend.",
  },
  {
    id: "session-c4n-bounded-location",
    skill: "code-knowledge-base",
    scenario: "The user asks where one worker-cancellation decision lives and permits reading existing knowledge and source only. Documentation generation and updates are forbidden. Pick the justified action.",
    choices: {
      A: "Answer the one location question with evidence from existing knowledge and source, leaving documentation unchanged.",
      B: "Map every functional package and launch a coverage campaign before answering.",
      C: "Create missing concepts and refresh the knowledge index because the repository has a knowledge store.",
    },
    expected: ["A"],
    rationale: "A bounded query does not authorize documentation expansion merely because a knowledge backend exists.",
  },
  {
    id: "session-c5-public-home-fixture",
    skill: "personal-setup-management",
    scenario: "The user requests a Ctrl-T source fix and verification, with no installation and no changes to private settings or unrelated files. A disposable HOME contains tracked public shell files, an untracked private marker, and a dangling unrelated symlink. The aggregate runner recursively copies its HOME input; a declared public inventory and focused fresh-shell regression are available. Pick every justified action.",
    choices: {
      A: "Copy all of live HOME to the fixture before running tests so no configuration is missed.",
      B: "Delete the dangling unrelated link or weaken the aggregate assertions to obtain a passing result.",
      C: "Inspect runner roots and verify the source fix in an isolated fixture made only from declared public inputs, preserving required paths and modes.",
      D: "Keep installed consumers and private files unchanged; if a mandatory aggregate cannot operate safely, report that setup failure separately from the focused result.",
    },
    expected: ["C", "D"],
    rationale: "Verification must preserve public input and private-state boundaries. A focused passing fixture neither authorizes installation nor conceals an unsafe required aggregate.",
  },
  {
    id: "session-c5n-shell-activation",
    skill: "personal-setup-management",
    scenario: "A public-source fixture and its fresh-shell regression passed. The user asks whether this proves the fix is active in their currently running shell, and forbids commands or installation. Pick the supported response.",
    choices: {
      A: "Confirm activation in the current shell because the fixture passed.",
      B: "Explain that the fixture supports source behavior; the installed link, a fresh consumer shell, and the already-running shell need separate evidence. Run and install nothing.",
      C: "Install the fix and open a fresh shell to strengthen the evidence before answering.",
    },
    expected: ["B"],
    rationale: "Source proof, installed target identity, fresh-shell loading, and current-shell state are distinct facts; the explanation does not authorize effects.",
  },
];
