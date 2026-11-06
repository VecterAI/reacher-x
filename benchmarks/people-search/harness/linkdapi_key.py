"""Swap the LinkdAPI key on the Convex DEV deployment for benchmark runs, then restore it.

    uv run python -m harness.linkdapi_key status    # fingerprints only, never values
    uv run python -m harness.linkdapi_key use-prod  # LINKDAPI_API_KEY_PROD from .env.benchmark.local
    uv run python -m harness.linkdapi_key restore   # original key from .env.convex.local

Key values go to `npx convex env set` through stdin, so they never appear in a command
line, and are never printed or written anywhere.
"""

from __future__ import annotations

import hashlib
import sys
from pathlib import Path

from .core import ENV, REPO_DIR, convex_cli

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
    out = convex_cli("env", "get", name, check=False, timeout=120)
    if out.returncode != 0:
        raise SystemExit(f"Could not read {name} from the dev deployment (exit {out.returncode}); nothing changed")
    return out.stdout.strip() or None


def convex_env_set(name: str, value: str) -> None:
    # Convex strips one trailing newline from a piped value.
    out = convex_cli("env", "set", name, input_text=value + "\n", check=False, timeout=120)
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
        after = convex_env_get(VAR)
        expected = prod if cmd == "use-prod" else original
        if after != expected:
            raise SystemExit(f"Dev key is {fp(after)} after {cmd}, expected {fp(expected)}")
        print(f"dev now: {fp(after)}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
