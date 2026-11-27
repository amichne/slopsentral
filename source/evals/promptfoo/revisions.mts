// Revision cases: a model rewrites a passage, and a deterministic grader checks what it kept and added.
// Each control text is an authored synthetic answer for the offline pipeline, not a model response.

export interface RevisionCase {
  readonly id: string;
  readonly context: string;
  readonly passage: string;
  // Each fact is a list of accepted spellings; one must appear (case-insensitive).
  readonly facts: readonly (readonly string[])[];
  // Regular expression sources. A sentence that matches must also mark the gap, or the claim is omitted.
  readonly omitOrMark: readonly string[];
  // Regular expression sources that must not appear in the revision.
  readonly forbid: readonly string[];
  readonly controls: {
    readonly accepted: string;
    readonly rejected: Readonly<Record<string, string>>;
  };
}

export const revisionCases: readonly RevisionCase[] = [
  {
    id: "revise-release-note",
    context: "release note",
    passage: "We're thrilled to announce version 2.4, a pivotal release that underscores our commitment to developer experience. It's not just an update, it's a reimagining of how you build. The `--watch` flag now restarts only the changed module, and cold starts drop from 8 seconds to 3 seconds.",
    facts: [["2.4"], ["--watch"], ["8", "eight"], ["3", "three"]],
    omitOrMark: ["pivotal", "commitment to", "reimagin"],
    forbid: [],
    controls: {
      accepted: "In version 2.4, the `--watch` flag restarts only the changed module. Cold starts drop from 8 seconds to 3 seconds.",
      rejected: {
        "kept claim": "Version 2.4 is a pivotal release. The `--watch` flag restarts only the changed module, and cold starts drop from 8 seconds to 3 seconds.",
        "dropped fact": "In version 2.4, the `--watch` flag restarts only the changed module.",
        "invented number": "In version 2.4, the `--watch` flag restarts only the changed module. Cold starts drop from 8 seconds to 3 seconds, a 62% cut.",
      },
    },
  },
  {
    id: "revise-pr-description",
    context: "pull request description",
    passage: "This PR delves into the intricate interplay between the retry loop and the circuit breaker, highlighting the importance of resilience. It adds jitter to the backoff and opens the breaker after 5 consecutive failures. Let me know if you have any questions!",
    facts: [["jitter"], ["5", "five"]],
    omitOrMark: ["importance", "interplay"],
    forbid: ["let me know"],
    controls: {
      accepted: "This PR adds jitter to the retry backoff. The circuit breaker now opens after 5 consecutive failures.",
      rejected: {
        "kept residue": "This PR adds jitter to the retry backoff. The circuit breaker now opens after 5 consecutive failures. Let me know if you have questions.",
        "first person": "I added jitter to the retry backoff. The circuit breaker now opens after 5 consecutive failures.",
      },
    },
  },
  {
    id: "revise-readme-intro",
    context: "README introduction",
    passage: "Nestled at the heart of your toolchain, Pathfinder is a seamless, blazing-fast, and robust file watcher that boasts a vibrant plugin ecosystem. Experts agree that it is the best choice for monorepos. It runs on macOS, Linux, and Windows and uses the native FSEvents and inotify APIs.",
    facts: [["Pathfinder"], ["macOS"], ["Linux"], ["Windows"], ["FSEvents"], ["inotify"]],
    omitOrMark: ["best choice", "experts"],
    forbid: ["seamless", "blazing", "vibrant"],
    controls: {
      accepted: "Pathfinder is a file watcher that accepts plugins. It runs on macOS, Linux, and Windows and uses the native FSEvents and inotify APIs. [source needed: who recommends it for monorepos]",
      rejected: {
        "kept claim": "Pathfinder is a file watcher and the best choice for monorepos. It runs on macOS, Linux, and Windows and uses the native FSEvents and inotify APIs.",
        "kept promotion": "Pathfinder is a seamless file watcher. It runs on macOS, Linux, and Windows and uses the native FSEvents and inotify APIs.",
      },
    },
  },
  {
    id: "revise-runbook-step",
    context: "runbook step",
    passage: "In today's ever-evolving landscape of cloud operations, it is crucial to remember that you may possibly want to drain the node before upgrading. Run `kubectl drain node-7 --ignore-daemonsets`, then wait until the pods are rescheduled.",
    facts: [["kubectl drain node-7 --ignore-daemonsets"], ["reschedul"]],
    omitOrMark: [],
    forbid: ["\\bmay (?:possibly )?(?:want|need) to\\b", "\\bmight want to\\b", "\\bconsider\\b", "\\byou should\\b", "\\bcrucial\\b", "ever-evolving"],
    controls: {
      accepted: "Drain the node before upgrading. Run `kubectl drain node-7 --ignore-daemonsets`, then wait until the pods are rescheduled.",
      rejected: {
        "kept hedge": "You may want to drain the node before upgrading. Run `kubectl drain node-7 --ignore-daemonsets`, then wait until the pods are rescheduled.",
        "changed command": "Drain the node before upgrading. Run `kubectl drain node-7`, then wait until the pods are rescheduled.",
      },
    },
  },
  {
    id: "revise-incident-summary",
    context: "incident summary",
    passage: "Despite these challenges, the team rallied together, showcasing remarkable resilience. The outage lasted 42 minutes and affected the EU region. The root cause was an expired TLS certificate on the ingress. The future looks bright as we continue our journey toward reliability.",
    facts: [["42", "forty-two"], ["EU"], ["TLS"], ["ingress"]],
    omitOrMark: ["resilience", "future looks", "journey"],
    forbid: [],
    controls: {
      accepted: "The outage lasted 42 minutes and affected the EU region. The root cause was an expired TLS certificate on the ingress.",
      rejected: {
        "kept outlook": "The outage lasted 42 minutes and affected the EU region. The root cause was an expired TLS certificate on the ingress. The future looks bright.",
        "invented number": "The outage lasted 42 minutes and affected 3 services in the EU region. The root cause was an expired TLS certificate on the ingress.",
      },
    },
  },
  {
    id: "revise-api-reference",
    context: "API reference entry",
    passage: "The `fetchAll` method serves as a powerful gateway to your data, offering seamless pagination, robust error handling, and unparalleled flexibility. It returns up to 100 items per page and throws `RateLimitError` when the quota is exceeded.",
    facts: [["fetchAll"], ["100", "hundred"], ["RateLimitError"]],
    omitOrMark: ["unparalleled", "powerful"],
    forbid: ["seamless"],
    controls: {
      accepted: "`fetchAll` returns up to 100 items per page. It throws `RateLimitError` when the quota is exceeded.",
      rejected: {
        "kept claim": "`fetchAll` offers unparalleled flexibility. It returns up to 100 items per page and throws `RateLimitError` when the quota is exceeded.",
        "dropped fact": "`fetchAll` returns up to 100 items per page.",
      },
    },
  },
  {
    id: "revise-design-note",
    context: "design note",
    passage: "Great question! As of my last update, SQLite may possibly support concurrent writers in WAL mode, though specific details are not extensively documented. In WAL mode, readers do not block the writer.",
    facts: [["WAL"], ["readers"]],
    omitOrMark: ["concurrent writ", "multiple writers", "more than one writer"],
    forbid: ["great question", "as of my"],
    controls: {
      accepted: "In WAL mode, readers do not block the writer. [source needed: whether SQLite supports concurrent writers in WAL mode]",
      rejected: {
        "asserted answer": "In WAL mode, readers do not block the writer. SQLite does not support concurrent writers in WAL mode.",
        "kept residue": "Great question! In WAL mode, readers do not block the writer.",
      },
    },
  },
  {
    id: "revise-changelog",
    context: "changelog entry",
    passage: "- **Performance:** Performance has been significantly enhanced, ensuring a faster, smoother, and more delightful experience.\n- **Reliability:** Reliability has been improved: the uploader now retries 3 times.",
    facts: [["3", "three"], ["retr"]],
    omitOrMark: ["perform", "faster", "smoother"],
    forbid: ["delightful"],
    controls: {
      accepted: "- The uploader now retries 3 times.\n- [source needed: the measured performance change]",
      rejected: {
        "kept claim": "- Improved performance.\n- The uploader now retries 3 times.",
        "invented number": "- Uploads are 20% faster.\n- The uploader now retries 3 times.",
      },
    },
  },
];
