# Broker

This directory is one strict TypeScript package. The canonical check is `npm run check`.

- `protocol` may depend on generated Codex contracts and provider-neutral broker types, never on a
  provider implementation.
- `broker` is pure provider-neutral catalog, decode, routing, lifecycle, and failure logic.
- `providers` own process adapters and domain contracts but never import Codex protocol types.
- `runtime` is the only composition root and owns sockets, persistence, supervision, configuration,
  and shutdown.
- Add a provider only in `src/runtime/composition.ts`; provider addition must not require semantic
  broker or protocol changes.
- External input must be runtime-decoded before it enters a provider. Do not add `any`, coercion,
  repair, fuzzy routing, a shell fallback, or unchecked assertions outside the protocol boundary.
- Generated protocol artifacts are outputs of the qualified `codex` binary. Regenerate them; never
  patch them by hand.
- Keep all resource limits finite and all expected failures exhaustive data.
