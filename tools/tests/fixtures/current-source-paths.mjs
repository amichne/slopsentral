// Independent acceptance fixtures for the current evidence reference grammar.
export const validPaths = ['README.md', 'package.json', 'LICENSE', '.gitignore', 'proof-data', '..name',
  '..directory/evidence', 'docs/README.md', 'docs/file name.md', 'docs/nested/evidence.md'];
export const invalidPaths = ['./README.md', '../README.md', '.', '..', '/README.md',
  'C:README.md', 'c:README.md', 'D:docs/README.md', 'C:', 'C:/README.md', 'C:\\README.md',
  '\\README.md', '\\\\server\\share\\README.md', '//server/share/README.md',
  'docs\\README.md', 'docs//README.md', 'docs///README.md', 'docs/../README.md',
  '..directory/../README.md', 'docs/./README.md', 'docs/README.md/'];
export const wrappedPaths = ['README.md', 'docs/README.md', 'C:README.md', './README.md', '/README.md']
  .flatMap(ref => [' ', '\t', '\n', '\u00a0'].flatMap(space => [space + ref, ref + space, space + ref + space]));
export const nonlocalReferences = ['https://example.invalid/evidence', 'http://example.invalid/evidence',
  'file:///outside/README.md', 'urn:evidence:README.md', 'mailto:engineer@example.invalid',
  'git+ssh://example.invalid/evidence', 'User requested a focused plugin for amichne/shell-config.',
  ' https://example.invalid/evidence ', ' Source evidence supports the routing fixture. '];
