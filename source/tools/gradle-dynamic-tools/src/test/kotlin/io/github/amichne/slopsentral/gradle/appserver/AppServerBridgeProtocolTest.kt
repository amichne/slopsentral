package io.github.amichne.slopsentral.gradle.appserver

import io.github.amichne.slopsentral.gradle.domain.GradleProject
import io.github.amichne.slopsentral.gradle.domain.Refinement
import io.github.amichne.slopsentral.gradle.wire.DynamicToolCaller
import io.github.amichne.slopsentral.gradle.wire.DynamicToolResult
import io.github.amichne.slopsentral.gradle.wire.LoopbackEndpoint
import io.github.amichne.slopsentral.gradle.wire.LoopbackBinding
import io.github.amichne.slopsentral.gradle.wire.ToolSchemaCatalog
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.boolean
import kotlinx.serialization.json.jsonArray
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import org.junit.jupiter.api.io.TempDir
import java.net.InetAddress
import java.net.ServerSocket
import java.nio.file.Path
import kotlin.io.path.writeText
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertIs
import kotlin.test.assertTrue

private val bridgeTestJson = Json

class AppServerBridgeProtocolTest {
    @TempDir
    lateinit var repository: Path

    @Test
    fun `bridge injects tools executes Gradle calls and preserves unrelated traffic`() {
        val tools = RecordingDynamicToolCaller()
        val bridge = AppServerBridgeProtocol(tools)

        val initialized = assertIs<ClientBridgeRouting.ForwardUpstream>(
            bridge.fromClient(
                """{"id":1,"method":"initialize","params":{"clientInfo":{"name":"codex-tui","version":"0.149.1"},"capabilities":{"requestAttestation":true}}}""",
            ),
        )
        val initializeParams = initialized.message.jsonObject()["params"]!!.jsonObject
        assertTrue(
            initializeParams["capabilities"]!!.jsonObject["experimentalApi"]!!.jsonPrimitive.boolean,
        )
        assertTrue(
            initializeParams["capabilities"]!!.jsonObject["requestAttestation"]!!.jsonPrimitive.boolean,
        )

        val started = assertIs<ClientBridgeRouting.ForwardUpstream>(
            bridge.fromClient(
                """{"id":2,"method":"thread/start","params":{"cwd":"/work","approvalPolicy":"never","sandbox":"read-only","experimentalRawEvents":false}}""",
            ),
        )
        val dynamicTools = started.message.jsonObject()["params"]!!.jsonObject["dynamicTools"]!!.jsonArray
        val namespace = dynamicTools.single().jsonObject
        assertEquals("gradle", namespace["name"]!!.jsonPrimitive.content)
        assertEquals(
            setOf("start", "observe", "cancel", "discover", "history", "debug"),
            namespace["tools"]!!.jsonArray.map { it.jsonObject["name"]!!.jsonPrimitive.content }.toSet(),
        )

        val call = assertIs<ServerBridgeRouting.ReplyUpstream>(
            bridge.fromServer(
                """{"id":"tool-1","method":"item/tool/call","params":{"threadId":"thread-1","turnId":"turn-1","callId":"call-1","namespace":"gradle","tool":"history","arguments":{"type":"HISTORY_LIST","limit":3}}}""",
            ),
        )
        assertEquals("history", tools.calls.single().tool)
        assertEquals("gradle", tools.calls.single().namespace)
        val callResponse = call.message.jsonObject()
        assertEquals("tool-1", callResponse["id"]!!.jsonPrimitive.content)
        assertTrue(callResponse["result"]!!.jsonObject["success"]!!.jsonPrimitive.boolean)

        val notification = """{"method":"turn/completed","params":{"threadId":"thread-1"}}"""
        assertEquals(
            notification,
            assertIs<ServerBridgeRouting.ForwardDownstream>(bridge.fromServer(notification)).message,
        )
    }

    @Test
    fun `bridge fails closed when the client already defines the Gradle namespace`() {
        val bridge = AppServerBridgeProtocol(RecordingDynamicToolCaller())

        val rejection = assertIs<ClientBridgeRouting.ReplyDownstream>(
            bridge.fromClient(
                """{"id":17,"method":"thread/start","params":{"dynamicTools":[{"type":"namespace","name":"gradle","description":"other","tools":[]}]}}""",
            ),
        )

        val response = rejection.message.jsonObject()
        assertEquals(17, response["id"]!!.jsonPrimitive.content.toInt())
        assertEquals(
            "DYNAMIC_TOOL_NAMESPACE_CONFLICT",
            response["error"]!!.jsonObject["data"]!!.jsonObject["failure"]!!.jsonPrimitive.content,
        )
    }

    @Test
    fun `bridge reports a finite failure when its loopback port is occupied`() {
        repository.resolve("gradlew").writeText("#!/bin/sh\nexit 0\n")
        repository.resolve("gradlew").toFile().setExecutable(true)
        val project = assertIs<Refinement.Accepted<GradleProject>>(GradleProject.admit(repository)).value

        ServerSocket(0, 1, InetAddress.getLoopbackAddress()).use { occupied ->
            val endpoint = assertIs<Refinement.Accepted<LoopbackEndpoint>>(
                LoopbackEndpoint.admit("127.0.0.1:${occupied.localPort}"),
            ).value

            assertEquals(
                AppServerBridgeStartFailure.BIND_FAILED,
                assertIs<Refinement.Rejected<AppServerBridgeStartFailure>>(
                    CodexAppServerBridge(
                        assertIs<Refinement.Accepted<LoopbackBinding>>(
                            LoopbackBinding.admit(endpoint.toString()),
                        ).value,
                        project,
                        endpoint,
                    ).run {
                        error("An occupied endpoint must not become ready.")
                    },
                ).failure,
            )
        }
    }
}

private data class RecordedDynamicToolCall(
    val namespace: String?,
    val tool: String,
    val arguments: JsonElement,
)

private class RecordingDynamicToolCaller : DynamicToolCaller {
    override val schemas = ToolSchemaCatalog.bundled()
    val calls = mutableListOf<RecordedDynamicToolCall>()

    override fun call(namespace: String?, tool: String, arguments: JsonElement): DynamicToolResult {
        calls += RecordedDynamicToolCall(namespace, tool, arguments)
        return DynamicToolResult(success = true, text = "{\"type\":\"HISTORY\",\"runs\":[]}")
    }
}

private fun String.jsonObject() = bridgeTestJson.parseToJsonElement(this).jsonObject
