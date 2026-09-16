# Module Boundary Rules

Treat public APIs, package ownership seams, modules, source sets, services,
repositories, controllers, queues, adapters, generated-code handoffs, persistence
records, and DTO-to-domain conversions as boundaries.

## Hard Rules

- Preserve established facts in boundary signatures or schemas.
- Parse primitive inputs before passing them deeper than the owning adapter.
- Return named domain values, closed outcomes, capabilities, state-specific
  values, or collections whose elements preserve meaning.
- Keep transport DTOs at the outer edge and make conversion explicit.
- Do not require callers to remember private control flow, prior validation,
  comments, or call order.
- Do not expose untyped maps, universal values, primitive statuses, ambiguous
  nulls, or a primitive plus a prose list of allowed values as domain results.

The review burden is on the weaker boundary. If a primitive truly is the public
contract, name the reason and the assertion that prevents repeated
interpretation downstream.
