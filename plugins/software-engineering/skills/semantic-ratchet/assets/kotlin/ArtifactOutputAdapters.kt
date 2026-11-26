package proof.artifacts

// Output adapters own representation choices. Domain models have no encoder.
fun interface OutputEncoder<in Value, out Representation> {
    fun encode(value: Value): Representation
}

object DigestTextOutput : OutputEncoder<Sha256Digest, String> {
    override fun encode(value: Sha256Digest): String = value.hex
}

object ArtifactSnapshotOutput : OutputEncoder<ArtifactBytes, ByteArray> {
    override fun encode(value: ArtifactBytes): ByteArray =
        buildList { value.forEachByte { add(it) } }.toByteArray()
}

object VerifiedArtifactBytesOutput : OutputEncoder<VerifiedArtifact, ByteArray> {
    override fun encode(value: VerifiedArtifact): ByteArray =
        ArtifactSnapshotOutput.encode(value.bytes)
}
