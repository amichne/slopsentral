# Glossary Authoring

Use a glossary to resolve a reader's uncertainty about an established domain concept.
A glossary does not supply authority to invent terminology or merge related concepts.
The same naming policy applies to prose, identifiers, filenames, and UI labels.

## Scope and Evidence

1. State the domain, intended readers, repository revision, and controlled document scope.
2. Find the existing glossary and inspect its entries before you add another owner.
3. Collect terms from current contracts, schemas, public identifiers, commands, documentation, and reader questions.
4. Keep candidates that affect a reader's action, interpretation, or distinction between concepts.

Do not fill a glossary with ordinary words whose usual meaning already fits.
Keep source excerpts, locations, dates, and unresolved conflicts with each candidate.
Search snippets, mirrored pages, and repetition in one repository do not establish wider domain usage.

## Choose an Established Name

1. Find the term in a current standard, maintained reference, or documented implementation from the same domain.
2. Examine the source's definition and use, not just the matching word.
3. If no standard fixes the term, compare use in independently maintained domain sources.
4. Prefer the established name whose ordinary or domain meaning identifies the correct concept with the least explanation.
5. Add a qualifier only when current domain usage supports it and a real ambiguity needs it.
6. Reject a coined metaphor, private abbreviation, or novel compound without matching domain evidence.

A shorter name loses priority when it names several different things.
A familiar technical name keeps priority over a novel phrase that sounds simpler.
For a new identifier, use established domain words and the language's naming convention.
Keep existing public identifiers and literal UI labels exact unless the task authorizes their change.
If local usage conflicts with domain usage, record both meanings before you propose a replacement.
If the search finds no supported name, leave the naming decision unresolved and describe the precise role in ordinary prose.

## Define the Concept

1. Start with the known class of thing, then state the property that distinguishes it.
2. Include the actor, object, lifetime, or scope when the distinction depends on it.
3. Use ordinary words and established technical terms that the intended reader understands.
4. Avoid a definition that repeats the label, depends on the previous paragraph, or uses an unexplained metaphor.
5. Give one source-backed example and the nearest different concept.
6. Keep operating instructions, benefits, and full implementation details outside the definition.

The definition must stand alone within the stated domain.
An example illustrates the definition and does not replace it.
Do not define every term through another glossary entry if that creates a circular or long dependency chain.
Define a specialist term at first use when a new reader needs it before the glossary.

## Establish Synonymy

1. Find an explicit source that uses both labels for the same concept within the proposed scope.
2. Compare their referent, distinguishing properties, actor, operation, lifetime, and scope.
3. Substitute each label in the source examples and examine whether the claim stays true.
4. Search for a valid case in which the labels differ.
5. Register the alternate label only if the evidence supports the complete glossary scope.
6. Otherwise, describe the relationship or preserve the unresolved distinction.

Shared attributes, nearby declarations, the same workflow, and similar definitions are insufficient evidence of synonymy.
A component and its container are different concepts.
A broader category and its subtype are different concepts.
An earlier name needs version and scope evidence before a migration rule can use it.
A misspelling needs spelling evidence and does not become a semantic synonym.
Use `Known synonyms: none` when no alternate label passes this review.

For example, a skill and a plugin share an agent-tooling context, but their source contracts describe different kinds of package.
Likewise, a hook responds to an event, so the event and the hook do not name the same thing.
These examples come from [Agent Skills](https://agentskills.io/specification) and [Claude Code hooks](https://code.claude.com/docs/en/hooks).

## Record and Review

1. Use the [entry template](../assets/glossary-entry.md) to keep source evidence with the definition.
2. Compare the proposal with every existing label, synonym, and definition.
3. Examine whether a domain reader can predict the concept from the label without the drafting conversation.
4. Ask a new reader to distinguish the example from the nearest different concept with only the definition.
5. Record actual reader feedback separately from an author's review or an LLM simulation.
6. Run the [registration check](glossary-contract.md#check).
7. Review the resulting prose with local Vale.

Use the repository's existing entry grammar and casing rules.
Internal uppercase markers are lookup syntax and do not establish a new domain meaning.
Keep initial entries provisional until the evidence and reader review support adoption.
A provisional entry does not authorize a repository-wide rename.
If a source or contract changes, review the affected entry and its migration rules.

## Local Vale Support

Vale supports local vocabularies and explicit substitution rules.
It does not infer a concept's meaning from an accepted spelling or a pattern match.
The pinned [vocabulary fixtures](https://github.com/vale-cli/vale/tree/v3.24.0/testdata/fixtures/vocab) and [substitution implementation](https://github.com/vale-cli/vale/blob/v3.24.0/internal/check/substitution.go) show these mechanisms.

- Use `accept.txt` for accepted spellings and product names that need spelling exceptions.
- Use `reject.txt` for forms that are wrong throughout the declared prose scope.
- Use an explicit `swap` only for an evidence-backed substitution in its named document scope.
- Keep ambiguous labels out of automatic replacement rules.
- Do not accept a rejected label merely to suppress a terminology finding.

A project vocabulary belongs under the installed `StylesPath`, for example `styles/config/vocabularies/Project/`.
Select it with `Vocab = Slopsentral, Project` in the installed configuration.
The existing Slopsentral vocabulary supplies product spellings, not glossary definitions.
Copy only reviewed forms into a project vocabulary and preserve their source evidence in the glossary.
An accepted form can suppress some style findings, so examine the affected rules before you add it.
The glossary files and Vale rules stay local.
Research can read public sources.
Do not upload project prose or connect to Vale CMS or MCP servers.

## Prior Work

These sources inform the protocol, examined on 2026-10-13:

- [Microsoft technical terms](https://learn.microsoft.com/en-us/style-guide/word-choice/use-technical-terms-carefully): use established industry terms and research current use before you adopt a name.
- [Google jargon guidance](https://developers.google.com/style/jargon): preserve useful specialist vocabulary and explain it for the intended reader.
- [W3C SKOS labels and relationships](https://www.w3.org/TR/skos-primer/): distinguish concepts, labels, scope notes, related concepts, and mappings.
- [ISO 704:2022 overview](https://www.iso.org/standard/79077.html): terminology work connects objects, concepts, definitions, and names.

This protocol uses these ideas without importing their full policies or claiming ISO compliance.
SKOS permits broader uses of alternate labels, including near-synonyms.
This protocol deliberately needs stronger evidence before a label becomes a substitution input.
