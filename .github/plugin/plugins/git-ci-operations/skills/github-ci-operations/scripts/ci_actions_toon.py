from __future__ import annotations

import csv
import re

from ci_actions_scalars import decode_scalar
from ci_actions_types import ObserverError


def parse_mapping_block(raw: str, name: str) -> dict[str, str]:
    lines = raw.splitlines()
    marker = f"{name}:"
    try:
        start = lines.index(marker)
    except ValueError as exc:
        raise ObserverError(f"gh-axi output is missing {name} block") from exc
    values: dict[str, str] = {}
    for line in lines[start + 1 :]:
        if not line.startswith("  "):
            break
        match = re.fullmatch(r"  ([A-Za-z0-9_]+):\s*(.*)", line)
        if match:
            values[match.group(1)] = decode_scalar(match.group(2))
    return values


def parse_top_level_mapping(raw: str) -> dict[str, str]:
    values: dict[str, str] = {}
    for line in raw.splitlines():
        match = re.fullmatch(r"([A-Za-z0-9_]+):\s*(.*)", line)
        if match and match.group(2):
            values[match.group(1)] = decode_scalar(match.group(2))
    return values


def top_level_scalar(raw: str, key: str) -> str:
    return parse_top_level_mapping(raw).get(key, "")


def parse_table(raw: str, name: str) -> list[dict[str, str]]:
    lines = raw.splitlines()
    header_pattern = re.compile(
        rf"^(?P<indent>\s*){re.escape(name)}\[\d+\]\{{(?P<fields>[^}}]+)\}}:$"
    )
    for index, line in enumerate(lines):
        match = header_pattern.fullmatch(line)
        if not match:
            continue
        fields = [field.strip() for field in match.group("fields").split(",")]
        row_prefix = match.group("indent") + "  "
        return parse_rows(lines[index + 1 :], row_prefix, fields, name)
    return []


def parse_rows(
    lines: list[str],
    row_prefix: str,
    fields: list[str],
    name: str,
) -> list[dict[str, str]]:
    rows: list[dict[str, str]] = []
    for row_line in lines:
        if not row_line.startswith(row_prefix):
            break
        values = next(csv.reader([row_line[len(row_prefix) :]], skipinitialspace=True))
        if len(values) != len(fields):
            raise ObserverError(f"gh-axi {name} row has unexpected field count")
        rows.append({field: decode_scalar(value) for field, value in zip(fields, values)})
    return rows


def parse_check_counts(summary: str) -> dict[str, int]:
    counts: dict[str, int] = {}
    matches = re.findall(r"(\d+)\s+(passed|failed|pending|skipped|total)", summary)
    for value, name in matches:
        counts[name] = int(value)
    if "total" not in counts:
        raise ObserverError("gh-axi pr checks summary is missing total count")
    return counts
