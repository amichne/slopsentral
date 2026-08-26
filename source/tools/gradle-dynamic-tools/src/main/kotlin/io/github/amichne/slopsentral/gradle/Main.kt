package io.github.amichne.slopsentral.gradle

import io.github.amichne.slopsentral.gradle.appserver.AppServerProcessFailure
import io.github.amichne.slopsentral.gradle.appserver.CodexAppServerClient
import io.github.amichne.slopsentral.gradle.appserver.CodexTurnOutcome
import io.github.amichne.slopsentral.gradle.appserver.ProcessJsonLineTransport
import io.github.amichne.slopsentral.gradle.domain.GradleProject
import io.github.amichne.slopsentral.gradle.domain.ProjectAdmissionFailure
import io.github.amichne.slopsentral.gradle.domain.Refinement
import io.github.amichne.slopsentral.gradle.runtime.GradleRunService
import io.github.amichne.slopsentral.gradle.runtime.SystemGradleExecutor
import io.github.amichne.slopsentral.gradle.wire.GradleToolDispatcher
import java.nio.file.Path
import kotlin.system.exitProcess

private const val usage =
    "Usage: gradle-dynamic-tools [--cwd REPOSITORY] [--model MODEL] -- PROMPT"

private data class CliConfiguration(
    val repository: Path,
    val model: String?,
    val prompt: String,
)

private enum class CliFailure {
    HELP_REQUESTED,
    MISSING_OPTION_VALUE,
    MISSING_PROMPT_SEPARATOR,
    EMPTY_PROMPT,
    UNKNOWN_OPTION,
}

private sealed interface CliAdmission {
    data class Accepted(val configuration: CliConfiguration) : CliAdmission

    data class Rejected(val failure: CliFailure) : CliAdmission
}

fun main(args: Array<String>) {
    val configuration = when (val admission = parseArguments(args)) {
        is CliAdmission.Accepted -> admission.configuration
        is CliAdmission.Rejected -> {
            val output = if (admission.failure == CliFailure.HELP_REQUESTED) System.out else System.err
            output.println(usage)
            exitProcess(if (admission.failure == CliFailure.HELP_REQUESTED) 0 else 2)
        }
    }

    val project = when (val admission = GradleProject.admit(configuration.repository)) {
        is Refinement.Accepted -> admission.value
        is Refinement.Rejected -> {
            System.err.println(admission.failure.cliMessage())
            exitProcess(2)
        }
    }

    GradleRunService(SystemGradleExecutor()).use { runs ->
        val dispatcher = GradleToolDispatcher(project.root, runs)
        when (val opening = ProcessJsonLineTransport.start(project.root)) {
            is Refinement.Rejected -> {
                System.err.println(opening.failure.cliMessage())
                exitProcess(3)
            }
            is Refinement.Accepted -> opening.value.use { transport ->
                when (
                    val outcome = CodexAppServerClient(transport, dispatcher).run(
                        repository = project.root,
                        prompt = configuration.prompt,
                        model = configuration.model,
                    )
                ) {
                    is CodexTurnOutcome.Completed -> println(outcome.finalAnswer)
                    is CodexTurnOutcome.Rejected -> {
                        System.err.println("${outcome.failure.code}: ${outcome.failure.message}")
                        exitProcess(4)
                    }
                }
            }
        }
    }
}

private fun parseArguments(args: Array<String>): CliAdmission {
    var repository = Path.of("").toAbsolutePath().normalize()
    var model: String? = null
    var index = 0
    while (index < args.size) {
        when (args[index]) {
            "--help", "-h" -> return CliAdmission.Rejected(CliFailure.HELP_REQUESTED)
            "--cwd" -> {
                if (index + 1 >= args.size) return CliAdmission.Rejected(CliFailure.MISSING_OPTION_VALUE)
                repository = Path.of(args[index + 1]).toAbsolutePath().normalize()
                index += 2
            }
            "--model" -> {
                if (index + 1 >= args.size) return CliAdmission.Rejected(CliFailure.MISSING_OPTION_VALUE)
                model = args[index + 1].takeIf(String::isNotBlank)
                    ?: return CliAdmission.Rejected(CliFailure.MISSING_OPTION_VALUE)
                index += 2
            }
            "--" -> {
                val prompt = args.drop(index + 1).joinToString(" ").trim()
                return if (prompt.isEmpty()) {
                    CliAdmission.Rejected(CliFailure.EMPTY_PROMPT)
                } else {
                    CliAdmission.Accepted(CliConfiguration(repository, model, prompt))
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
