from __future__ import annotations

import json
import os
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest

HOOKS = Path(__file__).resolve().parents[1]
SESSION = HOOKS / 'knowledge-overlay.py'
DRIFT = HOOKS / 'code-knowledge-drift.py'


class KnowledgeOverlayTest(unittest.TestCase):
    def setUp(self):
        self.temporary = tempfile.TemporaryDirectory()
        self.addCleanup(self.temporary.cleanup)
        self.root = Path(self.temporary.name).resolve()
        self.source = self.root / 'source'
        self.knowledge = self.root / 'source-knowledge'
        for repo in (self.source, self.knowledge):
            repo.mkdir()
            self.git(repo, 'init', '-q')
        (self.source / 'App.kt').write_text('class App\n')
        (self.knowledge / 'AGENTS.md').write_text('Keep source citations current.\n')
        (self.knowledge / 'docs').mkdir()
        (self.knowledge / 'docs/app.md').write_text('---\ntype: Architecture\ncode_sources:\n  - path: App.kt\n---\n# App\n')
        for repo in (self.source, self.knowledge):
            self.git(repo, 'add', '.')
        self.manifest = self.root / 'knowledge.json'
        self.entry = {'type': 'INVISIBLE', 'repository': str(self.source),
                      'knowledgeRepository': str(self.knowledge), 'documents': 'docs', 'instructions': 'AGENTS.md'}
        self.save()
        self.before = self.git(self.source, 'status', '--porcelain=v1', '-z').stdout
        self.env = {**os.environ, 'SLOPSENTRAL_KNOWLEDGE_MANIFEST': str(self.manifest), 'PYTHONDONTWRITEBYTECODE': '1'}

    def git(self, repo, *arguments):
        return subprocess.run(['git', '-C', str(repo), *arguments], capture_output=True, check=True)

    def save(self):
        self.manifest.write_text(json.dumps({'type': 'KNOWLEDGE_MANIFEST', 'schemaVersion': 1, 'repositories': [self.entry]}))

    def session(self, source='startup'):
        event = {'hook_event_name': 'SessionStart', 'source': source, 'cwd': str(self.source), 'session_id': 'test-session'}
        result = subprocess.run([sys.executable, str(SESSION)], input=json.dumps(event), env=self.env,
                                cwd=self.source, capture_output=True, text=True)
        self.assertEqual(0, result.returncode, result.stderr)
        return json.loads(result.stdout), json.loads(result.stderr)

    def test_invisible_session_and_drift_use_sibling_without_source_changes(self):
        for lifecycle in ('startup', 'resume', 'clear', 'compact'):
            output, evidence = self.session(lifecycle)
            context = output['hookSpecificOutput']['additionalContext']
            self.assertIn(str(self.knowledge / 'docs'), context)
            self.assertIn('Keep source citations current.', context)
            self.assertEqual('INVISIBLE', evidence['mode'])
            self.assertNotIn(str(self.source), json.dumps(evidence))
        self.assertEqual(self.before, self.git(self.source, 'status', '--porcelain=v1', '-z').stdout)
        (self.source / 'App.kt').write_text('class Changed\n')
        changed = self.git(self.source, 'status', '--porcelain=v1', '-z').stdout
        result = subprocess.run([sys.executable, str(DRIFT), '--repo', str(self.source), '--format', 'json', '--advisory'],
                                env=self.env, capture_output=True, text=True)
        self.assertEqual(0, result.returncode, result.stderr)
        payload = json.loads(result.stdout)
        self.assertEqual('ok', payload['status'])
        self.assertEqual(['App.kt'], payload['impactedConcepts'][0]['matchedSources'])
        self.assertEqual(changed, self.git(self.source, 'status', '--porcelain=v1', '-z').stdout)
        self.assertEqual([self.source / 'App.kt'], [p for p in self.source.iterdir() if p.name != '.git'])
        (self.knowledge / 'docs/app.md').write_text('---\ntype: Architecture\ncode_sources:\n  - path: App.kt\n---\n# Revised\n')
        self.assertIn(b'docs/app.md', self.git(self.knowledge, 'status', '--porcelain=v1', '-z').stdout)

    def test_source_citations_use_git_top_level_from_a_nested_working_directory(self):
        nested = self.source / 'nested'
        nested.mkdir()
        (self.source / 'App.kt').write_text('class Changed\n')
        result = subprocess.run([sys.executable, str(DRIFT), '--repo', str(nested), '--format', 'json', '--advisory'],
                                env=self.env, capture_output=True, text=True)
        self.assertEqual(0, result.returncode, result.stderr)
        payload = json.loads(result.stdout)
        self.assertEqual('ok', payload['status'])
        self.assertEqual(['App.kt'], payload['impactedConcepts'][0]['matchedSources'])

    def test_tracked_mode_uses_source_documents(self):
        (self.source / 'docs').mkdir()
        (self.source / 'docs/app.md').write_text('---\ntype: Architecture\n---\n')
        (self.source / 'AGENTS.md').write_text('Tracked guidance.\n')
        self.git(self.source, 'add', '.')
        self.entry = {'type': 'TRACKED', 'repository': str(self.source), 'documents': 'docs', 'instructions': 'AGENTS.md'}
        self.save()
        output, evidence = self.session()
        self.assertIn('Tracked guidance.', output['hookSpecificOutput']['additionalContext'])
        self.assertEqual('TRACKED', evidence['mode'])

    def test_unregistered_repository_is_quiet(self):
        self.entry['repository'] = str(self.knowledge)
        self.save()
        output, evidence = self.session()
        self.assertEqual({}, output)
        self.assertEqual('UNREGISTERED', evidence['outcome'])

    def test_invalid_manifest_has_bounded_failure_without_loading_guidance(self):
        for key, value in [('type', 'TYPO'), ('documents', '../source'), ('extra', 'secret-payload'),
                           ('knowledgeRepository', str(self.source))]:
            with self.subTest(key=key):
                old = dict(self.entry)
                self.entry[key] = value
                self.save()
                output, evidence = self.session()
                self.assertNotIn('hookSpecificOutput', output)
                self.assertEqual('FAILED', evidence['outcome'])
                self.assertNotIn('secret-payload', json.dumps(output) + json.dumps(evidence))
                self.entry = old

    def test_duplicate_root_missing_repo_and_symlink_guidance_fail_closed(self):
        data = json.loads(self.manifest.read_text())
        data['repositories'].append(dict(self.entry))
        self.manifest.write_text(json.dumps(data))
        self.assertEqual('INVALID_MANIFEST', self.session()[1]['code'])
        self.save()
        (self.knowledge / 'AGENTS.md').unlink()
        (self.knowledge / 'AGENTS.md').symlink_to(self.source / 'App.kt')
        self.assertEqual('UNSAFE_PATH', self.session()[1]['code'])
        self.entry['knowledgeRepository'] = str(self.root / 'absent')
        self.save()
        self.assertEqual('INVALID_KNOWLEDGE_REPOSITORY', self.session()[1]['code'])

    def test_large_guidance_and_invalid_event_are_not_success(self):
        (self.knowledge / 'AGENTS.md').write_text('x' * 9000)
        self.assertEqual('CONTEXT_TOO_LARGE', self.session()[1]['code'])
        self.assertEqual('INVALID_EVENT', self.session('unknown')[1]['code'])
        self.assertEqual('INVALID_EVENT', self.session([])[1]['code'])
        self.manifest.write_bytes(b'x' * 65537)
        self.assertEqual('MANIFEST_TOO_LARGE', self.session()[1]['code'])

    def test_missing_manifest_untracked_guidance_and_invalid_utf8_are_visible(self):
        self.manifest.unlink()
        self.assertEqual('MANIFEST_UNAVAILABLE', self.session()[1]['code'])
        self.save()
        self.git(self.knowledge, 'rm', '--cached', 'AGENTS.md')
        self.assertEqual('GUIDANCE_UNTRACKED', self.session()[1]['code'])
        self.git(self.knowledge, 'add', 'AGENTS.md')
        (self.knowledge / 'AGENTS.md').write_bytes(b'\xff')
        self.assertEqual('GUIDANCE_UNAVAILABLE', self.session()[1]['code'])
        self.manifest.write_bytes(b'\xff')
        self.assertEqual('INVALID_MANIFEST', self.session()[1]['code'])

    def test_configured_drift_failure_never_falls_back_to_source_docs(self):
        (self.source / 'docs').mkdir()
        (self.source / 'docs/valid.md').write_text('---\ntype: Architecture\n---\n')
        self.entry['documents'] = '../source/docs'
        self.save()
        result = subprocess.run([sys.executable, str(DRIFT), '--repo', str(self.source), '--format', 'json', '--advisory'],
                                env=self.env, capture_output=True, text=True)
        self.assertEqual('error', json.loads(result.stdout)['status'])
        self.assertEqual('INVALID_MANIFEST', json.loads(result.stdout)['error']['code'])


if __name__ == '__main__':
    unittest.main()
