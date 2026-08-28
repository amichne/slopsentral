import { Type } from "@sinclair/typebox";

import { canonicalJson } from "../../broker/canonical.ts";
import { defineTool } from "../../broker/index.ts";
import type { GradleRuntime } from "./runtime.ts";

const GradleOutput = Type.Object(
  {
    exitCode: Type.Integer(),
    stdout: Type.String(),
    stderr: Type.String(),
  },
  { additionalProperties: false },
);

const presentGradleOutput = (output: typeof GradleOutput.static) => ({
  success: output.exitCode === 0,
  contentItems: [{ type: "inputText" as const, text: canonicalJson(output) }],
});

const GradleInspectInput = Type.Object({}, { additionalProperties: false });

export const gradleInspect = defineTool<
  GradleRuntime,
  typeof GradleInspectInput,
  typeof GradleOutput
>({
  name: "inspect",
  description:
    "Inspect the admitted Gradle build's project structure through its wrapper.",
  input: GradleInspectInput,
  output: GradleOutput,
  loading: "eager",
  invoke: (runtime, _input, context) => runtime.execute(["projects"], context),
  present: presentGradleOutput,
});

const GradleTasksInput = Type.Object(
  { all: Type.Optional(Type.Boolean({ default: false })) },
  { additionalProperties: false },
);

export const gradleTasks = defineTool<
  GradleRuntime,
  typeof GradleTasksInput,
  typeof GradleOutput
>({
  name: "tasks",
  description:
    "List bounded Gradle task metadata through the admitted repository wrapper.",
  input: GradleTasksInput,
  output: GradleOutput,
  loading: "deferred",
  invoke: (runtime, input, context) =>
    runtime.execute(
      input.all === true ? ["tasks", "--all"] : ["tasks"],
      context,
    ),
  present: presentGradleOutput,
});

const GradleDependenciesInput = Type.Object(
  {
    configuration: Type.String({
      minLength: 1,
      maxLength: 128,
      pattern: "^[A-Za-z0-9_.-]+$",
    }),
    project: Type.Optional(
      Type.String({
        minLength: 2,
        maxLength: 256,
        pattern: "^(:[A-Za-z0-9_.-]+)+$",
      }),
    ),
  },
  { additionalProperties: false },
);

export const gradleDependencies = defineTool<
  GradleRuntime,
  typeof GradleDependenciesInput,
  typeof GradleOutput
>({
  name: "dependencies",
  description:
    "Read one Gradle dependency configuration from an exact project path.",
  input: GradleDependenciesInput,
  output: GradleOutput,
  loading: "deferred",
  invoke: (runtime, input, context) =>
    runtime.execute(
      [
        `${input.project ?? ""}:dependencies`,
        "--configuration",
        input.configuration,
      ],
      context,
    ),
  present: presentGradleOutput,
});

export const gradleTools = [
  gradleDependencies,
  gradleInspect,
  gradleTasks,
] as const;
