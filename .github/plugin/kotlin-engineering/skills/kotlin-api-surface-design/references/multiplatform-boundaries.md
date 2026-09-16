# Multiplatform Boundaries

Keep common APIs semantic and stable. Platform mechanics belong at leaves.

## Choose The Seam

| Situation | Prefer |
| --- | --- |
| Simple compile-time specialization with no lifecycle or runtime choice | Narrow `expect`/`actual` function, value, type alias, or leaf composable |
| Test fakes, injected dependencies, lifecycle ownership, or runtime selection | Common capability interface plus platform binding |
| One platform-specific UI leaf | Shared UI calling a platform leaf |
| Entire screen or flow differs | Separate platform implementation behind a common navigation or domain contract |

Name the common capability in domain terms. Reject Android, Apple, JVM, native
SDK, filesystem, permission, view-controller, activity, or resource types in a
common signature unless the module explicitly exists as that platform adapter.

Keep business branching and finite outcomes in common code. Platform bindings
translate native success and failure into the common domain contract; they do
not own business policy. An `actual` that needs lifecycle ownership, runtime
selection, or fakes is usually evidence that a common interface is the stronger
boundary.

## Verification

- Compile every affected source set.
- Test common behavior against a fake capability when the seam permits it.
- Confirm platform types do not leak into common callers.
- Define suspend completion precisely: launched, accepted, persisted, or fully
  completed are different outcomes.
- Verify a new platform implementation can be added without changing common
  domain callers.
