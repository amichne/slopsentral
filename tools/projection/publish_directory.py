"""Publish a complete sibling directory atomically without replacing any target."""

import ctypes
import errno
import json
import os
import stat
import sys
from pathlib import Path


def rename_exclusive(stage: Path, target: Path) -> str:
    libc = ctypes.CDLL(None, use_errno=True)
    if sys.platform == "darwin":
        rename = libc.renamex_np
        rename.argtypes = [ctypes.c_char_p, ctypes.c_char_p, ctypes.c_uint]
        # apple-oss-distributions/xnu: bsd/sys/stdio.h, RENAME_EXCL.
        args = (os.fsencode(stage), os.fsencode(target), 0x4)
    elif sys.platform == "linux":
        rename = libc.renameat2
        rename.argtypes = [
            ctypes.c_int,
            ctypes.c_char_p,
            ctypes.c_int,
            ctypes.c_char_p,
            ctypes.c_uint,
        ]
        # Linux renameat2(2): AT_FDCWD and RENAME_NOREPLACE.
        args = (-100, os.fsencode(stage), -100, os.fsencode(target), 1)
    else:
        return "ATOMIC_PUBLISH_UNAVAILABLE"
    rename.restype = ctypes.c_int
    if rename(*args) == 0:
        return "PUBLISHED"
    failure = ctypes.get_errno()
    if failure in (errno.EEXIST, errno.ENOTEMPTY):
        return "OUTPUT_EXISTS"
    if failure in (errno.ENOSYS, errno.EINVAL, errno.ENOTSUP):
        return "ATOMIC_PUBLISH_UNAVAILABLE"
    return "WRITE_FAILED"


def publish(stage: str, target: str) -> dict[str, str]:
    source, destination = Path(stage), Path(target)
    if (
        not source.is_absolute()
        or not destination.is_absolute()
        or source.parent != destination.parent
        or source == destination
    ):
        return {"type": "PUBLISH_REJECTED", "reason": "UNSAFE_PATH"}
    try:
        result = (
            rename_exclusive(source, destination)
            if stat.S_ISDIR(source.lstat().st_mode)
            else "UNSAFE_PATH"
        )
    except AttributeError:
        result = "ATOMIC_PUBLISH_UNAVAILABLE"
    except OSError:
        result = "WRITE_FAILED"
    return (
        {"type": "PUBLISHED"}
        if result == "PUBLISHED"
        else {"type": "PUBLISH_REJECTED", "reason": result}
    )


if __name__ == "__main__":
    parameters = sys.argv[1:]
    if len(parameters) == len(("stage", "target")):
        print(json.dumps(publish(*parameters)))
    else:
        print(json.dumps({"type": "PUBLISH_REJECTED", "reason": "UNSAFE_PATH"}))
