sealed interface CompilerProof {
    data object Ready : CompilerProof
    data object Limited : CompilerProof
}

fun describe(proof: CompilerProof): String = when (proof) {
    CompilerProof.Ready -> "ready"
}
