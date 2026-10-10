# Parse, Don't Validate

Use this when external data enters the system.

## Boundary Rule

Treat CLI args, files, JSON, database rows, environment variables, network
payloads, and user input as untrusted. Convert them once into trusted domain
types, then keep raw primitives out of core logic.

## Shape

For this example, a page request accepts between 1 and 100 items. Parse the
transport integer into the domain value before constructing the request.

```kotlin
@JvmInline
value class PageSize private constructor(internal val count: Int) {
    companion object {
        fun parse(raw: Int): PageSizeParse = when (raw) {
            in 1..100 -> PageSizeParse.Parsed(PageSize(raw))
            else -> PageSizeParse.OutOfRange
        }
    }
}

sealed interface PageSizeParse {
    data class Parsed(val size: PageSize) : PageSizeParse
    data object OutOfRange : PageSizeParse
}

data class PageRequest(val size: PageSize)
```

The private constructor and companion `parse` function own the range invariant.
`PageRequest` accepts the learned fact, not another integer to re-check. Expected
parse failure is a closed outcome, not an exception-backed `Result` or null.

Prefer value classes for meaningful scalars. Direct value-class use on the JVM
can retain the underlying representation without allocating a wrapper. Generic,
interface, and some nullable uses can box; do not claim every call is allocation-free.

## Output Adapter

Domain values do not implement `encode`, `toWire`, or a format-specific serializer.
The owning module keeps `count` internal; application modules consume `PageSize`.
Its output adapter implements the shared `SerializationStrategy` abstraction:

```kotlin
import kotlinx.serialization.BinaryFormat
import kotlinx.serialization.SerializationStrategy
import kotlinx.serialization.StringFormat
import kotlinx.serialization.descriptors.PrimitiveKind
import kotlinx.serialization.descriptors.PrimitiveSerialDescriptor
import kotlinx.serialization.encoding.Encoder

private object PageSizeEncoding : SerializationStrategy<PageSize> {
    override val descriptor = PrimitiveSerialDescriptor("PageSize", PrimitiveKind.INT)

    override fun serialize(encoder: Encoder, value: PageSize) {
        encoder.encodeInt(value.count)
    }
}

fun encodeText(format: StringFormat, size: PageSize): String =
    format.encodeToString(PageSizeEncoding, size)

fun encodeBinary(format: BinaryFormat, size: PageSize): ByteArray =
    format.encodeToByteArray(PageSizeEncoding, size)
```

The adapter can pass `Json` to `encodeText` or `Cbor` to `encodeBinary` without
changing the domain model or its serialization strategy. Primitive extraction
occurs only here. Place the adapter in the module that owns the internal view;
the compiler does not restrict which code inside that trusted module reads it.
Ingress still decodes transport data and calls `PageSize.parse`. Do not let an
automatic domain deserializer bypass the parser.

See Kotlin's [value-class representation](https://kotlinlang.org/docs/inline-classes.html#representation)
and the format-independent [SerializationStrategy contract](https://kotlinlang.org/api/kotlinx.serialization/kotlinx-serialization-core/kotlinx.serialization/-serialization-strategy/).

## Review

- Raw input should not flow past the boundary.
- Failure should be observable and testable.
- Parsing should normalize once, not repeatedly re-check the same invariant.
- Core consumers require the value class; format selection and encoding stay in adapters.
