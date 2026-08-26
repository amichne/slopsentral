@file:OptIn(kotlinx.serialization.ExperimentalSerializationApi::class)

package io.github.amichne.slopsentral.gradle.wire

import io.github.amichne.slopsentral.gradle.domain.EventCursor
import io.github.amichne.slopsentral.gradle.domain.GradleInvocation
import io.github.amichne.slopsentral.gradle.domain.GradleOperation
import io.github.amichne.slopsentral.gradle.domain.GradleProject
import io.github.amichne.slopsentral.gradle.domain.GradleTaskPath
import io.github.amichne.slopsentral.gradle.domain.ProjectAdmissionFailure
import io.github.amichne.slopsentral.gradle.domain.Refinement
import io.github.amichne.slopsentral.gradle.domain.RunCancellation
import io.github.amichne.slopsentral.gradle.domain.RunId
import io.github.amichne.slopsentral.gradle.domain.RunObservation
import io.github.amichne.slopsentral.gradle.domain.TestSelector
import io.github.amichne.slopsentral.gradle.domain.WaitDuration
import io.github.amichne.slopsentral.gradle.runtime.GradleRunService
import io.github.amichne.slopsentral.gradle.runtime.RunCancellationFailure
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
    ) : StartOperationDocument
}

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
private data class StartedResultDocument(
    val type: String = "GRADLE_STARTED",
    val runId: String,
    val state: String,
    val command: List<String>,
    val startedAt: String,
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
)

@Serializable
private data class CancellationResultDocument(
    val type: String = "GRADLE_CANCELLATION",
    val runId: String,
    val outcome: String,
    val state: String,
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
    fun all(): List<DynamicToolDefinition> = listOf("start", "observe", "cancel").map(definitions::getValue)

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
            }
        }
    }

    private fun started(started: StartedRun): DynamicToolResult {
        return success(
            StartedResultDocument(
                runId = started.runId.value.toString(),
                state = started.state.name,
                command = started.command,
                startedAt = started.startedAt.toString(),
            ),
        )
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
                Refinement.Accepted(GradleOperation.Tests(admittedTask.value, it))
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
)

private fun RunCancellation.toDocument(): CancellationResultDocument = CancellationResultDocument(
    runId = runId.value.toString(),
    outcome = outcome.name,
    state = state.name,
)
