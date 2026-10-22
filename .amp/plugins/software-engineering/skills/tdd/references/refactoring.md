# Refactor Candidates

After GREEN, consider only cleanup that reduces complexity in the touched
boundary or is required by the requested refactor:

- **Duplicated domain rule** → Reuse its existing owner or extract the smallest
  shared function; similar-looking code alone does not require an abstraction
- **Long methods** → Break into private helpers (keep tests on public interface)
- **Shallow modules** → Combine or deepen
- **Feature envy** → Move logic to where data lives
- **Primitive obsession** → Introduce value objects
- **Existing code** → Change adjacent code only when it blocks the invariant;
  record unrelated cleanup separately

Keep existing characterization green. Do not add extension points, configuration
flags, or compatibility layers for hypothetical consumers. A small amount of
local code can remain until actual variation shows where a shared boundary
belongs. Preserve proven types and closed failures throughout the cleanup.
