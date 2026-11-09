# Provenance and Adaptation

`interactive-views` is a local portable adaptation of Amp's official `creating-views`
skill, cached as version `0ed58f1025f027d5` and exported in `amp-builtin-skills`.
It is not an official Amp skill or host integration.

The original bundle's tree SHA-256 is
`a28c63bdf668890780eff86d2fd2df53a76e4bc18ff4ec67818b01cf4bc1e8d3`.
Original file SHA-256 values:

| Original file | SHA-256 |
| --- | --- |
| `SKILL.md` | `aa1567e068ab28837057cc8b99f35af7455a875337991de8acb4c4b7e9f1b04c` |
| `scripts/preview.mjs` | `7652b6ad6db0fa766fd0320fe69feb063eac37256708598357d5c7e5a945da29` |
| `scripts/kit/kit.css` | `f1e69e885650cd5561920a1cd996a520f620f18eebcf017b4584044576ac010f` |
| `scripts/kit/kit.js` | `23ec89712bc16250a82b89f32a3b2b0ff942424a7425c5c661b6c412116b46fe` |
| `scripts/kit/icons.svg` | `bf67cd29ef39a6ceae4e12f79f5a40c7acd4459a121c7f6ad7d6a70d48da6021` |

## Retained

The adaptation retains the quiet visual style, takeaway-first workflow, claim-matched data
transforms, default deciding state, responsive diagrams, working prototypes, and checks for
light/dark themes and keyboard interaction. The chart, diagram, and UI references, ten source
examples, kit stylesheet, chart/control runtime, and icon sprite derive from the original
bundle. Much of the detailed guidance and example code retains the original wording.

## Changed

The local name distinguishes it from the upstream skill. No special chat code fence,
automatically injected kit or theme, sandbox policy, inline-frame sizing, or particular
browser CLI is assumed. The renderer adapts the original preview's assembly into a local,
browser-independent command. It inlines theme tokens, CSS, runtime, and the attributed sprite
into a standalone document; it does not fetch, start services, upload, or publish. The
emitted resource policy blocks external subresources and forms but is not a sanitizer or a
security sandbox. Only trusted, locally authored fragments belong in it.

The stylesheet owns its light/dark defaults. Examples remain source fragments sharing one
kit rather than ten copies of the runtime. The snapshot-cost example uses a narrower ledger
on phones to fit the standalone page gutter and labels its prices illustrative. Generic
product guidance replaces rules tied to one product's anatomy. Native diagram rendering,
static fallbacks, unavailable checks, and separate publication authority are explicit.

## Icon Attribution

The sprite attributes its Lucide icons to `@iconify-json/lucide` under ISC and
identifies provider logos copied from upstream components. That comment stays in the
asset and assembled documents.
