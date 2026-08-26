package io.github.amichne.slopsentral.gradle

import io.github.amichne.slopsentral.gradle.debug.DebugFailure
import io.github.amichne.slopsentral.gradle.debug.JavaDebugger
import io.github.amichne.slopsentral.gradle.debug.JdiDebuggerService
import io.github.amichne.slopsentral.gradle.discovery.WrapperGradleTaskDiscoverer
import io.github.amichne.slopsentral.gradle.domain.DebugAttachOutcome
import io.github.amichne.slopsentral.gradle.domain.DebugAttachment
import io.github.amichne.slopsentral.gradle.domain.DebugControl
import io.github.amichne.slopsentral.gradle.domain.DebugControlOutcome
import io.github.amichne.slopsentral.gradle.domain.DebugEndpoint
import io.github.amichne.slopsentral.gradle.domain.DebugStack
import io.github.amichne.slopsentral.gradle.domain.DebugThreadId
import io.github.amichne.slopsentral.gradle.domain.DebugThreads
import io.github.amichne.slopsentral.gradle.domain.DebugTimeout
import io.github.amichne.slopsentral.gradle.domain.GradleInvocation
import io.github.amichne.slopsentral.gradle.domain.GradleOperation
import io.github.amichne.slopsentral.gradle.domain.GradleProject
import io.github.amichne.slopsentral.gradle.domain.GradleTaskPath
import io.github.amichne.slopsentral.gradle.domain.Refinement
import io.github.amichne.slopsentral.gradle.domain.RunId
import io.github.amichne.slopsentral.gradle.domain.RunState
import io.github.amichne.slopsentral.gradle.domain.RunSummary
import io.github.amichne.slopsentral.gradle.domain.StackFrameLimit
import io.github.amichne.slopsentral.gradle.history.FileRunHistoryStore
import io.github.amichne.slopsentral.gradle.runtime.GradleExecutor
import io.github.amichne.slopsentral.gradle.runtime.GradleProcessEvents
import io.github.amichne.slopsentral.gradle.runtime.GradleProcessHandle
import io.github.amichne.slopsentral.gradle.runtime.GradleRunService
import io.github.amichne.slopsentral.gradle.runtime.RunIdSource
import io.github.amichne.slopsentral.gradle.runtime.RunStartFailure
import io.github.amichne.slopsentral.gradle.runtime.TimeSource
import io.github.amichne.slopsentral.gradle.wire.GradleToolDispatcher
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.boolean
import kotlinx.serialization.json.jsonArray
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import org.junit.jupiter.api.io.TempDir
import java.net.ServerSocket
import java.io.File
import java.nio.file.Files
import java.nio.file.Path
import java.time.Instant
import java.util.UUID
import java.util.concurrent.CompletableFuture
import java.util.concurrent.TimeUnit
import kotlin.io.path.createDirectories
import kotlin.io.path.writeText
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertIs
import kotlin.test.assertNotNull
import kotlin.test.assertTrue

private val followUpJson = Json { ignoreUnknownKeys = false }
private val followUpRunId = RunId(UUID.fromString("12345678-1234-4234-8234-123456789abc"))
private val secondFollowUpRunId = RunId(UUID.fromString("12345678-1234-4234-8234-123456789abd"))
private val followUpTime = Instant.parse("2026-08-26T16:00:00Z")

class GradleDynamicToolsFollowUpTest {
    @TempDir
    lateinit var repository: Path

    @Test
    fun `wrapper process discovers bounded task metadata from a multi-project build`() {
        createGradleFixture(repository)
        val dispatcher = GradleToolDispatcher(
            repository,
            GradleRunService(FollowUpManualExecutor()),
            discoverer = WrapperGradleTaskDiscoverer(),
        )

        val result = dispatcher.call(
            "gradle",
            "discover",
            followUpJson.parseToJsonElement("""{"type":"DISCOVER","limit":100}"""),
        )

        assertTrue(result.success, result.text)
        val discovery = followUpJson.parseToJsonElement(result.text).jsonObject
        val verify = discovery["tasks"]!!.jsonArray
            .map { it.jsonObject }
            .single { it.string("path") == ":app:verifyFixture" }
        assertEquals("verification", verify.string("group"))
        assertEquals("Verifies the discovery fixture.", verify.string("description"))
        assertEquals(":app", verify.string("projectPath"))
        assertFalse(discovery["truncated"]!!.jsonPrimitive.boolean)
    }

    @Test
    fun `file history enforces cross-host ownership and survives restart`() {
        createWrapper(repository)
        val store = FileRunHistoryStore(repository)
        val firstExecutor = FollowUpManualExecutor()
        val first = GradleRunService(
            executor = firstExecutor,
            runIds = RunIdSource { followUpRunId.value },
            time = TimeSource { followUpTime },
            history = store,
        )
        val project = GradleProject.admit(repository).accepted()
        val invocation = GradleInvocation.forOperation(
            project,
            GradleOperation.Tasks(listOf(GradleTaskPath.admit(":app:check").accepted())),
        )

        assertIs<Refinement.Accepted<*>>(first.start(invocation))
        val competing = GradleRunService(
            executor = FollowUpManualExecutor(),
            runIds = RunIdSource { secondFollowUpRunId.value },
            time = TimeSource { followUpTime },
            history = FileRunHistoryStore(repository),
        )
        val rejected = assertIs<Refinement.Rejected<RunStartFailure>>(competing.start(invocation))
        assertEquals(RunStartFailure.RUN_ALREADY_ACTIVE, rejected.failure)
        assertEquals(RunState.RUNNING, competing.readHistory(followUpRunId).accepted().state)

        firstExecutor.complete(0)
        first.close()
        competing.close()

        val restarted = GradleRunService(
            executor = FollowUpManualExecutor(),
            history = FileRunHistoryStore(repository),
        )
        val persisted = restarted.readHistory(followUpRunId).accepted()
        assertEquals(RunState.SUCCEEDED, persisted.state)
        assertEquals(0, persisted.exitCode)
        assertEquals(listOf("./gradlew", "--console=plain", "--stacktrace", ":app:check"), persisted.command)
        restarted.close()
    }

    @Test
    fun `released active history is projected as abandoned by a new host`() {
        createWrapper(repository)
        val store = FileRunHistoryStore(repository)
        val lease = store.acquire(followUpRunId).accepted()
        lease.write(
            RunSummary(
                runId = followUpRunId,
                state = RunState.RUNNING,
                command = listOf("./gradlew", "test", "--debug-jvm"),
                startedAt = followUpTime,
                finishedAt = null,
                exitCode = null,
                durationMillis = null,
                debugEndpoint = DebugEndpoint.GradleTest,
            ),
        ).accepted()
        lease.close()

        val restarted = GradleRunService(
            executor = FollowUpManualExecutor(),
            history = FileRunHistoryStore(repository),
        )
        assertEquals(RunState.ABANDONED, restarted.readHistory(followUpRunId).accepted().state)
        restarted.close()
    }

    @Test
    fun `dispatcher registers follow-up tools and debug launch is explicit`() {
        createWrapper(repository)
        val executor = FollowUpManualExecutor()
        val runs = GradleRunService(
            executor = executor,
            runIds = RunIdSource { followUpRunId.value },
            time = TimeSource { followUpTime },
        )
        val debugger = FollowUpDebugger()
        val dispatcher = GradleToolDispatcher(repository, runs, debugger = debugger)
        assertEquals(
            setOf("start", "observe", "cancel", "discover", "history", "debug"),
            dispatcher.schemas.all().map { it.name }.toSet(),
        )

        val started = dispatcher.call(
            "gradle",
            "start",
            followUpJson.parseToJsonElement(
                """{"type":"START","operation":{"type":"TESTS","task":"test","selectors":[{"type":"TEST_SELECTOR","pattern":"example.WidgetTest"}],"debug":{"type":"JDWP"}}}""",
            ),
        )

        assertTrue(started.success, started.text)
        assertTrue(executor.latestInvocation.arguments.contains("--debug-jvm"))
        val payload = followUpJson.parseToJsonElement(started.text).jsonObject
        val endpoint = payload["debugEndpoint"]!!.jsonObject
        assertEquals("127.0.0.1", endpoint.string("host"))
        assertEquals(5005, endpoint["port"]!!.jsonPrimitive.content.toInt())

        val attached = dispatcher.call(
            "gradle",
            "debug",
            followUpJson.parseToJsonElement(
                """{"type":"DEBUG","runId":"${followUpRunId.value}","operation":{"type":"ATTACH","timeoutMillis":5000}}""",
            ),
        )
        assertTrue(attached.success, attached.text)
        assertEquals(DebugEndpoint.GradleTest, debugger.attachedEndpoint)

        val history = dispatcher.call(
            "gradle",
            "history",
            followUpJson.parseToJsonElement("""{"type":"HISTORY","operation":{"type":"LIST","limit":10}}"""),
        )
        assertTrue(history.success, history.text)
        assertEquals(1, followUpJson.parseToJsonElement(history.text).jsonObject["runs"]!!.jsonArray.size)
        executor.complete(0)
        runs.close()
    }

    @Test
    fun `jdi attaches to a live debuggee and controls suspended frames`() {
        val port = ServerSocket(0).use { it.localPort }
        val javaExecutable = Path.of(System.getProperty("java.home"), "bin", "java").toString()
        val process = ProcessBuilder(
            javaExecutable,
            "-agentlib:jdwp=transport=dt_socket,server=y,suspend=y,address=127.0.0.1:$port",
            "-cp",
            listOf(
                Path.of(GradleDynamicToolsFollowUpTest::class.java.protectionDomain.codeSource.location.toURI()).toString(),
                System.getProperty("java.class.path"),
            ).joinToString(File.pathSeparator),
            "io.github.amichne.slopsentral.gradle.DebuggeeMainKt",
        ).redirectErrorStream(true).start()
        val output = process.inputReader()
        try {
            val listening = output.readLineWithin()
            assertTrue(listening.contains("Listening for transport dt_socket"), listening)

            JdiDebuggerService().use { debugger ->
                val attached = debugger.attach(
                    followUpRunId,
                    DebugEndpoint.loopback(port).accepted(),
                    DebugTimeout.admit(5_000).accepted(),
                ).accepted()
                assertEquals("ATTACHED", attached.outcome.name)
                assertTrue(debugger.threads(followUpRunId).accepted().threads.isNotEmpty())

                debugger.resume(followUpRunId).accepted()
                val ready = output.readLineWithin()
                assertEquals("READY", ready)
                debugger.pause(followUpRunId).accepted()

                val mainThread = debugger.threads(followUpRunId).accepted().threads.single { it.name == "main" }
                assertTrue(mainThread.suspended)
                val stack = debugger.stack(
                    followUpRunId,
                    DebugThreadId.admit(mainThread.id).accepted(),
                    StackFrameLimit.admit(32).accepted(),
                ).accepted()
                assertTrue(stack.frames.any { it.methodName == "main" }, stack.frames.toString())
                assertEquals("DETACHED", debugger.detach(followUpRunId).accepted().outcome.name)
            }
        } finally {
            process.destroyForcibly()
            process.waitFor(5, TimeUnit.SECONDS)
        }
    }
}

private class FollowUpManualExecutor : GradleExecutor {
    private lateinit var events: GradleProcessEvents
    lateinit var latestInvocation: GradleInvocation
        private set

    override fun start(invocation: GradleInvocation, events: GradleProcessEvents): GradleProcessHandle {
        latestInvocation = invocation
        this.events = events
        return GradleProcessHandle { }
    }

    fun complete(exitCode: Int) = events.completed(exitCode)
}

private class FollowUpDebugger : JavaDebugger {
    var attachedEndpoint: DebugEndpoint? = null
        private set

    override fun attach(
        runId: RunId,
        endpoint: DebugEndpoint,
        timeout: DebugTimeout,
    ): Refinement<DebugAttachment, DebugFailure> {
        attachedEndpoint = endpoint
        return Refinement.Accepted(DebugAttachment(runId, endpoint, DebugAttachOutcome.ATTACHED))
    }

    override fun threads(runId: RunId): Refinement<DebugThreads, DebugFailure> =
        Refinement.Rejected(DebugFailure.NOT_ATTACHED)

    override fun stack(
        runId: RunId,
        threadId: DebugThreadId,
        maximumFrames: StackFrameLimit,
    ): Refinement<DebugStack, DebugFailure> = Refinement.Rejected(DebugFailure.NOT_ATTACHED)

    override fun pause(runId: RunId): Refinement<DebugControl, DebugFailure> =
        Refinement.Rejected(DebugFailure.NOT_ATTACHED)

    override fun resume(runId: RunId): Refinement<DebugControl, DebugFailure> =
        Refinement.Rejected(DebugFailure.NOT_ATTACHED)

    override fun detach(runId: RunId): Refinement<DebugControl, DebugFailure> =
        Refinement.Accepted(DebugControl(runId, DebugControlOutcome.DETACHED))

    override fun close() = Unit
}

private fun createWrapper(repository: Path) {
    repository.resolve("gradlew").writeText("#!/bin/sh\nexit 0\n")
    repository.resolve("gradlew").toFile().setExecutable(true)
}

private fun createGradleFixture(repository: Path) {
    val toolRoot = Path.of(GradleDynamicToolsFollowUpTest::class.java.protectionDomain.codeSource.location.toURI())
        .let { testClasses -> testClasses.parent.parent.parent.parent }
    repository.resolve("gradle/wrapper").createDirectories()
    Files.copy(toolRoot.resolve("gradlew"), repository.resolve("gradlew"))
    repository.resolve("gradlew").toFile().setExecutable(true)
    Files.copy(
        toolRoot.resolve("gradle/wrapper/gradle-wrapper.jar"),
        repository.resolve("gradle/wrapper/gradle-wrapper.jar"),
    )
    Files.copy(
        toolRoot.resolve("gradle/wrapper/gradle-wrapper.properties"),
        repository.resolve("gradle/wrapper/gradle-wrapper.properties"),
    )
    repository.resolve("settings.gradle.kts").writeText("rootProject.name = \"fixture\"\ninclude(\":app\")\n")
    repository.resolve("app").createDirectories()
    repository.resolve("app/build.gradle.kts").writeText(
        """
            tasks.register("verifyFixture") {
                group = "verification"
                description = "Verifies the discovery fixture."
            }
        """.trimIndent() + "\n",
    )
}

private fun java.io.BufferedReader.readLineWithin(): String = assertNotNull(
    CompletableFuture.supplyAsync(::readLine).get(5, TimeUnit.SECONDS),
)

private fun <Value, Failure> Refinement<Value, Failure>.accepted(): Value =
    assertIs<Refinement.Accepted<Value>>(this).value

private fun kotlinx.serialization.json.JsonObject.string(name: String): String =
    this[name]!!.jsonPrimitive.content
