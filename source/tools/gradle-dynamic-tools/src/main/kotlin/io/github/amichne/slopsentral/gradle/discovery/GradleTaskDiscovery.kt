package io.github.amichne.slopsentral.gradle.discovery

import io.github.amichne.slopsentral.gradle.domain.DiscoveredGradleTask
import io.github.amichne.slopsentral.gradle.domain.GradleProject
import io.github.amichne.slopsentral.gradle.domain.Refinement
import io.github.amichne.slopsentral.gradle.domain.TaskDiscovery
import io.github.amichne.slopsentral.gradle.domain.TaskDiscoveryRequest
import kotlinx.serialization.Serializable
import kotlinx.serialization.SerializationException
import kotlinx.serialization.decodeFromString
import kotlinx.serialization.json.Json
import java.io.IOException
import java.nio.charset.StandardCharsets
import java.nio.file.AtomicMoveNotSupportedException
import java.nio.file.Files
import java.nio.file.StandardCopyOption
import java.nio.file.Path

private const val discoveryOutputPrefix = "CODEX_GRADLE_DISCOVERY:"
private const val discoveryInitScriptResource = "/gradle-dynamic-tools-discovery.init.gradle"
private const val discoveryQueryEnvironment = "CODEX_GRADLE_DISCOVERY_QUERY"
private const val discoveryLimitEnvironment = "CODEX_GRADLE_DISCOVERY_LIMIT"

private val discoveryJson = Json { ignoreUnknownKeys = false }

enum class GradleTaskDiscoveryFailure {
    CONNECTION_FAILED,
    MODEL_UNAVAILABLE,
}

fun interface GradleTaskDiscoverer {
    fun discover(
        project: GradleProject,
        request: TaskDiscoveryRequest,
    ): Refinement<TaskDiscovery, GradleTaskDiscoveryFailure>
}

class WrapperGradleTaskDiscoverer : GradleTaskDiscoverer {
    override fun discover(
        project: GradleProject,
        request: TaskDiscoveryRequest,
    ): Refinement<TaskDiscovery, GradleTaskDiscoveryFailure> {
        val script = when (val installation = installInitScript(project.root)) {
            is Refinement.Accepted -> installation.value
            is Refinement.Rejected -> return installation
        }
        val process = try {
            ProcessBuilder(
                project.wrapper.toString(),
                "--console=plain",
                "--quiet",
                "--no-configuration-cache",
                "--init-script",
                script.toString(),
                ":codexDynamicToolsDiscoveryProbe",
            ).directory(project.root.toFile())
                .redirectErrorStream(true)
                .apply {
                    environment()[discoveryQueryEnvironment] = request.query?.value.orEmpty()
                    environment()[discoveryLimitEnvironment] = request.limit.value.toString()
                }
                .start()
        } catch (_: IOException) {
            return Refinement.Rejected(GradleTaskDiscoveryFailure.CONNECTION_FAILED)
        } catch (_: SecurityException) {
            return Refinement.Rejected(GradleTaskDiscoveryFailure.CONNECTION_FAILED)
        }

        val output = try {
            process.inputReader(StandardCharsets.UTF_8).use { it.readLines() }
        } catch (_: IOException) {
            process.destroyForcibly()
            return Refinement.Rejected(GradleTaskDiscoveryFailure.CONNECTION_FAILED)
        }
        if (process.waitFor() != 0) {
            return Refinement.Rejected(GradleTaskDiscoveryFailure.CONNECTION_FAILED)
        }
        val payload = output.lastOrNull { it.startsWith(discoveryOutputPrefix) }
            ?.removePrefix(discoveryOutputPrefix)
            ?: return Refinement.Rejected(GradleTaskDiscoveryFailure.MODEL_UNAVAILABLE)
        return try {
            val document = discoveryJson.decodeFromString<DiscoveryProbeDocument>(payload)
            Refinement.Accepted(
                TaskDiscovery(
                    tasks = document.tasks.map(DiscoveryTaskDocument::toDomain),
                    truncated = document.truncated,
                ),
            )
        } catch (_: SerializationException) {
            Refinement.Rejected(GradleTaskDiscoveryFailure.MODEL_UNAVAILABLE)
        } catch (_: IllegalArgumentException) {
            Refinement.Rejected(GradleTaskDiscoveryFailure.MODEL_UNAVAILABLE)
        }
    }
}

private fun installInitScript(
    repository: Path,
): Refinement<Path, GradleTaskDiscoveryFailure> = try {
    val directory = repository.resolve(".gradle/codex-dynamic-tools")
    Files.createDirectories(directory)
    val target = directory.resolve("discovery.init.gradle")
    val temporary = Files.createTempFile(directory, "discovery.init.", ".tmp")
    WrapperGradleTaskDiscoverer::class.java.getResourceAsStream(discoveryInitScriptResource).use { input ->
        requireNotNull(input)
        Files.copy(input, temporary, StandardCopyOption.REPLACE_EXISTING)
    }
    try {
        Files.move(
            temporary,
            target,
            StandardCopyOption.ATOMIC_MOVE,
            StandardCopyOption.REPLACE_EXISTING,
        )
    } catch (_: AtomicMoveNotSupportedException) {
        Files.move(temporary, target, StandardCopyOption.REPLACE_EXISTING)
    }
    Refinement.Accepted(target)
} catch (_: IOException) {
    Refinement.Rejected(GradleTaskDiscoveryFailure.CONNECTION_FAILED)
} catch (_: SecurityException) {
    Refinement.Rejected(GradleTaskDiscoveryFailure.CONNECTION_FAILED)
} catch (_: IllegalArgumentException) {
    Refinement.Rejected(GradleTaskDiscoveryFailure.MODEL_UNAVAILABLE)
}

@Serializable
private data class DiscoveryProbeDocument(
    val tasks: List<DiscoveryTaskDocument>,
    val truncated: Boolean,
)

@Serializable
private data class DiscoveryTaskDocument(
    val path: String,
    val name: String,
    val projectPath: String,
    val group: String? = null,
    val description: String? = null,
)

private fun DiscoveryTaskDocument.toDomain(): DiscoveredGradleTask = DiscoveredGradleTask(
    path = path,
    name = name,
    projectPath = projectPath,
    group = group,
    description = description,
)
