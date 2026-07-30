def as_text:
  if . == null then
    ""
  elif type == "string" then
    .
  elif type == "array" then
    map(
      if type == "object" and has("text") then
        .text
      else
        tostring
      end
    )
    | join("\n")
  elif type == "object" and has("text") then
    .text
  else
    tostring
  end;

def wall_seconds:
  .output as $output
  | if (
      ($output | type) == "object" and
      $output.wall_time_seconds != null
    ) then
      $output.wall_time_seconds | tonumber
    else
      $output
      | as_text
      | capture(
          "Wall time\\s*:?\\s*(?<seconds>[0-9]+(?:\\.[0-9]+)?)\\s*seconds";
          "i"
        )
      | .seconds
      | tonumber
    end;

def percentile($fraction):
  sort
  | .[((length * $fraction | ceil) - 1)];

[
  .[]
  | select((.input | as_text) | test($pattern; "i"))
  | . + {seconds: (try wall_seconds catch null)}
  | select(.seconds != null)
]
| sort_by(.name)
| group_by(.name)
| map(
    . as $rows
    | ($rows | map(.seconds)) as $values
    | {
        name: $rows[0].name,
        samples: ($values | length),
        meanSeconds: (($values | add) / ($values | length)),
        p50Seconds: ($values | percentile(0.50)),
        p95Seconds: ($values | percentile(0.95)),
        maxSeconds: ($values | max)
      }
  )
