# Parse, Don't Validate

Use this when external data enters the system.

## Boundary Rule

Treat CLI args, files, JSON, database rows, environment variables, network
payloads, and user input as untrusted. Convert them once into trusted domain
types, then keep raw primitives out of core logic.

## Shape

```kotlin
class ProjectName private constructor(private val text: String) {
    companion object {
        fun parse(raw: String): ParseProjectName =
            when (val normalized = raw.trim()) {
                "" -> ParseProjectName.Blank
                else -> ParseProjectName.Parsed(ProjectName(normalized))
            }
    }

    // Serialization is an explicit boundary; application APIs accept ProjectName.
    fun encode(): String = text
}

sealed interface ParseProjectName {
    data class Parsed(val name: ProjectName) : ParseProjectName
    data object Blank : ParseProjectName
}
```

The constructor is private and the successful case carries the stronger value.
The parser is the trusted owner of normalization and non-blank construction.
Use the repository's closed outcome convention; expected parse failure must
not fall back to an exception-backed `Result` or nullable sentinel.

## Review

- Raw input should not flow past the boundary.
- Failure should be observable and testable.
- Parsing should normalize once, not repeatedly re-check the same invariant.
