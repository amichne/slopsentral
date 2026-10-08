package proof.consumer

import proof.artifacts.*

fun parsedDigest(raw: String): Sha256Digest = when (val parsed = Sha256Digest.parse(raw)) {
    is DigestParse.Parsed -> parsed.digest
    is DigestParse.Rejected -> error("Fixture digest was rejected: ${parsed.reason}")
}

fun parsedBytes(raw: ByteArray): ArtifactBytes = when (val parsed = ArtifactBytes.parse(raw)) {
    is ContentParse.Parsed -> parsed.bytes
    ContentParse.Empty -> error("Fixture content was empty")
}

fun describe(outcome: Verification): String = when (outcome) {
    is Verification.Verified -> "VERIFIED"
    is Verification.ChecksumMismatch -> "CHECKSUM_MISMATCH"
}

fun main() {
    val raw = "hello\n".toByteArray()
    val bytes = parsedBytes(raw)
    val expected = parsedDigest("5891b5b522d5df086d0ff0b110fbd9d21bb4fc7163af34d08286a2e846f6be03")
    raw.fill(0) // Mutation of the boundary input cannot invalidate stored bytes.
    ArtifactSnapshotOutput.encode(bytes).fill(0) // Output arrays do not alias storage.
    val outcome = UnverifiedArtifact.prepare(bytes, expected).verify()
    check(describe(outcome) == "VERIFIED")
    when (outcome) {
        is Verification.Verified -> {
            val request = PublicationRequest.prepare(outcome.artifact)
            check(VerifiedArtifactBytesOutput.encode(request.artifact)
                .contentEquals("hello\n".toByteArray()))
            check(request.artifact.digest.sameAs(expected))
            check(DigestTextOutput.encode(request.artifact.digest) ==
                "5891b5b522d5df086d0ff0b110fbd9d21bb4fc7163af34d08286a2e846f6be03")
        }
        is Verification.ChecksumMismatch -> error("Matching fixture failed verification")
    }
    val wrongDigest = parsedDigest("0".repeat(64))
    when (val mismatch = UnverifiedArtifact.prepare(bytes, wrongDigest).verify()) {
        is Verification.Verified -> error("Mismatching fixture was accepted")
        is Verification.ChecksumMismatch -> {
            check(mismatch.expected.sameAs(wrongDigest))
            check(mismatch.observed.sameAs(expected))
        }
    }
    check(ArtifactBytes.parse(byteArrayOf()) == ContentParse.Empty)
    check(Sha256Digest.parse("abc") == DigestParse.Rejected(DigestRejection.WRONG_LENGTH))
    check(Sha256Digest.parse("G".repeat(64)) ==
        DigestParse.Rejected(DigestRejection.NON_LOWERCASE_HEX))
    println("KOTLIN_PROOFS_OK")
}
