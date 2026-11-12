package proof.forbidden

import proof.artifacts.*

fun forget(outcome: Verification): String = when (outcome) {
    is Verification.Verified -> "VERIFIED"
}
