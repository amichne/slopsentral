# Writing Patterns

Use these pairs when you revise or review prose for stock patterns. Readers
often associate these patterns with generated text. The catalogue follows
Factory's human-writing skill; the examples are local. See
[provenance](provenance.md#editorial-guidance).

Every pair follows three rules:

- The revision uses only facts from the original. If the original implies a
  fact that it does not supply, omit the claim or mark the gap for the author
  with `[source needed: ...]`.
- Remove the pattern, not the information.
- A match is a reason to read the passage again. It is not evidence of who
  wrote it.

The bundled assessment finds the patterns marked *(checked)*. You must find
the others by reading.

## Claims of significance *(checked)*

```text
Version 3 moves the build to Gradle 9.2, marking a pivotal moment for the
project and underscoring the team's commitment to reliability.
```

```text
Version 3 moves the build to Gradle 9.2.
```

The original names no reliability change, so the revision drops the claim.

## Unsupported attribution

```text
Experts agree that structured logging is crucial: it writes each event as
JSON fields, and industry reports show that it cuts incident time.
```

```text
Structured logging writes each event as JSON fields.
[source needed: the report that measured incident time]
```

## Promotional words *(checked)*

```text
Our blazing-fast, seamless CLI boasts a rich plugin ecosystem and runs on
macOS and Linux.
```

```text
The CLI runs on macOS and Linux and accepts plugins.
```

## Stock vocabulary *(checked)*

```text
Let's delve into the intricate interplay between the cache and the scheduler.
The cache stores task outputs by input hash, and the scheduler skips a task
when its hash matches.
```

```text
The cache stores task outputs by input hash. The scheduler skips a task when
its hash matches.
```

## "Serves as" in place of "is"

```text
`config.toml` serves as the single source of truth and features a `[paths]`
table.
```

```text
`config.toml` is the single source of truth. It has a `[paths]` table.
```

Keep "serves as" when the subject has another main role, as in "the lock
file also serves as the cache key".

## Negative parallelism *(checked)*

```text
It's not just a linter, it's a complete quality platform. It checks formatting
and import order.
```

```text
It checks formatting and import order.
```

## Forced groups of three

```text
The release improves speed, stability, and developer experience. Cold builds
drop from 90 to 60 seconds.
```

```text
Cold builds drop from 90 to 60 seconds.
```

Keep a list of three when the source supports each item.

## Trailing significance clauses *(checked)*

```text
The parser now rejects duplicate keys, highlighting the project's focus on
correctness.
```

```text
The parser now rejects duplicate keys.
```

## False ranges

```text
The guide covers everything from installing the CLI to tuning production
clusters.
```

```text
The guide covers installing the CLI and tuning production clusters.
```

"From X to Y" claims that the topics between X and Y are covered too. State
only the topics the source names.

## Synonym cycling

```text
Each worker reads a job from the queue. The consumer then acknowledges the
task. If the processor crashes, the message returns to the queue.
```

```text
Each worker reads a job from the queue. The worker then acknowledges the job.
If the worker crashes, the job returns to the queue.
```

Merge names only when the source shows that they refer to the same thing.
Otherwise ask, as the glossary rules require.

## Challenges and outlook *(checked)*

```text
Despite these challenges, the future looks bright: the team plans to ship
Windows support in Q3.
```

```text
The team plans to ship Windows support in Q3.
```

## Conversational residue *(checked)*

```text
Great question! Here's a quick overview of the flag. `--dry-run` prints the
plan without applying it. I hope this helps, and let me know if you'd like
more detail.
```

```text
`--dry-run` prints the plan without applying it.
```

## Cutoff disclaimers and stacked hedges *(checked)*

```text
As of my last update, the API may possibly support pagination, though the
details are not extensively documented.
```

```text
[source needed: whether the API supports pagination]
```

Do not resolve the uncertainty with a guess. A date, a version, or a "yes"
that the source does not give is a new claim.

## Dashes and bold

```text
The cache is **local-only**—it never uploads artifacts—and **expires** after
**7 days**.
```

```text
The cache is local-only and never uploads artifacts. It expires after 7 days.
```

Use one sentence for each fact instead of dashes. Bold only the term that the
reader must find while scanning.

## Bold-label lists

```text
- **Performance:** Performance is improved with a faster parser.
- **Reliability:** Reliability is improved because retries now back off.
```

```text
A faster parser improves performance, and retries now back off.
```

Keep labeled items in reference material that readers scan by label.

## Title case in headings

```text
Configuring Remote Build Caches
```

```text
Configuring remote build caches
```

Follow the repository's heading convention when it differs.

## Invented voice

Factory's skill recommends opinions, feelings, and first person. This skill
does not add them. The [grounding rules](grounding.md) apply.

```text
The benchmark ran 20 times on one machine. Median latency fell 12%.
```

```text
The benchmark ran 20 times on one machine. Median latency fell 12%.
```

The original is already concise and supported, so leave it unchanged. Do not
change it to "I was surprised that latency fell 12%" unless the author says so.
