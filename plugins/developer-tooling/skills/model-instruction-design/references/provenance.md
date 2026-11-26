# Provenance and Local Design

`model-instruction-design` is an original Slopsentral procedure informed by Amp's official `writing-prompts` skill.
The local skill has a distinct name, structure, examples, and task-specific rules.
It is not an official Amp skill.

## Examined source

On 2026-11-12, a fresh Amp CLI process retrieved the skill catalog with `amp skill list`.
`amp skill info writing-prompts` then resolved and downloaded revision `5daeef585502d265`.
The CLI version was `0.0.1794499251-g8dc9ce`.
This retrieved current source for this review. It does not establish that another active Amp session reloaded its skills.

The four examined upstream files had these SHA-256 digests:

| Source file | SHA-256 |
| --- | --- |
| `SKILL.md` | `a7549419ad615e5a1011f544934b974c9b4221d268bc1b91e98de66a3e3b3cad` |
| `reference/skills.md` | `e07d4b54fcb65e252703c5617ccddb7f220a5ea729f69116696c06e46ea841fe` |
| `reference/system-prompts-and-tools.md` | `d58171202d0126015c0c02abbc5cff75554c155a668aabbec166e167b7772665` |
| `reference/user-prompts.md` | `69d5380f428bea7c9f72b0e4da48e3a7d94e63e756f53b538501a501956aad2d` |

## Design choices

The source informed condition-based instructions, explicit recipients, selective references, concrete examples, and evidence for behavior claims.
The local procedure adds these Slopsentral decisions:

- Carry existing authority into the prompt without another approval demand or broader permission.
- Keep facts, hypotheses, design choices, and user requirements distinct.
- Bind result claims to resource identity, revision, completeness, and freshness.
- Route machine-enforceable invariants to the existing schema, type, or runtime owner.
- Keep prompt design separate from skill packaging and ordinary prose assessment.
- Use the existing decision suite with independent expectations and a no-skill control.

The local procedure does not adopt universal load-first instructions or another host's tools and workflow.
It rejects stale cached success as current authority when a fresh read fails.
It preserves the actual schema's optional and required fields instead of changing them for assumed model habits.

No upstream files, examples, templates, or scripts are distributed with this skill.
The upstream files remain review inputs outside the canonical source tree.
These changes describe the adaptation. They do not establish measured model improvement.
