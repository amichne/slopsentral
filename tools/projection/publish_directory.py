"""Publish a complete sibling directory atomically without replacing any target."""
import ctypes
import errno
import json
import os
import stat
import sys


def publish(stage, target):
    if (not os.path.isabs(stage) or not os.path.isabs(target)
            or os.path.dirname(stage) != os.path.dirname(target)
            or stage == target):
        return {"type": "PUBLISH_REJECTED", "reason": "UNSAFE_PATH"}
    try:
        if not stat.S_ISDIR(os.lstat(stage).st_mode):
            return {"type": "PUBLISH_REJECTED", "reason": "UNSAFE_PATH"}
        libc = ctypes.CDLL(None, use_errno=True)
        if sys.platform == "darwin":
            rename = libc.renamex_np
            rename.argtypes = [ctypes.c_char_p, ctypes.c_char_p, ctypes.c_uint]
            # apple-oss-distributions/xnu: bsd/sys/stdio.h, RENAME_EXCL.
            args = (os.fsencode(stage), os.fsencode(target), 0x4)
        elif sys.platform == "linux":
            rename = libc.renameat2
            rename.argtypes = [ctypes.c_int, ctypes.c_char_p, ctypes.c_int,
                               ctypes.c_char_p, ctypes.c_uint]
            # Linux renameat2(2): AT_FDCWD and RENAME_NOREPLACE.
            args = (-100, os.fsencode(stage), -100, os.fsencode(target), 1)
        else:
            return {"type": "PUBLISH_REJECTED", "reason": "ATOMIC_PUBLISH_UNAVAILABLE"}
        rename.restype = ctypes.c_int
        if rename(*args) == 0:
            return {"type": "PUBLISHED"}
        failure = ctypes.get_errno()
        reason = ("OUTPUT_EXISTS" if failure in (errno.EEXIST, errno.ENOTEMPTY)
                  else "ATOMIC_PUBLISH_UNAVAILABLE" if failure in
                  (errno.ENOSYS, errno.EINVAL, errno.ENOTSUP)
                  else "WRITE_FAILED")
        return {"type": "PUBLISH_REJECTED", "reason": reason}
    except AttributeError:
        return {"type": "PUBLISH_REJECTED", "reason": "ATOMIC_PUBLISH_UNAVAILABLE"}
    except OSError:
        return {"type": "PUBLISH_REJECTED", "reason": "WRITE_FAILED"}


if __name__ == "__main__":
    result = (publish(*sys.argv[1:]) if len(sys.argv) == 3 else
              {"type": "PUBLISH_REJECTED", "reason": "UNSAFE_PATH"})
    print(json.dumps(result))
