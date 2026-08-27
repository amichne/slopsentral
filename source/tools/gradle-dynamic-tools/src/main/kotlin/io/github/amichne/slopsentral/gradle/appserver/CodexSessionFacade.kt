package io.github.amichne.slopsentral.gradle.appserver

import io.github.amichne.slopsentral.gradle.domain.GradleProject
import io.github.amichne.slopsentral.gradle.domain.Refinement
import io.github.amichne.slopsentral.gradle.wire.DynamicToolCaller
import io.github.amichne.slopsentral.gradle.wire.GradleToolWireServer
import io.github.amichne.slopsentral.gradle.wire.LoopbackBinding
import io.github.amichne.slopsentral.gradle.wire.LoopbackEndpoint
import io.github.amichne.slopsentral.gradle.wire.WireServerStartFailure
import java.io.IOException
import java.nio.file.Path

class CodexCliArguments private constructor(val values: List<String>) {
    companion object {
        fun of(values: List<String>): CodexCliArguments = CodexCliArguments(values.toList())
    }
}

enum class CodexCliRunFailure {
    CODEX_NOT_STARTED,
    INTERRUPTED,
}

sealed interface CodexCliRunOutcome {
    data class Completed(val exitCode: Int) : CodexCliRunOutcome

    data class Rejected(val failure: CodexCliRunFailure) : CodexCliRunOutcome
}

fun interface CodexCliRunner {
    fun run(
        repository: Path,
        bridge: LoopbackEndpoint,
        arguments: CodexCliArguments,
    ): CodexCliRunOutcome
}

class SystemCodexCliRunner(
    private val executable: String = "codex",
) : CodexCliRunner {
    override fun run(
        repository: Path,
        bridge: LoopbackEndpoint,
        arguments: CodexCliArguments,
    ): CodexCliRunOutcome {
        val process = try {
            ProcessBuilder(
                buildList {
                    add(executable)
                    add("--remote")
                    add("ws://$bridge")
                    add("-C")
                    add(repository.toString())
                    addAll(arguments.values)
                },
            ).directory(repository.toFile()).inheritIO().start()
        } catch (_: IOException) {
            return CodexCliRunOutcome.Rejected(CodexCliRunFailure.CODEX_NOT_STARTED)
        } catch (_: SecurityException) {
            return CodexCliRunOutcome.Rejected(CodexCliRunFailure.CODEX_NOT_STARTED)
        }
        return try {
            CodexCliRunOutcome.Completed(process.waitFor())
        } catch (_: InterruptedException) {
            process.destroy()
            Thread.currentThread().interrupt()
            CodexCliRunOutcome.Rejected(CodexCliRunFailure.INTERRUPTED)
        }
    }
}

sealed interface CodexSessionFailure {
    data class GradleServer(val failure: WireServerStartFailure) : CodexSessionFailure

    data class AppServerBridge(val failure: AppServerBridgeStartFailure) : CodexSessionFailure

    data class CodexCli(val failure: CodexCliRunFailure) : CodexSessionFailure
}

sealed interface CodexSessionOutcome {
    data class Completed(val exitCode: Int) : CodexSessionOutcome

    data class Rejected(val failure: CodexSessionFailure) : CodexSessionOutcome
}

class CodexSessionFacade(
    private val codex: CodexCliRunner = SystemCodexCliRunner(),
) {
    fun run(
        project: GradleProject,
        tools: DynamicToolCaller,
        arguments: CodexCliArguments,
    ): CodexSessionOutcome {
        val gradleServer = when (
            val started = GradleToolWireServer.start(LoopbackBinding.ephemeral(), project, tools)
        ) {
            is Refinement.Accepted -> started.value
            is Refinement.Rejected -> return CodexSessionOutcome.Rejected(
                CodexSessionFailure.GradleServer(started.failure),
            )
        }
        return gradleServer.use { server ->
            val bridge = when (
                val started = CodexAppServerBridge(
                    LoopbackBinding.ephemeral(),
                    project,
                    server.endpoint,
                ).start()
            ) {
                is Refinement.Accepted -> started.value
                is Refinement.Rejected -> return@use CodexSessionOutcome.Rejected(
                    CodexSessionFailure.AppServerBridge(started.failure),
                )
            }
            bridge.use { running ->
                when (val outcome = codex.run(project.root, running.endpoint, arguments)) {
                    is CodexCliRunOutcome.Completed -> CodexSessionOutcome.Completed(outcome.exitCode)
                    is CodexCliRunOutcome.Rejected -> CodexSessionOutcome.Rejected(
                        CodexSessionFailure.CodexCli(outcome.failure),
                    )
                }
            }
        }
    }
}
