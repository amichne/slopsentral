package proof.artifacts

import java.security.MessageDigest

sealed interface DigestParse {
    data class Parsed(val digest: Sha256Digest) : DigestParse
    data class Rejected(val reason: DigestRejection) : DigestParse
}

enum class DigestRejection { WRONG_LENGTH, NON_LOWERCASE_HEX }

class Sha256Digest private constructor(private val hex: String) {
    fun sameAs(other: Sha256Digest): Boolean = hex == other.hex

    // Extraction belongs to the wire adapter, not application decisions.
    fun toWire(): String = hex

    companion object {
        fun parse(raw: String): DigestParse = when {
            raw.length != 64 -> DigestParse.Rejected(DigestRejection.WRONG_LENGTH)
            raw.any { it !in '0'..'9' && it !in 'a'..'f' } ->
                DigestParse.Rejected(DigestRejection.NON_LOWERCASE_HEX)
            else -> DigestParse.Parsed(Sha256Digest(raw))
        }

        internal fun of(bytes: ArtifactBytes): Sha256Digest {
            // SHA-256 is a required JVM algorithm. No expected error protocol
            // is implemented with an exception here.
            val digest = MessageDigest.getInstance("SHA-256").digest(bytes.toWire())
            val alphabet = "0123456789abcdef"
            return Sha256Digest(buildString(64) {
                for (byte in digest) {
                    val unsigned = byte.toInt() and 0xff
                    append(alphabet[unsigned ushr 4])
                    append(alphabet[unsigned and 0x0f])
                }
            })
        }
    }
}

sealed interface ContentParse {
    data class Parsed(val bytes: ArtifactBytes) : ContentParse
    data object Empty : ContentParse
}

// A head plus a privately owned tail represents nonemptiness structurally.
// Neither a mutable input array nor an extracted output array aliases storage.
class ArtifactBytes private constructor(
    private val head: Byte,
    private val tail: List<Byte>,
) {
    fun toWire(): ByteArray = byteArrayOf(head, *tail.toByteArray())

    companion object {
        fun parse(raw: ByteArray): ContentParse = when {
            raw.isEmpty() -> ContentParse.Empty
            else -> ContentParse.Parsed(ArtifactBytes(raw.first(), raw.drop(1)))
        }
    }
}

sealed interface Verification {
    sealed interface Verified : Verification { val artifact: VerifiedArtifact }
    sealed interface ChecksumMismatch : Verification {
        val expected: Sha256Digest
        val observed: Sha256Digest
    }
}

class UnverifiedArtifact private constructor(
    private val bytes: ArtifactBytes,
    private val expected: Sha256Digest,
) {
    fun verify(): Verification = VerifiedArtifact.verify(bytes, expected)

    companion object {
        fun prepare(bytes: ArtifactBytes, expected: Sha256Digest): UnverifiedArtifact =
            UnverifiedArtifact(bytes, expected)
    }
}

class VerifiedArtifact private constructor(
    private val bytes: ArtifactBytes,
    val digest: Sha256Digest,
) {
    private class Accepted(override val artifact: VerifiedArtifact) : Verification.Verified
    private class Mismatch(
        override val expected: Sha256Digest,
        override val observed: Sha256Digest,
    ) : Verification.ChecksumMismatch

    // This is the outbound serialization edge; mutation cannot change the proof.
    fun toWire(): ByteArray = bytes.toWire()

    companion object {
        fun verify(bytes: ArtifactBytes, expected: Sha256Digest): Verification {
            val observed = Sha256Digest.of(bytes)
            return if (expected.sameAs(observed)) {
                Accepted(VerifiedArtifact(bytes, observed))
            } else {
                Mismatch(expected, observed)
            }
        }
    }
}

// Pure preparation of the next state. An effect adapter may consume this
// request; this example makes no claim that publication has occurred.
class PublicationRequest private constructor(val artifact: VerifiedArtifact) {
    companion object {
        fun prepare(artifact: VerifiedArtifact): PublicationRequest =
            PublicationRequest(artifact)
    }
}
