package proof.forbidden

import proof.artifacts.*

fun bypass(artifact: UnverifiedArtifact): PublicationRequest =
    PublicationRequest.prepare(artifact)
