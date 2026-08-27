@file:OptIn(kotlinx.serialization.ExperimentalSerializationApi::class)

package io.github.amichne.slopsentral.gradle.history

import io.github.amichne.slopsentral.gradle.domain.DebugEndpoint
import io.github.amichne.slopsentral.gradle.domain.Refinement
import io.github.amichne.slopsentral.gradle.domain.RunId
import io.github.amichne.slopsentral.gradle.domain.RunState
import io.github.amichne.slopsentral.gradle.domain.RunSummary
import kotlinx.serialization.Serializable
import kotlinx.serialization.SerializationException
import kotlinx.serialization.decodeFromString
import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.Json
import java.io.IOException
import java.nio.ByteBuffer
import java.nio.channels.FileChannel
import java.nio.channels.FileLock
import java.nio.channels.OverlappingFileLockException
import java.nio.charset.StandardCharsets
import java.nio.file.AtomicMoveNotSupportedException
import java.nio.file.Files
import java.nio.file.Path
import java.nio.file.StandardCopyOption
import java.nio.file.StandardOpenOption
import java.time.Instant
import java.time.format.DateTimeParseException
import java.util.concurrent.atomic.AtomicBoolean

private val historyJson = Json {
    encodeDefaults = true
    explicitNulls = false
    ignoreUnknownKeys = false
}

enum class RunPersistenceFailure {
    LOCK_HELD,
    LEASE_CLOSED,
    LEASE_MISMATCH,
    IO_FAILURE,
    CORRUPT_HISTORY,
    UNKNOWN_RUN,
}

interface RunLease : AutoCloseable {
    val runId: RunId

    fun write(summary: RunSummary): Refinement<Unit, RunPersistenceFailure>

    override fun close()
}

interface RunHistoryStore {
    fun acquire(runId: RunId): Refinement<RunLease, RunPersistenceFailure>

    fun read(runId: RunId): Refinement<RunSummary, RunPersistenceFailure>

    fun list(limit: Int): Refinement<List<RunSummary>, RunPersistenceFailure>

    fun activeOwner(): Refinement<RunId?, RunPersistenceFailure>
}

class InMemoryRunHistoryStore : RunHistoryStore {
    private val monitor = Any()
    private val summaries = mutableMapOf<RunId, RunSummary>()
    private var leasedRunId: RunId? = null

    override fun acquire(runId: RunId): Refinement<RunLease, RunPersistenceFailure> = synchronized(monitor) {
        if (leasedRunId != null) {
            Refinement.Rejected(RunPersistenceFailure.LOCK_HELD)
        } else {
            leasedRunId = runId
            val closed = AtomicBoolean(false)
            Refinement.Accepted(
                object : RunLease {
                    override val runId = runId

                    override fun write(summary: RunSummary): Refinement<Unit, RunPersistenceFailure> =
                        synchronized(monitor) {
                            when {
                                closed.get() || leasedRunId != runId ->
                                    Refinement.Rejected(RunPersistenceFailure.LEASE_CLOSED)
                                summary.runId != runId ->
                                    Refinement.Rejected(RunPersistenceFailure.LEASE_MISMATCH)
                                else -> {
                                    summaries[summary.runId] = summary
                                    Refinement.Accepted(Unit)
                                }
                            }
                        }

                    override fun close() {
                        if (closed.compareAndSet(false, true)) {
                            synchronized(monitor) {
                                if (leasedRunId == runId) leasedRunId = null
                            }
                        }
                    }
                },
            )
        }
    }

    override fun read(runId: RunId): Refinement<RunSummary, RunPersistenceFailure> = synchronized(monitor) {
        summaries[runId]?.let(Refinement<RunSummary, RunPersistenceFailure>::Accepted)
            ?: Refinement.Rejected(RunPersistenceFailure.UNKNOWN_RUN)
    }

    override fun list(limit: Int): Refinement<List<RunSummary>, RunPersistenceFailure> = synchronized(monitor) {
        Refinement.Accepted(summaries.values.sortedByDescending(RunSummary::startedAt).take(limit))
    }

    override fun activeOwner(): Refinement<RunId?, RunPersistenceFailure> = synchronized(monitor) {
        Refinement.Accepted(leasedRunId)
    }
}

class FileRunHistoryStore(repositoryRoot: Path) : RunHistoryStore {
    private val storageRoot = repositoryRoot.toAbsolutePath().normalize()
        .resolve(".gradle/codex-dynamic-tools")
    private val runsRoot = storageRoot.resolve("runs")
    private val activeLock = storageRoot.resolve("active.lock")

    override fun acquire(runId: RunId): Refinement<RunLease, RunPersistenceFailure> {
        val channel = try {
            Files.createDirectories(storageRoot)
            FileChannel.open(
                activeLock,
                StandardOpenOption.CREATE,
                StandardOpenOption.READ,
                StandardOpenOption.WRITE,
            )
        } catch (_: IOException) {
            return Refinement.Rejected(RunPersistenceFailure.IO_FAILURE)
        } catch (_: SecurityException) {
            return Refinement.Rejected(RunPersistenceFailure.IO_FAILURE)
        }

        val lock = try {
            channel.tryLock()
        } catch (_: OverlappingFileLockException) {
            null
        } catch (_: IOException) {
            channel.closeQuietly()
            return Refinement.Rejected(RunPersistenceFailure.IO_FAILURE)
        }
        if (lock == null) {
            channel.closeQuietly()
            return Refinement.Rejected(RunPersistenceFailure.LOCK_HELD)
        }

        return try {
            val metadata = runId.value.toString().toByteArray(StandardCharsets.UTF_8)
            channel.truncate(0)
            channel.position(0)
            channel.write(ByteBuffer.wrap(metadata))
            channel.force(true)
            Refinement.Accepted(FileRunLease(runId, lock, channel, ::writeOwned))
        } catch (_: IOException) {
            lock.releaseQuietly()
            channel.closeQuietly()
            Refinement.Rejected(RunPersistenceFailure.IO_FAILURE)
        }
    }

    private fun writeOwned(summary: RunSummary): Refinement<Unit, RunPersistenceFailure> = try {
        Files.createDirectories(runsRoot)
        val destination = summary.path()
        val temporary = Files.createTempFile(runsRoot, ".${summary.runId.value}-", ".tmp")
        try {
            Files.writeString(
                temporary,
                historyJson.encodeToString(summary.toDocument()),
                StandardCharsets.UTF_8,
                StandardOpenOption.TRUNCATE_EXISTING,
            )
            try {
                Files.move(
                    temporary,
                    destination,
                    StandardCopyOption.ATOMIC_MOVE,
                    StandardCopyOption.REPLACE_EXISTING,
                )
            } catch (_: AtomicMoveNotSupportedException) {
                Files.move(temporary, destination, StandardCopyOption.REPLACE_EXISTING)
            }
        } finally {
            Files.deleteIfExists(temporary)
        }
        Refinement.Accepted(Unit)
    } catch (_: IOException) {
        Refinement.Rejected(RunPersistenceFailure.IO_FAILURE)
    } catch (_: SecurityException) {
        Refinement.Rejected(RunPersistenceFailure.IO_FAILURE)
    }

    override fun read(runId: RunId): Refinement<RunSummary, RunPersistenceFailure> {
        val path = runId.path()
        if (!Files.exists(path)) return Refinement.Rejected(RunPersistenceFailure.UNKNOWN_RUN)
        return decode(path)
    }

    override fun list(limit: Int): Refinement<List<RunSummary>, RunPersistenceFailure> = try {
        Files.createDirectories(runsRoot)
        val paths = Files.list(runsRoot).use { stream ->
            stream.filter { it.fileName.toString().endsWith(".json") }.toList()
        }
        val summaries = ArrayList<RunSummary>(paths.size)
        for (path in paths) {
            when (val decoded = decode(path)) {
                is Refinement.Accepted -> summaries += decoded.value
                is Refinement.Rejected -> return decoded
            }
        }
        Refinement.Accepted(
            summaries.sortedWith(
                compareByDescending<RunSummary>(RunSummary::startedAt)
                    .thenByDescending { it.runId.value.toString() },
            ).take(limit),
        )
    } catch (_: IOException) {
        Refinement.Rejected(RunPersistenceFailure.IO_FAILURE)
    } catch (_: SecurityException) {
        Refinement.Rejected(RunPersistenceFailure.IO_FAILURE)
    }

    override fun activeOwner(): Refinement<RunId?, RunPersistenceFailure> {
        val channel = try {
            Files.createDirectories(storageRoot)
            FileChannel.open(
                activeLock,
                StandardOpenOption.CREATE,
                StandardOpenOption.READ,
                StandardOpenOption.WRITE,
            )
        } catch (_: IOException) {
            return Refinement.Rejected(RunPersistenceFailure.IO_FAILURE)
        } catch (_: SecurityException) {
            return Refinement.Rejected(RunPersistenceFailure.IO_FAILURE)
        }
        val probe = try {
            channel.tryLock()
        } catch (_: OverlappingFileLockException) {
            null
        } catch (_: IOException) {
            channel.closeQuietly()
            return Refinement.Rejected(RunPersistenceFailure.IO_FAILURE)
        }
        if (probe != null) {
            probe.releaseQuietly()
            channel.closeQuietly()
            return Refinement.Accepted(null)
        }
        channel.closeQuietly()
        return try {
            when (val admitted = RunId.admit(Files.readString(activeLock).trim())) {
                is Refinement.Accepted -> Refinement.Accepted(admitted.value)
                is Refinement.Rejected -> Refinement.Rejected(RunPersistenceFailure.CORRUPT_HISTORY)
            }
        } catch (_: IOException) {
            Refinement.Rejected(RunPersistenceFailure.IO_FAILURE)
        } catch (_: SecurityException) {
            Refinement.Rejected(RunPersistenceFailure.IO_FAILURE)
        }
    }

    private fun decode(path: Path): Refinement<RunSummary, RunPersistenceFailure> = try {
        val document = historyJson.decodeFromString<PersistedRunSummaryDocument>(Files.readString(path))
        document.toDomain()?.let(Refinement<RunSummary, RunPersistenceFailure>::Accepted)
            ?: Refinement.Rejected(RunPersistenceFailure.CORRUPT_HISTORY)
    } catch (_: IOException) {
        Refinement.Rejected(RunPersistenceFailure.IO_FAILURE)
    } catch (_: SecurityException) {
        Refinement.Rejected(RunPersistenceFailure.IO_FAILURE)
    } catch (_: SerializationException) {
        Refinement.Rejected(RunPersistenceFailure.CORRUPT_HISTORY)
    } catch (_: IllegalArgumentException) {
        Refinement.Rejected(RunPersistenceFailure.CORRUPT_HISTORY)
    }

    private fun RunSummary.path(): Path = runId.path()

    private fun RunId.path(): Path = runsRoot.resolve("$value.json")
}

private class FileRunLease(
    override val runId: RunId,
    private val lock: FileLock,
    private val channel: FileChannel,
    private val writer: (RunSummary) -> Refinement<Unit, RunPersistenceFailure>,
) : RunLease {
    private val closed = AtomicBoolean(false)

    override fun write(summary: RunSummary): Refinement<Unit, RunPersistenceFailure> = when {
        closed.get() -> Refinement.Rejected(RunPersistenceFailure.LEASE_CLOSED)
        summary.runId != runId -> Refinement.Rejected(RunPersistenceFailure.LEASE_MISMATCH)
        else -> writer(summary)
    }

    override fun close() {
        if (closed.compareAndSet(false, true)) {
            lock.releaseQuietly()
            channel.closeQuietly()
        }
    }
}

@Serializable
private data class PersistedDebugEndpointDocument(
    val type: String = "DEBUG_ENDPOINT",
    val host: String,
    val port: Int,
)

@Serializable
private data class PersistedRunSummaryDocument(
    val type: String = "RUN_SUMMARY",
    val runId: String,
    val state: String,
    val command: List<String>,
    val startedAt: String,
    val finishedAt: String? = null,
    val exitCode: Int? = null,
    val durationMillis: Long? = null,
    val debugEndpoint: PersistedDebugEndpointDocument? = null,
)

private fun RunSummary.toDocument(): PersistedRunSummaryDocument = PersistedRunSummaryDocument(
    runId = runId.value.toString(),
    state = state.name,
    command = command,
    startedAt = startedAt.toString(),
    finishedAt = finishedAt?.toString(),
    exitCode = exitCode,
    durationMillis = durationMillis,
    debugEndpoint = debugEndpoint?.let {
        PersistedDebugEndpointDocument(host = it.host, port = it.port)
    },
)

private fun PersistedRunSummaryDocument.toDomain(): RunSummary? {
    if (type != "RUN_SUMMARY" || command.isEmpty() || durationMillis?.let { it < 0 } == true) return null
    val admittedRunId = RunId.admit(runId)
    if (admittedRunId !is Refinement.Accepted) return null
    val admittedEndpoint = debugEndpoint?.let { endpoint ->
        if (endpoint.type != "DEBUG_ENDPOINT" || endpoint.host != "127.0.0.1") return null
        when (val admitted = DebugEndpoint.loopback(endpoint.port)) {
            is Refinement.Accepted -> admitted.value
            is Refinement.Rejected -> return null
        }
    }
    val parsedState = runCatching { RunState.valueOf(state) }.getOrNull() ?: return null
    if (parsedState == RunState.ABANDONED) return null
    val parsedStartedAt = startedAt.parseInstant() ?: return null
    val parsedFinishedAt = finishedAt?.parseInstant() ?: if (finishedAt == null) null else return null
    if (parsedState.isActive && (parsedFinishedAt != null || exitCode != null || durationMillis != null)) return null
    return RunSummary(
        runId = admittedRunId.value,
        state = parsedState,
        command = command,
        startedAt = parsedStartedAt,
        finishedAt = parsedFinishedAt,
        exitCode = exitCode,
        durationMillis = durationMillis,
        debugEndpoint = admittedEndpoint,
    )
}

private fun String.parseInstant(): Instant? = try {
    Instant.parse(this)
} catch (_: DateTimeParseException) {
    null
}

private fun FileLock.releaseQuietly() {
    try {
        release()
    } catch (_: IOException) {}
}

private fun FileChannel.closeQuietly() {
    try {
        close()
    } catch (_: IOException) {}
}
