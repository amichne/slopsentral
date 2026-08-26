package io.github.amichne.slopsentral.gradle.runtime

import io.github.amichne.slopsentral.gradle.domain.CancelOutcome
import io.github.amichne.slopsentral.gradle.domain.EventCursor
import io.github.amichne.slopsentral.gradle.domain.GradleInvocation
import io.github.amichne.slopsentral.gradle.domain.Refinement
import io.github.amichne.slopsentral.gradle.domain.RunCancellation
import io.github.amichne.slopsentral.gradle.domain.RunEvent
import io.github.amichne.slopsentral.gradle.domain.RunId
import io.github.amichne.slopsentral.gradle.domain.RunObservation
import io.github.amichne.slopsentral.gradle.domain.RunState
import io.github.amichne.slopsentral.gradle.domain.WaitDuration
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
}

enum class RunObservationFailure {
    UNKNOWN_RUN,
    CURSOR_AHEAD,
}

enum class RunCancellationFailure {
    UNKNOWN_RUN,
}

data class StartedRun(
    val runId: RunId,
    val state: RunState,
    val command: List<String>,
    val startedAt: Instant,
)

class GradleRunService(
    private val executor: GradleExecutor,
    private val runIds: RunIdSource = RunIdSource(UUID::randomUUID),
    private val time: TimeSource = TimeSource(Instant::now),
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
            record = RunRecord(runId, invocation.displayCommand, time, ::clearActive)
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
        return Refinement.Accepted(record.cancel())
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
}

private class RunRecord(
    private val runId: RunId,
    private val command: List<String>,
    private val time: TimeSource,
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

    fun isActive(): Boolean = monitor.withLock { state.isActive }

    fun startedRun(): StartedRun = monitor.withLock {
        StartedRun(runId, state, command, startedAt)
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
            changed.signalAll()
        }
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
                changed.signalAll()
                true
            }
        }
        if (becameTerminal) onTerminal(runId)
    }

    fun observe(
        after: EventCursor,
        wait: WaitDuration,
    ): Refinement<RunObservation, RunObservationFailure> = monitor.withLock {
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

    fun cancel(): RunCancellation {
        val processHandle: GradleProcessHandle?
        val cancellation: RunCancellation
        monitor.withLock {
            val outcome = when (state) {
                RunState.RUNNING -> {
                    cancellationRequested = true
                    state = RunState.CANCELLING
                    changed.signalAll()
                    CancelOutcome.REQUESTED
                }
                RunState.CANCELLING -> CancelOutcome.ALREADY_REQUESTED
                RunState.SUCCEEDED, RunState.FAILED, RunState.CANCELLED -> CancelOutcome.ALREADY_TERMINAL
            }
            processHandle = if (outcome == CancelOutcome.REQUESTED) handle else null
            cancellation = RunCancellation(runId, outcome, state)
        }
        processHandle?.cancel()
        return cancellation
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
