# Choose an existing workflow

Slopsentral adds constrained domain design to the host workflow.
Use repository instructions and native Git, compiler, schema, and CI tools first.
Select an upstream plugin when the task needs a reusable general procedure.
Keep upstream packages under their original ownership.

| Task | Existing option | Fit and limit |
| --- | --- | --- |
| TDD, debugging, review, and branch completion | [Superpowers](https://github.com/obra/superpowers) | Its shared skills support Codex and Copilot. Its full methodology adds planning and orchestration. Select it explicitly when that procedure fits. |
| Copilot review | [Awesome Copilot: PR Review](https://github.com/github/awesome-copilot/tree/main/plugins/pr-review) | A read-only review canvas. Examine its host extension and tool needs. |
| Copilot tests | [Awesome Copilot: Testing Automation](https://github.com/github/awesome-copilot/tree/main/plugins/testing-automation) | A community package for test workflows. The project still owns its runner and assertions. |
| Git and CI facts | Native Git and GitHub CLI | Use structured command results and the project checks. A custom polling service adds no value without an unmet need. |
| Domain values and atomic predicates | Slopsentral `semantic-ratchet` | Supplies the focused design guidance that generic workflow packages do not own. |

## Select a package

For Codex, select Superpowers through the host plugin directory.
The [upstream README](https://github.com/obra/superpowers#codex-app) describes supported installation paths.
For Copilot CLI, register its marketplace and select the package:

```sh
copilot plugin marketplace add obra/superpowers-marketplace
copilot plugin install superpowers@superpowers-marketplace
```

For a focused Copilot package, use the community marketplace:

```sh
copilot plugin marketplace add github/awesome-copilot
copilot plugin install pr-review@awesome-copilot
```

Keep plugin selection explicit. Do not copy upstream skills into this repository or install competing procedures for the same task.
These source references establish available packages and documented installation paths.
They do not establish comparative quality or successful execution in a local host.

## Existing local procedures

The existing Git, CI, TDD, and mise procedures remain as standalone source references.
Developer Tooling keeps Python automation and tool authoring.
The default Software Engineering plugin no longer installs those procedures, a session hook, or a Stop gate.
Its standard skill folder works without uv, Python, Node.js, a profile manager, or a local service.
The host selects the skill from its name and description.

The [OpenAI skill model](https://developers.openai.com/plugins/concepts/skills)
and [Copilot plugin reference](https://docs.github.com/en/copilot/reference/copilot-cli-reference/cli-plugin-reference)
describe this delivery shape.
