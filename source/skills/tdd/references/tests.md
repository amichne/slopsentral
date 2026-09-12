# Focused Behavior Tests

Test the smallest boundary that owns the invariant through an interface its
caller can use. A module API, pure function, parser, compiler fixture, or adapter
can be the right boundary. Public behavior does not mean starting the entire
application, opening a browser, or launching an IDE.

## Choose Assertions That Discriminate

- Name the input, observable outcome, and plausible wrong behavior rejected by
  the test. Prefer one coherent behavior; use as many assertions as it needs.
- Obtain expected results from the contract or independently authored fixture.
  A test that calculates its expectation through the production function can
  reproduce the same bug on both sides.
- Assert identities, values, and ordering when they are part of the contract.
  Counts alone can pass despite duplicates, replay, or substitution.
- Exercise one valid control and the closest meaningful failure boundary when
  the change affects rejection, isolation, authority, or a type invariant.
- Prefer a compiler or schema assertion for a claim those mechanisms can prove.
  Keep behavioral tests for the claims they cannot prove.

```text
Given four distinct production-issued results and page size three,
when the consumer resumes the emitted continuation,
then the pages contain the four expected identities in order without replay,
and a continuation for another authority is rejected.
```

Those assertions protect one paging contract. They need not become separate
application-wide tests or a mock verification for every collaborator.

## Keep Refactoring Cheap

Avoid assertions about private method names, helper decomposition, incidental
logging text, or internal call order. Keep tests green when implementation
structure changes but the promised behavior does not.

Call counts and ordering are useful when they *are* the boundary contract,
such as exactly-once effect dispatch or workspace serialization. Filesystem or
database inspection is appropriate when persistence is the promised observable
result. Prefer round trips through the consumer API when it owns that contract.

Use real pure collaborators. Control time, randomness, filesystem, network,
processes, and host capabilities at explicit effect boundaries. A deterministic
fake of an external host can prove adapter decisions; it cannot prove the host
works. Add the smallest real-boundary check when that is the unresolved claim.

## Avoid Tests That Add Maintenance Without Evidence

Do not add a string-presence assertion for every instruction edit or a test
that simply repeats the implementation. Existing parsers, schema validators,
link checks, and formatting checks often suffice for low-impact edits. Agent
workflow behavior needs observed task execution and independent evaluation;
matching guidance text or replaying a golden fixture proves a narrower claim.
