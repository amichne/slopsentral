# Broker

This directory is one strict TypeScript package. The canonical check is `npm run check`.

- `protocol` may depend on runtime-injected Codex schema validators and provider-neutral broker
  types, never on a provider implementation.
- `broker` is pure provider-neutral catalog, decode, routing, lifecycle, and failure logic.
- `providers` own process adapters and domain contracts but never import Codex protocol types.
- `runtime` is the only composition root and owns sockets, persistence, supervision, configuration,
  and shutdown.
- Add a provider only in `src/runtime/composition.ts`; provider addition must not require semantic
  broker or protocol changes.
- External input must be runtime-decoded before it enters a provider. Do not add `any`, coercion,
  repair, fuzzy routing, a shell fallback, or unchecked assertions outside the protocol boundary.
- Codex protocol schemas and Kast capability schemas are ephemeral outputs of their configured
  binaries. Qualify them at runtime; do not check generated protocol trees or pinned capability
  snapshots into this package.
- Keep all resource limits finite and all expected failures exhaustive data.
