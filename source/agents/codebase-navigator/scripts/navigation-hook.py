#!/usr/bin/env python3
"""Install or run the advisory navigation hook; summaries remain reviewable Git files."""
import argparse
import importlib.util
from pathlib import Path
import re
import shlex
import subprocess
import sys

BEGIN = '# >>> codebase-navigator >>>'
END = '# <<< codebase-navigator <<<'
LEGACY_EXCLUDES = {
    prefix + name for prefix in ('', '/', '**/', '/**/')
    for name in ('AGENTS.md', 'AGENTS.local.md')
}


def install(exclude: Path, hook: Path, mode: str):
    existing = hook.read_text() if hook.exists() else '#!/usr/bin/env bash\n'
    command = f'python3 {shlex.quote(str(Path(__file__).resolve()))} run --mode {mode}'
    fragment = f'{BEGIN}\n{command} || echo "navigation: refresh failed; review hook diagnostics" >&2\n{END}'
    if BEGIN in existing:
        pattern = re.compile(re.escape(BEGIN) + r'.*?' + re.escape(END), re.S)
        if len(pattern.findall(existing)) != 1:
            raise ValueError('expected one complete managed hook block')
        updated = pattern.sub(lambda _: fragment, existing)
    elif '# codebase-navigator:' in existing:
        # Old installers appended one known fragment without an end marker.
        # Replace only through that fragment's terminator; preserve other hooks.
        pattern = re.compile(
            r'^# codebase-navigator: mark changed directories as outdated\n'
            r'.*?^_nav_mark_outdated\n|'
            r'^# codebase-navigator: regenerate [^\n]+\n'
            r'.*?^fi\n', re.M | re.S)
        if len(pattern.findall(existing)) != 1:
            raise ValueError('unrecognized legacy navigation hook; preserve it for manual review')
        updated = pattern.sub(lambda _: fragment + '\n', existing)
    else:
        updated = existing.rstrip() + '\n\n' + fragment + '\n'

    lines = exclude.read_text().splitlines() if exclude.exists() else []
    lines = [line for line in lines if line.strip() not in LEGACY_EXCLUDES]
    if 'OUTDATED.local.md' not in lines:
        lines.append('OUTDATED.local.md')
    exclude.parent.mkdir(parents=True, exist_ok=True)
    exclude.write_text('\n'.join(lines) + '\n')
    hook.parent.mkdir(parents=True, exist_ok=True)
    hook.write_text(updated)
    hook.chmod(hook.stat().st_mode | 0o111)
    print(f'navigation: installed {mode} hook; AGENTS.md is tracked by default; OUTDATED.local.md stays local')


def run(mode: str):
    root = Path(subprocess.check_output(['git', 'rev-parse', '--show-toplevel'], text=True).strip())
    changed = subprocess.check_output([
        'git', 'diff-tree', '--root', '--no-commit-id', '-r', '-m', '--name-only', '-z', 'HEAD'
    ], cwd=root)
    directories = set()
    for raw in changed.split(b'\0'):
        if not raw:
            continue
        relative = Path(raw.decode('utf-8', errors='surrogateescape'))
        if relative.name in {'AGENTS.md', 'AGENTS.local.md', 'OUTDATED.local.md'}:
            continue
        directory = relative.parent
        while directory != Path('.') and not (root / directory / 'AGENTS.md').is_file():
            directory = directory.parent
        if '\n' in str(directory) or '\r' in str(directory):
            raise ValueError('directory cannot be represented by the line-based staleness marker')
        directories.add(directory.as_posix())
    marker = root / 'OUTDATED.local.md'
    recorded = set(marker.read_text().splitlines()) if marker.exists() else set()
    pending = sorted(directories - recorded)
    if pending:
        with marker.open('a') as output:
            if marker.stat().st_size and not marker.read_bytes().endswith(b'\n'):
                output.write('\n')
            output.write('\n'.join(pending) + '\n')
    print(f'navigation: {len(directories)} affected guide(s); {len(pending)} added to local refresh marker')
    if mode == 'auto':
        spec = importlib.util.spec_from_file_location('navigation', Path(__file__).with_name('gen-agents-local.py'))
        nav = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(nav)
        for directory in sorted(directories):
            outcome = nav.generate(root / directory)
            print(f'navigation: {outcome}: {directory}/AGENTS.md')
        # Hooks only append. Reviewed refresh clears the marker.


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    commands = parser.add_subparsers(dest='command', required=True)
    setup = commands.add_parser('install')
    setup.add_argument('--exclude', type=Path, required=True)
    setup.add_argument('--hook', type=Path, required=True)
    setup.add_argument('--mode', choices=['collect', 'auto'], required=True)
    refresh = commands.add_parser('run')
    refresh.add_argument('--mode', choices=['collect', 'auto'], required=True)
    args = parser.parse_args()
    try:
        if args.command == 'install':
            install(args.exclude, args.hook, args.mode)
        else:
            run(args.mode)
    except (OSError, ValueError, subprocess.CalledProcessError) as error:
        print(f'navigation: {args.command} failed ({type(error).__name__}): {error}', file=sys.stderr)
        return 1
    return 0


if __name__ == '__main__':
    sys.exit(main())
