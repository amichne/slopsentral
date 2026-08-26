package io.github.amichne.slopsentral.gradle.discovery

import io.github.amichne.slopsentral.gradle.domain.DiscoveredGradleTask
import io.github.amichne.slopsentral.gradle.domain.GradleProject
import io.github.amichne.slopsentral.gradle.domain.Refinement
import io.github.amichne.slopsentral.gradle.domain.TaskDiscovery
import io.github.amichne.slopsentral.gradle.domain.TaskDiscoveryRequest
import org.gradle.tooling.GradleConnectionException
import org.gradle.tooling.GradleConnector
import org.gradle.tooling.UnknownModelException
import org.gradle.tooling.model.GradleProject as ToolingGradleProject
import java.util.Locale

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

class ToolingApiGradleTaskDiscoverer : GradleTaskDiscoverer {
    override fun discover(
        project: GradleProject,
        request: TaskDiscoveryRequest,
    ): Refinement<TaskDiscovery, GradleTaskDiscoveryFailure> = try {
        GradleConnector.newConnector()
            .forProjectDirectory(project.root.toFile())
            .connect()
            .use { connection ->
                val model = connection.getModel(ToolingGradleProject::class.java)
                val matching = model.flatten()
                    .flatMap { toolingProject ->
                        toolingProject.tasks.map { task ->
                            DiscoveredGradleTask(
                                path = task.path,
                                name = task.name,
                                projectPath = toolingProject.path,
                                group = task.group?.takeIf(String::isNotBlank),
                                description = task.description?.takeIf(String::isNotBlank),
                            )
                        }
                    }
                    .distinctBy(DiscoveredGradleTask::path)
                    .filter { task -> request.query?.value?.let(task::contains) ?: true }
                    .sortedBy(DiscoveredGradleTask::path)
                Refinement.Accepted(
                    TaskDiscovery(
                        tasks = matching.take(request.limit.value),
                        truncated = matching.size > request.limit.value,
                    ),
                )
            }
    } catch (_: UnknownModelException) {
        Refinement.Rejected(GradleTaskDiscoveryFailure.MODEL_UNAVAILABLE)
    } catch (_: GradleConnectionException) {
        Refinement.Rejected(GradleTaskDiscoveryFailure.CONNECTION_FAILED)
    } catch (_: SecurityException) {
        Refinement.Rejected(GradleTaskDiscoveryFailure.CONNECTION_FAILED)
    }
}

private fun ToolingGradleProject.flatten(): List<ToolingGradleProject> =
    listOf(this) + children.flatMap(ToolingGradleProject::flatten)

private fun DiscoveredGradleTask.contains(query: String): Boolean {
    val normalized = query.lowercase(Locale.ROOT)
    return sequenceOf(path, name, projectPath, group, description)
        .filterNotNull()
        .any { normalized in it.lowercase(Locale.ROOT) }
}
