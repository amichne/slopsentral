# Report CI performance per attempt

From this skill directory, read one completed attempt.

```sh
set -o pipefail
gh run view "$run_id" --repo "$repository" --attempt "$attempt" \
  --json databaseId,attempt,headSha,status,conclusion,createdAt,startedAt,updatedAt,jobs |
  jq -f scripts/attempt-signals.jq
```

Keep each attempt, including failures and cancellations.
The report keeps job links, step durations, the first unsuccessful step, and elapsed time to that signal.
Examine the linked log to classify the cause and identify the first actionable error.
The report sums job execution seconds across concurrent jobs. This sum estimates runner use.
Attempt wall time and elapsed time since run creation have different start times.
Missing times return `null`. Skipped jobs contribute no runner time.

Add these fields to the PR summary when their sources exist.

| Signal | Source and interpretation |
| --- | --- |
| Feedback | Give the command, stage, first error, elapsed time, and partial log. Classify cancellation separately from a product failure. |
| Latency | Report queue time when the service supplies admission timestamps. Show setup, Gradle, native compilation, artifact transfer, and cache save separately. |
| Cache health | From the Gradle invocation, count eligible tasks, expected hits, actual hits, and unexpected executions. Give transfer time for each cache layer. |
| Completed work | Link the successful producer and its artifact ID. Name the consumer that admitted the bytes or the reason it repeated work. |
| Local parity | Record the same source tree, version, wrapper command, toolchain, task selection, and cache policy. Name each obligation that needs a different host. |

Use `unavailable` when a source lacks the metric. A job duration cannot supply a cache hit rate.
Compare medians for equivalent task graphs, runner classes, resource limits, and cache states.
Set a regression budget before the comparison.
Use the existing workflow graph model for the sample floor and critical path.
Keep small cohorts advisory. Include failed and canceled attempts in the cost report.

For persistent setup state, exercise fresh setup twice and inspect the second run for unnecessary downloads.
Start a fresh noninteractive shell to examine the resulting toolchain.
Keep authentication in the current execution context.
These controls adapt the setup and resume distinction from Amp's orb lifecycle. [Amp orbs](https://ampcode.com/docs/orbs)
