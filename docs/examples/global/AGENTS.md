# Engineering principles

Design software whose contracts express its meaning, whose legal behavior is
explicit, and whose claims have evidence. Apply these principles with the
strongest mechanisms the project's language and tools support.

## Establish the contract

- Before a substantial change, name the consumer, observable outcome, invariant,
  scope, and non-goals. An invariant is a rule that every legal value or operation
  must preserve.
- Inspect the owning implementation, public contracts, direct consumers, and
  existing tests before choosing a design.
- Distinguish current behavior, intended behavior, assumptions, and unknowns.
  Treat summaries and plans as leads until their sources support them.
- Choose reuse, extension, a new owner, or investigation from that evidence.
  Reuse an existing owner that meets the contract.
- Define the smallest faithful acceptance test, a nearby counterexample, and
  the evidence that ends the task. Scale this preparation to the change.

## Preserve established facts

- Parse external input once at each entry point into constrained values or
  explicit failures. Keep unchecked construction under the invariant's owner.
- Make a successful parse, normalization, lookup, or authorization return the
  facts that later consumers need.
- Make consumer contracts accept those stronger values. Carry them through
  transformations instead of reconstructing raw primitives.
- Prefer representations that exclude invalid shapes by construction.
  If the language cannot express the rule directly, use controlled construction.
- Where static enforcement is unavailable, use schemas, controlled module APIs,
  closed tagged values, and focused runtime tests.
- Keep values with different meanings distinct even when their primitive
  representations match.
- Do not treat a name, alias, unchecked wrapper, comment, or prior guard as
  proof of an invariant.
- If no later consumer needs a small private fact, keep it local.
  Add a representation to prevent a named misuse, not to decorate every primitive.

## Model legal alternatives and transitions

- Represent finite alternatives with closed variants. Put each case's necessary
  data on that case.
- Avoid tags with unrelated optional fields, Boolean modes, and nulls with
  several meanings.
- Handle closed alternatives exhaustively. Adding a supported case must expose
  incomplete consumers.
- Give unsupported external input an explicit rejection. If the compatibility
  contract permits unknown values, model them explicitly.
- Make each lifecycle transition accept its legal source state and return its
  destination state or a defined failure.
- Expose restricted operations only through the state or capability that
  supports them. Do not depend on remembered call order.
- Scope evidence to the identity, version, action, and lifetime it establishes.
  If external mutation or elapsed time can invalidate a fact, reestablish it.
- Do not claim that an ordinary type proves fresh authorization, immutable
  external state, atomicity, or single consumption.

## Give each rule one owner

- Keep each invariant, transition, default, and protocol rule under one
  authoritative owner. Derive other representations from that owner.
- Put behavior with the smallest type or module that owns its meaning.
  Syntax and convenience do not establish ownership.
- Keep public interfaces small while preserving the facts consumers need.
  Hide implementation choices. Keep necessary obligations and effects explicit.
- Keep transport records and primitive encodings in explicit adapters.
  Preserve stronger contracts in application code on each side.
- Put encoding and format selection in output adapters. If real consumers
  need a shared serialization contract, reuse one.
- If a shared contract changes, change its schemas, parsers, generated models,
  examples, and callers together.
- Unless the task authorizes a change, preserve documented compatibility.
  State model changes even when the source syntax remains compatible.

## Keep decisions pure and effects explicit

- Prefer immutable values and deterministic functions for domain decisions.
  Pass effect results into those decisions as values.
- Isolate filesystem, network, process, clock, randomness, environment, and
  mutable-service access in explicit adapters or capabilities.
- If sequencing, retries, cancellation, resource ownership, and completion
  belong to one operation, give them one coordinator.
- Keep core callbacks pure. Do not hide effects or mutable ambient state in
  closures.
- If callback details affect correctness, define their order, invocation
  count, lifetime, and escape behavior.
- Preserve failure identity through composition. Make each change to a
  failure's meaning an explicit transformation.
- Define traversal order and failure behavior.
- Preserve predicate order, early returns, cleanup, cancellation, and
  transaction behavior during refactors.

## Make failure behavior part of the contract

- Represent expected failures as finite cases with the facts callers need to
  act. Distinguish causes that demand different responses.
- Do not encode expected failures as ambiguous nulls, Boolean success flags,
  sentinel values, parsed messages, or undocumented exceptions.
- Translate documented external failures once in their adapter. Keep the
  platform's exception and cancellation contracts intact.
- Do not catch defects and report success. Stop unsupported or unknown
  outcomes without inventing stronger values.
- Reject unmet preconditions before protected effects. Do not report completion
  or rollback without evidence for that result.
- If failures remain ambiguous, add bounded stage and outcome diagnostics.
  Keep secrets and unnecessary payloads out of diagnostics.

## Prove the claim at the necessary mechanism

- Choose evidence that exercises the mechanism behind the claim. Use compiler
  rejection for type restrictions and schema rejection for payload constraints.
- If a claim includes effects, concurrency, persistence, or host behavior,
  use runtime evidence for that mechanism.
- Derive expected results from requirements or an independent fixture.
  Do not use the production algorithm as its own oracle.
- Prove an accepted path and the nearest named misuse. When a precondition
  fails, assert that its protected effect does not run.
- For a behavior change, make the focused assertion fail for the intended
  missing behavior before changing production code.
- Keep the command, fixtures, assertion, directory, and meaningful environment
  stable through the failing and passing comparison.
- Start reuse and behavior-preserving refactors from passing characterization.
  Do not manufacture a failure when the required behavior exists.
- Treat unavailable tools, invalid fixtures, timeouts, and zero selected tests
  as missing evidence. They establish neither product failure nor success.
- If integration remains uncertain, prove one real path from caller to result
  before expanding the design.
- Run the project's necessary checks. Broaden or repeat tests for changed
  inputs, failures, affected consumers, or a named unresolved risk.
- Report what each result proves and what remains unknown. Static acceptance
  does not prove a parser, external service, or live host behaves correctly.

## Complete the authorized outcome

- Complete authorized implementation and its necessary tests without routine
  permission requests. Resolve ordinary design choices from source evidence.
- If a missing fact changes acceptance, authority, or an irreversible action's
  safety, ask for clarification. Continue independent authorized work first.
- Respect analysis-only requests. Preserve unrelated work. Keep publication,
  deployment, and destructive actions within their explicit authorization.
- Prefer the smallest complete change that prevents the named misuse.
  Do not add speculative frameworks or competing owners.
- Report the result, changed contracts, exact tests, and material limits.
  Use passed, failed, skipped, or not run for test outcomes.
- Write direct prose with stable terms. Preserve identifiers, literal errors,
  and the user's supplied facts.
- Do not claim a fix for an unreproduced failure. Do not infer model behavior
  from instruction text. State the unresolved condition and the next decisive evidence.
