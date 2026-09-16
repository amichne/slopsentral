# kotlinx.serialization and Ktor

Use this reference for serialized boundaries and Ktor server or client adapters.

## Keep the dependency at the edge

- Keep domain types and capability interfaces free of `ApplicationCall`,
  `HttpClient`, `HttpRequestBuilder`, `HttpResponse`, Ktor engine types,
  `JsonElement`, `KSerializer`, and serialization annotations added only for
  transport convenience.
- Put HTTP request and response DTOs in the Ktor or wire adapter. Map each DTO
  to a trusted domain type before calling core logic.
- If a serialized schema is itself a public contract, give it a dedicated wire
  contract module. Do not make the wire model the domain model by default.
- Let the integration module select the Ktor server engine, Ktor client engine,
  plugins, endpoints, credentials, and concrete adapter. If that selection
  requires Ktor objects, construct the adapter inside the integration owner.
  Do not expose a Ktor-typed adapter constructor across modules.

## Use kotlinx.serialization deliberately

- Prefer generated `@Serializable` models over hand-written JSON encoding and
  decoding.
- Own one configured `Json` instance per wire contract or application boundary.
  Decide unknown-key handling, defaults, null behavior, polymorphism, and class
  discriminators from compatibility requirements. Do not scatter anonymous
  `Json { ... }` instances through call sites.
- Use custom serializers for a real wire representation, not to bypass a weak
  domain model.
- Use `JsonElement` only while the payload is genuinely open or partially
  unknown. Refine known content to a typed DTO before it enters core code.
- Keep wire defaults separate from domain defaults. A missing field must not
  manufacture a valid domain value unless the contract defines that meaning.

## Keep Ktor adapters thin

- Install only the Ktor plugins the boundary uses. Configure
  `ContentNegotiation` with the owned kotlinx.serialization `Json` instance.
- Server routes parse transport input, invoke a domain capability, and project
  the typed outcome to status, headers, and a response DTO. Keep business rules
  out of routing blocks.
- Client adapters own URL construction, headers, authentication, timeouts,
  transport retries, and response decoding. Expose domain operations and typed
  failures to callers.
- Reuse an `HttpClient` for its owned lifecycle and close it at the application
  boundary. Do not create one client per request.
- Use a Ktor retry plugin or another established policy implementation when
  retries are valid. Keep idempotency and domain retry decisions explicit.
- Make engine selection a deployment decision. Do not make one engine a
  domain dependency.

## Test the contracts

- Test serializers with representative fixtures, missing and unknown fields,
  invalid values, defaults, nulls, and compatibility cases. A round trip alone
  does not prove the external contract.
- Test Ktor servers with `testApplication`. Assert status, headers, body, and
  typed failure projection without binding a real port.
- Test Ktor clients with `MockEngine`. Assert the outgoing method, URL, headers,
  body, timeout or retry behavior, and each response class.
- Test malformed payloads, transport failures, and relevant non-success status
  codes. Assert their finite domain failure projections.
- Keep domain capability tests independent of Ktor and serialization.
- Run one integration test that composes the real adapter configuration. Avoid
  live network dependencies unless the task explicitly requires them.
- Reuse one contract suite for every supported adapter implementation.
- Run the repository's dependency or public-API gate to prove that pure modules
  do not import or expose Ktor and serialization types.

## Official guidance

- [Kotlin serialization](https://kotlinlang.org/docs/serialization.html)
- [JSON configuration](https://kotlinlang.org/docs/serialization-configure-json-serialization.html)
- [Ktor server serialization](https://ktor.io/docs/server-serialization.html)
- [Ktor client serialization](https://ktor.io/docs/client-serialization.html)
- [Ktor server testing](https://ktor.io/docs/server-testing.html)
- [Ktor client testing](https://ktor.io/docs/client-testing.html)
