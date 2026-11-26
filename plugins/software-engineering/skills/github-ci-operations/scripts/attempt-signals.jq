# Input: one completed attempt from gh run view, including jobs and steps.
def seconds($start; $end):
  if ($start == null or $end == null) then null
  else (($end | fromdateiso8601) - ($start | fromdateiso8601)) as $n
  | if $n >= 0 then $n else null end end;

if .status != "completed" or (.jobs | type != "array" or length == 0)
then error("expected a completed attempt with job evidence") else . end
| . as $run
| [.jobs[] | select(.conclusion != "skipped") | {
    job: .name, url, conclusion, seconds: seconds(.startedAt; .completedAt),
    steps: [.steps[]? | select(.conclusion != "skipped") | {
      step: .name, conclusion, completedAt, seconds: seconds(.startedAt; .completedAt)
    }]
  }] as $jobs
| {
    run: .databaseId, attempt, headSha, conclusion,
    attemptWallSeconds: seconds(.startedAt; .updatedAt),
    sinceRunCreatedSeconds: seconds(.createdAt; .updatedAt),
    jobExecutionSeconds: (if ($jobs | length > 0 and all(.seconds != null))
      then ($jobs | map(.seconds) | add) else null end),
    firstUnsuccessfulStep: ([$jobs[] as $job | $job.steps[]
      | select((.conclusion == "failure" or .conclusion == "cancelled" or .conclusion == "timed_out")
        and .completedAt != null)
      | {job: $job.job, url: $job.url, step, conclusion, completedAt,
         elapsedSeconds: seconds($run.startedAt; .completedAt)}] | sort_by(.completedAt) | first),
    jobs: $jobs
  }
