# Installed Discovery and Recovery

Keep source validation, package validation, installation, client discovery,
semantic invocation, and recovery as separate proof obligations. Reuse the
repository's installer, lifecycle controls, replay reports, and product gates.
Use intellij-plugin-delivery for IDE packaging and repository-onboarding for
marketplace consumer setup; do not create a second installer.

Record the exact source revision, artifact identity, installed version, target
client and IDE build, and registration or handshake evidence. Start a fresh
client session, discover the real schema, and invoke a known semantic operation.
Package contents, an enabled entry, a listening process, and unit tests each
prove a narrower boundary than a successful fresh-client invocation.

Follow the identity chain: candidate commit and tree, producer run and attempt,
artifact digest, installed bytes, and loaded runtime identity. A version label
alone cannot distinguish an old process from newly installed bytes. Record dirty
source or missing runtime identity as a qualification gap. A passing old head
cannot qualify a changed candidate. Tree equality can support byte-preserving
promotion only under the repository's declared build-input and producer contract;
it does not transfer current-head required checks or live-runtime evidence.

Sequence the smallest dependency group that is independently valid. Parallelize
independent documentation and checks, keep coupled integration seams with one
owner, and refresh a branch only when its inputs or integration obligations
change. Reuse immutable tested artifacts through the existing promotion path.
Minimize rebuild and host restart cycles without removing release contracts or
weakening CI. A merged change still needs separate installation and loaded-runtime
qualification before a deployed claim.

Within authorized disposable state, exercise interrupted setup, stale
registration, restart, and rollback through existing lifecycle commands. Verify
that recovery restores discovery and the same semantic operation. Preserve
unrelated work, configuration, and recoverable artifacts. Installation or restart
in a user's active environment requires authority for that effect.

If the fresh client cannot be inspected or recovery cannot be exercised, retain
the successful earlier stages and name the remaining obligations. Report partial
qualification rather than treating local tests as installed proof.

[Kast #957](https://github.com/amichne/kast/pull/957) retains producer, source tree,
toolchain, and payload identity for promotion; its
[candidate admission code](https://github.com/amichne/kast/blob/7d4913cf959e250ea4628f34abbc7e37f1ea8229/.github/scripts/release/build_candidate.py)
is a source-confirmed example, not proof that a particular installation is loaded.
