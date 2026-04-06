from __future__ import annotations

import subprocess
import sys
from pathlib import Path


def main() -> int:
    project_dir = Path(__file__).resolve().parent

    command = [
        sys.executable,
        "-m",
        "pytest",
        "--cov=app",
        "--cov-report=term-missing",
        "--cov-report=html",
    ]

    # Allow optional extra pytest args, e.g.:
    # python run_test.py -k scheduling --maxfail=1
    command.extend(sys.argv[1:])

    result = subprocess.run(command, cwd=project_dir)
    return result.returncode


if __name__ == "__main__":
    raise SystemExit(main())
