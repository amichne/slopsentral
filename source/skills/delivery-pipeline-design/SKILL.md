---
name: delivery-pipeline-design
description: "Use when defining CI/CD stages, artifact promotion, deployment gates, rollback, or trust boundaries before encoding the design in a provider-specific workflow."
---

# Delivery Pipeline Design

Design the path from a source revision to a verified deployment. This skill owns
stage boundaries and evidence. GitHub workflow syntax and run diagnosis belong
to github-ci-operations; a pipeline design does not authorize deployment.

## Workflow

1. Identify the release unit, source revision, required checks, artifact identity,
   environments, actors, and permitted external actions. Inspect the existing path.
2. Draw the dependency graph around outputs and trust boundaries. Split stages
   where artifact ownership, platform, credentials, or failure recovery changes;
   retain shared warm build state where those constraints permit it.
3. Build once and promote the verified immutable artifact where the target allows
   it. Tie each test, provenance record, and deployment to the artifact actually used.
4. Isolate untrusted pull-request execution from publishing credentials. Use
   narrowly scoped identity and environment gates; cache data is not release evidence.
5. Specify rollout health signals, stop conditions, and recovery. Include schema
   compatibility and data migration limits; a previous binary is not always a rollback.
6. Evaluate the critical path, expanded job count, concurrency, and recovery cost.
   Optimize measured waste without silently removing proof or required checks.
7. Validate the design with a failed build, expired credential, partial deployment,
   stale artifact, and failed rollback scenario before authoring provider configuration.

## References

Read [pipeline review](references/pipeline-review.md) for the deliverable and
counterexamples. Use provider documentation for exact workflow syntax and current
security capabilities rather than copying remembered action versions.

## Completion Criteria

Each stage names its input, output, authority, required evidence, and failure
path. Promotion cannot substitute an unverified artifact. The implementation plan
states what is local, what is externally authorized, and what remains unproved.

Read [provenance](references/provenance.md) when updating this skill.
