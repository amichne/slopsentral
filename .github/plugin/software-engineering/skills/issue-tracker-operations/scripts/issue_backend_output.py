from __future__ import annotations

import json
import re
import sys
from typing import Mapping, Sequence


SAFE_SCALAR = re.compile(r"^[A-Za-z0-9_./-]+$")


def _scalar(value: object) -> str:
    if value is None:
        return "null"
    if value is True:
        return "true"
    if value is False:
        return "false"
    if isinstance(value, (int, float)):
        return str(value)
    text = str(value)
    if SAFE_SCALAR.fullmatch(text):
        return text
    return json.dumps(text, ensure_ascii=False)


def _scalar_sequence(value: object) -> bool:
    return isinstance(value, list) and all(not isinstance(item, (dict, list)) for item in value)


def _tabular_rows(value: object) -> tuple[list[str], list[Mapping[str, object]]] | None:
    if not isinstance(value, list) or not value or not all(isinstance(item, dict) for item in value):
        return None
    rows = [item for item in value if isinstance(item, dict)]
    keys = list(rows[0].keys())
    if not keys or any(list(row.keys()) != keys for row in rows):
        return None
    if any(any(isinstance(item, (dict, list)) for item in row.values()) for row in rows):
        return None
    return keys, rows


def _render_mapping(value: Mapping[str, object], indent: int, lines: list[str]) -> None:
    prefix = " " * indent
    for key, item in value.items():
        if isinstance(item, dict):
            lines.append(f"{prefix}{key}:")
            _render_mapping(item, indent + 2, lines)
            continue
        table = _tabular_rows(item)
        if table is not None:
            keys, rows = table
            lines.append(f"{prefix}{key}[{len(rows)}]{{{','.join(keys)}}}:")
            for row in rows:
                lines.append(f"{prefix}  {','.join(_scalar(row[column]) for column in keys)}")
            continue
        if _scalar_sequence(item):
            sequence = item if isinstance(item, list) else []
            lines.append(f"{prefix}{key}[{len(sequence)}]: {','.join(_scalar(entry) for entry in sequence)}")
            continue
        if isinstance(item, list):
            lines.append(f"{prefix}{key}[{len(item)}]:")
            for entry in item:
                if isinstance(entry, dict):
                    fields = list(entry.items())
                    if fields and not isinstance(fields[0][1], (dict, list)):
                        first_key, first_value = fields[0]
                        lines.append(f"{prefix}  - {first_key}: {_scalar(first_value)}")
                        _render_mapping(dict(fields[1:]), indent + 4, lines)
                    else:
                        lines.append(f"{prefix}  -")
                        _render_mapping(entry, indent + 4, lines)
                else:
                    lines.append(f"{prefix}  - {_scalar(entry)}")
            continue
        lines.append(f"{prefix}{key}: {_scalar(item)}")


def render_toon(value: Mapping[str, object]) -> str:
    lines: list[str] = []
    _render_mapping(value, 0, lines)
    return "\n".join(lines) + "\n"


def emit(value: Mapping[str, object], json_output: bool) -> None:
    if json_output:
        json.dump(value, sys.stdout, ensure_ascii=False, separators=(",", ":"))
        sys.stdout.write("\n")
        return
    sys.stdout.write(render_toon(value))
