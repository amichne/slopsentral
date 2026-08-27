package io.github.amichne.slopsentral.gradle

import io.github.amichne.slopsentral.gradle.appserver.CodexAppServerClient
import io.github.amichne.slopsentral.gradle.appserver.CodexTurnOutcome
import io.github.amichne.slopsentral.gradle.appserver.JsonLineTransport
import io.github.amichne.slopsentral.gradle.domain.GradleInvocation
import io.github.amichne.slopsentral.gradle.domain.GradleProject
import io.github.amichne.slopsentral.gradle.domain.Refinement
import io.github.amichne.slopsentral.gradle.runtime.GradleExecutor
import io.github.amichne.slopsentral.gradle.runtime.GradleProcessEvents
import io.github.amichne.slopsentral.gradle.runtime.GradleProcessHandle
import io.github.amichne.slopsentral.gradle.runtime.GradleRunService
import io.github.amichne.slopsentral.gradle.runtime.RunIdSource
import io.github.amichne.slopsentral.gradle.runtime.SystemGradleExecutor
import io.github.amichne.slopsentral.gradle.runtime.TimeSource
import io.github.amichne.slopsentral.gradle.wire.GradleToolDispatcher
import io.github.amichne.slopsentral.gradle.wire.GradleToolWireClient
import io.github.amichne.slopsentral.gradle.wire.GradleToolWireServer
import io.github.amichne.slopsentral.gradle.wire.LoopbackBinding
import io.github.amichne.slopsentral.gradle.wire.WireConnectionFailure
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.boolean
import kotlinx.serialization.json.jsonArray
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import org.junit.jupiter.api.io.TempDir
import java.nio.file.Path
import java.nio.file.Files
import java.time.Instant
import java.util.UUID
import kotlin.io.path.writeText
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertIs
import kotlin.test.assertTrue

private val testJson = Json { ignoreUnknownKeys = false }
private val firstRunId = UUID.fromString("abcdefab-cdef-4abc-8def-abcdefabcdef")
private val secondRunId = UUID.fromString("abcdefab-cdef-4abc-8def-abcdefabcdee")

class GradleDynamicToolsTest {
    @TempDir
    lateinit var repository: Path

    @Test
    fun `start and observe preserve command output and build failure as data`() {
        val executor = ManualGradleExecutor()
        val dispatcher = dispatcher(executor)

        val started = dispatcher.call(
            namespace = "gradle",
            tool = "start",
            arguments = testJson.parseToJsonElement(
                """{"type":"START","operation":{"type":"TESTS","task":":app:test","selectors":[{"type":"TEST_SELECTOR","pattern":"example.WidgetTest.creates"}]}}""",
            ),
        )

        assertTrue(started.success)
        assertEquals("GRADLE_STARTED", started.payload().string("type"))
        assertEquals(firstRunId.toString(), started.payload().string("runId"))
        assertEquals(
            listOf(
                "--console=plain",
                "--stacktrace",
                ":app:test",
                "--tests",
                "example.WidgetTest.creates",
            ),
            executor.latestInvocation.arguments,
        )
        assertEquals(repository.resolve("gradlew").toRealPath(), executor.latestInvocation.executable)

        executor.output("WidgetTest > creates FAILED")
        executor.complete(exitCode = 1)

        val observed = dispatcher.call(
            namespace = "gradle",
            tool = "observe",
            arguments = testJson.parseToJsonElement(
                """{"type":"OBSERVE","runId":"$firstRunId","after":0,"waitMillis":0}""",
            ),
        )

        assertTrue(observed.success, observed.text)
        assertEquals("FAILED", observed.payload().string("state"))
        assertEquals(1, observed.payload()["exitCode"]?.jsonPrimitive?.content?.toInt())
        assertEquals(
            "WidgetTest > creates FAILED",
            observed.payload()["events"]!!.jsonArray.single().jsonObject.string("text"),
        )
        assertEquals(1L, observed.payload()["nextCursor"]!!.jsonPrimitive.content.toLong())
    }

    @Test
    fun `one active run is enforced and cancellation is idempotent`() {
        val executor = ManualGradleExecutor()
        val dispatcher = dispatcher(executor)
        val startArguments = testJson.parseToJsonElement(
            """{"type":"START","operation":{"type":"TASKS","tasks":[":app:check"]}}""",
        )

        assertTrue(dispatcher.call("gradle", "start", startArguments).success)

        val secondStart = dispatcher.call("gradle", "start", startArguments)
        assertFalse(secondStart.success)
        assertEquals("RUN_ALREADY_ACTIVE", secondStart.payload().string("code"))

        val cancelArguments = testJson.parseToJsonElement(
            """{"type":"CANCEL","runId":"$firstRunId"}""",
        )
        val firstCancel = dispatcher.call("gradle", "cancel", cancelArguments)
        val secondCancel = dispatcher.call("gradle", "cancel", cancelArguments)

        assertEquals("REQUESTED", firstCancel.payload().string("outcome"))
        assertEquals("ALREADY_REQUESTED", secondCancel.payload().string("outcome"))
        assertEquals(1, executor.cancelCount)

        executor.complete(exitCode = 143)
        val observation = dispatcher.call(
            "gradle",
            "observe",
            testJson.parseToJsonElement(
                """{"type":"OBSERVE","runId":"$firstRunId","after":0,"waitMillis":0}""",
            ),
        )
        assertEquals("CANCELLED", observation.payload().string("state"))

        val restarted = dispatcher.call("gradle", "start", startArguments)
        assertTrue(restarted.success)
        assertEquals(secondRunId.toString(), restarted.payload().string("runId"))
    }

    @Test
    fun `unknown input fields fail closed before process execution`() {
        val executor = ManualGradleExecutor()
        val dispatcher = dispatcher(executor)

        val rejected = dispatcher.call(
            "gradle",
            "start",
            testJson.parseToJsonElement(
                """{"type":"START","operation":{"type":"TASKS","tasks":[":app:test"],"shell":"ignored"}}""",
            ),
        )

        assertFalse(rejected.success)
        assertEquals("INVALID_ARGUMENTS", rejected.payload().string("code"))
        assertEquals(0, executor.startCount)

        val nonCanonicalRunId = dispatcher.call(
            "gradle",
            "observe",
            testJson.parseToJsonElement(
                """{"type":"OBSERVE","runId":"${firstRunId.toString().uppercase()}","after":0,"waitMillis":0}""",
            ),
        )
        assertFalse(nonCanonicalRunId.success)
        assertEquals("INVALID_ARGUMENTS", nonCanonicalRunId.payload().string("code"))
    }

    @Test
    fun `system executor captures wrapper output and nonzero exit without a shell`() {
        val wrapper = repository.resolve("gradlew")
        wrapper.writeText(
            """
                #!/bin/sh
                printf 'ARGS:%s\n' "${'$'}*"
                printf 'synthetic failure\n'
                exit 7
            """.trimIndent() + "\n",
        )
        wrapper.toFile().setExecutable(true)
        GradleRunService(
            executor = SystemGradleExecutor(),
            runIds = RunIdSource { firstRunId },
            time = TimeSource(Instant::now),
        ).use { runs ->
            val dispatcher = GradleToolDispatcher(repository, runs)
            val started = dispatcher.call(
                "gradle",
                "start",
                testJson.parseToJsonElement(
                    """{"type":"START","operation":{"type":"TASKS","tasks":["verify"]}}""",
                ),
            )
            assertTrue(started.success, started.text)

            var cursor = 0L
            val output = mutableListOf<String>()
            var terminal: JsonObject? = null
            repeat(10) {
                val observed = dispatcher.call(
                    "gradle",
                    "observe",
                    testJson.parseToJsonElement(
                        """{"type":"OBSERVE","runId":"$firstRunId","after":$cursor,"waitMillis":1000}""",
                    ),
                )
                assertTrue(observed.success, observed.text)
                val payload = observed.payload()
                output += payload["events"]!!.jsonArray.map { it.jsonObject.string("text") }
                cursor = payload["nextCursor"]!!.jsonPrimitive.content.toLong()
                if (payload.string("state") == "FAILED") terminal = payload
                if (terminal != null) return@repeat
            }

            assertEquals(7, terminal?.get("exitCode")?.jsonPrimitive?.content?.toInt())
            assertTrue(output.contains("ARGS:--console=plain --stacktrace verify"), output.toString())
            assertTrue(output.contains("synthetic failure"), output.toString())
        }
    }

    @Test
    fun `app server client registers schemas and answers a live dynamic call`() {
        val executor = ManualGradleExecutor()
        val dispatcher = dispatcher(executor)
        val project = admittedProject(repository)
        val transport = ScriptedTransport(
            """{"id":1,"result":{"userAgent":"test"}}""",
            """{"id":2,"result":{"thread":{"id":"thread-1"},"model":"gpt-test"}}""",
            """{"id":3,"result":{"turn":{"id":"turn-1"}}}""",
            """{"id":"tool-request-1","method":"item/tool/call","params":{"threadId":"thread-1","turnId":"turn-1","callId":"call-1","namespace":"gradle","tool":"start","arguments":{"type":"START","operation":{"type":"TASKS","tasks":[":app:test"]}}}}""",
            """{"method":"item/completed","params":{"threadId":"thread-1","turnId":"turn-1","item":{"type":"agentMessage","text":"Gradle run started."}}}""",
            """{"method":"turn/completed","params":{"threadId":"thread-1","turn":{"id":"turn-1","status":"completed"}}}""",
        )

        val server = assertIs<Refinement.Accepted<GradleToolWireServer>>(
            GradleToolWireServer.start(LoopbackBinding.ephemeral(), project, dispatcher),
        ).value
        val outcome = server.use {
            assertIs<Refinement.Accepted<GradleToolWireClient>>(
                GradleToolWireClient.connect(server.endpoint, project),
            ).value.use { remoteTools ->
                CodexAppServerClient(transport, remoteTools).run(
                    repository = repository,
                    prompt = "Run :app:test and report the result.",
                    model = null,
                )
            }
        }

        val result = assertIs<CodexTurnOutcome.Completed>(outcome)
        assertEquals("Gradle run started.", result.finalAnswer)
        assertEquals(1, executor.startCount)
        assertTrue(dispatcher.schemas.contractSha256.matches(Regex("[0-9a-f]{64}")))
        val threadStart = transport.sent
            .map(testJson::parseToJsonElement)
            .map { it.jsonObject }
            .single { it["method"]?.jsonPrimitive?.content == "thread/start" }
        val namespace = threadStart["params"]!!.jsonObject["dynamicTools"]!!
            .jsonArray.single().jsonObject
        assertEquals("gradle", namespace.string("name"))
        assertEquals(
            setOf("start", "observe", "cancel", "discover", "history", "debug"),
            namespace["tools"]!!.jsonArray.map { it.jsonObject.string("name") }.toSet(),
        )
        namespace["tools"]!!.jsonArray.forEach { tool ->
            assertEquals(false, tool.jsonObject["deferLoading"]!!.jsonPrimitive.boolean)
            assertEquals(false, tool.jsonObject["inputSchema"]!!.jsonObject["additionalProperties"]!!.jsonPrimitive.boolean)
        }
        val toolResponse = transport.sent
            .map(testJson::parseToJsonElement)
            .map { it.jsonObject }
            .single { it["id"]?.jsonPrimitive?.content == "tool-request-1" }
        assertTrue(toolResponse["result"]!!.jsonObject["success"]!!.jsonPrimitive.boolean)
        executor.complete(exitCode = 0)
    }

    @Test
    fun `wire server preserves a run across independently admitted clients`() {
        val executor = ManualGradleExecutor()
        val dispatcher = dispatcher(executor)
        val project = admittedProject(repository)
        val otherRepository = repository.resolve("other-repository")
        Files.createDirectories(otherRepository)
        otherRepository.resolve("gradlew").writeText("#!/bin/sh\nexit 0\n")
        otherRepository.resolve("gradlew").toFile().setExecutable(true)
        val otherProject = admittedProject(otherRepository)
        val server = assertIs<Refinement.Accepted<GradleToolWireServer>>(
            GradleToolWireServer.start(
                binding = LoopbackBinding.ephemeral(),
                project = project,
                tools = dispatcher,
            ),
        ).value

        server.use {
            val mismatch = GradleToolWireClient.connect(server.endpoint, otherProject)
            assertEquals(
                WireConnectionFailure.REPOSITORY_MISMATCH,
                assertIs<Refinement.Rejected<WireConnectionFailure>>(mismatch).failure,
            )
            assertEquals(0, executor.startCount)

            val started = assertIs<Refinement.Accepted<GradleToolWireClient>>(
                GradleToolWireClient.connect(server.endpoint, project),
            ).value.use { firstClient ->
                firstClient.call(
                    "gradle",
                    "start",
                    testJson.parseToJsonElement(
                        """{"type":"START","operation":{"type":"TASKS","tasks":[":app:test"]}}""",
                    ),
                )
            }
            assertTrue(started.success, started.text)
            executor.output("persistent output")

            val observed = assertIs<Refinement.Accepted<GradleToolWireClient>>(
                GradleToolWireClient.connect(server.endpoint, project),
            ).value.use { secondClient ->
                secondClient.call(
                    "gradle",
                    "observe",
                    testJson.parseToJsonElement(
                        """{"type":"OBSERVE","runId":"$firstRunId","after":0,"waitMillis":0}""",
                    ),
                )
            }

            assertTrue(observed.success, observed.text)
            assertEquals(
                "persistent output",
                observed.payload()["events"]!!.jsonArray.single().jsonObject.string("text"),
            )
            assertEquals(1, executor.startCount)
            executor.complete(exitCode = 0)
        }
    }

    private fun dispatcher(executor: ManualGradleExecutor): GradleToolDispatcher {
        val wrapper = repository.resolve("gradlew")
        wrapper.writeText("#!/bin/sh\nexit 0\n")
        wrapper.toFile().setExecutable(true)
        val ids = ArrayDeque(listOf(firstRunId, secondRunId))
        val service = GradleRunService(
            executor = executor,
            runIds = RunIdSource { ids.removeFirst() },
            time = TimeSource { Instant.parse("2026-08-26T12:00:00Z") },
        )
        return GradleToolDispatcher(repository, service)
    }

    private fun admittedProject(root: Path): GradleProject =
        assertIs<Refinement.Accepted<GradleProject>>(GradleProject.admit(root)).value
}

private class ManualGradleExecutor : GradleExecutor {
    private lateinit var events: GradleProcessEvents
    lateinit var latestInvocation: GradleInvocation
        private set
    var startCount: Int = 0
        private set
    var cancelCount: Int = 0
        private set

    override fun start(invocation: GradleInvocation, events: GradleProcessEvents): GradleProcessHandle {
        latestInvocation = invocation
        this.events = events
        startCount += 1
        return GradleProcessHandle { cancelCount += 1 }
    }

    fun output(text: String) = events.output(text)

    fun complete(exitCode: Int) = events.completed(exitCode)
}

private class ScriptedTransport(vararg incoming: String) : JsonLineTransport {
    private val incoming = ArrayDeque(incoming.toList())
    val sent = mutableListOf<String>()

    override fun send(line: String) {
        sent += line
    }

    override fun receive(): String = incoming.removeFirst()

    override fun close() = Unit
}

private fun io.github.amichne.slopsentral.gradle.wire.DynamicToolResult.payload(): JsonObject =
    testJson.parseToJsonElement(text).jsonObject

private fun JsonObject.string(name: String): String = this[name]!!.jsonPrimitive.content
