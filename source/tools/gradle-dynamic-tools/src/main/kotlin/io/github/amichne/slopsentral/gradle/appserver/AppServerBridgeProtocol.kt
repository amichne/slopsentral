@file:OptIn(kotlinx.serialization.ExperimentalSerializationApi::class)

package io.github.amichne.slopsentral.gradle.appserver

import io.github.amichne.slopsentral.gradle.wire.DynamicToolCaller
import io.github.amichne.slopsentral.gradle.wire.DynamicToolResult
import kotlinx.serialization.Serializable
import kotlinx.serialization.SerializationException
import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonNull
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.decodeFromJsonElement
import kotlinx.serialization.json.encodeToJsonElement
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.put

private const val GRADLE_NAMESPACE = "gradle"
private const val NAMESPACE_CONFLICT_CODE = -32040

internal val appServerJson = Json {
    encodeDefaults = true
    explicitNulls = false
    ignoreUnknownKeys = true
}

enum class AppServerBridgeFailure {
    MALFORMED_CLIENT_MESSAGE,
    DYNAMIC_TOOL_NAMESPACE_CONFLICT,
    MALFORMED_SERVER_TOOL_CALL,
}

sealed interface ClientBridgeRouting {
    data class ForwardUpstream(val message: String) : ClientBridgeRouting

    data class ReplyDownstream(val message: String) : ClientBridgeRouting

    data class Close(val failure: AppServerBridgeFailure) : ClientBridgeRouting
}

sealed interface ServerBridgeRouting {
    data class ForwardDownstream(val message: String) : ServerBridgeRouting

    data class ReplyUpstream(val message: String) : ServerBridgeRouting

    data class Close(val failure: AppServerBridgeFailure) : ServerBridgeRouting
}

class AppServerBridgeProtocol(
    private val tools: DynamicToolCaller,
) {
    fun fromClient(message: String): ClientBridgeRouting {
        val document = parseObject(message)
            ?: return ClientBridgeRouting.Close(AppServerBridgeFailure.MALFORMED_CLIENT_MESSAGE)
        return when (document.stringOrNull("method")) {
            "initialize" -> refineInitialize(document)
            "thread/start" -> refineThreadStart(document)
            else -> ClientBridgeRouting.ForwardUpstream(message)
        }
    }

    fun fromServer(message: String): ServerBridgeRouting {
        val document = parseObject(message)
            ?: return ServerBridgeRouting.Close(AppServerBridgeFailure.MALFORMED_SERVER_TOOL_CALL)
        if (document.stringOrNull("method") != "item/tool/call") {
            return ServerBridgeRouting.ForwardDownstream(message)
        }
        val params = document["params"] as? JsonObject
            ?: return ServerBridgeRouting.Close(AppServerBridgeFailure.MALFORMED_SERVER_TOOL_CALL)
        if (params.stringOrNull("namespace") != GRADLE_NAMESPACE) {
            return ServerBridgeRouting.ForwardDownstream(message)
        }
        val id = document["id"]
            ?: return ServerBridgeRouting.Close(AppServerBridgeFailure.MALFORMED_SERVER_TOOL_CALL)
        val call = try {
            appServerJson.decodeFromJsonElement<DynamicToolCallParamsDocument>(params)
        } catch (_: SerializationException) {
            return ServerBridgeRouting.Close(AppServerBridgeFailure.MALFORMED_SERVER_TOOL_CALL)
        } catch (_: IllegalArgumentException) {
            return ServerBridgeRouting.Close(AppServerBridgeFailure.MALFORMED_SERVER_TOOL_CALL)
        }
        val result = try {
            tools.call(call.namespace, call.tool, call.arguments)
        } catch (_: RuntimeException) {
            DynamicToolResult(
                success = false,
                text = appServerJson.encodeToString(BridgeToolFailureDocument()),
            )
        }
        return ServerBridgeRouting.ReplyUpstream(dynamicToolResponse(id, result))
    }

    private fun refineInitialize(document: JsonObject): ClientBridgeRouting {
        val params = document["params"] as? JsonObject
            ?: return ClientBridgeRouting.Close(AppServerBridgeFailure.MALFORMED_CLIENT_MESSAGE)
        val capabilities = when (val value = params["capabilities"]) {
            null, JsonNull -> JsonObject(emptyMap())
            is JsonObject -> value
            else -> return ClientBridgeRouting.Close(AppServerBridgeFailure.MALFORMED_CLIENT_MESSAGE)
        }
        val refinedCapabilities = JsonObject(capabilities + ("experimentalApi" to JsonPrimitive(true)))
        val refinedParams = JsonObject(params + ("capabilities" to refinedCapabilities))
        return ClientBridgeRouting.ForwardUpstream(
            JsonObject(document + ("params" to refinedParams)).toString(),
        )
    }

    private fun refineThreadStart(document: JsonObject): ClientBridgeRouting {
        val params = document["params"] as? JsonObject
            ?: return ClientBridgeRouting.Close(AppServerBridgeFailure.MALFORMED_CLIENT_MESSAGE)
        val existing = when (val value = params["dynamicTools"]) {
            null, JsonNull -> JsonArray(emptyList())
            is JsonArray -> value
            else -> return ClientBridgeRouting.Close(AppServerBridgeFailure.MALFORMED_CLIENT_MESSAGE)
        }
        val names = existing.map { tool ->
            (tool as? JsonObject)?.stringOrNull("name")
                ?: return ClientBridgeRouting.Close(AppServerBridgeFailure.MALFORMED_CLIENT_MESSAGE)
        }
        if (GRADLE_NAMESPACE in names) {
            val id = document["id"]
                ?: return ClientBridgeRouting.Close(AppServerBridgeFailure.DYNAMIC_TOOL_NAMESPACE_CONFLICT)
            return ClientBridgeRouting.ReplyDownstream(namespaceConflict(id))
        }
        val refinedTools = JsonArray(existing + appServerJson.encodeToJsonElement(tools.dynamicToolNamespace()))
        val refinedParams = JsonObject(params + ("dynamicTools" to refinedTools))
        return ClientBridgeRouting.ForwardUpstream(
            JsonObject(document + ("params" to refinedParams)).toString(),
        )
    }

    private fun namespaceConflict(id: JsonElement): String = buildJsonObject {
        put("id", id)
        put(
            "error",
            buildJsonObject {
                put("code", NAMESPACE_CONFLICT_CODE)
                put("message", "The Gradle dynamic-tool namespace is already defined.")
                put(
                    "data",
                    buildJsonObject {
                        put("failure", AppServerBridgeFailure.DYNAMIC_TOOL_NAMESPACE_CONFLICT.name)
                    },
                )
            },
        )
    }.toString()
}

internal fun DynamicToolCaller.dynamicToolNamespace(): DynamicToolNamespaceDocument =
    DynamicToolNamespaceDocument(
        type = "namespace",
        name = GRADLE_NAMESPACE,
        description =
            "Discover tasks; run, observe, and cancel one Gradle wrapper invocation; read durable history; " +
                "and attach JDI to debug-enabled tests. Use observe until the run becomes terminal.",
        tools = schemas.all().map { definition ->
            DynamicToolFunctionDocument(
                type = "function",
                name = definition.name,
                description = definition.description,
                inputSchema = definition.inputSchema,
                deferLoading = false,
            )
        },
    )

internal fun dynamicToolResponse(id: JsonElement, result: DynamicToolResult): String =
    appServerJson.encodeToString(
        BridgeRpcResponseDocument(
            id = id,
            result = DynamicToolCallResponseDocument(
                contentItems = listOf(DynamicToolOutputTextDocument(type = "inputText", text = result.text)),
                success = result.success,
            ),
        ),
    )

private fun parseObject(message: String): JsonObject? = try {
    appServerJson.parseToJsonElement(message).jsonObject
} catch (_: SerializationException) {
    null
} catch (_: IllegalArgumentException) {
    null
}

private fun JsonObject.stringOrNull(name: String): String? =
    (this[name] as? JsonPrimitive)?.takeIf(JsonPrimitive::isString)?.content

@Serializable
private data class BridgeRpcResponseDocument(
    val id: JsonElement,
    val result: DynamicToolCallResponseDocument,
)

@Serializable
private data class BridgeToolFailureDocument(
    val type: String = "TOOL_FAILURE",
    val code: BridgeToolFailureCode = BridgeToolFailureCode.BRIDGE_CALL_FAILED,
    val message: String = "The Gradle bridge could not complete the tool call.",
)

@Serializable
private enum class BridgeToolFailureCode {
    BRIDGE_CALL_FAILED,
}

@Serializable
internal data class DynamicToolNamespaceDocument(
    val type: String,
    val name: String,
    val description: String,
    val tools: List<DynamicToolFunctionDocument>,
)

@Serializable
internal data class DynamicToolFunctionDocument(
    val type: String,
    val name: String,
    val description: String,
    val inputSchema: JsonObject,
    val deferLoading: Boolean,
)

@Serializable
internal data class DynamicToolCallParamsDocument(
    val threadId: String,
    val turnId: String,
    val callId: String,
    val namespace: String? = null,
    val tool: String,
    val arguments: JsonElement,
)

@Serializable
internal data class DynamicToolCallResponseDocument(
    val contentItems: List<DynamicToolOutputTextDocument>,
    val success: Boolean,
)

@Serializable
internal data class DynamicToolOutputTextDocument(
    val type: String,
    val text: String,
)
