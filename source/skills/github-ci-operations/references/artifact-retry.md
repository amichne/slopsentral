# Reuse a successful producer after a partial retry

In Kast run 41557509358, the Mac job completed in 18 minutes and 14 seconds.
Linux assembly stopped after the executable upload.
The run kept the executable under the name from attempt 1.
The historical run had no second attempt.
The fixture replays that case locally. [Kast run](https://github.com/amichne/kast/actions/runs/41557509358)

From this skill directory, examine the original selectors.

```sh
uv run --locked --script scripts/artifact_retry.py edge assets/kast-retry/workflow.yml native assembly
```

Expect exit 1, with `MATCH` for the first attempt and `SELECTOR_MISMATCH` for the consumer retry.
The consumer asks for a name with suffix 2. The producer wrote a name with suffix 1.

Examine the producer output in the corrected example.

```sh
uv run --locked --script scripts/artifact_retry.py edge assets/kast-retry/producer-bound.yml native assembly
```

Expect exit 0 with two matches.
The upload step returns its artifact ID.
The producer exposes that ID as a job output.
The consumer downloads that single ID through its direct dependency.
Use the same command with a repository workflow and its job names.
If a job contains several transfers, select the intended action with one-based `--upload` and `--download` numbers.

The rule compares selectors for one same-run transfer after a successful upload.
It supports literal names, `github.run_id`, `github.run_attempt`, and the direct job output in the example.
An unsupported selector returns `UNRESOLVED` and exits with failure.
A match establishes the selector relationship only. Job conditions, matrix expansion, permissions, and hosted output availability need separate evidence.

## Admit bytes for the next stage

1. Get the repository, workflow, source revision, run, producer job, attempt, conclusion, and artifact ID from trusted CI records.
2. Reject a failed producer or an ID outside that producer's outputs.
3. Resolve the producer tree and expected tree from trusted revisions.
4. Get the artifact metadata and original archive from that repository.
5. Examine the archive before extraction.

```sh
uv run --locked --script scripts/artifact_retry.py bytes artifact.json "$artifact_id" "$expected_tree" "$producer_tree" download.zip
```

The metadata uses the GitHub artifact fields `id`, `expired`, and `digest`.
The command compares the SHA-256 digest of the downloaded ZIP.
It reports `WRONG_ARTIFACT`, `EXPIRED`, `FOREIGN_TREE`, or `DIGEST_MISMATCH` for those rejection cases.
`BYTES_MATCH` covers the supplied ID, trees, and bytes. The caller owns producer admission.
If the artifact expired, rerun the producer and its dependent stages.
If the archive matches, resume at the first unfinished stage.
Release promotion needs the full qualification record for the same payload, version, platform, and toolchain.

## Place native work at its first necessary platform

Run cheap source checks and prepare versioned inputs on a portable runner.
Include resolved reachability metadata, native flags, and toolchain identity in the input inventory.
Compile once per target after its inputs pass admission.
Run a real executable probe on that target before upload.
Give the assembler the admitted executable.
Run installed-product qualification against the assembled bytes.
Keep independent documentation jobs outside the native dependency chain. [Kast native handoff](https://github.com/amichne/kast/pull/1140)
