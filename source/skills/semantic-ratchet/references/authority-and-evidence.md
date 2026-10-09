# Authority and Evidence

Keep compiler-issued identities and their original model or input universe in
consumer contracts. A matching name, path, signature, or reconstructed graph is
not evidence of the same authority. Preserve the identity through partitioning,
projection, retention, and restoration; reject mismatched or uninventoried inputs
before publishing a positive result.

Exactness of observed items, completeness of a declared universe, supported
model coverage, and freshness are distinct obligations. Exact items may form
an incomplete result. An absent item in an uncaptured module cannot become
a complete empty inventory. Closed outcomes must retain rejection causes and
recoverable partial evidence when the contract permits it. A complete-only
consumer accepts only established completion; it must not silently relabel
partial, stale, or rejected evidence as success.

Derive legal and forbidden cases from the consumer obligation: same authority
and admitted universe; a foreign model with matching-looking identities;
an uncaptured module; a closed lifetime; and a current budget rejected after
earlier successful capture. State which authority establishes each fact and
which mutable effects still need observation. Schema shape alone cannot prove
compiler issuance, universe completeness, or runtime freshness.

Source-confirmed examples are merged [Kast #956](https://github.com/amichne/kast/pull/956)
and [#958](https://github.com/amichne/kast/pull/958) for closed completion and
retained evidence, and [#965](https://github.com/amichne/kast/pull/965) for original
module input identity. [#966's tests](https://github.com/amichne/kast/blob/5713978aab5d43c5b5ddb63cc8b6008f0fc27659/runtime/hosted/src/test/kotlin/io/github/amichne/kast/runtime/hosted/HostedReadCallbackPartitionsTest.kt)
reject foreign models, uncaptured modules, closed reads, and expired parent
budgets. This reference adopts those bounded principles; it does not claim
to have reproduced Kast's native or installed behavior.
