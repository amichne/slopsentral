package io.github.amichne.slopsentral.gradle.debug

import com.sun.jdi.AbsentInformationException
import com.sun.jdi.Bootstrap
import com.sun.jdi.IncompatibleThreadStateException
import com.sun.jdi.ThreadReference
import com.sun.jdi.VMDisconnectedException
import com.sun.jdi.VirtualMachine
import com.sun.jdi.connect.AttachingConnector
import com.sun.jdi.connect.IllegalConnectorArgumentsException
import com.sun.jdi.connect.TransportTimeoutException
import io.github.amichne.slopsentral.gradle.domain.DebugAttachOutcome
import io.github.amichne.slopsentral.gradle.domain.DebugAttachment
import io.github.amichne.slopsentral.gradle.domain.DebugControl
import io.github.amichne.slopsentral.gradle.domain.DebugControlOutcome
import io.github.amichne.slopsentral.gradle.domain.DebugEndpoint
import io.github.amichne.slopsentral.gradle.domain.DebugStack
import io.github.amichne.slopsentral.gradle.domain.DebugStackFrame
import io.github.amichne.slopsentral.gradle.domain.DebugThread
import io.github.amichne.slopsentral.gradle.domain.DebugThreadId
import io.github.amichne.slopsentral.gradle.domain.DebugThreadState
import io.github.amichne.slopsentral.gradle.domain.DebugThreads
import io.github.amichne.slopsentral.gradle.domain.DebugTimeout
import io.github.amichne.slopsentral.gradle.domain.Refinement
import io.github.amichne.slopsentral.gradle.domain.RunId
import io.github.amichne.slopsentral.gradle.domain.StackFrameLimit
import java.io.IOException
import java.util.concurrent.TimeUnit

private const val SOCKET_ATTACH_CONNECTOR = "com.sun.jdi.SocketAttach"

enum class DebugFailure {
    CONNECTOR_UNAVAILABLE,
    ATTACH_TIMEOUT,
    ATTACH_FAILED,
    NOT_ATTACHED,
    DISCONNECTED,
    UNKNOWN_THREAD,
    THREAD_NOT_SUSPENDED,
    FRAME_INFORMATION_UNAVAILABLE,
    CONTROL_FAILED,
}

interface JavaDebugger : AutoCloseable {
    fun attach(
        runId: RunId,
        endpoint: DebugEndpoint,
        timeout: DebugTimeout,
    ): Refinement<DebugAttachment, DebugFailure>

    fun threads(runId: RunId): Refinement<DebugThreads, DebugFailure>

    fun stack(
        runId: RunId,
        threadId: DebugThreadId,
        maximumFrames: StackFrameLimit,
    ): Refinement<DebugStack, DebugFailure>

    fun pause(runId: RunId): Refinement<DebugControl, DebugFailure>

    fun resume(runId: RunId): Refinement<DebugControl, DebugFailure>

    fun detach(runId: RunId): Refinement<DebugControl, DebugFailure>
}

class JdiDebuggerService : JavaDebugger {
    private val monitor = Any()
    private val sessions = mutableMapOf<RunId, JdiSession>()

    override fun attach(
        runId: RunId,
        endpoint: DebugEndpoint,
        timeout: DebugTimeout,
    ): Refinement<DebugAttachment, DebugFailure> = synchronized(monitor) {
        sessions[runId]?.let { existing ->
            return Refinement.Accepted(
                DebugAttachment(runId, existing.endpoint, DebugAttachOutcome.ALREADY_ATTACHED),
            )
        }
        val connector = socketConnector()
            ?: return Refinement.Rejected(DebugFailure.CONNECTOR_UNAVAILABLE)
        when (val attached = connector.attachUntil(endpoint, timeout)) {
            is Refinement.Accepted -> {
                sessions[runId] = JdiSession(endpoint, attached.value)
                Refinement.Accepted(DebugAttachment(runId, endpoint, DebugAttachOutcome.ATTACHED))
            }
            is Refinement.Rejected -> attached
        }
    }

    override fun threads(runId: RunId): Refinement<DebugThreads, DebugFailure> =
        withSession(runId) { virtualMachine ->
            DebugThreads(
                runId = runId,
                threads = virtualMachine.allThreads()
                    .map(ThreadReference::toDomain)
                    .sortedBy(DebugThread::id),
            )
        }

    override fun stack(
        runId: RunId,
        threadId: DebugThreadId,
        maximumFrames: StackFrameLimit,
    ): Refinement<DebugStack, DebugFailure> {
        val session = synchronized(monitor) { sessions[runId] }
            ?: return Refinement.Rejected(DebugFailure.NOT_ATTACHED)
        return try {
            val thread = session.virtualMachine.allThreads().singleOrNull { it.uniqueID() == threadId.value }
                ?: return Refinement.Rejected(DebugFailure.UNKNOWN_THREAD)
            if (!thread.isSuspended) return Refinement.Rejected(DebugFailure.THREAD_NOT_SUSPENDED)
            val count = minOf(thread.frameCount(), maximumFrames.value)
            val frames = thread.frames(0, count).mapIndexed { index, frame ->
                val location = frame.location()
                DebugStackFrame(
                    index = index,
                    declaringType = location.declaringType().name(),
                    methodName = location.method().name(),
                    lineNumber = location.lineNumber(),
                    sourceName = try {
                        location.sourceName()
                    } catch (_: AbsentInformationException) {
                        null
                    },
                )
            }
            Refinement.Accepted(DebugStack(runId, thread.toDomain(), frames))
        } catch (_: IncompatibleThreadStateException) {
            Refinement.Rejected(DebugFailure.FRAME_INFORMATION_UNAVAILABLE)
        } catch (_: VMDisconnectedException) {
            remove(runId)
            Refinement.Rejected(DebugFailure.DISCONNECTED)
        } catch (_: RuntimeException) {
            Refinement.Rejected(DebugFailure.FRAME_INFORMATION_UNAVAILABLE)
        }
    }

    override fun pause(runId: RunId): Refinement<DebugControl, DebugFailure> =
        control(runId, DebugControlOutcome.PAUSED, VirtualMachine::suspend)

    override fun resume(runId: RunId): Refinement<DebugControl, DebugFailure> =
        control(runId, DebugControlOutcome.RESUMED, VirtualMachine::resume)

    override fun detach(runId: RunId): Refinement<DebugControl, DebugFailure> {
        val session = remove(runId)
            ?: return Refinement.Accepted(DebugControl(runId, DebugControlOutcome.ALREADY_DETACHED))
        return try {
            session.virtualMachine.dispose()
            Refinement.Accepted(DebugControl(runId, DebugControlOutcome.DETACHED))
        } catch (_: VMDisconnectedException) {
            Refinement.Accepted(DebugControl(runId, DebugControlOutcome.DETACHED))
        } catch (_: RuntimeException) {
            Refinement.Rejected(DebugFailure.CONTROL_FAILED)
        }
    }

    override fun close() {
        val runIds = synchronized(monitor) { sessions.keys.toList() }
        runIds.forEach(::detach)
    }

    private fun <Value> withSession(
        runId: RunId,
        operation: (VirtualMachine) -> Value,
    ): Refinement<Value, DebugFailure> {
        val session = synchronized(monitor) { sessions[runId] }
            ?: return Refinement.Rejected(DebugFailure.NOT_ATTACHED)
        return try {
            Refinement.Accepted(operation(session.virtualMachine))
        } catch (_: VMDisconnectedException) {
            remove(runId)
            Refinement.Rejected(DebugFailure.DISCONNECTED)
        } catch (_: RuntimeException) {
            Refinement.Rejected(DebugFailure.CONTROL_FAILED)
        }
    }

    private fun control(
        runId: RunId,
        outcome: DebugControlOutcome,
        operation: (VirtualMachine) -> Unit,
    ): Refinement<DebugControl, DebugFailure> = when (val controlled = withSession(runId, operation)) {
        is Refinement.Accepted -> Refinement.Accepted(DebugControl(runId, outcome))
        is Refinement.Rejected -> controlled
    }

    private fun socketConnector(): AttachingConnector? = Bootstrap.virtualMachineManager()
        .attachingConnectors()
        .singleOrNull { it.name() == SOCKET_ATTACH_CONNECTOR }

    private fun remove(runId: RunId): JdiSession? = synchronized(monitor) { sessions.remove(runId) }
}

private data class JdiSession(
    val endpoint: DebugEndpoint,
    val virtualMachine: VirtualMachine,
)

private fun AttachingConnector.attachUntil(
    endpoint: DebugEndpoint,
    timeout: DebugTimeout,
): Refinement<VirtualMachine, DebugFailure> {
    val deadline = System.nanoTime() + TimeUnit.MILLISECONDS.toNanos(timeout.milliseconds.toLong())
    while (true) {
        val remainingMillis = TimeUnit.NANOSECONDS.toMillis(deadline - System.nanoTime()).coerceAtLeast(1)
        val arguments = defaultArguments().also { values ->
            values.getValue("hostname").setValue(endpoint.host)
            values.getValue("port").setValue(endpoint.port.toString())
            values.getValue("timeout").setValue(remainingMillis.toString())
        }
        try {
            return Refinement.Accepted(attach(arguments))
        } catch (_: TransportTimeoutException) {
            if (System.nanoTime() >= deadline) return Refinement.Rejected(DebugFailure.ATTACH_TIMEOUT)
        } catch (_: IOException) {
            if (System.nanoTime() >= deadline) return Refinement.Rejected(DebugFailure.ATTACH_TIMEOUT)
        } catch (_: IllegalConnectorArgumentsException) {
            return Refinement.Rejected(DebugFailure.ATTACH_FAILED)
        } catch (_: SecurityException) {
            return Refinement.Rejected(DebugFailure.ATTACH_FAILED)
        } catch (_: RuntimeException) {
            return Refinement.Rejected(DebugFailure.ATTACH_FAILED)
        }
        try {
            Thread.sleep(minOf(100, remainingMillis))
        } catch (_: InterruptedException) {
            Thread.currentThread().interrupt()
            return Refinement.Rejected(DebugFailure.ATTACH_FAILED)
        }
    }
}

private fun ThreadReference.toDomain(): DebugThread = DebugThread(
    id = uniqueID(),
    name = name(),
    state = when (status()) {
        ThreadReference.THREAD_STATUS_NOT_STARTED -> DebugThreadState.NOT_STARTED
        ThreadReference.THREAD_STATUS_RUNNING -> DebugThreadState.RUNNING
        ThreadReference.THREAD_STATUS_SLEEPING -> DebugThreadState.SLEEPING
        ThreadReference.THREAD_STATUS_MONITOR -> DebugThreadState.MONITOR
        ThreadReference.THREAD_STATUS_WAIT -> DebugThreadState.WAITING
        ThreadReference.THREAD_STATUS_ZOMBIE -> DebugThreadState.ZOMBIE
        ThreadReference.THREAD_STATUS_UNKNOWN -> DebugThreadState.UNKNOWN
        else -> DebugThreadState.UNKNOWN
    },
    suspended = isSuspended,
)
