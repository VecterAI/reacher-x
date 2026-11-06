"""Swap the LinkdAPI key on the Convex DEV deployment for benchmark runs, then restore it.

    uv run python -m harness.linkdapi_key status    # fingerprints only, never values
    uv run python -m harness.linkdapi_key use-prod  # LINKDAPI_API_KEY_PROD from .env.benchmark.local
    uv run python -m harness.linkdapi_key restore   # original key from .env.convex.local

Key values are passed straight to `npx convex env set` and never printed or written anywhere.
"""

from __future__ import annotations

import hashlib
import subprocess
import sys
from pathlib import Path

from .core import ENV, REPO_DIR

CONVEX_ENV_FILE = REPO_DIR / ".env.convex.local"
VAR = "LINKDAPI_API_KEY"


def fp(value: str | None) -> str:
    return hashlib.sha256(value.encode()).hexdigest()[:10] if value else "(unset)"


def read_env_file(path: Path, name: str) -> str | None:
    if not path.exists():
        return None
    for line in path.read_text().splitlines():
        if line.startswith(name + "="):
            return line.split("=", 1)[1].strip().strip('"').strip("'")
    return None


def convex_env_get(name: str) -> str | None:
    out = subprocess.run(["npx", "convex", "env", "get", name], cwd=REPO_DIR, capture_output=True, text=True, timeout=120)
    value = out.stdout.strip()
    return value or None


def convex_env_set(name: str, value: str) -> None:
    out = subprocess.run(["npx", "convex", "env", "set", name, value], cwd=REPO_DIR, capture_output=True, text=True, timeout=120)
    if out.returncode != 0:
        raise SystemExit(f"Could not set {name} on dev (exit {out.returncode})")


def main() -> int:
    cmd = sys.argv[1] if len(sys.argv) > 1 else "status"
    current = convex_env_get(VAR)
    original = read_env_file(CONVEX_ENV_FILE, VAR)
    prod = ENV.get("LINKDAPI_API_KEY_PROD")
    print(f"dev now: {fp(current)} | original (.env.convex.local): {fp(original)} | prod (.env.benchmark.local): {fp(prod)}")
    if cmd == "use-prod":
        if not prod:
            raise SystemExit("Add LINKDAPI_API_KEY_PROD to .env.benchmark.local first")
        if current != original and current != prod:
            raise SystemExit("Dev key matches neither the original nor the prod key; not touching it")
        if not original:
            raise SystemExit("No original key in .env.convex.local, so it could not be restored; not swapping")
        convex_env_set(VAR, prod)
    elif cmd == "restore":
        if not original:
            raise SystemExit("No original key in .env.convex.local")
        convex_env_set(VAR, original)
    elif cmd != "status":
        raise SystemExit("usage: status | use-prod | restore")
    if cmd != "status":
        print(f"dev now: {fp(convex_env_get(VAR))}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
