import fs from 'node:fs';
import path from 'node:path';

export function currentSourceLocalPaths(source) {
  if (source?.type !== 'CURRENT_SOURCE' || !Array.isArray(source.evidenceRefs)) return [];
  // A path starts with a single filename segment or an absolute/drive prefix.
  // Keep URI references and descriptive sentences outside the file contract.
  return source.evidenceRefs.filter(ref => {
    if (typeof ref !== 'string') return false;
    const candidate = ref.trim();
    return /^[A-Za-z]:[/\\]/.test(candidate)
      || (!/^[A-Za-z][A-Za-z0-9+.-]*:/.test(candidate)
        && /^(?:[/\\]|[^\s/\\:]+(?:[/\\]|$))/.test(candidate));
  });
}

// Historical source kinds preserve their recorded paths at capture time.
export function currentSourceEvidenceFindings(source, repoRoot, owner) {
  if (source?.type !== 'CURRENT_SOURCE') return [];
  if (!Array.isArray(source.evidenceRefs) || source.evidenceRefs.length === 0) {
    return [`${owner}: CURRENT_SOURCE evidenceRefs must be non-empty`];
  }
  const findings = [];
  const root = fs.realpathSync(repoRoot);
  const localPaths = new Set(currentSourceLocalPaths(source));
  for (const ref of source.evidenceRefs) {
    if (typeof ref !== 'string' || !ref.trim()) {
      findings.push(`${owner}: CURRENT_SOURCE evidenceRefs must contain non-empty strings`);
      continue;
    }
    if (!localPaths.has(ref)) continue;
    if (ref !== ref.trim() || path.isAbsolute(ref) || ref.includes('\\')
        || /^[A-Za-z]:\//.test(ref)
        || ref.split('/').some(segment => ['', '.', '..'].includes(segment))) {
      findings.push(`${owner}: CURRENT_SOURCE evidence path is invalid: ${ref}`);
      continue;
    }
    const candidate = path.resolve(root, ref);
    try {
      const real = fs.realpathSync(candidate);
      const relative = path.relative(root, real);
      if (relative === '..' || relative.startsWith('..' + path.sep)
          || path.isAbsolute(relative) || !fs.statSync(real).isFile()) {
        findings.push(`${owner}: CURRENT_SOURCE evidence path is invalid: ${ref}`);
      }
    } catch {
      findings.push(`${owner}: CURRENT_SOURCE evidence file is unavailable: ${ref}`);
    }
  }
  return findings;
}
