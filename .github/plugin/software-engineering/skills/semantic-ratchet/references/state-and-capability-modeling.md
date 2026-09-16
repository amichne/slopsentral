# State And Capability Modeling

Use state-specific representations when legal facts or operations change across
a lifecycle. A transition accepts only its source state and returns its
destination state; state-specific data and operations exist only on the state
that supports them.

Use a capability-bearing value when authorization or another precondition has
been discharged. Possessing the required value should be evidence that the
caller may attempt the operation. Prefer separate commands or interfaces over
booleans that switch permission, mode, mutability, retry, or lifecycle behavior.

When static typestate is unavailable, centralize construction and transitions
behind a module or object API over a closed tagged state, then test the complete
transition graph. Do not scatter state guards or permission checks across
consumers.

Reject `call this first` protocols, boolean authorization gates followed by a
separate protected operation, nullable lifecycle fields, public setters that
bypass transitions, and capabilities inferred from ambient state.
