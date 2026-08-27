package io.github.amichne.slopsentral.gradle.appserver

import io.github.amichne.slopsentral.gradle.domain.GradleProject
import io.github.amichne.slopsentral.gradle.domain.Refinement
import io.github.amichne.slopsentral.gradle.wire.GradleToolWireClient
import io.github.amichne.slopsentral.gradle.wire.LoopbackBinding
import io.github.amichne.slopsentral.gradle.wire.LoopbackEndpoint
import io.ktor.server.application.install
import io.ktor.server.cio.CIO
import io.ktor.server.engine.embeddedServer
import io.ktor.server.routing.routing
import io.ktor.server.websocket.DefaultWebSocketServerSession
import io.ktor.server.websocket.WebSockets
import io.ktor.server.websocket.webSocket
import io.ktor.websocket.CloseReason
import io.ktor.websocket.Frame
import io.ktor.websocket.close
import io.ktor.websocket.readText
import io.ktor.websocket.send
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.cancelAndJoin
import kotlinx.coroutines.launch
import kotlinx.coroutines.runBlocking
import kotlinx.coroutines.withContext
import java.io.IOException
import java.net.BindException
import java.util.concurrent.CountDownLatch
import java.util.concurrent.atomic.AtomicBoolean

enum class AppServerBridgeStartFailure {
    BIND_FAILED,
    SERVER_FAILED,
    INTERRUPTED,
}

class CodexAppServerBridge(
    private val binding: LoopbackBinding,
    private val project: GradleProject,
    private val gradleServer: LoopbackEndpoint,
) {
    fun start(): Refinement<RunningCodexAppServerBridge, AppServerBridgeStartFailure> {
        val server = embeddedServer(CIO, host = LOOPBACK_HOST, port = binding.port) {
            install(WebSockets)
            routing {
                webSocket("/") {
                    bridgeConnection()
                }
            }
        }
        return try {
            server.start(wait = false)
            val connector = runBlocking { server.engine.resolvedConnectors() }.singleOrNull()
                ?: return server.rejectedStart(AppServerBridgeStartFailure.SERVER_FAILED)
            Refinement.Accepted(
                RunningCodexAppServerBridge(LoopbackEndpoint.bound(connector.port)) {
                    server.stop(gracePeriodMillis = 500, timeoutMillis = 2_000)
                },
            )
        } catch (_: BindException) {
            server.rejectedStart(AppServerBridgeStartFailure.BIND_FAILED)
        } catch (_: IOException) {
            server.rejectedStart(AppServerBridgeStartFailure.SERVER_FAILED)
        } catch (_: SecurityException) {
            server.rejectedStart(AppServerBridgeStartFailure.SERVER_FAILED)
        } catch (failure: RuntimeException) {
            server.rejectedStart(
                if (failure.causedByBindFailure()) {
                    AppServerBridgeStartFailure.BIND_FAILED
                } else {
                    AppServerBridgeStartFailure.SERVER_FAILED
                },
            )
        }
    }

    fun run(onReady: (LoopbackEndpoint) -> Unit): Refinement<Unit, AppServerBridgeStartFailure> {
        val running = when (val started = start()) {
            is Refinement.Accepted -> started.value
            is Refinement.Rejected -> return started
        }
        val stopped = CountDownLatch(1)
        val shutdownHook = Thread.ofPlatform()
            .name("gradle-dynamic-tools-bridge-shutdown")
            .unstarted {
                running.close()
                stopped.countDown()
            }
        return running.use {
            try {
                Runtime.getRuntime().addShutdownHook(shutdownHook)
                onReady(running.endpoint)
                stopped.await()
                Refinement.Accepted(Unit)
            } catch (_: SecurityException) {
                Refinement.Rejected(AppServerBridgeStartFailure.SERVER_FAILED)
            } catch (_: InterruptedException) {
                Thread.currentThread().interrupt()
                Refinement.Rejected(AppServerBridgeStartFailure.INTERRUPTED)
            } finally {
                try {
                    Runtime.getRuntime().removeShutdownHook(shutdownHook)
                } catch (_: IllegalArgumentException) {
                } catch (_: IllegalStateException) {
                }
            }
        }
    }

    private suspend fun DefaultWebSocketServerSession.bridgeConnection() {
        val tools = when (
            val connection = withContext(Dispatchers.IO) {
                GradleToolWireClient.connect(gradleServer, project)
            }
        ) {
            is Refinement.Accepted -> connection.value
            is Refinement.Rejected -> {
                close(
                    CloseReason(
                        CloseReason.Codes.INTERNAL_ERROR,
                        "GRADLE_SERVER_${connection.failure.name}",
                    ),
                )
                return
            }
        }
        val upstream = when (
            val opening = withContext(Dispatchers.IO) {
                ProcessJsonLineTransport.startForBridge(project.root)
            }
        ) {
            is Refinement.Accepted -> opening.value
            is Refinement.Rejected -> {
                tools.close()
                close(CloseReason(CloseReason.Codes.INTERNAL_ERROR, opening.failure.name))
                return
            }
        }
        try {
            bridgeMessages(upstream, AppServerBridgeProtocol(tools))
        } finally {
            upstream.close()
            tools.close()
        }
    }

    private suspend fun DefaultWebSocketServerSession.bridgeMessages(
        upstream: JsonLineTransport,
        protocol: AppServerBridgeProtocol,
    ) {
        val upstreamReader = launch(Dispatchers.IO) {
            try {
                while (true) {
                    when (val routing = protocol.fromServer(upstream.receive())) {
                        is ServerBridgeRouting.ForwardDownstream -> send(routing.message)
                        is ServerBridgeRouting.ReplyUpstream -> upstream.send(routing.message)
                        is ServerBridgeRouting.Close -> {
                            close(CloseReason(CloseReason.Codes.PROTOCOL_ERROR, routing.failure.name))
                            return@launch
                        }
                    }
                }
            } catch (_: IOException) {
                close(CloseReason(CloseReason.Codes.GOING_AWAY, "CODEX_APP_SERVER_CLOSED"))
            }
        }
        try {
            for (frame in incoming) {
                if (frame !is Frame.Text) {
                    close(CloseReason(CloseReason.Codes.CANNOT_ACCEPT, "TEXT_FRAMES_REQUIRED"))
                    break
                }
                when (val routing = protocol.fromClient(frame.readText())) {
                    is ClientBridgeRouting.ForwardUpstream -> withContext(Dispatchers.IO) {
                        upstream.send(routing.message)
                    }
                    is ClientBridgeRouting.ReplyDownstream -> send(routing.message)
                    is ClientBridgeRouting.Close -> {
                        close(CloseReason(CloseReason.Codes.PROTOCOL_ERROR, routing.failure.name))
                        break
                    }
                }
            }
        } finally {
            upstream.close()
            upstreamReader.cancelAndJoin()
        }
    }

    private companion object {
        const val LOOPBACK_HOST = "127.0.0.1"
    }
}

class RunningCodexAppServerBridge internal constructor(
    val endpoint: LoopbackEndpoint,
    private val stop: () -> Unit,
) : AutoCloseable {
    private val closed = AtomicBoolean(false)

    override fun close() {
        if (closed.compareAndSet(false, true)) stop()
    }
}

private fun io.ktor.server.engine.EmbeddedServer<*, *>.rejectedStart(
    failure: AppServerBridgeStartFailure,
): Refinement.Rejected<AppServerBridgeStartFailure> {
    stop(gracePeriodMillis = 0, timeoutMillis = 0)
    return Refinement.Rejected(failure)
}

private fun RuntimeException.causedByBindFailure(): Boolean =
    generateSequence<Throwable>(this) { it.cause }.any { it is BindException }
