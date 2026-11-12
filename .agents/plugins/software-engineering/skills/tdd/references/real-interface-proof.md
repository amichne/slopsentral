# Real Interface Proof

Use this procedure when the requested evidence is a running integration, live
smoke test, or installed artifact. For an isolated rule, keep the focused test;
a live stack is not a mandatory addition to every code change.

1. Name the interface the user actually reaches, the version it runs, the
   representative input, and the expected observation. Reuse existing probes.
   Keep the request's read-only and environment boundaries intact.
2. Separate readiness from behavior. Inspect available connections and tools
   before declaring the runtime unavailable. When a status command disagrees
   with an existing connection, try one bounded, authorized read through the
   public interface and retain both observations. Do not install, restart, or
   mutate a shared host merely to obtain stronger proof.
3. Exercise the requested path, including the continuation or second hop when
   that is the claim. Check identities and content against an independent
   fixture or source-backed expectation; a count or successful response can
   conceal the wrong relationship. Include the nearest relevant control.
4. For a changed behavior, capture the same discriminating case before and
   after when available. A smoke test of unchanged code needs no invented RED.
   Confirm which artifact or process executed each run; source edits do not
   update an already-running process.
5. Inspect the result and report contradictions as findings. Name what the
   real run exercised, what supporting tests checked, and what remains unproven.
   If blocked, name the attempted probe and the missing capability. Do not
   replace the requested case with an easier test and call the task complete.

Do not infer a performance gain from a passing smoke test or a baseline compared
with itself. Use runtime-performance.md for equivalence and measurement rules.
Do not launch agents or model evaluations from this procedure without applicable
authority for that work and its usage.
