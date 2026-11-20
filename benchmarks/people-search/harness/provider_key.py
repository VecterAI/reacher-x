"""Swap a provider key on the Convex DEV deployment for benchmark runs, then restore it.

    uv run python -m harness.provider_key all status         # fingerprints only, never values
    uv run python -m harness.provider_key linkdapi use-prod  # LINKDAPI_API_KEY_PROD from .env.benchmark.local
    uv run python -m harness.provider_key socialapi restore  # original key from .env.convex.local

Providers: linkdapi (LINKDAPI_API_KEY), socialapi (SOCIALAPI_API_KEY), or all. Key values go
to `npx convex env set` through stdin, so they never appear in a command line, and are never
printed or written anywhere.
"""

from __future__ import annotations

import hashlib
import sys
from pathlib import Path

from .core import ENV, REPO_DIR, convex_cli

CONVEX_ENV_FILE = REPO_DIR / ".env.convex.local"
PROVIDERS = {"linkdapi": "LINKDAPI_API_KEY", "socialapi": "SOCIALAPI_API_KEY"}
USAGE = f"usage: provider_key <{'|'.join(PROVIDERS)}|all> <status|use-prod|restore>"


def fp(value: str | None) -> str:
    return hashlib.sha256(value.encode()).hexdigest()[:10] if value else "(unset)"


def read_env_file(path: Path, name: str) -> str | None:
    if not path.exists():
        return None
    for line in path.read_text().splitlines():
        if line.startswith(name + "="):
            return line.split("=", 1)[1].strip().strip('"').strip("'") or None
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


def run(var: str, cmd: str) -> None:
    current = convex_env_get(var)
    original = read_env_file(CONVEX_ENV_FILE, var)
    prod = ENV.get(var + "_PROD") or None
    print(f"{var}: dev now {fp(current)} | original (.env.convex.local) {fp(original)} | prod (.env.benchmark.local) {fp(prod)}")
    if cmd == "status":
        return
    if not original:
        raise SystemExit(f"No original {var} in .env.convex.local, so it could not be restored; not touching it")
    if cmd == "use-prod":
        if not prod:
            raise SystemExit(f"Add {var}_PROD to .env.benchmark.local first")
        if current not in (original, prod):
            raise SystemExit(f"Dev {var} matches neither the original nor the prod key; not touching it")
        expected = prod
    else:
        expected = original
    if current != expected:
        convex_env_set(var, expected)
    after = convex_env_get(var)
    if after != expected:
        raise SystemExit(f"Dev {var} is {fp(after)} after {cmd}, expected {fp(expected)}")
    print(f"{var}: dev now {fp(after)}")


def main() -> int:
    if len(sys.argv) != 3 or sys.argv[2] not in ("status", "use-prod", "restore"):
        raise SystemExit(USAGE)
    which, cmd = sys.argv[1], sys.argv[2]
    if which != "all" and which not in PROVIDERS:
        raise SystemExit(USAGE)
    for name, var in PROVIDERS.items():
        if which in ("all", name):
            run(var, cmd)
    return 0


if __name__ == "__main__":
    sys.exit(main())
