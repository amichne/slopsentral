from __future__ import annotations

import json
from typing import Any

from ci_actions_types import ObserverError


def required_text(values: dict[str, Any], key: str, source: str) -> str:
    value = normalized(values.get(key))
    if not value:
        raise ObserverError(f"{source} output is missing {key}")
    return value


def parse_json(raw: str, source: str) -> Any:
    try:
        return json.loads(raw)
    except json.JSONDecodeError as exc:
        raise ObserverError(f"{source} returned invalid JSON") from exc


def normalized(value: Any) -> str:
    if value is None:
        return ""
    return str(value).strip()
