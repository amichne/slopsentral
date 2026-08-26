package io.github.amichne.slopsentral.gradle.domain

import java.nio.file.Files
import java.nio.file.Path
import java.time.Instant
import java.util.UUID

sealed interface Refinement<out Value, out Failure> {
    data class Accepted<Value>(val value: Value) : Refinement<Value, Nothing>

    data class Rejected<Failure>(val failure: Failure) : Refinement<Nothing, Failure>
}

enum class ProjectAdmissionFailure {
    NOT_A_DIRECTORY,
    MISSING_GRADLE_WRAPPER,
    WRAPPER_OUTSIDE_REPOSITORY,
    WRAPPER_NOT_EXECUTABLE,
}

class GradleProject private constructor(
    val root: Path,
    val wrapper: Path,
) {
    companion object {
        fun admit(candidate: Path): Refinement<GradleProject, ProjectAdmissionFailure> {
            val normalized = candidate.toAbsolutePath().normalize()
            if (!Files.isDirectory(normalized)) {
                return Refinement.Rejected(ProjectAdmissionFailure.NOT_A_DIRECTORY)
            }
            val wrapperCandidate = normalized.resolve("gradlew")
            if (!Files.isRegularFile(wrapperCandidate)) {
                return Refinement.Rejected(ProjectAdmissionFailure.MISSING_GRADLE_WRAPPER)
            }
            val realRoot = normalized.toRealPath()
            val realWrapper = wrapperCandidate.toRealPath()
            if (!realWrapper.startsWith(realRoot)) {
                return Refinement.Rejected(ProjectAdmissionFailure.WRAPPER_OUTSIDE_REPOSITORY)
            }
            if (!Files.isExecutable(realWrapper)) {
                return Refinement.Rejected(ProjectAdmissionFailure.WRAPPER_NOT_EXECUTABLE)
            }
            return Refinement.Accepted(GradleProject(realRoot, realWrapper))
        }
    }
}

enum class ValueAdmissionFailure {
    INVALID_TASK_PATH,
    INVALID_TEST_SELECTOR,
    INVALID_RUN_ID,
    INVALID_CURSOR,
    INVALID_WAIT_DURATION,
    INVALID_DISCOVERY_LIMIT,
    INVALID_TASK_QUERY,
    INVALID_HISTORY_LIMIT,
    INVALID_DEBUG_PORT,
    INVALID_DEBUG_TIMEOUT,
    INVALID_DEBUG_THREAD_ID,
    INVALID_STACK_FRAME_LIMIT,
}

@JvmInline
value class GradleTaskPath private constructor(val value: String) {
    companion object {
        private val pattern = Regex("^(?::[A-Za-z0-9_.-]+)+$|^[A-Za-z][A-Za-z0-9_.-]*$")

        fun admit(value: String): Refinement<GradleTaskPath, ValueAdmissionFailure> =
            if (value.length in 1..256 && pattern.matches(value)) {
                Refinement.Accepted(GradleTaskPath(value))
            } else {
                Refinement.Rejected(ValueAdmissionFailure.INVALID_TASK_PATH)
            }
    }
}

@JvmInline
value class TestSelector private constructor(val value: String) {
    companion object {
        fun admit(value: String): Refinement<TestSelector, ValueAdmissionFailure> =
            if (value.length in 1..512 && value.none { it == '\r' || it == '\n' }) {
                Refinement.Accepted(TestSelector(value))
            } else {
                Refinement.Rejected(ValueAdmissionFailure.INVALID_TEST_SELECTOR)
            }
    }
}

@JvmInline
value class RunId(val value: UUID) {
    companion object {
        fun admit(value: String): Refinement<RunId, ValueAdmissionFailure> = try {
            val parsed = UUID.fromString(value)
            if (parsed.toString() == value) {
                Refinement.Accepted(RunId(parsed))
            } else {
                Refinement.Rejected(ValueAdmissionFailure.INVALID_RUN_ID)
            }
        } catch (_: IllegalArgumentException) {
            Refinement.Rejected(ValueAdmissionFailure.INVALID_RUN_ID)
        }
    }
}

@JvmInline
value class EventCursor private constructor(val value: Long) {
    companion object {
        val Beginning = EventCursor(0)

        fun admit(value: Long): Refinement<EventCursor, ValueAdmissionFailure> =
            if (value >= 0) {
                Refinement.Accepted(EventCursor(value))
            } else {
                Refinement.Rejected(ValueAdmissionFailure.INVALID_CURSOR)
            }

        internal fun next(value: Long): EventCursor = EventCursor(value)
    }
}

@JvmInline
value class WaitDuration private constructor(val milliseconds: Long) {
    companion object {
        fun admit(value: Long): Refinement<WaitDuration, ValueAdmissionFailure> =
            if (value in 0..30_000) {
                Refinement.Accepted(WaitDuration(value))
            } else {
                Refinement.Rejected(ValueAdmissionFailure.INVALID_WAIT_DURATION)
            }
    }
}

sealed interface GradleOperation {
    data class Tasks(val tasks: List<GradleTaskPath>) : GradleOperation

    data class Tests(
        val task: GradleTaskPath,
        val selectors: List<TestSelector>,
        val debug: DebugLaunch?,
    ) : GradleOperation
}

enum class DebugLaunch {
    JDWP,
}

@ConsistentCopyVisibility
data class DebugEndpoint private constructor(
    val host: String,
    val port: Int,
) {
    companion object {
        val GradleTest = DebugEndpoint("127.0.0.1", 5005)

        fun loopback(port: Int): Refinement<DebugEndpoint, ValueAdmissionFailure> =
            if (port in 1..65535) {
                Refinement.Accepted(DebugEndpoint("127.0.0.1", port))
            } else {
                Refinement.Rejected(ValueAdmissionFailure.INVALID_DEBUG_PORT)
            }
    }
}

data class GradleInvocation(
    val project: GradleProject,
    val executable: Path,
    val arguments: List<String>,
    val debugEndpoint: DebugEndpoint?,
) {
    val displayCommand: List<String> = listOf("./gradlew") + arguments

    companion object {
        fun forOperation(project: GradleProject, operation: GradleOperation): GradleInvocation {
            val arguments = buildList {
                add("--console=plain")
                add("--stacktrace")
                when (operation) {
                    is GradleOperation.Tasks -> operation.tasks.forEach { add(it.value) }
                    is GradleOperation.Tests -> {
                        add(operation.task.value)
                        operation.selectors.forEach { selector ->
                            add("--tests")
                            add(selector.value)
                        }
                        if (operation.debug == DebugLaunch.JDWP) add("--debug-jvm")
                    }
                }
            }
            return GradleInvocation(
                project = project,
                executable = project.wrapper,
                arguments = arguments,
                debugEndpoint = when (operation) {
                    is GradleOperation.Tasks -> null
                    is GradleOperation.Tests -> operation.debug?.let { DebugEndpoint.GradleTest }
                },
            )
        }
    }
}

enum class RunState {
    RUNNING,
    CANCELLING,
    SUCCEEDED,
    FAILED,
    CANCELLED,
    ABANDONED,
    ;

    val isActive: Boolean
        get() = this == RUNNING || this == CANCELLING
}

data class RunEvent(
    val cursor: EventCursor,
    val text: String,
)

data class RunObservation(
    val runId: RunId,
    val state: RunState,
    val command: List<String>,
    val startedAt: Instant,
    val finishedAt: Instant?,
    val exitCode: Int?,
    val durationMillis: Long?,
    val events: List<RunEvent>,
    val nextCursor: EventCursor,
    val debugEndpoint: DebugEndpoint?,
)

enum class CancelOutcome {
    REQUESTED,
    ALREADY_REQUESTED,
    ALREADY_TERMINAL,
}

data class RunCancellation(
    val runId: RunId,
    val outcome: CancelOutcome,
    val state: RunState,
)
