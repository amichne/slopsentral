package proof.forbidden

import proof.artifacts.*

fun mislabel(digest: Sha256Digest): Verification.ChecksumMismatch =
    Verification.ChecksumMismatch(digest, digest)
