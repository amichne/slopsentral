package io.github.amichne.slopsentral.gradle.domain

@JvmInline
value class ReleaseVersion private constructor(val value: String) {
    companion object {
        val CURRENT = ReleaseVersion("0.1.0")
    }

    override fun toString(): String = value
}
