from typing import Literal, assert_never


def incomplete(value: Literal["valid", "invalid"]) -> int:
    if value == "valid":
        return 0
    assert_never(value)
