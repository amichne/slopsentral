import fs from 'node:fs';
import path from 'node:path';

// Historical source kinds preserve their recorded paths at capture time.
export function currentSourceEvidenceFindings(source, repoRoot, owner) {
  if (source?.type !== 'CURRENT_SOURCE') return [];
  if (!Array.isArray(source.evidenceRefs) || source.evidenceRefs.length === 0) {
    return [`${owner}: CURRENT_SOURCE evidenceRefs must be non-empty`];
  }
  const findings = [];
  const root = fs.realpathSync(repoRoot);
  for (const ref of source.evidenceRefs) {
    if (typeof ref !== 'string' || !ref.trim()) {
      findings.push(`${owner}: CURRENT_SOURCE evidenceRefs must contain non-empty strings`);
      continue;
    }
    if (/^https?:\/\//.test(ref) || !/^(?:\.{1,2}\/|[A-Za-z0-9_.-]+\/)/.test(ref)) continue;
    const candidate = path.resolve(root, ref);
    try {
      const real = fs.realpathSync(candidate);
      const relative = path.relative(root, real);
      if (path.posix.normalize(ref) !== ref || relative.startsWith('..')
          || path.isAbsolute(relative) || !fs.statSync(real).isFile()) {
        findings.push(`${owner}: CURRENT_SOURCE evidence path is invalid: ${ref}`);
      }
    } catch {
      findings.push(`${owner}: CURRENT_SOURCE evidence file is unavailable: ${ref}`);
    }
  }
  return findings;
}
