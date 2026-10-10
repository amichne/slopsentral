# Shell: Explicit Transitions And Honest Effects

Use this example when shell coordinates operations whose completion and failure
must remain explicit. [publish-verified.sh](../assets/publish-verified.sh) accepts
a source pathname, expected SHA-256 digest, and exact destination pathname. It
emits one result governed by the [canonical schema](../assets/artifact-result.schema.json)
when the output channel accepts the write.

Its supported sequence is:

```text
INPUT -> PREPARE -> COPY -> FREEZE -> HASH -> PUBLISH -> CLEANUP
```

The module owns transitions. It parses the input digest, creates a private
workspace, validates the workspace reply before permitting cleanup, copies
source bytes, rejects empty content, and removes write permission on its staged
file. It hashes that staged file and strictly parses the command reply.
Publication is attempted only after the parsed digest matches the expectation.

The publication adapter uses `linkSync` to create the exact destination
exclusively. It publishes the verified inode instead of reopening the original
source pathname. An existing file or directory is a named failure. A later
source mutation cannot change the staged bytes. There is no separate
check-then-open publication path that could replace verified input.

Every command is guarded and its exit status captured immediately. Known missing
tools become `TOOL_UNAVAILABLE`; other stage failures preserve the stage and
bounded status. Successful but malformed replies become `PROTOCOL_FAILED`.
Known failed link operations are reported as `STAGE_FAILED`. Unexpected
publication termination becomes `PUBLICATION_UNCONFIRMED`, and interruption
during publication becomes `PUBLICATION_INTERRUPTED`. Both preserve uncertainty
about external state. Structured output includes no paths, source contents,
command stderr, or unbounded diagnostics.

Cleanup authority starts only after the workspace reply has been validated.
Completed success/failure paths and handled HUP/INT/TERM signals attempt cleanup
once that ownership is established. `PREPARATION_INTERRUPTED` retains uncertainty
about whether a workspace was created before validation; that unproven path is
not deleted. A cleanup failure wraps the prior outcome as `CLEANUP_FAILED` and
exits nonzero. The wrapper retains a confirmed publication rather than inventing
rollback. Discarded command stderr is replaced by structured stage/outcome
evidence; it does not turn a command failure into success.

Result emission is guarded too. The process boundary has three named outcomes:
status 0 means a `PUBLISHED` record was written, status 1 means a failure record
was written, and status 74 means `RESULT_EMISSION_FAILED`. A failed write may
leave no complete structured output. The caller must retain uncertainty about
publication and cleanup; a transport failure cannot undo their effects. It must
not parse a diagnostic string or assume a nonzero exit means no publication.
Other process outcomes, including unhandled termination, require an explicit
unexpected-process failure at the calling boundary. Even a successful write is
not proof that a remote consumer received the record.

The [runner](../scripts/check-proof-examples.mjs) injects failures through isolated
command adapters and asserts exact outputs, operation order, destination bytes,
and workspace retention. It covers matching/mismatching checksums, source
mutation, preparation/copy/freeze/hash failures, malformed workspace/hash replies,
missing hashing capability, destination conflicts, unknown publication status,
cleanup failure after success and rejection, invalid input, handled TERM before
and during publication, TERM during preparation before ownership, and closed
stdout/stderr after publication and failed cleanup. Assertions about the absence of publication
apply to these observed fixtures; uncertain outcomes retain uncertainty in the
contract.

```sh
node <skill-root>/scripts/check-proof-examples.mjs --contracts-only
```

Here `<skill-root>` contains this skill's `SKILL.md`; the checkout root is
`source/skills/semantic-ratchet`. Node 20+, AJV 8, a shell, `mktemp`, `cp`, `chmod`,
`shasum`, and `rm` are required. AJV must be installed in a package enclosing the
runner for Node module resolution. The script performs no dependency installation
or tool configuration and fails if required dependencies are unavailable.

The supported effect model is a local filesystem with ordinary exclusive
hard-link semantics, trusted utilities, and a private workspace whose bytes and
ancestor path are not modified by another writer. `TMPDIR` must be absolute and
on the destination filesystem; cross-filesystem linking fails explicitly.
Permissions support this model but do not exclude a process with the same user
or root authority. The script proves no static type guarantee, exactly-once
delivery, checksum authenticity, crash durability, or cleanup after SIGKILL or
interruption during cleanup. It is a small executable contract example, not a
production publication system.
