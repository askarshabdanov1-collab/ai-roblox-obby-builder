"""Invoke Linux renameat2(RENAME_NOREPLACE) with fixed positional paths."""

import ctypes
import errno
import os
import sys


EXIT_CONFLICT = 10
EXIT_UNAVAILABLE = 20
EXIT_FAILURE = 30
AT_FDCWD = -100
RENAME_NOREPLACE = 1


def main() -> int:
    if len(sys.argv) != 3:
        return EXIT_FAILURE
    try:
        renameat2 = ctypes.CDLL(None, use_errno=True).renameat2
    except (AttributeError, OSError):
        return EXIT_UNAVAILABLE
    renameat2.argtypes = [
        ctypes.c_int,
        ctypes.c_char_p,
        ctypes.c_int,
        ctypes.c_char_p,
        ctypes.c_uint,
    ]
    renameat2.restype = ctypes.c_int
    result = renameat2(
        AT_FDCWD,
        os.fsencode(sys.argv[1]),
        AT_FDCWD,
        os.fsencode(sys.argv[2]),
        RENAME_NOREPLACE,
    )
    if result == 0:
        return 0
    error_number = ctypes.get_errno()
    if error_number in (errno.EEXIST, errno.ENOTEMPTY):
        return EXIT_CONFLICT
    if error_number in (
        errno.ENOSYS,
        errno.EINVAL,
        getattr(errno, "ENOTSUP", errno.EINVAL),
        getattr(errno, "EOPNOTSUPP", errno.EINVAL),
    ):
        return EXIT_UNAVAILABLE
    return EXIT_FAILURE


if __name__ == "__main__":
    raise SystemExit(main())
