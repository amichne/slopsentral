@file:OptIn(kotlinx.serialization.ExperimentalSerializationApi::class)

package io.github.amichne.slopsentral.gradle.wire

import io.github.amichne.slopsentral.gradle.debug.DebugFailure
import io.github.amichne.slopsentral.gradle.debug.JavaDebugger
import io.github.amichne.slopsentral.gradle.debug.JdiDebuggerService
import io.github.amichne.slopsentral.gradle.discovery.GradleTaskDiscoverer
import io.github.amichne.slopsentral.gradle.discovery.GradleTaskDiscoveryFailure
import io.github.amichne.slopsentral.gradle.discovery.ToolingApiGradleTaskDiscoverer
import io.github.amichne.slopsentral.gradle.domain.DebugAttachment
import io.github.amichne.slopsentral.gradle.domain.DebugControl
import io.github.amichne.slopsentral.gradle.domain.DebugEndpoint
import io.github.amichne.slopsentral.gradle.domain.DebugLaunch
import io.github.amichne.slopsentral.gradle.domain.DebugStack
import io.github.amichne.slopsentral.gradle.domain.DebugThreadId
import io.github.amichne.slopsentral.gradle.domain.DebugThreads
import io.github.amichne.slopsentral.gradle.domain.DebugTimeout
import io.github.amichne.slopsentral.gradle.domain.DiscoveredGradleTask
import io.github.amichne.slopsentral.gradle.domain.DiscoveryLimit
import io.github.amichne.slopsentral.gradle.domain.EventCursor
import io.github.amichne.slopsentral.gradle.domain.GradleInvocation
import io.github.amichne.slopsentral.gradle.domain.GradleOperation
import io.github.amichne.slopsentral.gradle.domain.GradleProject
import io.github.amichne.slopsentral.gradle.domain.GradleTaskPath
import io.github.amichne.slopsentral.gradle.domain.HistoryLimit
import io.github.amichne.slopsentral.gradle.domain.ProjectAdmissionFailure
import io.github.amichne.slopsentral.gradle.domain.Refinement
import io.github.amichne.slopsentral.gradle.domain.RunCancellation
import io.github.amichne.slopsentral.gradle.domain.RunId
import io.github.amichne.slopsentral.gradle.domain.RunObservation
import io.github.amichne.slopsentral.gradle.domain.RunSummary
import io.github.amichne.slopsentral.gradle.domain.StackFrameLimit
import io.github.amichne.slopsentral.gradle.domain.TaskDiscovery
import io.github.amichne.slopsentral.gradle.domain.TaskDiscoveryRequest
import io.github.amichne.slopsentral.gradle.domain.TaskQuery
import io.github.amichne.slopsentral.gradle.domain.TestSelector
import io.github.amichne.slopsentral.gradle.domain.WaitDuration
import io.github.amichne.slopsentral.gradle.runtime.GradleRunService
import io.github.amichne.slopsentral.gradle.runtime.DebugTargetFailure
import io.github.amichne.slopsentral.gradle.runtime.RunCancellationFailure
import io.github.amichne.slopsentral.gradle.runtime.RunHistoryFailure
import io.github.amichne.slopsentral.gradle.runtime.RunObservationFailure
import io.github.amichne.slopsentral.gradle.runtime.RunStartFailure
import io.github.amichne.slopsentral.gradle.runtime.StartedRun
import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable
import kotlinx.serialization.SerializationException
import kotlinx.serialization.decodeFromString
import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonObject
import java.nio.file.Path

private val wireJson = Json {
    classDiscriminator = "type"
    encodeDefaults = true
    explicitNulls = false
    ignoreUnknownKeys = false
}

@Serializable
private enum class StartDocumentType {
    START,
}

@Serializable
private data class StartDocument(
    val type: StartDocumentType,
    val operation: StartOperationDocument,
)

@Serializable
private sealed interface StartOperationDocument {
    @Serializable
    @SerialName("TASKS")
    data class Tasks(val tasks: List<String>) : StartOperationDocument

    @Serializable
    @SerialName("TESTS")
    data class Tests(
        val task: String,
        val selectors: List<TestSelectorDocument>,
        val debug: DebugLaunchDocument? = null,
    ) : StartOperationDocument
}

@Serializable
private enum class DebugLaunchDocumentType {
    JDWP,
}

@Serializable
private data class DebugLaunchDocument(val type: DebugLaunchDocumentType)

@Serializable
private enum class TestSelectorDocumentType {
    TEST_SELECTOR,
}

@Serializable
private data class TestSelectorDocument(
    val type: TestSelectorDocumentType,
    val pattern: String,
)

@Serializable
private enum class ObserveDocumentType {
    OBSERVE,
}

@Serializable
private data class ObserveDocument(
    val type: ObserveDocumentType,
    val runId: String,
    val after: Long,
    val waitMillis: Long,
)

@Serializable
private enum class CancelDocumentType {
    CANCEL,
}

@Serializable
private data class CancelDocument(
    val type: CancelDocumentType,
    val runId: String,
)

@Serializable
private enum class DiscoverDocumentType {
    DISCOVER,
}

@Serializable
private data class DiscoverDocument(
    val type: DiscoverDocumentType,
    val query: String? = null,
    val limit: Int,
)

@Serializable
private enum class HistoryDocumentType {
    HISTORY,
}

@Serializable
private data class HistoryDocument(
    val type: HistoryDocumentType,
    val operation: HistoryOperationDocument,
)

@Serializable
private sealed interface HistoryOperationDocument {
    @Serializable
    @SerialName("LIST")
    data class ListRuns(val limit: Int) : HistoryOperationDocument

    @Serializable
    @SerialName("READ")
    data class ReadRun(val runId: String) : HistoryOperationDocument
}

@Serializable
private enum class DebugDocumentType {
    DEBUG,
}

@Serializable
private data class DebugDocument(
    val type: DebugDocumentType,
    val runId: String,
    val operation: DebugOperationDocument,
)

@Serializable
private sealed interface DebugOperationDocument {
    @Serializable
    @SerialName("ATTACH")
    data class Attach(val timeoutMillis: Int) : DebugOperationDocument

    @Serializable
    @SerialName("THREADS")
    data object Threads : DebugOperationDocument

    @Serializable
    @SerialName("STACK")
    data class Stack(val threadId: Long, val maximumFrames: Int) : DebugOperationDocument

    @Serializable
    @SerialName("PAUSE")
    data object Pause : DebugOperationDocument

    @Serializable
    @SerialName("RESUME")
    data object Resume : DebugOperationDocument

    @Serializable
    @SerialName("DETACH")
    data object Detach : DebugOperationDocument
}

@Serializable
private data class DebugEndpointDocument(
    val type: String = "DEBUG_ENDPOINT",
    val host: String,
    val port: Int,
)

@Serializable
private data class StartedResultDocument(
    val type: String = "GRADLE_STARTED",
    val runId: String,
    val state: String,
    val command: List<String>,
    val startedAt: String,
    val debugEndpoint: DebugEndpointDocument?,
)

@Serializable
private data class OutputEventDocument(
    val type: String = "OUTPUT",
    val cursor: Long,
    val text: String,
)

@Serializable
private data class ObservationResultDocument(
    val type: String = "GRADLE_OBSERVATION",
    val runId: String,
    val state: String,
    val command: List<String>,
    val startedAt: String,
    val finishedAt: String?,
    val exitCode: Int?,
    val durationMillis: Long?,
    val events: List<OutputEventDocument>,
    val nextCursor: Long,
    val debugEndpoint: DebugEndpointDocument?,
)

@Serializable
private data class CancellationResultDocument(
    val type: String = "GRADLE_CANCELLATION",
    val runId: String,
    val outcome: String,
    val state: String,
)

@Serializable
private data class DiscoveredTaskDocument(
    val type: String = "GRADLE_TASK",
    val path: String,
    val name: String,
    val projectPath: String,
    val group: String?,
    val description: String?,
)

@Serializable
private data class TaskDiscoveryResultDocument(
    val type: String = "GRADLE_TASK_DISCOVERY",
    val tasks: List<DiscoveredTaskDocument>,
    val truncated: Boolean,
)

@Serializable
private data class RunSummaryDocument(
    val type: String = "GRADLE_RUN_SUMMARY",
    val runId: String,
    val state: String,
    val command: List<String>,
    val startedAt: String,
    val finishedAt: String?,
    val exitCode: Int?,
    val durationMillis: Long?,
    val debugEndpoint: DebugEndpointDocument?,
)

@Serializable
private data class RunHistoryResultDocument(
    val type: String = "GRADLE_RUN_HISTORY",
    val runs: List<RunSummaryDocument>,
)

@Serializable
private data class DebugAttachmentResultDocument(
    val type: String = "DEBUG_ATTACHMENT",
    val runId: String,
    val outcome: String,
    val endpoint: DebugEndpointDocument,
)

@Serializable
private data class DebugThreadDocument(
    val type: String = "DEBUG_THREAD",
    val id: Long,
    val name: String,
    val state: String,
    val suspended: Boolean,
)

@Serializable
private data class DebugThreadsResultDocument(
    val type: String = "DEBUG_THREADS",
    val runId: String,
    val threads: List<DebugThreadDocument>,
)

@Serializable
private data class DebugStackFrameDocument(
    val type: String = "DEBUG_STACK_FRAME",
    val index: Int,
    val declaringType: String,
    val methodName: String,
    val lineNumber: Int,
    val sourceName: String?,
)

@Serializable
private data class DebugStackResultDocument(
    val type: String = "DEBUG_STACK",
    val runId: String,
    val thread: DebugThreadDocument,
    val frames: List<DebugStackFrameDocument>,
)

@Serializable
private data class DebugControlResultDocument(
    val type: String = "DEBUG_CONTROL",
    val runId: String,
    val outcome: String,
)

@Serializable
private enum class ToolFailureCode {
    UNKNOWN_TOOL,
    INVALID_ARGUMENTS,
    INVALID_REPOSITORY,
    MISSING_GRADLE_WRAPPER,
    WRAPPER_OUTSIDE_REPOSITORY,
    WRAPPER_NOT_EXECUTABLE,
    RUN_ALREADY_ACTIVE,
    PROCESS_START_FAILED,
    UNKNOWN_RUN,
    CURSOR_AHEAD,
    TASK_DISCOVERY_FAILED,
    TASK_MODEL_UNAVAILABLE,
    PERSISTENCE_FAILED,
    CORRUPT_HISTORY,
    DEBUG_NOT_ENABLED,
    RUN_NOT_ACTIVE,
    DEBUG_CONNECTOR_UNAVAILABLE,
    DEBUG_ATTACH_TIMEOUT,
    DEBUG_ATTACH_FAILED,
    DEBUG_NOT_ATTACHED,
    DEBUG_DISCONNECTED,
    DEBUG_UNKNOWN_THREAD,
    DEBUG_THREAD_NOT_SUSPENDED,
    DEBUG_FRAME_INFORMATION_UNAVAILABLE,
    DEBUG_CONTROL_FAILED,
}

@Serializable
private data class ToolFailureDocument(
    val type: String = "TOOL_FAILURE",
    val code: ToolFailureCode,
    val message: String,
)

data class DynamicToolResult(
    val success: Boolean,
    val text: String,
)

data class DynamicToolDefinition(
    val name: String,
    val description: String,
    val inputSchema: JsonObject,
)

class ToolSchemaCatalog private constructor(
    private val definitions: Map<String, DynamicToolDefinition>,
) {
    fun all(): List<DynamicToolDefinition> =
        listOf("start", "observe", "cancel", "discover", "history", "debug").map(definitions::getValue)

    companion object {
        fun bundled(): ToolSchemaCatalog {
            val definitions = listOf(
                Triple(
                    "start",
                    "Start one repository Gradle task or filtered test invocation and return its run ID immediately.",
                    "start.schema.json",
                ),
                Triple(
                    "observe",
                    "Read output and terminal state after a run cursor; optionally wait up to 30 seconds for change.",
                    "observe.schema.json",
                ),
                Triple(
                    "cancel",
                    "Idempotently request cancellation of one known Gradle run.",
                    "cancel.schema.json",
                ),
                Triple(
                    "discover",
                    "Discover bounded task metadata from the repository Gradle project model.",
                    "discover.schema.json",
                ),
                Triple(
                    "history",
                    "List or read repository-persistent Gradle run summaries.",
                    "history.schema.json",
                ),
                Triple(
                    "debug",
                    "Attach to and inspect or control the JDI session for a debug-enabled test run.",
                    "debug.schema.json",
                ),
            ).associate { (name, description, resource) ->
                val text = checkNotNull(ToolSchemaCatalog::class.java.classLoader.getResource(resource)) {
                    "missing bundled dynamic-tool schema: $resource"
                }.readText()
                name to DynamicToolDefinition(
                    name = name,
                    description = description,
                    inputSchema = wireJson.parseToJsonElement(text) as JsonObject,
                )
            }
            return ToolSchemaCatalog(definitions)
        }
    }
}

class GradleToolDispatcher(
    repositoryRoot: Path,
    private val runs: GradleRunService,
    private val discoverer: GradleTaskDiscoverer = ToolingApiGradleTaskDiscoverer(),
    private val debugger: JavaDebugger = JdiDebuggerService(),
    val schemas: ToolSchemaCatalog = ToolSchemaCatalog.bundled(),
) {
    private val repositoryRoot = repositoryRoot.toAbsolutePath().normalize()

    fun call(namespace: String?, tool: String, arguments: JsonElement): DynamicToolResult {
        if (namespace != "gradle") {
            return failure(ToolFailureCode.UNKNOWN_TOOL, "Expected the gradle dynamic-tool namespace.")
        }
        return when (tool) {
            "start" -> start(arguments)
            "observe" -> observe(arguments)
            "cancel" -> cancel(arguments)
            "discover" -> discover(arguments)
            "history" -> history(arguments)
            "debug" -> debug(arguments)
            else -> failure(ToolFailureCode.UNKNOWN_TOOL, "Unknown gradle tool.")
        }
    }

    private fun start(arguments: JsonElement): DynamicToolResult {
        val document = decode<StartDocument>(arguments)
            ?: return invalidArguments("Arguments do not match the START contract.")
        val operation = when (val admitted = document.operation.admit()) {
            is Refinement.Accepted -> admitted.value
            is Refinement.Rejected -> return invalidArguments(admitted.failure)
        }
        val project = when (val admitted = GradleProject.admit(repositoryRoot)) {
            is Refinement.Accepted -> admitted.value
            is Refinement.Rejected -> return projectFailure(admitted.failure)
        }
        return when (val started = runs.start(GradleInvocation.forOperation(project, operation))) {
            is Refinement.Accepted -> started(started.value)
            is Refinement.Rejected -> when (started.failure) {
                RunStartFailure.RUN_ALREADY_ACTIVE -> failure(
                    ToolFailureCode.RUN_ALREADY_ACTIVE,
                    "This repository already has an active Gradle run.",
                )
                RunStartFailure.PROCESS_START_FAILED -> failure(
                    ToolFailureCode.PROCESS_START_FAILED,
                    "The repository Gradle wrapper could not be started.",
                )
                RunStartFailure.PERSISTENCE_FAILED -> failure(
                    ToolFailureCode.PERSISTENCE_FAILED,
                    "The run summary or repository ownership lock could not be persisted.",
                )
            }
        }
    }

    private fun observe(arguments: JsonElement): DynamicToolResult {
        val document = decode<ObserveDocument>(arguments)
            ?: return invalidArguments("Arguments do not match the OBSERVE contract.")
        val runId = when (val admitted = RunId.admit(document.runId)) {
            is Refinement.Accepted -> admitted.value
            is Refinement.Rejected -> return invalidArguments("runId must be a canonical UUID.")
        }
        val cursor = when (val admitted = EventCursor.admit(document.after)) {
            is Refinement.Accepted -> admitted.value
            is Refinement.Rejected -> return invalidArguments("after must be zero or greater.")
        }
        val wait = when (val admitted = WaitDuration.admit(document.waitMillis)) {
            is Refinement.Accepted -> admitted.value
            is Refinement.Rejected -> return invalidArguments("waitMillis must be between 0 and 30000.")
        }
        return when (val observation = runs.observe(runId, cursor, wait)) {
            is Refinement.Accepted -> success(observation.value.toDocument())
            is Refinement.Rejected -> when (observation.failure) {
                RunObservationFailure.UNKNOWN_RUN -> failure(
                    ToolFailureCode.UNKNOWN_RUN,
                    "The run ID is not known by this host.",
                )
                RunObservationFailure.CURSOR_AHEAD -> failure(
                    ToolFailureCode.CURSOR_AHEAD,
                    "The requested cursor is beyond the run event stream.",
                )
                RunObservationFailure.PERSISTENCE_FAILED -> failure(
                    ToolFailureCode.PERSISTENCE_FAILED,
                    "The terminal run summary could not be persisted.",
                )
            }
        }
    }

    private fun cancel(arguments: JsonElement): DynamicToolResult {
        val document = decode<CancelDocument>(arguments)
            ?: return invalidArguments("Arguments do not match the CANCEL contract.")
        val runId = when (val admitted = RunId.admit(document.runId)) {
            is Refinement.Accepted -> admitted.value
            is Refinement.Rejected -> return invalidArguments("runId must be a canonical UUID.")
        }
        return when (val cancelled = runs.cancel(runId)) {
            is Refinement.Accepted -> success(cancelled.value.toDocument())
            is Refinement.Rejected -> when (cancelled.failure) {
                RunCancellationFailure.UNKNOWN_RUN -> failure(
                    ToolFailureCode.UNKNOWN_RUN,
                    "The run ID is not known by this host.",
                )
                RunCancellationFailure.PERSISTENCE_FAILED -> failure(
                    ToolFailureCode.PERSISTENCE_FAILED,
                    "The cancellation state could not be persisted.",
                )
            }
        }
    }

    private fun discover(arguments: JsonElement): DynamicToolResult {
        val document = decode<DiscoverDocument>(arguments)
            ?: return invalidArguments("Arguments do not match the DISCOVER contract.")
        val limit = when (val admitted = DiscoveryLimit.admit(document.limit)) {
            is Refinement.Accepted -> admitted.value
            is Refinement.Rejected -> return invalidArguments("limit must be between 1 and 1000.")
        }
        val query = document.query?.let { raw ->
            when (val admitted = TaskQuery.admit(raw)) {
                is Refinement.Accepted -> admitted.value
                is Refinement.Rejected -> return invalidArguments("query must be a nonempty single-line value.")
            }
        }
        val project = when (val admitted = GradleProject.admit(repositoryRoot)) {
            is Refinement.Accepted -> admitted.value
            is Refinement.Rejected -> return projectFailure(admitted.failure)
        }
        return when (val discovery = discoverer.discover(project, TaskDiscoveryRequest(query, limit))) {
            is Refinement.Accepted -> success(discovery.value.toDocument())
            is Refinement.Rejected -> when (discovery.failure) {
                GradleTaskDiscoveryFailure.CONNECTION_FAILED -> failure(
                    ToolFailureCode.TASK_DISCOVERY_FAILED,
                    "Gradle task discovery could not connect to the repository build.",
                )
                GradleTaskDiscoveryFailure.MODEL_UNAVAILABLE -> failure(
                    ToolFailureCode.TASK_MODEL_UNAVAILABLE,
                    "The repository build does not expose the Gradle project model.",
                )
            }
        }
    }

    private fun history(arguments: JsonElement): DynamicToolResult {
        val document = decode<HistoryDocument>(arguments)
            ?: return invalidArguments("Arguments do not match the HISTORY contract.")
        return when (val operation = document.operation) {
            is HistoryOperationDocument.ListRuns -> {
                val limit = when (val admitted = HistoryLimit.admit(operation.limit)) {
                    is Refinement.Accepted -> admitted.value
                    is Refinement.Rejected -> return invalidArguments("limit must be between 1 and 100.")
                }
                when (val summaries = runs.listHistory(limit)) {
                    is Refinement.Accepted -> success(RunHistoryResultDocument(runs = summaries.value.map { it.toDocument() }))
                    is Refinement.Rejected -> historyFailure(summaries.failure)
                }
            }
            is HistoryOperationDocument.ReadRun -> {
                val runId = operation.runId.admitRunId() ?: return invalidRunId()
                when (val summary = runs.readHistory(runId)) {
                    is Refinement.Accepted -> success(RunHistoryResultDocument(runs = listOf(summary.value.toDocument())))
                    is Refinement.Rejected -> historyFailure(summary.failure)
                }
            }
        }
    }

    private fun debug(arguments: JsonElement): DynamicToolResult {
        val document = decode<DebugDocument>(arguments)
            ?: return invalidArguments("Arguments do not match the DEBUG contract.")
        val runId = document.runId.admitRunId() ?: return invalidRunId()
        return when (val operation = document.operation) {
            is DebugOperationDocument.Attach -> {
                val timeout = when (val admitted = DebugTimeout.admit(document.operation.timeoutMillis)) {
                    is Refinement.Accepted -> admitted.value
                    is Refinement.Rejected -> return invalidArguments("timeoutMillis must be between 1 and 30000.")
                }
                withDebugTarget(runId) { endpoint ->
                    debugger.attach(runId, endpoint, timeout).toToolResult(DebugAttachment::toDocument)
                }
            }
            DebugOperationDocument.Threads -> withDebugTarget(runId) {
                debugger.threads(runId).toToolResult(DebugThreads::toDocument)
            }
            is DebugOperationDocument.Stack -> {
                val threadId = when (val admitted = DebugThreadId.admit(operation.threadId)) {
                    is Refinement.Accepted -> admitted.value
                    is Refinement.Rejected -> return invalidArguments("threadId must be greater than zero.")
                }
                val maximumFrames = when (val admitted = StackFrameLimit.admit(operation.maximumFrames)) {
                    is Refinement.Accepted -> admitted.value
                    is Refinement.Rejected -> return invalidArguments("maximumFrames must be between 1 and 128.")
                }
                withDebugTarget(runId) {
                    debugger.stack(runId, threadId, maximumFrames).toToolResult(DebugStack::toDocument)
                }
            }
            DebugOperationDocument.Pause -> withDebugTarget(runId) {
                debugger.pause(runId).toToolResult(DebugControl::toDocument)
            }
            DebugOperationDocument.Resume -> withDebugTarget(runId) {
                debugger.resume(runId).toToolResult(DebugControl::toDocument)
            }
            DebugOperationDocument.Detach -> debugger.detach(runId).toToolResult(DebugControl::toDocument)
        }
    }

    private inline fun withDebugTarget(
        runId: RunId,
        operation: (DebugEndpoint) -> DynamicToolResult,
    ): DynamicToolResult = when (val admitted = runs.debugTarget(runId)) {
        is Refinement.Accepted -> operation(admitted.value.endpoint)
        is Refinement.Rejected -> debugTargetFailure(admitted.failure)
    }

    private fun started(started: StartedRun): DynamicToolResult {
        return success(
            StartedResultDocument(
                runId = started.runId.value.toString(),
                state = started.state.name,
                command = started.command,
                startedAt = started.startedAt.toString(),
                debugEndpoint = started.debugEndpoint?.toDocument(),
            ),
        )
    }

    private fun historyFailure(failure: RunHistoryFailure): DynamicToolResult = when (failure) {
        RunHistoryFailure.UNKNOWN_RUN -> failure(
            ToolFailureCode.UNKNOWN_RUN,
            "The run ID has no persisted summary.",
        )
        RunHistoryFailure.PERSISTENCE_FAILED -> failure(
            ToolFailureCode.PERSISTENCE_FAILED,
            "Persistent run history could not be read.",
        )
        RunHistoryFailure.CORRUPT_HISTORY -> failure(
            ToolFailureCode.CORRUPT_HISTORY,
            "Persistent run history contains an invalid summary.",
        )
    }

    private fun debugTargetFailure(failure: DebugTargetFailure): DynamicToolResult = when (failure) {
        DebugTargetFailure.UNKNOWN_RUN -> failure(ToolFailureCode.UNKNOWN_RUN, "The run ID is not known.")
        DebugTargetFailure.DEBUG_NOT_ENABLED -> failure(
            ToolFailureCode.DEBUG_NOT_ENABLED,
            "The run was not started with JDWP debugging enabled.",
        )
        DebugTargetFailure.RUN_NOT_ACTIVE -> failure(
            ToolFailureCode.RUN_NOT_ACTIVE,
            "The debug-enabled run is no longer active in this host.",
        )
    }

    private fun debugFailure(failure: DebugFailure): DynamicToolResult = when (failure) {
        DebugFailure.CONNECTOR_UNAVAILABLE -> failure(
            ToolFailureCode.DEBUG_CONNECTOR_UNAVAILABLE,
            "The JDK socket attaching connector is unavailable.",
        )
        DebugFailure.ATTACH_TIMEOUT -> failure(
            ToolFailureCode.DEBUG_ATTACH_TIMEOUT,
            "The JDWP endpoint did not accept the debugger before the timeout.",
        )
        DebugFailure.ATTACH_FAILED -> failure(
            ToolFailureCode.DEBUG_ATTACH_FAILED,
            "The debugger could not attach to the JDWP endpoint.",
        )
        DebugFailure.NOT_ATTACHED -> failure(
            ToolFailureCode.DEBUG_NOT_ATTACHED,
            "No debugger is attached to this run.",
        )
        DebugFailure.DISCONNECTED -> failure(
            ToolFailureCode.DEBUG_DISCONNECTED,
            "The debug target disconnected.",
        )
        DebugFailure.UNKNOWN_THREAD -> failure(
            ToolFailureCode.DEBUG_UNKNOWN_THREAD,
            "The debug thread ID is not known.",
        )
        DebugFailure.THREAD_NOT_SUSPENDED -> failure(
            ToolFailureCode.DEBUG_THREAD_NOT_SUSPENDED,
            "Stack frames are available only for a suspended thread.",
        )
        DebugFailure.FRAME_INFORMATION_UNAVAILABLE -> failure(
            ToolFailureCode.DEBUG_FRAME_INFORMATION_UNAVAILABLE,
            "The target could not provide stack-frame information.",
        )
        DebugFailure.CONTROL_FAILED -> failure(
            ToolFailureCode.DEBUG_CONTROL_FAILED,
            "The requested debugger control operation failed.",
        )
    }

    private inline fun <Value, reified Document> Refinement<Value, DebugFailure>.toToolResult(
        document: (Value) -> Document,
    ): DynamicToolResult = when (this) {
        is Refinement.Accepted -> success(document(value))
        is Refinement.Rejected -> debugFailure(failure)
    }

    private fun projectFailure(failure: ProjectAdmissionFailure): DynamicToolResult = when (failure) {
        ProjectAdmissionFailure.NOT_A_DIRECTORY -> failure(
            ToolFailureCode.INVALID_REPOSITORY,
            "The thread working directory is not a directory.",
        )
        ProjectAdmissionFailure.MISSING_GRADLE_WRAPPER -> failure(
            ToolFailureCode.MISSING_GRADLE_WRAPPER,
            "The thread working directory has no gradlew file.",
        )
        ProjectAdmissionFailure.WRAPPER_OUTSIDE_REPOSITORY -> failure(
            ToolFailureCode.WRAPPER_OUTSIDE_REPOSITORY,
            "The Gradle wrapper resolves outside the thread working directory.",
        )
        ProjectAdmissionFailure.WRAPPER_NOT_EXECUTABLE -> failure(
            ToolFailureCode.WRAPPER_NOT_EXECUTABLE,
            "The repository gradlew file is not executable.",
        )
    }

    private inline fun <reified Document> decode(arguments: JsonElement): Document? = try {
        wireJson.decodeFromString<Document>(arguments.toString())
    } catch (_: SerializationException) {
        null
    } catch (_: IllegalArgumentException) {
        null
    }

    private fun invalidArguments(message: String): DynamicToolResult = failure(ToolFailureCode.INVALID_ARGUMENTS, message)

    private fun invalidRunId(): DynamicToolResult = invalidArguments("runId must be a canonical UUID.")

    private inline fun <reified Document> success(document: Document): DynamicToolResult =
        DynamicToolResult(success = true, text = wireJson.encodeToString(document))

    private fun failure(code: ToolFailureCode, message: String): DynamicToolResult = DynamicToolResult(
        success = false,
        text = wireJson.encodeToString(ToolFailureDocument(code = code, message = message)),
    )
}

private fun StartOperationDocument.admit(): Refinement<GradleOperation, String> = when (this) {
    is StartOperationDocument.Tasks -> {
        if (tasks.size !in 1..32 || tasks.toSet().size != tasks.size) {
            Refinement.Rejected("tasks must contain 1 to 32 unique task paths.")
        } else {
            tasks.admitAll(GradleTaskPath::admit)?.let { Refinement.Accepted(GradleOperation.Tasks(it)) }
                ?: Refinement.Rejected("Every task must be a canonical Gradle task path.")
        }
    }
    is StartOperationDocument.Tests -> {
        val admittedTask = GradleTaskPath.admit(task)
        if (admittedTask !is Refinement.Accepted) {
            Refinement.Rejected("task must be a canonical Gradle task path.")
        } else if (selectors.size !in 1..64 || selectors.map { it.pattern }.toSet().size != selectors.size) {
            Refinement.Rejected("selectors must contain 1 to 64 unique test patterns.")
        } else {
            selectors.map { it.pattern }.admitAll(TestSelector::admit)?.let {
                Refinement.Accepted(
                    GradleOperation.Tests(
                        task = admittedTask.value,
                        selectors = it,
                        debug = debug?.let { DebugLaunch.JDWP },
                    ),
                )
            } ?: Refinement.Rejected("Every test selector must be nonblank and single-line.")
        }
    }
}

private fun <Value> List<String>.admitAll(
    admit: (String) -> Refinement<Value, *>,
): List<Value>? {
    val values = ArrayList<Value>(size)
    for (raw in this) {
        when (val admitted = admit(raw)) {
            is Refinement.Accepted -> values += admitted.value
            is Refinement.Rejected -> return null
        }
    }
    return values
}

private fun RunObservation.toDocument(): ObservationResultDocument = ObservationResultDocument(
    runId = runId.value.toString(),
    state = state.name,
    command = command,
    startedAt = startedAt.toString(),
    finishedAt = finishedAt?.toString(),
    exitCode = exitCode,
    durationMillis = durationMillis,
    events = events.map { OutputEventDocument(cursor = it.cursor.value, text = it.text) },
    nextCursor = nextCursor.value,
    debugEndpoint = debugEndpoint?.toDocument(),
)

private fun RunCancellation.toDocument(): CancellationResultDocument = CancellationResultDocument(
    runId = runId.value.toString(),
    outcome = outcome.name,
    state = state.name,
)

private fun String.admitRunId(): RunId? = when (val admitted = RunId.admit(this)) {
    is Refinement.Accepted -> admitted.value
    is Refinement.Rejected -> null
}

private fun DebugEndpoint.toDocument(): DebugEndpointDocument = DebugEndpointDocument(
    host = host,
    port = port,
)

private fun TaskDiscovery.toDocument(): TaskDiscoveryResultDocument = TaskDiscoveryResultDocument(
    tasks = tasks.map(DiscoveredGradleTask::toDocument),
    truncated = truncated,
)

private fun DiscoveredGradleTask.toDocument(): DiscoveredTaskDocument = DiscoveredTaskDocument(
    path = path,
    name = name,
    projectPath = projectPath,
    group = group,
    description = description,
)

private fun RunSummary.toDocument(): RunSummaryDocument = RunSummaryDocument(
    runId = runId.value.toString(),
    state = state.name,
    command = command,
    startedAt = startedAt.toString(),
    finishedAt = finishedAt?.toString(),
    exitCode = exitCode,
    durationMillis = durationMillis,
    debugEndpoint = debugEndpoint?.toDocument(),
)

private fun DebugAttachment.toDocument(): DebugAttachmentResultDocument = DebugAttachmentResultDocument(
    runId = runId.value.toString(),
    outcome = outcome.name,
    endpoint = endpoint.toDocument(),
)

private fun DebugThreads.toDocument(): DebugThreadsResultDocument = DebugThreadsResultDocument(
    runId = runId.value.toString(),
    threads = threads.map {
        DebugThreadDocument(
            id = it.id,
            name = it.name,
            state = it.state.name,
            suspended = it.suspended,
        )
    },
)

private fun DebugStack.toDocument(): DebugStackResultDocument = DebugStackResultDocument(
    runId = runId.value.toString(),
    thread = DebugThreadDocument(
        id = thread.id,
        name = thread.name,
        state = thread.state.name,
        suspended = thread.suspended,
    ),
    frames = frames.map {
        DebugStackFrameDocument(
            index = it.index,
            declaringType = it.declaringType,
            methodName = it.methodName,
            lineNumber = it.lineNumber,
            sourceName = it.sourceName,
        )
    },
)

private fun DebugControl.toDocument(): DebugControlResultDocument = DebugControlResultDocument(
    runId = runId.value.toString(),
    outcome = outcome.name,
)
