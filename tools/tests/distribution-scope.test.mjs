import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';

const root = path.resolve(import.meta.dirname, '../..');

test('Pkl source research declares only the retained runtime and its documentation', () => {
  const manifest = JSON.parse(fs.readFileSync(path.join(root,
    'source/skills/pkl-engineering/references/official-sources.json'), 'utf8'));
  assert.deepEqual(manifest.sources.map(source => source.repository).sort(),
    ['https://github.com/apple/pkl', 'https://github.com/apple/pkl-lang.org']);
});

test('knowledge distribution uses the local format example without upstream host commands', () => {
  const skill = path.join(root, 'source/skills/code-knowledge-base');
  assert.equal(fs.existsSync(path.join(skill, 'assets/self-bundle')), false);
  assert.ok(fs.existsSync(path.join(skill, 'assets/example-bundle')));
  const handoff = fs.readFileSync(path.join(skill, 'references/knowledge-backend-handoff.md'), 'utf8');
  assert.match(handoff, /report the missing capability before a write/i);
  assert.match(handoff, /Do not select an outside skill/);
  assert.doesNotMatch(handoff, /load.*external.*skill/i);
});

test('public catalog and native measurement exclude optional outside workflow integrations', () => {
  const marketplace = JSON.parse(fs.readFileSync(path.join(root, 'source/adaptable.marketplace.json'), 'utf8'));
  assert.ok(!marketplace.skills.some(skill => skill.name === 'mise-project-tooling'));
  const gradle = path.join(root, 'source/skills/gradle-performance-engineering');
  assert.equal(fs.existsSync(path.join(gradle, 'references/develocity-api.md')), false);
  assert.ok(fs.existsSync(path.join(gradle, 'references/native-reports.md')));
  const issueTypes = fs.readFileSync(path.join(root,
    'source/skills/issue-tracker-operations/scripts/issue_backend_types.py'), 'utf8');
  assert.doesNotMatch(issueTypes, /JIRA/);
});
