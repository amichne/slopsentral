package proof.forbidden

import proof.artifacts.*

fun forge(bytes: ArtifactBytes, digest: Sha256Digest): VerifiedArtifact =
    VerifiedArtifact(bytes, digest)
