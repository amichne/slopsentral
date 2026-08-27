@file:OptIn(kotlinx.serialization.ExperimentalSerializationApi::class)

package io.github.amichne.slopsentral.gradle.appserver

import io.github.amichne.slopsentral.gradle.domain.Refinement
import io.github.amichne.slopsentral.gradle.wire.DynamicToolCaller
import io.github.amichne.slopsentral.gradle.wire.DynamicToolResult
import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable
import kotlinx.serialization.SerializationException
import kotlinx.serialization.decodeFromString
import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.decodeFromJsonElement
import kotlinx.serialization.json.encodeToJsonElement
import java.io.BufferedReader
import java.io.BufferedWriter
import java.io.IOException
import java.nio.charset.StandardCharsets
import java.nio.file.Path
import java.util.concurrent.atomic.AtomicBoolean

private const val INITIALIZE_REQUEST_ID = 1L
private const val THREAD_START_REQUEST_ID = 2L
private const val TURN_START_REQUEST_ID = 3L

interface JsonLineTransport : AutoCloseable {
    fun send(line: String)

    fun receive(): String
}

enum class AppServerFailureCode {
    TRANSPORT_FAILURE,
    MALFORMED_MESSAGE,
    SERVER_REJECTED_REQUEST,
    UNEXPECTED_RESPONSE,
    TURN_NOT_COMPLETED,
}

data class AppServerFailure(
    val code: AppServerFailureCode,
    val message: String,
)

sealed interface CodexTurnOutcome {
    data class Completed(
        val finalAnswer: String,
        val threadId: String,
        val turnId: String,
        val model: String,
    ) : CodexTurnOutcome

    data class Rejected(val failure: AppServerFailure) : CodexTurnOutcome
}

class CodexAppServerClient(
    private val transport: JsonLineTransport,
    private val tools: DynamicToolCaller,
) {
    fun run(
        repository: Path,
        prompt: String,
        model: String?,
    ): CodexTurnOutcome = try {
        runProtocol(repository, prompt, model)
    } catch (_: IOException) {
        CodexTurnOutcome.Rejected(
            AppServerFailure(AppServerFailureCode.TRANSPORT_FAILURE, "Codex app-server transport failed."),
        )
    } catch (_: SerializationException) {
        CodexTurnOutcome.Rejected(
            AppServerFailure(AppServerFailureCode.MALFORMED_MESSAGE, "Codex app-server returned malformed JSON."),
        )
    } catch (_: IllegalArgumentException) {
        CodexTurnOutcome.Rejected(
            AppServerFailure(AppServerFailureCode.MALFORMED_MESSAGE, "Codex app-server returned an invalid document."),
        )
    }

    private fun runProtocol(repository: Path, prompt: String, model: String?): CodexTurnOutcome {
        sendRequest(
            INITIALIZE_REQUEST_ID,
            "initialize",
            InitializeParamsDocument(
                clientInfo = ClientInfoDocument(
                    name = "gradle-dynamic-tools",
                    title = "Gradle dynamic tools POC",
                    version = "0.2.0",
                ),
                capabilities = InitializeCapabilitiesDocument(
                    experimentalApi = true,
                    requestAttestation = false,
                ),
            ),
        )
        when (val initialized = awaitResult(INITIALIZE_REQUEST_ID)) {
            is AwaitedResult.Accepted -> Unit
            is AwaitedResult.Rejected -> return CodexTurnOutcome.Rejected(initialized.failure)
        }
        transport.send(appServerJson.encodeToString(RpcNotificationDocument("initialized")))

        sendRequest(
            THREAD_START_REQUEST_ID,
            "thread/start",
            ThreadStartParamsDocument(
                cwd = repository.toAbsolutePath().normalize().toString(),
                approvalPolicy = "never",
                sandbox = AppServerSandboxModeDocument.READ_ONLY,
                ephemeral = true,
                experimentalRawEvents = false,
                dynamicTools = listOf(tools.dynamicToolNamespace()),
                model = model,
            ),
        )
        val threadResult = when (val started = awaitResult(THREAD_START_REQUEST_ID)) {
            is AwaitedResult.Accepted -> appServerJson.decodeFromJsonElement<ThreadStartResultDocument>(started.result)
            is AwaitedResult.Rejected -> return CodexTurnOutcome.Rejected(started.failure)
        }

        sendRequest(
            TURN_START_REQUEST_ID,
            "turn/start",
            TurnStartParamsDocument(
                threadId = threadResult.thread.id,
                input = listOf(TextUserInputDocument(type = "text", text = prompt, textElements = emptyList())),
            ),
        )
        val turnResult = when (val started = awaitResult(TURN_START_REQUEST_ID)) {
            is AwaitedResult.Accepted -> appServerJson.decodeFromJsonElement<TurnStartResultDocument>(started.result)
            is AwaitedResult.Rejected -> return CodexTurnOutcome.Rejected(started.failure)
        }

        var finalAnswer = ""
        while (true) {
            val incoming = appServerJson.decodeFromString<RpcIncomingDocument>(transport.receive())
            when (incoming.method) {
                "item/tool/call" -> handleToolCall(incoming, threadResult.thread.id, turnResult.turn.id)
                "item/started", "item/completed" -> {
                    val item = incoming.params?.let { appServerJson.decodeFromJsonElement<ItemParamsDocument>(it) }
                    if (item?.threadId == threadResult.thread.id && item.turnId == turnResult.turn.id) {
                        val observed = appServerJson.decodeFromJsonElement<ObservedItemDocument>(item.item)
                        if (observed.type == "agentMessage" && !observed.text.isNullOrBlank()) {
                            finalAnswer = observed.text
                        }
                    }
                }
                "turn/completed" -> {
                    val completion = incoming.params?.let {
                        appServerJson.decodeFromJsonElement<TurnCompletedParamsDocument>(it)
                    } ?: return CodexTurnOutcome.Rejected(
                        AppServerFailure(
                            AppServerFailureCode.MALFORMED_MESSAGE,
                            "turn/completed omitted params.",
                        ),
                    )
                    if (
                        completion.threadId != threadResult.thread.id ||
                        completion.turn.id != turnResult.turn.id ||
                        completion.turn.status != "completed"
                    ) {
                        return CodexTurnOutcome.Rejected(
                            AppServerFailure(
                                AppServerFailureCode.TURN_NOT_COMPLETED,
                                "Codex turn did not complete successfully.",
                            ),
                        )
                    }
                    return CodexTurnOutcome.Completed(
                        finalAnswer = finalAnswer,
                        threadId = threadResult.thread.id,
                        turnId = turnResult.turn.id,
                        model = threadResult.model,
                    )
                }
            }
        }
    }

    private fun handleToolCall(incoming: RpcIncomingDocument, threadId: String, turnId: String) {
        val requestId = requireNotNull(incoming.id)
        val call = requireNotNull(incoming.params).let {
            appServerJson.decodeFromJsonElement<DynamicToolCallParamsDocument>(it)
        }
        val result = if (call.threadId == threadId && call.turnId == turnId) {
            tools.call(call.namespace, call.tool, call.arguments)
        } else {
            DynamicToolResult(
                success = false,
                text = """{"type":"TOOL_FAILURE","code":"WRONG_TURN","message":"Tool call belongs to another turn."}""",
            )
        }
        transport.send(
            appServerJson.encodeToString(
                RpcResponseDocument(
                    id = requestId,
                    result = DynamicToolCallResponseDocument(
                        contentItems = listOf(DynamicToolOutputTextDocument(type = "inputText", text = result.text)),
                        success = result.success,
                    ),
                ),
            ),
        )
    }

    private inline fun <reified Params> sendRequest(id: Long, method: String, params: Params) {
        transport.send(
            appServerJson.encodeToString(
                RpcRequestDocument(
                    id = id,
                    method = method,
                    params = appServerJson.encodeToJsonElement(params),
                ),
            ),
        )
    }

    private fun awaitResult(id: Long): AwaitedResult {
        while (true) {
            val incoming = appServerJson.decodeFromString<RpcIncomingDocument>(transport.receive())
            if (incoming.id?.toString() != id.toString()) continue
            if (incoming.error != null) {
                return AwaitedResult.Rejected(
                    AppServerFailure(
                        AppServerFailureCode.SERVER_REJECTED_REQUEST,
                        "Codex app-server rejected request $id.",
                    ),
                )
            }
            return incoming.result?.let(AwaitedResult::Accepted)
                ?: AwaitedResult.Rejected(
                    AppServerFailure(
                        AppServerFailureCode.UNEXPECTED_RESPONSE,
                        "Codex app-server response $id omitted result.",
                    ),
                )
        }
    }

}

private sealed interface AwaitedResult {
    data class Accepted(val result: JsonElement) : AwaitedResult

    data class Rejected(val failure: AppServerFailure) : AwaitedResult
}

@Serializable
private data class RpcRequestDocument(
    val id: Long,
    val method: String,
    val params: JsonElement,
)

@Serializable
private data class RpcNotificationDocument(val method: String)

@Serializable
private data class RpcResponseDocument(
    val id: JsonElement,
    val result: DynamicToolCallResponseDocument,
)

@Serializable
private data class RpcIncomingDocument(
    val id: JsonElement? = null,
    val method: String? = null,
    val params: JsonElement? = null,
    val result: JsonElement? = null,
    val error: JsonElement? = null,
)

@Serializable
private data class InitializeParamsDocument(
    val clientInfo: ClientInfoDocument,
    val capabilities: InitializeCapabilitiesDocument,
)

@Serializable
private data class ClientInfoDocument(
    val name: String,
    val title: String,
    val version: String,
)

@Serializable
private data class InitializeCapabilitiesDocument(
    val experimentalApi: Boolean,
    val requestAttestation: Boolean,
)

@Serializable
private data class ThreadStartParamsDocument(
    val cwd: String,
    val approvalPolicy: String,
    val sandbox: AppServerSandboxModeDocument,
    val ephemeral: Boolean,
    val experimentalRawEvents: Boolean,
    val dynamicTools: List<DynamicToolNamespaceDocument>,
    val model: String? = null,
)

@Serializable
private enum class AppServerSandboxModeDocument {
    @SerialName("read-only")
    READ_ONLY,
}

@Serializable
private data class ThreadStartResultDocument(
    val thread: IdentityDocument,
    val model: String,
)

@Serializable
private data class TurnStartResultDocument(val turn: IdentityDocument)

@Serializable
private data class IdentityDocument(val id: String)

@Serializable
private data class TurnStartParamsDocument(
    val threadId: String,
    val input: List<TextUserInputDocument>,
)

@Serializable
private data class TextUserInputDocument(
    val type: String,
    val text: String,
    @SerialName("text_elements") val textElements: List<JsonElement>,
)

@Serializable
private data class ItemParamsDocument(
    val item: JsonElement,
    val threadId: String,
    val turnId: String,
)

@Serializable
private data class ObservedItemDocument(
    val type: String,
    val text: String? = null,
)

@Serializable
private data class TurnCompletedParamsDocument(
    val threadId: String,
    val turn: TurnCompletionDocument,
)

@Serializable
private data class TurnCompletionDocument(
    val id: String,
    val status: String,
)

enum class AppServerProcessFailure {
    CODEX_NOT_STARTED,
}

class ProcessJsonLineTransport private constructor(
    private val process: Process,
    private val reader: BufferedReader,
    private val writer: BufferedWriter,
) : JsonLineTransport {
    private val closed = AtomicBoolean(false)

    @Synchronized
    override fun send(line: String) {
        writer.write(line)
        writer.newLine()
        writer.flush()
    }

    override fun receive(): String = reader.readLine() ?: throw IOException("app-server stdout closed")

    override fun close() {
        if (!closed.compareAndSet(false, true)) return
        try {
            writer.close()
        } finally {
            try {
                reader.close()
            } finally {
                process.destroy()
            }
        }
    }

    companion object {
        fun start(repository: Path): Refinement<ProcessJsonLineTransport, AppServerProcessFailure> =
            start(repository, disableShellTool = true)

        fun startForBridge(repository: Path): Refinement<ProcessJsonLineTransport, AppServerProcessFailure> =
            start(repository, disableShellTool = false)

        private fun start(
            repository: Path,
            disableShellTool: Boolean,
        ): Refinement<ProcessJsonLineTransport, AppServerProcessFailure> = try {
            val command = buildList {
                add("codex")
                add("app-server")
                if (disableShellTool) {
                    add("--disable")
                    add("shell_tool")
                }
                add("--stdio")
            }
            val process = ProcessBuilder(command).directory(repository.toFile()).start()
            Thread.ofPlatform()
                .daemon(true)
                .name("gradle-dynamic-tools-app-server-stderr")
                .start {
                    process.errorReader(StandardCharsets.UTF_8).useLines { lines ->
                        lines.forEach(System.err::println)
                    }
                }
            Refinement.Accepted(
                ProcessJsonLineTransport(
                    process = process,
                    reader = process.inputReader(StandardCharsets.UTF_8),
                    writer = process.outputWriter(StandardCharsets.UTF_8),
                ),
            )
        } catch (_: IOException) {
            Refinement.Rejected(AppServerProcessFailure.CODEX_NOT_STARTED)
        } catch (_: SecurityException) {
            Refinement.Rejected(AppServerProcessFailure.CODEX_NOT_STARTED)
        }
    }
}
