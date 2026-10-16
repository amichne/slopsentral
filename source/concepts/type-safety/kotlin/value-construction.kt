private const val ORDER_SEPARATOR = "::"

@JvmInline
value class TenantId private constructor(val value: String) {
    companion object {
        fun parse(raw: String): TenantIdParse = when {
            raw.isBlank() -> TenantIdParse.Rejected(TenantIdFailure.BLANK)
            ORDER_SEPARATOR in raw -> TenantIdParse.Rejected(TenantIdFailure.RESERVED_SEPARATOR)
            else -> TenantIdParse.Parsed(TenantId(raw))
        }
    }

    override fun toString(): String = value
}

enum class TenantIdFailure { BLANK, RESERVED_SEPARATOR }
sealed interface TenantIdParse {
    data class Parsed(val tenant: TenantId) : TenantIdParse
    data class Rejected(val reason: TenantIdFailure) : TenantIdParse
}

@JvmInline
value class OrderSequence private constructor(val value: Long) {
    companion object {
        fun parse(raw: String): OrderSequenceParse {
            val value = raw.toLongOrNull()
                ?: return OrderSequenceParse.Rejected(OrderSequenceFailure.NOT_A_LONG)
            return if (value > 0) OrderSequenceParse.Parsed(OrderSequence(value))
            else OrderSequenceParse.Rejected(OrderSequenceFailure.NOT_POSITIVE)
        }
    }
}

enum class OrderSequenceFailure { NOT_A_LONG, NOT_POSITIVE }
sealed interface OrderSequenceParse {
    data class Parsed(val sequence: OrderSequence) : OrderSequenceParse
    data class Rejected(val reason: OrderSequenceFailure) : OrderSequenceParse
}

@ConsistentCopyVisibility
data class OrderId private constructor(val tenant: TenantId, val sequence: OrderSequence) {
    companion object {
        fun create(tenant: TenantId, sequence: OrderSequence): OrderId = OrderId(tenant, sequence)

        fun parse(raw: String): OrderIdParse {
            // The tenant may end in a single colon, overlapping the separator.
            val separatorIndex = raw.lastIndexOf(ORDER_SEPARATOR)
            if (separatorIndex < 0) return OrderIdParse.MalformedShape
            val rawTenant = raw.substring(0, separatorIndex)
            if (ORDER_SEPARATOR in rawTenant) return OrderIdParse.MalformedShape
            val tenant = when (val parsed = TenantId.parse(rawTenant)) {
                is TenantIdParse.Parsed -> parsed.tenant
                is TenantIdParse.Rejected -> return OrderIdParse.InvalidTenant(parsed.reason)
            }
            val sequence = when (val parsed = OrderSequence.parse(raw.substring(separatorIndex + ORDER_SEPARATOR.length))) {
                is OrderSequenceParse.Parsed -> parsed.sequence
                is OrderSequenceParse.Rejected -> return OrderIdParse.InvalidSequence(parsed.reason)
            }
            return OrderIdParse.Parsed(create(tenant, sequence))
        }
    }

    // Raw encoding exists only at the serialization edge; fields retain their proofs.
    override fun toString(): String = "${tenant.value}$ORDER_SEPARATOR${sequence.value}"
}

sealed interface OrderIdParse {
    data class Parsed(val order: OrderId) : OrderIdParse
    data object MalformedShape : OrderIdParse
    data class InvalidTenant(val reason: TenantIdFailure) : OrderIdParse
    data class InvalidSequence(val reason: OrderSequenceFailure) : OrderIdParse
}
