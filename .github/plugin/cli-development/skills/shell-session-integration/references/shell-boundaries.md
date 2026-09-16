# Shell Boundaries

Zsh integration can use `add-zsh-hook` and completion functions. Scope option
changes with `emulate -L zsh` in functions. Test behavior in the supported Zsh
version and guard against repeated registration.

Bash completion reads `COMP_WORDS` and `COMP_CWORD`; splitting `COMP_LINE` loses
quoting structure. Inspect the supported representation of `PROMPT_COMMAND`
before composing callbacks: Bash versions differ in array support. Capture the
previous status before running another command.

Fish uses its own `complete` and event functions. Do not assume a lazily loaded
function has already registered an event handler. Source registration from an
appropriate startup entrypoint and provide a tool-owned teardown path.

A native executable cannot modify its parent's environment. A shell function or
reviewed sourceable output can, which creates a separate trust boundary. Keep
data output distinct from code intended for evaluation. Never put network work
or repository mutation in an ordinary prompt or completion callback.

Terminal control requires a terminal and a supported capability. Do not emit
control sequences to redirected stdout. Save terminal state before changing it
and restore it through the actual owning cleanup handler.
