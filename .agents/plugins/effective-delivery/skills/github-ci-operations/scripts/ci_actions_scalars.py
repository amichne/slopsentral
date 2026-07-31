from __future__ import annotations

import json
from typing import Any

from ci_actions_types import ObserverError


def required_text(values: dict[str, str], key: str, source: str) -> str:
    value = normalized(values.get(key))
    if not value:
        raise ObserverError(f"{source} output is missing {key}")
    return value


def decode_scalar(value: str) -> str:
    text = value.strip()
    if text in {"", "null"}:
        return ""
    if text.startswith('"') and text.endswith('"'):
        try:
            decoded = json.loads(text)
        except json.JSONDecodeError as exc:
            raise ObserverError(f"invalid quoted TOON scalar: {text[:80]}") from exc
        return str(decoded)
    return text


def normalized(value: Any) -> str:
    if value is None:
        return ""
    return str(value).strip()
