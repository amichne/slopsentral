import importlib.util
import os
from pathlib import Path
import subprocess
import tempfile
import unittest

SCRIPTS = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('navigation', SCRIPTS / 'gen-agents-local.py')
nav = importlib.util.module_from_spec(spec)
spec.loader.exec_module(nav)


class NavigationTest(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(prefix='navigation test ')
        self.addCleanup(self.temp.cleanup)
        self.repo = Path(self.temp.name)
        self.git('init', '-q')
        self.git('config', 'user.email', 'test@example.invalid')
        self.git('config', 'user.name', 'Navigation test')
        self.git('config', 'commit.gpgsign', 'false')

    def git(self, *args, repo=None):
        return subprocess.run(['git', '-C', str(repo or self.repo), *args],
                              check=True, capture_output=True, text=True).stdout

    def setup(self, *args, repo=None):
        return subprocess.run(['bash', str(SCRIPTS / 'setup-local-nav.sh'),
                               '--repo-root', str(repo or self.repo), *args],
                              capture_output=True, text=True)

    def test_setup_migrates_legacy_exclusions_and_is_idempotent(self):
        exclude = self.repo / '.git/info/exclude'
        exclude.write_text('# user rule\n*.private\nAGENTS.local.md\n**/AGENTS.local.md\nAGENTS.md\n/AGENTS.md\n**/AGENTS.md\n')
        self.assertEqual(self.setup().returncode, 0)
        first = exclude.read_text()
        self.assertIn('*.private', first)
        self.assertNotIn('AGENTS', first)
        self.assertEqual(first.count('OUTDATED.local.md'), 1)
        self.assertEqual(self.setup().returncode, 0)
        self.assertEqual(first, exclude.read_text())
        (self.repo / 'nested').mkdir()
        (self.repo / 'nested/AGENTS.md').write_text('instructions')
        self.assertIn('nested/AGENTS.md', self.git('ls-files', '--others', '--exclude-standard'))

    def test_invalid_mode_does_not_install(self):
        self.assertNotEqual(self.setup('--hook-mode', 'invalid').returncode, 0)
        self.assertFalse((self.repo / '.git/hooks/post-commit').exists())

    def test_hook_collects_root_and_nested_changes_without_rewriting_guides(self):
        (self.repo / 'AGENTS.md').write_text('authored rules\n')
        (self.repo / 'README.md').write_text('root source')
        module = self.repo / 'module space'
        (module / 'src').mkdir(parents=True)
        (module / 'AGENTS.md').write_text(nav.GENERATED_MARKER + '\nreviewed map\n')
        (module / 'src/file.kt').write_text('source')
        self.assertEqual(self.setup().returncode, 0)
        self.git('add', 'AGENTS.md', 'README.md', 'module space')
        self.git('commit', '-qm', 'initial')
        self.assertEqual(set((self.repo / 'OUTDATED.local.md').read_text().splitlines()), {'.', 'module space'})
        self.assertEqual((module / 'AGENTS.md').read_text(), nav.GENERATED_MARKER + '\nreviewed map\n')
        (self.repo / 'OUTDATED.local.md').write_text('')
        (module / 'AGENTS.md').write_text(nav.GENERATED_MARKER + '\nrefreshed map\n')
        self.git('add', 'module space/AGENTS.md')
        self.git('commit', '-qm', 'refresh only')
        self.assertEqual((self.repo / 'OUTDATED.local.md').read_text(), '')

    def test_preserves_custom_hook_and_updates_managed_hook(self):
        hook = self.repo / '.git/hooks/post-commit'
        hook.write_text('#!/usr/bin/env bash\necho custom-hook\n')
        hook.chmod(0o755)
        self.assertEqual(self.setup().returncode, 0)
        first = hook.read_text()
        self.assertEqual(self.setup('--hook-mode', 'auto').returncode, 0)
        self.assertIn('echo custom-hook', hook.read_text())
        self.assertNotEqual(first, hook.read_text())
        self.assertEqual(hook.read_text().count('# >>> codebase-navigator >>>'), 1)

    def test_migrates_legacy_hook_and_preserves_suffix(self):
        hook = self.repo / '.git/hooks/post-commit'
        hook.write_text('#!/usr/bin/env bash\necho before\n'
                        '# codebase-navigator: mark changed directories as outdated\n'
                        '_nav_mark_outdated() {\n  echo old\n}\n_nav_mark_outdated\n'
                        'echo after\n')
        self.assertEqual(self.setup().returncode, 0)
        self.assertIn('echo before', hook.read_text())
        self.assertIn('echo after', hook.read_text())
        self.assertNotIn('echo old', hook.read_text())

    def test_unknown_legacy_hook_fails_without_mutation(self):
        hook = self.repo / '.git/hooks/post-commit'
        original = '#!/usr/bin/env bash\n# codebase-navigator: unknown custom integration\n'
        hook.write_text(original)
        exclude = self.repo / '.git/info/exclude'
        before = exclude.read_text()
        result = self.setup()
        self.assertNotEqual(result.returncode, 0)
        self.assertIn('unrecognized legacy', result.stderr)
        self.assertEqual(hook.read_text(), original)
        self.assertEqual(exclude.read_text(), before)

    def test_source_module_named_build_is_included(self):
        module = self.repo / 'build'
        module.mkdir()
        (module / 'build.gradle.kts').write_text('plugins {}')
        self.assertIn(module, nav.subdirs(self.repo))
        self.assertEqual(nav.generate(module), 'written')

    def test_linked_worktree(self):
        self.git('commit', '--allow-empty', '-qm', 'initial')
        worktree = self.repo / 'worktree space'
        self.git('worktree', 'add', '-qb', 'test', str(worktree))
        result = self.setup(repo=worktree)
        self.assertEqual(result.returncode, 0, result.stderr)
        (worktree / 'README.md').write_text('changed')
        self.git('add', 'README.md', repo=worktree)
        self.git('commit', '-qm', 'worktree update', repo=worktree)
        self.assertEqual((worktree / 'OUTDATED.local.md').read_text(), '.\n')
        self.assertFalse((self.repo / 'OUTDATED.local.md').exists())

    def test_authored_guides_survive_force(self):
        guide = self.repo / 'AGENTS.md'
        guide.write_text('authored rules')
        self.assertEqual(nav.generate(self.repo, force=True), 'skipped')
        self.assertEqual(guide.read_text(), 'authored rules')

    def test_hash_is_stable_across_mtimes_and_ignored_outputs(self):
        source = self.repo / 'source.kt'
        source.write_text('hello')
        first = nav.source_hash(self.repo)
        os.utime(source, (1, 1))
        output = self.repo / 'build'
        output.mkdir()
        (output / 'output.jar').write_text('binary')
        (self.repo / 'AGENTS.md').write_text(nav.GENERATED_MARKER)
        (self.repo / 'AGENTS.local.md').write_text('legacy map')
        self.assertEqual(nav.source_hash(self.repo), first)
        source.write_text('longer source')
        self.assertNotEqual(nav.source_hash(self.repo), first)

    def test_generation_does_not_link_to_missing_guides_or_follow_symlinks(self):
        (self.repo / 'child').mkdir()
        (self.repo / 'external').symlink_to(self.repo / 'child', target_is_directory=True)
        rendered = nav.render(self.repo, nav.source_hash(self.repo))
        self.assertNotIn('child/AGENTS.md', rendered)
        self.assertNotIn('external', rendered)
        self.assertNotIn('../AGENTS.md', rendered)


if __name__ == '__main__':
    unittest.main()
