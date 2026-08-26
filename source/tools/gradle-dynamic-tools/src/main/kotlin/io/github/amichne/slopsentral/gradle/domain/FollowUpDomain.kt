package io.github.amichne.slopsentral.gradle.domain

import java.time.Instant

@JvmInline
value class DiscoveryLimit private constructor(val value: Int) {
    companion object {
        fun admit(value: Int): Refinement<DiscoveryLimit, ValueAdmissionFailure> =
            if (value in 1..1000) {
                Refinement.Accepted(DiscoveryLimit(value))
            } else {
                Refinement.Rejected(ValueAdmissionFailure.INVALID_DISCOVERY_LIMIT)
            }
    }
}

@JvmInline
value class TaskQuery private constructor(val value: String) {
    companion object {
        fun admit(value: String): Refinement<TaskQuery, ValueAdmissionFailure> =
            if (value.length in 1..128 && value.none { it == '\r' || it == '\n' }) {
                Refinement.Accepted(TaskQuery(value))
            } else {
                Refinement.Rejected(ValueAdmissionFailure.INVALID_TASK_QUERY)
            }
    }
}

@JvmInline
value class HistoryLimit private constructor(val value: Int) {
    companion object {
        fun admit(value: Int): Refinement<HistoryLimit, ValueAdmissionFailure> =
            if (value in 1..100) {
                Refinement.Accepted(HistoryLimit(value))
            } else {
                Refinement.Rejected(ValueAdmissionFailure.INVALID_HISTORY_LIMIT)
            }
    }
}

data class TaskDiscoveryRequest(
    val query: TaskQuery?,
    val limit: DiscoveryLimit,
)

data class DiscoveredGradleTask(
    val path: String,
    val name: String,
    val projectPath: String,
    val group: String?,
    val description: String?,
)

data class TaskDiscovery(
    val tasks: List<DiscoveredGradleTask>,
    val truncated: Boolean,
)

data class RunSummary(
    val runId: RunId,
    val state: RunState,
    val command: List<String>,
    val startedAt: Instant,
    val finishedAt: Instant?,
    val exitCode: Int?,
    val durationMillis: Long?,
    val debugEndpoint: DebugEndpoint?,
)

@JvmInline
value class DebugTimeout private constructor(val milliseconds: Int) {
    companion object {
        fun admit(value: Int): Refinement<DebugTimeout, ValueAdmissionFailure> =
            if (value in 1..30_000) {
                Refinement.Accepted(DebugTimeout(value))
            } else {
                Refinement.Rejected(ValueAdmissionFailure.INVALID_DEBUG_TIMEOUT)
            }
    }
}

@JvmInline
value class DebugThreadId private constructor(val value: Long) {
    companion object {
        fun admit(value: Long): Refinement<DebugThreadId, ValueAdmissionFailure> =
            if (value > 0) {
                Refinement.Accepted(DebugThreadId(value))
            } else {
                Refinement.Rejected(ValueAdmissionFailure.INVALID_DEBUG_THREAD_ID)
            }
    }
}

@JvmInline
value class StackFrameLimit private constructor(val value: Int) {
    companion object {
        fun admit(value: Int): Refinement<StackFrameLimit, ValueAdmissionFailure> =
            if (value in 1..128) {
                Refinement.Accepted(StackFrameLimit(value))
            } else {
                Refinement.Rejected(ValueAdmissionFailure.INVALID_STACK_FRAME_LIMIT)
            }
    }
}

enum class DebugAttachOutcome {
    ATTACHED,
    ALREADY_ATTACHED,
}

data class DebugAttachment(
    val runId: RunId,
    val endpoint: DebugEndpoint,
    val outcome: DebugAttachOutcome,
)

enum class DebugThreadState {
    NOT_STARTED,
    RUNNING,
    SLEEPING,
    MONITOR,
    WAITING,
    ZOMBIE,
    UNKNOWN,
}

data class DebugThread(
    val id: Long,
    val name: String,
    val state: DebugThreadState,
    val suspended: Boolean,
)

data class DebugThreads(
    val runId: RunId,
    val threads: List<DebugThread>,
)

data class DebugStackFrame(
    val index: Int,
    val declaringType: String,
    val methodName: String,
    val lineNumber: Int,
    val sourceName: String?,
)

data class DebugStack(
    val runId: RunId,
    val thread: DebugThread,
    val frames: List<DebugStackFrame>,
)

enum class DebugControlOutcome {
    PAUSED,
    RESUMED,
    DETACHED,
    ALREADY_DETACHED,
}

data class DebugControl(
    val runId: RunId,
    val outcome: DebugControlOutcome,
)
