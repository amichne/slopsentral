package io.github.amichne.slopsentral.gradle

import io.github.amichne.slopsentral.gradle.appserver.AppServerProcessFailure
import io.github.amichne.slopsentral.gradle.appserver.AppServerBridgeStartFailure
import io.github.amichne.slopsentral.gradle.appserver.CodexCliArguments
import io.github.amichne.slopsentral.gradle.appserver.CodexCliRunFailure
import io.github.amichne.slopsentral.gradle.appserver.CodexAppServerClient
import io.github.amichne.slopsentral.gradle.appserver.CodexAppServerBridge
import io.github.amichne.slopsentral.gradle.appserver.CodexSessionFacade
import io.github.amichne.slopsentral.gradle.appserver.CodexSessionFailure
import io.github.amichne.slopsentral.gradle.appserver.CodexSessionOutcome
import io.github.amichne.slopsentral.gradle.appserver.CodexTurnOutcome
import io.github.amichne.slopsentral.gradle.appserver.ProcessJsonLineTransport
import io.github.amichne.slopsentral.gradle.debug.JdiDebuggerService
import io.github.amichne.slopsentral.gradle.domain.GradleProject
import io.github.amichne.slopsentral.gradle.domain.ProjectAdmissionFailure
import io.github.amichne.slopsentral.gradle.domain.Refinement
import io.github.amichne.slopsentral.gradle.domain.ReleaseVersion
import io.github.amichne.slopsentral.gradle.history.FileRunHistoryStore
import io.github.amichne.slopsentral.gradle.runtime.GradleRunService
import io.github.amichne.slopsentral.gradle.runtime.SystemGradleExecutor
import io.github.amichne.slopsentral.gradle.wire.DynamicToolCaller
import io.github.amichne.slopsentral.gradle.wire.GradleToolDispatcher
import io.github.amichne.slopsentral.gradle.wire.GradleToolWireClient
import io.github.amichne.slopsentral.gradle.wire.GradleToolWireServer
import io.github.amichne.slopsentral.gradle.wire.LoopbackAddressFailure
import io.github.amichne.slopsentral.gradle.wire.LoopbackBinding
import io.github.amichne.slopsentral.gradle.wire.LoopbackEndpoint
import io.github.amichne.slopsentral.gradle.wire.WireConnectionFailure
import io.github.amichne.slopsentral.gradle.wire.WireServerStartFailure
import java.nio.file.Path
import kotlin.system.exitProcess

private val usage =
    """
    Usage:
      gradle-dynamic-tools codex [--cwd REPOSITORY] [-- CODEX_ARGUMENTS...]
      gradle-dynamic-tools serve [--cwd REPOSITORY] [--listen 127.0.0.1:PORT]
      gradle-dynamic-tools bridge [--cwd REPOSITORY] [--server 127.0.0.1:PORT] [--listen 127.0.0.1:PORT]
      gradle-dynamic-tools [--cwd REPOSITORY] [--server 127.0.0.1:PORT] [--model MODEL] -- PROMPT
    """.trimIndent()

private const val defaultListenAddress = "127.0.0.1:48173"
private const val defaultBridgeListenAddress = "127.0.0.1:4500"

internal sealed interface CliConfiguration {
    data class InteractiveCodex(
        val repository: Path,
        val arguments: CodexCliArguments,
    ) : CliConfiguration

    data class RunCodex(
        val repository: Path,
        val server: LoopbackEndpoint?,
        val model: String?,
        val prompt: String,
    ) : CliConfiguration

    data class Serve(
        val repository: Path,
        val binding: LoopbackBinding,
    ) : CliConfiguration

    data class Bridge(
        val repository: Path,
        val server: LoopbackEndpoint,
        val listen: LoopbackBinding,
    ) : CliConfiguration
}

internal enum class CliFailure {
    HELP_REQUESTED,
    MISSING_OPTION_VALUE,
    MISSING_PROMPT_SEPARATOR,
    EMPTY_PROMPT,
    UNKNOWN_OPTION,
    INVALID_LOOPBACK_ADDRESS,
}

internal sealed interface CliAdmission {
    data class Accepted(val configuration: CliConfiguration) : CliAdmission

    data class VersionRequested(val version: ReleaseVersion) : CliAdmission

    data class Rejected(val failure: CliFailure) : CliAdmission
}

private sealed interface CliExecution {
    data class Completed(val output: String?) : CliExecution

    data class Rejected(val exitCode: Int, val message: String) : CliExecution

    data class Exited(val exitCode: Int) : CliExecution
}

fun main(args: Array<String>) {
    val execution = when (val admission = parseArguments(args)) {
        is CliAdmission.Accepted -> execute(admission.configuration)
        is CliAdmission.VersionRequested -> CliExecution.Completed("gradle-dynamic-tools ${admission.version}")
        is CliAdmission.Rejected -> {
            if (admission.failure == CliFailure.HELP_REQUESTED) {
                CliExecution.Completed(usage)
            } else {
                CliExecution.Rejected(2, usage)
            }
        }
    }
    when (execution) {
        is CliExecution.Completed -> execution.output?.let(::println)
        is CliExecution.Rejected -> {
            System.err.println(execution.message)
            exitProcess(execution.exitCode)
        }
        is CliExecution.Exited -> exitProcess(execution.exitCode)
    }
}

private fun execute(configuration: CliConfiguration): CliExecution {
    val repository = when (configuration) {
        is CliConfiguration.InteractiveCodex -> configuration.repository
        is CliConfiguration.RunCodex -> configuration.repository
        is CliConfiguration.Serve -> configuration.repository
        is CliConfiguration.Bridge -> configuration.repository
    }
    val project = when (val admission = GradleProject.admit(repository)) {
        is Refinement.Accepted -> admission.value
        is Refinement.Rejected -> return CliExecution.Rejected(2, admission.failure.cliMessage())
    }
    return when (configuration) {
        is CliConfiguration.InteractiveCodex -> executeInteractiveCodex(configuration, project)
        is CliConfiguration.RunCodex -> executeCodex(configuration, project)
        is CliConfiguration.Serve -> executeServer(configuration, project)
        is CliConfiguration.Bridge -> executeBridge(configuration, project)
    }
}

private fun executeInteractiveCodex(
    configuration: CliConfiguration.InteractiveCodex,
    project: GradleProject,
): CliExecution = JdiDebuggerService().use { debugger ->
    GradleRunService(
        executor = SystemGradleExecutor(),
        history = FileRunHistoryStore(project.root),
    ).use { runs ->
        val tools = GradleToolDispatcher(project.root, runs, debugger = debugger)
        when (val outcome = CodexSessionFacade().run(project, tools, configuration.arguments)) {
            is CodexSessionOutcome.Completed -> if (outcome.exitCode == 0) {
                CliExecution.Completed(output = null)
            } else {
                CliExecution.Exited(outcome.exitCode)
            }
            is CodexSessionOutcome.Rejected -> CliExecution.Rejected(3, outcome.failure.cliMessage())
        }
    }
}

private fun executeBridge(
    configuration: CliConfiguration.Bridge,
    project: GradleProject,
): CliExecution {
    when (val connection = GradleToolWireClient.connect(configuration.server, project)) {
        is Refinement.Accepted -> connection.value.close()
        is Refinement.Rejected -> return CliExecution.Rejected(3, connection.failure.cliMessage())
    }
    return when (val outcome = CodexAppServerBridge(configuration.listen, project, configuration.server).run { endpoint ->
        println(
            "gradle-dynamic-tools bridge ready endpoint=ws://$endpoint " +
                "gradle=${configuration.server} repository=${project.root}",
        )
    }) {
        is Refinement.Accepted -> CliExecution.Completed(output = null)
        is Refinement.Rejected -> CliExecution.Rejected(3, outcome.failure.cliMessage())
    }
}

private fun executeCodex(configuration: CliConfiguration.RunCodex, project: GradleProject): CliExecution =
    if (configuration.server == null) {
        JdiDebuggerService().use { debugger ->
            GradleRunService(
                executor = SystemGradleExecutor(),
                history = FileRunHistoryStore(project.root),
            ).use { runs ->
                runCodexTurn(
                    configuration = configuration,
                    project = project,
                    tools = GradleToolDispatcher(project.root, runs, debugger = debugger),
                )
            }
        }
    } else {
        when (val connection = GradleToolWireClient.connect(configuration.server, project)) {
            is Refinement.Accepted -> connection.value.use { tools ->
                runCodexTurn(configuration, project, tools)
            }
            is Refinement.Rejected -> CliExecution.Rejected(3, connection.failure.cliMessage())
        }
    }

private fun runCodexTurn(
    configuration: CliConfiguration.RunCodex,
    project: GradleProject,
    tools: DynamicToolCaller,
): CliExecution = when (val opening = ProcessJsonLineTransport.start(project.root)) {
    is Refinement.Rejected -> CliExecution.Rejected(3, opening.failure.cliMessage())
    is Refinement.Accepted -> opening.value.use { transport ->
        when (
            val outcome = CodexAppServerClient(transport, tools).run(
                repository = project.root,
                prompt = configuration.prompt,
                model = configuration.model,
            )
        ) {
            is CodexTurnOutcome.Completed -> CliExecution.Completed(outcome.finalAnswer)
            is CodexTurnOutcome.Rejected -> CliExecution.Rejected(
                4,
                "${outcome.failure.code}: ${outcome.failure.message}",
            )
        }
    }
}

private fun executeServer(
    configuration: CliConfiguration.Serve,
    project: GradleProject,
): CliExecution = JdiDebuggerService().use { debugger ->
    GradleRunService(
        executor = SystemGradleExecutor(),
        history = FileRunHistoryStore(project.root),
    ).use { runs ->
        val dispatcher = GradleToolDispatcher(project.root, runs, debugger = debugger)
        when (val started = GradleToolWireServer.start(configuration.binding, project, dispatcher)) {
            is Refinement.Rejected -> CliExecution.Rejected(3, started.failure.cliMessage())
            is Refinement.Accepted -> started.value.use { server ->
                val shutdownHook = Thread.ofPlatform()
                    .name("gradle-dynamic-tools-wire-shutdown")
                    .unstarted(server::close)
                Runtime.getRuntime().addShutdownHook(shutdownHook)
                println(
                    "gradle-dynamic-tools server ready endpoint=${server.endpoint} repository=${project.root}",
                )
                try {
                    server.awaitTermination()
                } finally {
                    try {
                        Runtime.getRuntime().removeShutdownHook(shutdownHook)
                    } catch (_: IllegalStateException) {
                    }
                }
                CliExecution.Completed(output = null)
            }
        }
    }
}

internal fun parseArguments(args: Array<String>): CliAdmission = when {
    args.firstOrNull() == "codex" -> parseInteractiveCodexArguments(args.drop(1))
    args.firstOrNull() == "serve" -> parseServeArguments(args.drop(1))
    args.firstOrNull() == "bridge" -> parseBridgeArguments(args.drop(1))
    else -> parseRunArguments(args.toList())
}

private fun parseInteractiveCodexArguments(args: List<String>): CliAdmission {
    var repository = Path.of("").toAbsolutePath().normalize()
    var index = 0
    while (index < args.size) {
        when (args[index]) {
            "--help", "-h" -> return CliAdmission.Rejected(CliFailure.HELP_REQUESTED)
            "--version" -> return CliAdmission.VersionRequested(ReleaseVersion.CURRENT)
            "--cwd" -> {
                val value = args.getOrNull(index + 1)
                    ?: return CliAdmission.Rejected(CliFailure.MISSING_OPTION_VALUE)
                repository = Path.of(value).toAbsolutePath().normalize()
                index += 2
            }
            "--" -> return CliAdmission.Accepted(
                CliConfiguration.InteractiveCodex(
                    repository,
                    CodexCliArguments.of(args.drop(index + 1)),
                ),
            )
            else -> return CliAdmission.Rejected(CliFailure.UNKNOWN_OPTION)
        }
    }
    return CliAdmission.Accepted(
        CliConfiguration.InteractiveCodex(repository, CodexCliArguments.of(emptyList())),
    )
}

private fun parseBridgeArguments(args: List<String>): CliAdmission {
    var repository = Path.of("").toAbsolutePath().normalize()
    var server = when (val admitted = LoopbackEndpoint.admit(defaultListenAddress)) {
        is Refinement.Accepted -> admitted.value
        is Refinement.Rejected -> error("Invalid built-in Gradle server address: ${admitted.failure}")
    }
    var listen = when (val admitted = LoopbackBinding.admit(defaultBridgeListenAddress)) {
        is Refinement.Accepted -> admitted.value
        is Refinement.Rejected -> error("Invalid built-in bridge listen address: ${admitted.failure}")
    }
    var index = 0
    while (index < args.size) {
        when (args[index]) {
            "--help", "-h" -> return CliAdmission.Rejected(CliFailure.HELP_REQUESTED)
            "--version" -> return CliAdmission.VersionRequested(ReleaseVersion.CURRENT)
            "--cwd" -> {
                val value = args.getOrNull(index + 1)
                    ?: return CliAdmission.Rejected(CliFailure.MISSING_OPTION_VALUE)
                repository = Path.of(value).toAbsolutePath().normalize()
                index += 2
            }
            "--server" -> {
                val value = args.getOrNull(index + 1)
                    ?: return CliAdmission.Rejected(CliFailure.MISSING_OPTION_VALUE)
                server = when (val admitted = LoopbackEndpoint.admit(value)) {
                    is Refinement.Accepted -> admitted.value
                    is Refinement.Rejected -> return CliAdmission.Rejected(admitted.failure.cliFailure())
                }
                index += 2
            }
            "--listen" -> {
                val value = args.getOrNull(index + 1)
                    ?: return CliAdmission.Rejected(CliFailure.MISSING_OPTION_VALUE)
                listen = when (val admitted = LoopbackBinding.admit(value)) {
                    is Refinement.Accepted -> admitted.value
                    is Refinement.Rejected -> return CliAdmission.Rejected(admitted.failure.cliFailure())
                }
                index += 2
            }
            else -> return CliAdmission.Rejected(CliFailure.UNKNOWN_OPTION)
        }
    }
    return CliAdmission.Accepted(CliConfiguration.Bridge(repository, server, listen))
}

private fun parseServeArguments(args: List<String>): CliAdmission {
    var repository = Path.of("").toAbsolutePath().normalize()
    var binding = when (val admitted = LoopbackBinding.admit(defaultListenAddress)) {
        is Refinement.Accepted -> admitted.value
        is Refinement.Rejected -> error("Invalid built-in listen address: ${admitted.failure}")
    }
    var index = 0
    while (index < args.size) {
        when (args[index]) {
            "--help", "-h" -> return CliAdmission.Rejected(CliFailure.HELP_REQUESTED)
            "--version" -> return CliAdmission.VersionRequested(ReleaseVersion.CURRENT)
            "--cwd" -> {
                val value = args.getOrNull(index + 1)
                    ?: return CliAdmission.Rejected(CliFailure.MISSING_OPTION_VALUE)
                repository = Path.of(value).toAbsolutePath().normalize()
                index += 2
            }
            "--listen" -> {
                val value = args.getOrNull(index + 1)
                    ?: return CliAdmission.Rejected(CliFailure.MISSING_OPTION_VALUE)
                binding = when (val admitted = LoopbackBinding.admit(value)) {
                    is Refinement.Accepted -> admitted.value
                    is Refinement.Rejected -> return CliAdmission.Rejected(admitted.failure.cliFailure())
                }
                index += 2
            }
            else -> return CliAdmission.Rejected(CliFailure.UNKNOWN_OPTION)
        }
    }
    return CliAdmission.Accepted(CliConfiguration.Serve(repository, binding))
}

private fun parseRunArguments(args: List<String>): CliAdmission {
    var repository = Path.of("").toAbsolutePath().normalize()
    var server: LoopbackEndpoint? = null
    var model: String? = null
    var index = 0
    while (index < args.size) {
        when (args[index]) {
            "--help", "-h" -> return CliAdmission.Rejected(CliFailure.HELP_REQUESTED)
            "--version" -> return CliAdmission.VersionRequested(ReleaseVersion.CURRENT)
            "--cwd" -> {
                val value = args.getOrNull(index + 1)
                    ?: return CliAdmission.Rejected(CliFailure.MISSING_OPTION_VALUE)
                repository = Path.of(value).toAbsolutePath().normalize()
                index += 2
            }
            "--server" -> {
                val value = args.getOrNull(index + 1)
                    ?: return CliAdmission.Rejected(CliFailure.MISSING_OPTION_VALUE)
                server = when (val admitted = LoopbackEndpoint.admit(value)) {
                    is Refinement.Accepted -> admitted.value
                    is Refinement.Rejected -> return CliAdmission.Rejected(admitted.failure.cliFailure())
                }
                index += 2
            }
            "--model" -> {
                val value = args.getOrNull(index + 1)
                    ?: return CliAdmission.Rejected(CliFailure.MISSING_OPTION_VALUE)
                model = value.takeIf(String::isNotBlank)
                    ?: return CliAdmission.Rejected(CliFailure.MISSING_OPTION_VALUE)
                index += 2
            }
            "--" -> {
                val prompt = args.drop(index + 1).joinToString(" ").trim()
                return if (prompt.isEmpty()) {
                    CliAdmission.Rejected(CliFailure.EMPTY_PROMPT)
                } else {
                    CliAdmission.Accepted(CliConfiguration.RunCodex(repository, server, model, prompt))
                }
            }
            else -> return CliAdmission.Rejected(
                if (args[index].startsWith("-")) CliFailure.UNKNOWN_OPTION else CliFailure.MISSING_PROMPT_SEPARATOR,
            )
        }
    }
    return CliAdmission.Rejected(CliFailure.MISSING_PROMPT_SEPARATOR)
}

private fun ProjectAdmissionFailure.cliMessage(): String = when (this) {
    ProjectAdmissionFailure.NOT_A_DIRECTORY -> "The --cwd value is not a directory."
    ProjectAdmissionFailure.MISSING_GRADLE_WRAPPER -> "The repository does not contain gradlew."
    ProjectAdmissionFailure.WRAPPER_OUTSIDE_REPOSITORY -> "The gradlew file resolves outside the repository."
    ProjectAdmissionFailure.WRAPPER_NOT_EXECUTABLE -> "The repository gradlew file is not executable."
}

private fun AppServerProcessFailure.cliMessage(): String = when (this) {
    AppServerProcessFailure.CODEX_NOT_STARTED -> "Could not start codex app-server."
}

private fun LoopbackAddressFailure.cliFailure(): CliFailure = CliFailure.INVALID_LOOPBACK_ADDRESS

private fun WireConnectionFailure.cliMessage(): String = when (this) {
    WireConnectionFailure.CONNECTION_FAILED -> "Could not connect to the Gradle tool server."
    WireConnectionFailure.HANDSHAKE_FAILED -> "The Gradle tool server rejected the connection handshake."
    WireConnectionFailure.MALFORMED_RESPONSE -> "The Gradle tool server returned a malformed handshake response."
    WireConnectionFailure.PROTOCOL_MISMATCH -> "The Gradle tool server uses an incompatible protocol version."
    WireConnectionFailure.REPOSITORY_MISMATCH ->
        "The Gradle tool server is bound to a different repository."
    WireConnectionFailure.TOOL_CONTRACT_MISMATCH ->
        "The Gradle tool server exposes a different dynamic-tool schema contract."
}

private fun WireServerStartFailure.cliMessage(): String = when (this) {
    WireServerStartFailure.BIND_FAILED -> "Could not bind the Gradle tool server loopback address."
}

private fun AppServerBridgeStartFailure.cliMessage(): String = when (this) {
    AppServerBridgeStartFailure.BIND_FAILED -> "Could not bind the Codex App Server bridge loopback address."
    AppServerBridgeStartFailure.SERVER_FAILED -> "The Codex App Server bridge failed."
    AppServerBridgeStartFailure.INTERRUPTED -> "The Codex App Server bridge was interrupted."
}

private fun CodexSessionFailure.cliMessage(): String = when (this) {
    is CodexSessionFailure.GradleServer -> failure.cliMessage()
    is CodexSessionFailure.AppServerBridge -> failure.cliMessage()
    is CodexSessionFailure.CodexCli -> when (failure) {
        CodexCliRunFailure.CODEX_NOT_STARTED -> "Could not start the Codex CLI."
        CodexCliRunFailure.INTERRUPTED -> "The Codex CLI session was interrupted."
    }
}
