package io.github.amichne.slopsentral.gradle.runtime

import io.github.amichne.slopsentral.gradle.domain.CancelOutcome
import io.github.amichne.slopsentral.gradle.domain.DebugEndpoint
import io.github.amichne.slopsentral.gradle.domain.EventCursor
import io.github.amichne.slopsentral.gradle.domain.GradleInvocation
import io.github.amichne.slopsentral.gradle.domain.HistoryLimit
import io.github.amichne.slopsentral.gradle.domain.Refinement
import io.github.amichne.slopsentral.gradle.domain.RunCancellation
import io.github.amichne.slopsentral.gradle.domain.RunEvent
import io.github.amichne.slopsentral.gradle.domain.RunId
import io.github.amichne.slopsentral.gradle.domain.RunObservation
import io.github.amichne.slopsentral.gradle.domain.RunState
import io.github.amichne.slopsentral.gradle.domain.RunSummary
import io.github.amichne.slopsentral.gradle.domain.WaitDuration
import io.github.amichne.slopsentral.gradle.history.InMemoryRunHistoryStore
import io.github.amichne.slopsentral.gradle.history.RunHistoryStore
import io.github.amichne.slopsentral.gradle.history.RunLease
import io.github.amichne.slopsentral.gradle.history.RunPersistenceFailure
import java.io.IOException
import java.time.Duration
import java.time.Instant
import java.util.UUID
import java.util.concurrent.CompletableFuture
import java.util.concurrent.TimeUnit
import java.util.concurrent.locks.ReentrantLock
import kotlin.concurrent.withLock

fun interface GradleProcessHandle {
    fun cancel()
}

interface GradleProcessEvents {
    fun output(text: String)

    fun completed(exitCode: Int)
}

fun interface GradleExecutor {
    fun start(invocation: GradleInvocation, events: GradleProcessEvents): GradleProcessHandle
}

fun interface RunIdSource {
    fun next(): UUID
}

fun interface TimeSource {
    fun now(): Instant
}

enum class RunStartFailure {
    RUN_ALREADY_ACTIVE,
    PROCESS_START_FAILED,
    PERSISTENCE_FAILED,
}

enum class RunObservationFailure {
    UNKNOWN_RUN,
    CURSOR_AHEAD,
    PERSISTENCE_FAILED,
}

enum class RunCancellationFailure {
    UNKNOWN_RUN,
    PERSISTENCE_FAILED,
}

enum class RunHistoryFailure {
    UNKNOWN_RUN,
    PERSISTENCE_FAILED,
    CORRUPT_HISTORY,
}

enum class DebugTargetFailure {
    UNKNOWN_RUN,
    DEBUG_NOT_ENABLED,
    RUN_NOT_ACTIVE,
}

data class StartedRun(
    val runId: RunId,
    val state: RunState,
    val command: List<String>,
    val startedAt: Instant,
    val debugEndpoint: DebugEndpoint?,
)

data class DebugTarget(
    val runId: RunId,
    val endpoint: DebugEndpoint,
)

class GradleRunService(
    private val executor: GradleExecutor,
    private val runIds: RunIdSource = RunIdSource(UUID::randomUUID),
    private val time: TimeSource = TimeSource(Instant::now),
    private val history: RunHistoryStore = InMemoryRunHistoryStore(),
) : AutoCloseable {
    private val lock = Any()
    private val runs = mutableMapOf<RunId, RunRecord>()
    private var activeRunId: RunId? = null

    fun start(invocation: GradleInvocation): Refinement<StartedRun, RunStartFailure> {
        val runId: RunId
        val record: RunRecord
        synchronized(lock) {
            val current = activeRunId?.let(runs::get)
            if (current?.isActive() == true) {
                return Refinement.Rejected(RunStartFailure.RUN_ALREADY_ACTIVE)
            }
            runId = RunId(runIds.next())
            val lease = when (val acquired = history.acquire(runId)) {
                is Refinement.Accepted -> acquired.value
                is Refinement.Rejected -> return Refinement.Rejected(
                    when (acquired.failure) {
                        RunPersistenceFailure.LOCK_HELD -> RunStartFailure.RUN_ALREADY_ACTIVE
                        RunPersistenceFailure.LEASE_CLOSED,
                        RunPersistenceFailure.LEASE_MISMATCH,
                        RunPersistenceFailure.IO_FAILURE,
                        RunPersistenceFailure.CORRUPT_HISTORY,
                        RunPersistenceFailure.UNKNOWN_RUN,
                        -> RunStartFailure.PERSISTENCE_FAILED
                    },
                )
            }
            record = RunRecord(
                runId = runId,
                command = invocation.displayCommand,
                debugEndpoint = invocation.debugEndpoint,
                time = time,
                lease = lease,
                onTerminal = ::clearActive,
            )
            if (record.persistStarted() is Refinement.Rejected) {
                lease.close()
                return Refinement.Rejected(RunStartFailure.PERSISTENCE_FAILED)
            }
            runs[runId] = record
            activeRunId = runId
        }

        val handle = try {
            executor.start(invocation, record)
        } catch (_: IOException) {
            record.startRejected()
            return Refinement.Rejected(RunStartFailure.PROCESS_START_FAILED)
        } catch (_: SecurityException) {
            record.startRejected()
            return Refinement.Rejected(RunStartFailure.PROCESS_START_FAILED)
        }
        record.attach(handle)
        return Refinement.Accepted(record.startedRun())
    }

    fun observe(
        runId: RunId,
        after: EventCursor,
        wait: WaitDuration,
    ): Refinement<RunObservation, RunObservationFailure> {
        val record = synchronized(lock) { runs[runId] }
            ?: return Refinement.Rejected(RunObservationFailure.UNKNOWN_RUN)
        return record.observe(after, wait)
    }

    fun cancel(runId: RunId): Refinement<RunCancellation, RunCancellationFailure> {
        val record = synchronized(lock) { runs[runId] }
            ?: return Refinement.Rejected(RunCancellationFailure.UNKNOWN_RUN)
        return record.cancel()
    }

    fun readHistory(runId: RunId): Refinement<RunSummary, RunHistoryFailure> =
        when (val persisted = history.read(runId)) {
            is Refinement.Accepted -> projectForCurrentHost(persisted.value)
            is Refinement.Rejected -> Refinement.Rejected(persisted.failure.toHistoryFailure())
        }

    fun listHistory(limit: HistoryLimit): Refinement<List<RunSummary>, RunHistoryFailure> =
        when (val persisted = history.list(limit.value)) {
            is Refinement.Accepted -> if (persisted.value.none { it.state.isActive }) {
                persisted
            } else {
                when (val owner = history.activeOwner()) {
                    is Refinement.Accepted -> Refinement.Accepted(
                        persisted.value.map { it.projectForCurrentHost(owner.value) },
                    )
                    is Refinement.Rejected -> Refinement.Rejected(owner.failure.toHistoryFailure())
                }
            }
            is Refinement.Rejected -> Refinement.Rejected(persisted.failure.toHistoryFailure())
        }

    fun debugTarget(runId: RunId): Refinement<DebugTarget, DebugTargetFailure> {
        val current = synchronized(lock) { runs[runId] }
        if (current != null) return current.debugTarget()
        return when (val persisted = history.read(runId)) {
            is Refinement.Accepted -> if (persisted.value.debugEndpoint == null) {
                Refinement.Rejected(DebugTargetFailure.DEBUG_NOT_ENABLED)
            } else {
                Refinement.Rejected(DebugTargetFailure.RUN_NOT_ACTIVE)
            }
            is Refinement.Rejected -> Refinement.Rejected(
                if (persisted.failure == RunPersistenceFailure.UNKNOWN_RUN) {
                    DebugTargetFailure.UNKNOWN_RUN
                } else {
                    DebugTargetFailure.RUN_NOT_ACTIVE
                },
            )
        }
    }

    override fun close() {
        val active = synchronized(lock) { activeRunId?.let(runs::get) }
        active?.cancel()
    }

    private fun clearActive(runId: RunId) {
        synchronized(lock) {
            if (activeRunId == runId) activeRunId = null
        }
    }

    private fun projectForCurrentHost(summary: RunSummary): Refinement<RunSummary, RunHistoryFailure> =
        if (!summary.state.isActive) {
            Refinement.Accepted(summary)
        } else {
            when (val owner = history.activeOwner()) {
                is Refinement.Accepted -> Refinement.Accepted(summary.projectForCurrentHost(owner.value))
                is Refinement.Rejected -> Refinement.Rejected(owner.failure.toHistoryFailure())
            }
        }

    private fun RunSummary.projectForCurrentHost(activeOwner: RunId?): RunSummary {
        val currentIsActive = synchronized(lock) { runs[runId]?.isActive() == true }
        return if (state.isActive && !currentIsActive && activeOwner != runId) {
            copy(state = RunState.ABANDONED)
        } else {
            this
        }
    }
}

private fun RunPersistenceFailure.toHistoryFailure(): RunHistoryFailure = when (this) {
    RunPersistenceFailure.UNKNOWN_RUN -> RunHistoryFailure.UNKNOWN_RUN
    RunPersistenceFailure.CORRUPT_HISTORY -> RunHistoryFailure.CORRUPT_HISTORY
    RunPersistenceFailure.LOCK_HELD,
    RunPersistenceFailure.LEASE_CLOSED,
    RunPersistenceFailure.LEASE_MISMATCH,
    RunPersistenceFailure.IO_FAILURE,
    -> RunHistoryFailure.PERSISTENCE_FAILED
}

private class RunRecord(
    private val runId: RunId,
    private val command: List<String>,
    private val debugEndpoint: DebugEndpoint?,
    private val time: TimeSource,
    private val lease: RunLease,
    private val onTerminal: (RunId) -> Unit,
) : GradleProcessEvents {
    private val monitor = ReentrantLock()
    private val changed = monitor.newCondition()
    private val startedAt = time.now()
    private val events = mutableListOf<RunEvent>()
    private var state = RunState.RUNNING
    private var handle: GradleProcessHandle? = null
    private var cancellationRequested = false
    private var finishedAt: Instant? = null
    private var exitCode: Int? = null
    private var persistenceFailed = false

    fun isActive(): Boolean = monitor.withLock { state.isActive }

    fun startedRun(): StartedRun = monitor.withLock {
        StartedRun(runId, state, command, startedAt, debugEndpoint)
    }

    fun persistStarted(): Refinement<Unit, RunPersistenceFailure> = monitor.withLock { persist() }

    fun debugTarget(): Refinement<DebugTarget, DebugTargetFailure> = monitor.withLock {
        when {
            debugEndpoint == null -> Refinement.Rejected(DebugTargetFailure.DEBUG_NOT_ENABLED)
            !state.isActive -> Refinement.Rejected(DebugTargetFailure.RUN_NOT_ACTIVE)
            else -> Refinement.Accepted(DebugTarget(runId, debugEndpoint))
        }
    }

    fun attach(processHandle: GradleProcessHandle) {
        val mustCancel = monitor.withLock {
            handle = processHandle
            cancellationRequested && state.isActive
        }
        if (mustCancel) processHandle.cancel()
    }

    fun startRejected() {
        monitor.withLock {
            state = RunState.FAILED
            finishedAt = time.now()
            persist()
            changed.signalAll()
        }
        lease.close()
        onTerminal(runId)
    }

    override fun output(text: String) {
        monitor.withLock {
            if (!state.isActive) return
            val cursor = EventCursor.next(events.size.toLong() + 1)
            events += RunEvent(cursor, text)
            changed.signalAll()
        }
    }

    override fun completed(exitCode: Int) {
        val becameTerminal = monitor.withLock {
            if (!state.isActive) {
                false
            } else {
                this.exitCode = exitCode
                finishedAt = time.now()
                state = when {
                    cancellationRequested -> RunState.CANCELLED
                    exitCode == 0 -> RunState.SUCCEEDED
                    else -> RunState.FAILED
                }
                persist()
                changed.signalAll()
                true
            }
        }
        if (becameTerminal) {
            lease.close()
            onTerminal(runId)
        }
    }

    fun observe(
        after: EventCursor,
        wait: WaitDuration,
    ): Refinement<RunObservation, RunObservationFailure> = monitor.withLock {
        if (persistenceFailed) {
            return Refinement.Rejected(RunObservationFailure.PERSISTENCE_FAILED)
        }
        if (after.value > events.size.toLong()) {
            return Refinement.Rejected(RunObservationFailure.CURSOR_AHEAD)
        }
        if (after.value == events.size.toLong() && state.isActive && wait.milliseconds > 0) {
            try {
                changed.await(wait.milliseconds, TimeUnit.MILLISECONDS)
            } catch (_: InterruptedException) {
                Thread.currentThread().interrupt()
            }
        }
        Refinement.Accepted(snapshot(after))
    }

    fun cancel(): Refinement<RunCancellation, RunCancellationFailure> {
        val processHandle: GradleProcessHandle?
        val cancellation: RunCancellation
        val persistFailed: Boolean
        monitor.withLock {
            val outcome = when (state) {
                RunState.RUNNING -> {
                    cancellationRequested = true
                    state = RunState.CANCELLING
                    persist()
                    changed.signalAll()
                    CancelOutcome.REQUESTED
                }
                RunState.CANCELLING -> CancelOutcome.ALREADY_REQUESTED
                RunState.SUCCEEDED,
                RunState.FAILED,
                RunState.CANCELLED,
                RunState.ABANDONED,
                -> CancelOutcome.ALREADY_TERMINAL
            }
            processHandle = if (outcome == CancelOutcome.REQUESTED) handle else null
            cancellation = RunCancellation(runId, outcome, state)
            persistFailed = persistenceFailed
        }
        processHandle?.cancel()
        return if (persistFailed) {
            Refinement.Rejected(RunCancellationFailure.PERSISTENCE_FAILED)
        } else {
            Refinement.Accepted(cancellation)
        }
    }

    private fun snapshot(after: EventCursor): RunObservation {
        val completion = finishedAt
        val duration = completion?.let { Duration.between(startedAt, it).toMillis() }
        return RunObservation(
            runId = runId,
            state = state,
            command = command,
            startedAt = startedAt,
            finishedAt = completion,
            exitCode = exitCode,
            durationMillis = duration,
            events = events.drop(after.value.toInt()),
            nextCursor = EventCursor.next(events.size.toLong()),
            debugEndpoint = debugEndpoint,
        )
    }

    private fun persist(): Refinement<Unit, RunPersistenceFailure> = lease.write(summary()).also {
        persistenceFailed = it is Refinement.Rejected
    }

    private fun summary(): RunSummary {
        val completion = finishedAt
        return RunSummary(
            runId = runId,
            state = state,
            command = command,
            startedAt = startedAt,
            finishedAt = completion,
            exitCode = exitCode,
            durationMillis = completion?.let { Duration.between(startedAt, it).toMillis() },
            debugEndpoint = debugEndpoint,
        )
    }
}

class SystemGradleExecutor : GradleExecutor {
    override fun start(invocation: GradleInvocation, events: GradleProcessEvents): GradleProcessHandle {
        val process = ProcessBuilder(listOf(invocation.executable.toString()) + invocation.arguments)
            .directory(invocation.project.root.toFile())
            .redirectErrorStream(true)
            .start()

        Thread.ofPlatform()
            .daemon(true)
            .name("gradle-dynamic-tools-${process.pid()}")
            .start {
                try {
                    process.inputReader().useLines { lines -> lines.forEach(events::output) }
                } catch (_: IOException) {
                    process.destroyForcibly()
                }
                val exitCode = try {
                    process.waitFor()
                } catch (_: InterruptedException) {
                    process.destroyForcibly()
                    Thread.currentThread().interrupt()
                    130
                }
                events.completed(exitCode)
            }

        return GradleProcessHandle {
            process.destroy()
            CompletableFuture.delayedExecutor(2, TimeUnit.SECONDS).execute {
                if (process.isAlive) process.destroyForcibly()
            }
        }
    }
}
