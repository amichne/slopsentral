@file:OptIn(kotlinx.serialization.ExperimentalSerializationApi::class)

package io.github.amichne.slopsentral.gradle.wire

import io.github.amichne.slopsentral.gradle.domain.GradleProject
import io.github.amichne.slopsentral.gradle.domain.Refinement
import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable
import kotlinx.serialization.SerializationException
import kotlinx.serialization.decodeFromString
import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonElement
import java.io.BufferedReader
import java.io.BufferedWriter
import java.io.IOException
import java.io.InputStreamReader
import java.io.OutputStreamWriter
import java.net.InetSocketAddress
import java.net.ServerSocket
import java.net.Socket
import java.net.SocketException
import java.nio.charset.StandardCharsets
import java.util.concurrent.ConcurrentHashMap
import java.util.concurrent.CountDownLatch
import java.util.concurrent.atomic.AtomicBoolean
import java.util.concurrent.atomic.AtomicLong

private const val LOOPBACK_HOST = "127.0.0.1"
private const val WIRE_PROTOCOL_VERSION = 1
private const val MAXIMUM_FRAME_CHARACTERS = 1_048_576
private const val CONNECT_TIMEOUT_MILLIS = 3_000
private const val HANDSHAKE_TIMEOUT_MILLIS = 3_000

private val protocolJson = Json {
    classDiscriminator = "type"
    encodeDefaults = true
    explicitNulls = false
    ignoreUnknownKeys = false
}

enum class LoopbackAddressFailure {
    INVALID_FORMAT,
    NON_LOOPBACK_HOST,
    PORT_OUT_OF_RANGE,
}

@JvmInline
value class LoopbackBinding private constructor(val port: Int) {
    override fun toString(): String = "$LOOPBACK_HOST:$port"

    companion object {
        fun ephemeral(): LoopbackBinding = LoopbackBinding(0)

        fun admit(value: String): Refinement<LoopbackBinding, LoopbackAddressFailure> =
            when (val address = parseLoopbackAddress(value, allowEphemeralPort = true)) {
                is Refinement.Accepted -> Refinement.Accepted(LoopbackBinding(address.value))
                is Refinement.Rejected -> address
            }
    }
}

@JvmInline
value class LoopbackEndpoint private constructor(val port: Int) {
    init {
        require(port in 1..65_535)
    }

    internal val socketAddress: InetSocketAddress
        get() = InetSocketAddress(LOOPBACK_HOST, port)

    override fun toString(): String = "$LOOPBACK_HOST:$port"

    companion object {
        fun admit(value: String): Refinement<LoopbackEndpoint, LoopbackAddressFailure> =
            when (val address = parseLoopbackAddress(value, allowEphemeralPort = false)) {
                is Refinement.Accepted -> Refinement.Accepted(LoopbackEndpoint(address.value))
                is Refinement.Rejected -> address
            }

        internal fun bound(port: Int): LoopbackEndpoint = LoopbackEndpoint(port)
    }
}

private fun parseLoopbackAddress(
    value: String,
    allowEphemeralPort: Boolean,
): Refinement<Int, LoopbackAddressFailure> {
    val separator = value.lastIndexOf(':')
    if (separator <= 0 || separator == value.lastIndex) {
        return Refinement.Rejected(LoopbackAddressFailure.INVALID_FORMAT)
    }
    if (value.substring(0, separator) != LOOPBACK_HOST) {
        return Refinement.Rejected(LoopbackAddressFailure.NON_LOOPBACK_HOST)
    }
    val port = value.substring(separator + 1).toIntOrNull()
        ?: return Refinement.Rejected(LoopbackAddressFailure.INVALID_FORMAT)
    val range = if (allowEphemeralPort) 0..65_535 else 1..65_535
    return if (port in range) {
        Refinement.Accepted(port)
    } else {
        Refinement.Rejected(LoopbackAddressFailure.PORT_OUT_OF_RANGE)
    }
}

enum class WireServerStartFailure {
    BIND_FAILED,
}

enum class WireConnectionFailure {
    CONNECTION_FAILED,
    HANDSHAKE_FAILED,
    MALFORMED_RESPONSE,
    PROTOCOL_MISMATCH,
    REPOSITORY_MISMATCH,
    TOOL_CONTRACT_MISMATCH,
}

@Serializable
private sealed interface WireRequestDocument

@Serializable
@SerialName("HELLO")
private data class HelloRequestDocument(
    val requestId: Long,
    val protocolVersion: Int,
    val repositoryRoot: String,
    val toolContractSha256: String,
) : WireRequestDocument

@Serializable
@SerialName("CALL")
private data class CallRequestDocument(
    val requestId: Long,
    val protocolVersion: Int,
    val namespace: String?,
    val tool: String,
    val arguments: JsonElement,
) : WireRequestDocument

@Serializable
private sealed interface WireResponseDocument

@Serializable
@SerialName("READY")
private data class ReadyResponseDocument(
    val requestId: Long,
    val protocolVersion: Int,
    val repositoryRoot: String,
    val toolContractSha256: String,
) : WireResponseDocument

@Serializable
@SerialName("RESULT")
private data class ResultResponseDocument(
    val requestId: Long,
    val success: Boolean,
    val text: String,
) : WireResponseDocument

@Serializable
@SerialName("FAILURE")
private data class FailureResponseDocument(
    val requestId: Long?,
    val code: WireProtocolFailureCode,
    val message: String,
) : WireResponseDocument

@Serializable
private enum class WireProtocolFailureCode {
    MALFORMED_REQUEST,
    FRAME_TOO_LARGE,
    INVALID_REQUEST_ID,
    UNSUPPORTED_PROTOCOL,
    HANDSHAKE_REQUIRED,
    HANDSHAKE_ALREADY_COMPLETED,
    REPOSITORY_MISMATCH,
    TOOL_CONTRACT_MISMATCH,
    INTERNAL_FAILURE,
}

@Serializable
private data class WireToolFailureDocument(
    val type: String = "TOOL_FAILURE",
    val code: WireToolFailureCode,
    val message: String,
)

@Serializable
private enum class WireToolFailureCode {
    WIRE_CONNECTION_CLOSED,
    WIRE_TRANSPORT_FAILED,
    WIRE_MALFORMED_RESPONSE,
    WIRE_PROTOCOL_FAILURE,
}

class GradleToolWireServer private constructor(
    private val serverSocket: ServerSocket,
    private val project: GradleProject,
    private val tools: DynamicToolCaller,
) : AutoCloseable {
    private val closed = AtomicBoolean(false)
    private val terminated = CountDownLatch(1)
    private val connections = ConcurrentHashMap.newKeySet<Socket>()

    val endpoint: LoopbackEndpoint = LoopbackEndpoint.bound(serverSocket.localPort)

    private val acceptThread = Thread.ofPlatform()
        .daemon(true)
        .name("gradle-dynamic-tools-wire-accept-${serverSocket.localPort}")
        .start(::acceptConnections)

    fun awaitTermination() {
        terminated.await()
    }

    override fun close() {
        if (!closed.compareAndSet(false, true)) return
        try {
            serverSocket.close()
        } finally {
            connections.forEach { connection ->
                try {
                    connection.close()
                } catch (_: IOException) {}
            }
            terminated.countDown()
        }
    }

    private fun acceptConnections() {
        while (!closed.get()) {
            try {
                val connection = serverSocket.accept().apply {
                    tcpNoDelay = true
                    soTimeout = HANDSHAKE_TIMEOUT_MILLIS
                }
                connections += connection
                Thread.ofPlatform()
                    .daemon(true)
                    .name("gradle-dynamic-tools-wire-client-${connection.port}")
                    .start { serve(connection) }
            } catch (_: SocketException) {
                if (!closed.get()) close()
            } catch (_: IOException) {
                close()
            } catch (_: SecurityException) {
                close()
            }
        }
    }

    private fun serve(connection: Socket) {
        try {
            connection.use { socket ->
                val reader = BufferedReader(InputStreamReader(socket.getInputStream(), StandardCharsets.UTF_8))
                val writer = BufferedWriter(OutputStreamWriter(socket.getOutputStream(), StandardCharsets.UTF_8))
                var admitted = false
                while (!closed.get()) {
                    when (val frame = reader.readBoundedFrame()) {
                        FrameRead.EndOfStream -> return
                        FrameRead.TooLarge -> {
                            writer.send(
                                FailureResponseDocument(
                                    requestId = null,
                                    code = WireProtocolFailureCode.FRAME_TOO_LARGE,
                                    message = "The wire request exceeded the maximum frame size.",
                                ),
                            )
                            return
                        }
                        is FrameRead.Line -> {
                            val request = try {
                                protocolJson.decodeFromString<WireRequestDocument>(frame.value)
                            } catch (_: SerializationException) {
                                writer.send(
                                    FailureResponseDocument(
                                        requestId = null,
                                        code = WireProtocolFailureCode.MALFORMED_REQUEST,
                                        message = "The wire request did not match the protocol contract.",
                                    ),
                                )
                                continue
                            } catch (_: IllegalArgumentException) {
                                writer.send(
                                    FailureResponseDocument(
                                        requestId = null,
                                        code = WireProtocolFailureCode.MALFORMED_REQUEST,
                                        message = "The wire request contained an invalid value.",
                                    ),
                                )
                                continue
                            }
                            val handled = handle(request, admitted)
                            if (!admitted && handled.admitted) socket.soTimeout = 0
                            admitted = handled.admitted
                            writer.send(handled.response)
                            if (handled.closeConnection) return
                        }
                    }
                }
            }
        } catch (_: IOException) {
        } finally {
            connections -= connection
        }
    }

    private fun handle(request: WireRequestDocument, admitted: Boolean): HandledRequest {
        if (request.requestId() <= 0) {
            return HandledRequest(
                admitted,
                FailureResponseDocument(
                    requestId = request.requestId(),
                    code = WireProtocolFailureCode.INVALID_REQUEST_ID,
                    message = "requestId must be greater than zero.",
                ),
            )
        }
        if (request.protocolVersion() != WIRE_PROTOCOL_VERSION) {
            return HandledRequest(
                admitted,
                FailureResponseDocument(
                    requestId = request.requestId(),
                    code = WireProtocolFailureCode.UNSUPPORTED_PROTOCOL,
                    message = "The wire protocol version is not supported.",
                ),
                closeConnection = true,
            )
        }
        return when (request) {
            is HelloRequestDocument -> handleHello(request, admitted)
            is CallRequestDocument -> handleCall(request, admitted)
        }
    }

    private fun handleHello(request: HelloRequestDocument, admitted: Boolean): HandledRequest {
        if (admitted) {
            return HandledRequest(
                admitted = true,
                response = FailureResponseDocument(
                    requestId = request.requestId,
                    code = WireProtocolFailureCode.HANDSHAKE_ALREADY_COMPLETED,
                    message = "This wire connection is already admitted.",
                ),
            )
        }
        if (request.repositoryRoot != project.root.toString()) {
            return HandledRequest(
                admitted = false,
                response = FailureResponseDocument(
                    requestId = request.requestId,
                    code = WireProtocolFailureCode.REPOSITORY_MISMATCH,
                    message = "The client repository does not match the server repository.",
                ),
                closeConnection = true,
            )
        }
        if (request.toolContractSha256 != tools.schemas.contractSha256) {
            return HandledRequest(
                admitted = false,
                response = FailureResponseDocument(
                    requestId = request.requestId,
                    code = WireProtocolFailureCode.TOOL_CONTRACT_MISMATCH,
                    message = "The client dynamic-tool contract does not match the server contract.",
                ),
                closeConnection = true,
            )
        }
        return HandledRequest(
            admitted = true,
            response = ReadyResponseDocument(
                requestId = request.requestId,
                protocolVersion = WIRE_PROTOCOL_VERSION,
                repositoryRoot = project.root.toString(),
                toolContractSha256 = tools.schemas.contractSha256,
            ),
        )
    }

    private fun handleCall(request: CallRequestDocument, admitted: Boolean): HandledRequest {
        if (!admitted) {
            return HandledRequest(
                admitted = false,
                response = FailureResponseDocument(
                    requestId = request.requestId,
                    code = WireProtocolFailureCode.HANDSHAKE_REQUIRED,
                    message = "A successful repository handshake is required before tool calls.",
                ),
                closeConnection = true,
            )
        }
        val result = try {
            tools.call(request.namespace, request.tool, request.arguments)
        } catch (_: RuntimeException) {
            return HandledRequest(
                admitted = true,
                response = FailureResponseDocument(
                    requestId = request.requestId,
                    code = WireProtocolFailureCode.INTERNAL_FAILURE,
                    message = "The server could not complete the tool call.",
                ),
            )
        }
        return HandledRequest(
            admitted = true,
            response = ResultResponseDocument(
                requestId = request.requestId,
                success = result.success,
                text = result.text,
            ),
        )
    }

    companion object {
        fun start(
            binding: LoopbackBinding,
            project: GradleProject,
            tools: DynamicToolCaller,
        ): Refinement<GradleToolWireServer, WireServerStartFailure> {
            val socket = try {
                ServerSocket()
            } catch (_: IOException) {
                return Refinement.Rejected(WireServerStartFailure.BIND_FAILED)
            } catch (_: SecurityException) {
                return Refinement.Rejected(WireServerStartFailure.BIND_FAILED)
            }
            return try {
                socket.apply {
                    reuseAddress = true
                    bind(InetSocketAddress(LOOPBACK_HOST, binding.port))
                }
                Refinement.Accepted(GradleToolWireServer(socket, project, tools))
            } catch (_: IOException) {
                socket.closeAfterRejectedStart()
            } catch (_: SecurityException) {
                socket.closeAfterRejectedStart()
            }
        }
    }
}

class GradleToolWireClient internal constructor(
    private val socket: Socket,
    private val reader: BufferedReader,
    private val writer: BufferedWriter,
    override val schemas: ToolSchemaCatalog,
) : DynamicToolCaller, AutoCloseable {
    private val closed = AtomicBoolean(false)
    private val requestIds = AtomicLong(1)

    @Synchronized
    override fun call(namespace: String?, tool: String, arguments: JsonElement): DynamicToolResult {
        if (closed.get()) {
            return toolFailure(
                WireToolFailureCode.WIRE_CONNECTION_CLOSED,
                "The Gradle tool wire connection is closed.",
            )
        }
        val requestId = requestIds.incrementAndGet()
        return try {
            writer.send(
                CallRequestDocument(
                    requestId = requestId,
                    protocolVersion = WIRE_PROTOCOL_VERSION,
                    namespace = namespace,
                    tool = tool,
                    arguments = arguments,
                ),
            )
            when (val response = reader.receiveResponse()) {
                is ResponseRead.Accepted -> response.value.toToolResult(requestId)
                ResponseRead.EndOfStream -> failAndClose(
                    WireToolFailureCode.WIRE_CONNECTION_CLOSED,
                    "The Gradle tool server closed the wire connection.",
                )
                ResponseRead.Malformed -> failAndClose(
                    WireToolFailureCode.WIRE_MALFORMED_RESPONSE,
                    "The Gradle tool server returned an invalid wire response.",
                )
                ResponseRead.TooLarge -> failAndClose(
                    WireToolFailureCode.WIRE_MALFORMED_RESPONSE,
                    "The Gradle tool server response exceeded the maximum frame size.",
                )
            }
        } catch (_: IOException) {
            failAndClose(
                WireToolFailureCode.WIRE_TRANSPORT_FAILED,
                "The Gradle tool wire transport failed.",
            )
        }
    }

    override fun close() {
        if (!closed.compareAndSet(false, true)) return
        try {
            writer.close()
        } catch (_: IOException) {
        } finally {
            try {
                reader.close()
            } catch (_: IOException) {
            } finally {
                try {
                    socket.close()
                } catch (_: IOException) {}
            }
        }
    }

    private fun WireResponseDocument.toToolResult(expectedRequestId: Long): DynamicToolResult = when (this) {
        is ResultResponseDocument -> if (requestId == expectedRequestId) {
            DynamicToolResult(success = success, text = text)
        } else {
            failAndClose(
                WireToolFailureCode.WIRE_PROTOCOL_FAILURE,
                "The Gradle tool server response did not match the active request.",
            )
        }
        is FailureResponseDocument -> failAndClose(
            WireToolFailureCode.WIRE_PROTOCOL_FAILURE,
            "The Gradle tool server rejected the request with ${code.name}.",
        )
        is ReadyResponseDocument -> failAndClose(
            WireToolFailureCode.WIRE_PROTOCOL_FAILURE,
            "The Gradle tool server returned an unexpected handshake response.",
        )
    }

    private fun failAndClose(code: WireToolFailureCode, message: String): DynamicToolResult {
        close()
        return toolFailure(code, message)
    }

    companion object {
        fun connect(
            endpoint: LoopbackEndpoint,
            project: GradleProject,
            schemas: ToolSchemaCatalog = ToolSchemaCatalog.bundled(),
        ): Refinement<GradleToolWireClient, WireConnectionFailure> {
            val socket = Socket()
            return try {
                socket.connect(endpoint.socketAddress, CONNECT_TIMEOUT_MILLIS)
                socket.tcpNoDelay = true
                socket.soTimeout = HANDSHAKE_TIMEOUT_MILLIS
                val reader = BufferedReader(InputStreamReader(socket.getInputStream(), StandardCharsets.UTF_8))
                val writer = BufferedWriter(OutputStreamWriter(socket.getOutputStream(), StandardCharsets.UTF_8))
                writer.send(
                    HelloRequestDocument(
                        requestId = 1,
                        protocolVersion = WIRE_PROTOCOL_VERSION,
                        repositoryRoot = project.root.toString(),
                        toolContractSha256 = schemas.contractSha256,
                    ),
                )
                when (val response = reader.receiveResponse()) {
                    is ResponseRead.Accepted -> {
                        socket.soTimeout = 0
                        response.value.admitHandshake(
                            socket = socket,
                            reader = reader,
                            writer = writer,
                            project = project,
                            schemas = schemas,
                        )
                    }
                    ResponseRead.EndOfStream -> socket.reject(WireConnectionFailure.HANDSHAKE_FAILED)
                    ResponseRead.Malformed -> socket.reject(WireConnectionFailure.MALFORMED_RESPONSE)
                    ResponseRead.TooLarge -> socket.reject(WireConnectionFailure.MALFORMED_RESPONSE)
                }
            } catch (_: IOException) {
                socket.reject(WireConnectionFailure.CONNECTION_FAILED)
            } catch (_: SecurityException) {
                socket.reject(WireConnectionFailure.CONNECTION_FAILED)
            }
        }
    }
}

private data class HandledRequest(
    val admitted: Boolean,
    val response: WireResponseDocument,
    val closeConnection: Boolean = false,
)

private fun WireRequestDocument.requestId(): Long = when (this) {
    is CallRequestDocument -> requestId
    is HelloRequestDocument -> requestId
}

private fun WireRequestDocument.protocolVersion(): Int = when (this) {
    is CallRequestDocument -> protocolVersion
    is HelloRequestDocument -> protocolVersion
}

private sealed interface FrameRead {
    data class Line(val value: String) : FrameRead

    data object EndOfStream : FrameRead

    data object TooLarge : FrameRead
}

private fun BufferedReader.readBoundedFrame(): FrameRead {
    val frame = StringBuilder()
    while (true) {
        when (val character = read()) {
            -1 -> return if (frame.isEmpty()) FrameRead.EndOfStream else FrameRead.Line(frame.toString())
            '\n'.code -> {
                if (frame.endsWith("\r")) frame.setLength(frame.length - 1)
                return FrameRead.Line(frame.toString())
            }
            else -> {
                if (frame.length == MAXIMUM_FRAME_CHARACTERS) return FrameRead.TooLarge
                frame.append(character.toChar())
            }
        }
    }
}

private sealed interface ResponseRead {
    data class Accepted(val value: WireResponseDocument) : ResponseRead

    data object EndOfStream : ResponseRead

    data object Malformed : ResponseRead

    data object TooLarge : ResponseRead
}

private fun BufferedReader.receiveResponse(): ResponseRead = when (val frame = readBoundedFrame()) {
    FrameRead.EndOfStream -> ResponseRead.EndOfStream
    FrameRead.TooLarge -> ResponseRead.TooLarge
    is FrameRead.Line -> try {
        ResponseRead.Accepted(protocolJson.decodeFromString<WireResponseDocument>(frame.value))
    } catch (_: SerializationException) {
        ResponseRead.Malformed
    } catch (_: IllegalArgumentException) {
        ResponseRead.Malformed
    }
}

private fun BufferedWriter.send(document: WireRequestDocument) {
    write(protocolJson.encodeToString(document))
    newLine()
    flush()
}

private fun BufferedWriter.send(document: WireResponseDocument) {
    write(protocolJson.encodeToString(document))
    newLine()
    flush()
}

private fun WireResponseDocument.admitHandshake(
    socket: Socket,
    reader: BufferedReader,
    writer: BufferedWriter,
    project: GradleProject,
    schemas: ToolSchemaCatalog,
): Refinement<GradleToolWireClient, WireConnectionFailure> = when (this) {
    is ReadyResponseDocument -> when {
        requestId != 1L -> socket.reject(WireConnectionFailure.HANDSHAKE_FAILED)
        protocolVersion != WIRE_PROTOCOL_VERSION -> socket.reject(WireConnectionFailure.PROTOCOL_MISMATCH)
        repositoryRoot != project.root.toString() -> socket.reject(WireConnectionFailure.REPOSITORY_MISMATCH)
        toolContractSha256 != schemas.contractSha256 ->
            socket.reject(WireConnectionFailure.TOOL_CONTRACT_MISMATCH)
        else -> Refinement.Accepted(GradleToolWireClient(socket, reader, writer, schemas))
    }
    is FailureResponseDocument -> when (code) {
        WireProtocolFailureCode.REPOSITORY_MISMATCH -> socket.reject(WireConnectionFailure.REPOSITORY_MISMATCH)
        WireProtocolFailureCode.TOOL_CONTRACT_MISMATCH ->
            socket.reject(WireConnectionFailure.TOOL_CONTRACT_MISMATCH)
        WireProtocolFailureCode.UNSUPPORTED_PROTOCOL -> socket.reject(WireConnectionFailure.PROTOCOL_MISMATCH)
        else -> socket.reject(WireConnectionFailure.HANDSHAKE_FAILED)
    }
    is ResultResponseDocument -> socket.reject(WireConnectionFailure.HANDSHAKE_FAILED)
}

private fun <Value> Socket.reject(
    failure: WireConnectionFailure,
): Refinement<Value, WireConnectionFailure> {
    try {
        close()
    } catch (_: IOException) {}
    return Refinement.Rejected(failure)
}

private fun ServerSocket.closeAfterRejectedStart(): Refinement<GradleToolWireServer, WireServerStartFailure> {
    try {
        close()
    } catch (_: IOException) {}
    return Refinement.Rejected(WireServerStartFailure.BIND_FAILED)
}

private fun toolFailure(code: WireToolFailureCode, message: String): DynamicToolResult =
    DynamicToolResult(
        success = false,
        text = protocolJson.encodeToString(WireToolFailureDocument(code = code, message = message)),
    )
