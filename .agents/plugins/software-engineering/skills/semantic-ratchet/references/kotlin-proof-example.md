# Kotlin: Verification Survives The Consumer Boundary

Use this example when a Kotlin operation must require an established fact and
its callers must handle every expected outcome. The canonical executable
implementation is [ArtifactProof.kt](../assets/kotlin/ArtifactProof.kt).

The invariant is precise: preparing a publication request requires immutable,
nonempty bytes whose SHA-256 digest matched the supplied, parsed expectation.
Publication preparation is pure; it does not claim an external write occurred.

| Established fact | Representation | Obligation discharged |
| --- | --- | --- |
| Exactly 64 lowercase hexadecimal characters | `Sha256Digest` value class, private constructor and `parse` | Consumers need no string shape checks |
| At least one byte, privately owned storage | `ArtifactBytes`, head plus private copied tail | Empty content and mutable aliases cannot enter the core |
| Supplied checksum matched these bytes | `VerifiedArtifact`, private constructor | `PublicationRequest.prepare` requires verification |
| Verification has two supported outcomes | Sealed `Verification` hierarchy | Complete consumers handle success and mismatch |
| Digest parsing has finite rejection reasons | `DigestRejection` enum inside sealed `DigestParse` | Failure requires neither an exception nor a nullable value |
| Prepared request retains verification | `PublicationRequest` value class | A single-field state distinction needs no ordinary wrapper class |

Parsing checks raw input once. Verification then makes the remaining domain
decision: whether two refined digests agree. That equality predicate is not a
boolean failure protocol; verification returns a sealed outcome containing the
case-specific evidence. Publication preparation performs no repeated guards.

Primitive storage remains internal to the trusted owning module. The SHA-256
algorithm reads those immutable bytes directly. [Output adapters](../assets/kotlin/ArtifactOutputAdapters.kt)
implement the shared `OutputEncoder` abstraction; domain types expose no
`encode` or `toWire` methods. Returned byte arrays are copies. Application
consumers continue passing `VerifiedArtifact`; its digest string or original
bytes cannot replace that contract. Internal visibility excludes other Kotlin
modules, not trusted code inside the owning module.

Use value classes aggressively for single-field domain distinctions. Direct
JVM use can retain the underlying representation; generic and interface use can
box. The format-independent Kotlin serialization example in Kotlin Design
Practices shows the same model through JSON and binary adapters.

The checks compile consumers separately from the domain library:

- [Legal.kt](../assets/kotlin/Legal.kt) verifies the known `hello\n` checksum,
  prepares a request, handles mismatch exhaustively, rejects empty content and
  malformed digests, and mutates input/output arrays without changing stored
  evidence. Assertions run after compilation.
- [ForgeVerified.kt](../assets/kotlin/ForgeVerified.kt) must fail because unchecked
  construction is private.
- [ForgeMismatch.kt](../assets/kotlin/ForgeMismatch.kt) must fail because consumers
  cannot construct a false mismatch with matching digests. Concrete result
  constructors are private to the verification owner; callers receive sealed
  views with case-specific evidence.
- [PublishUnverified.kt](../assets/kotlin/PublishUnverified.kt) must fail with an
  argument type mismatch at the publication boundary.
- [ForgetFailure.kt](../assets/kotlin/ForgetFailure.kt) must fail because its
  `when` expression omits `ChecksumMismatch`.

Run the [bundled runner](../scripts/check-proof-examples.mjs) with no mode flag:

```sh
node <skill-root>/scripts/check-proof-examples.mjs
```

Here `<skill-root>` is the directory containing this skill's `SKILL.md`. In this
checkout it is `source/skills/semantic-ratchet`. The runner requires Node 20+,
`kotlinc`, Java, and the shell tools named in the shell example. AJV 8 must be
installed in a package enclosing the runner so Node can resolve
`ajv/dist/2020.js`; this repository declares it in its root `package.json`.
The runner performs no installation or tool configuration. Missing dependencies
or wrong diagnostics fail the run. `--contracts-only` reports Kotlin as
`NOT_RUN`; it proves no compiler claim.

The compiler proves the consumer contracts, visibility, and exhaustive handling.
The parser and checksum implementation require executable checks and the JVM's
SHA-256 contract. Kotlin does not enforce linear consumption: a verified value
can prepare more than one request. Reflection, altered bytecode, effect success,
cryptographic authenticity, and exactly-once publication are outside this proof.
