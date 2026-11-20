"""Shared helpers: paths, env, disk cache, spend guard, person format.

Secrets are read from the env file and never printed or written to disk.
"""

from __future__ import annotations

import hashlib
import json
import os
import subprocess
import sys
import time
from dataclasses import dataclass, field
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import httpx

BENCH_DIR = Path(__file__).resolve().parent.parent
REPO_DIR = BENCH_DIR.parent.parent
DATA_DIR = BENCH_DIR / "data"
UPSTREAM_DIR = BENCH_DIR / ".upstream" / "people-search-bench"
CONFIG = json.loads((BENCH_DIR / "config.json").read_text())

# Budget rules for issue #122 (total spend must stay under $10).
OPENROUTER_WARN_USD = 5.0
HARD_STOP_USD = 9.5
TAVILY_CREDIT_STOP = 950


class BudgetStop(RuntimeError):
    """Raised before a paid step that would break a budget rule."""


# ---------------------------------------------------------------- env


def load_env() -> dict[str, str]:
    path = Path(os.environ.get("BENCH_ENV_FILE", REPO_DIR / ".env.benchmark.local"))
    env: dict[str, str] = {}
    if path.exists():
        for line in path.read_text().splitlines():
            line = line.strip()
            if line and not line.startswith("#") and "=" in line:
                k, v = line.split("=", 1)
                env[k.strip()] = v.strip().strip('"').strip("'")
    # Real environment wins over the file.
    env.update({k: v for k, v in os.environ.items() if k in env or k.endswith("_API_KEY") or k.startswith("TREG_")})
    return env


ENV = load_env()


def secret(name: str) -> str:
    value = ENV.get(name)
    if not value:
        raise SystemExit(f"Missing {name} in .env.benchmark.local")
    return value


# ---------------------------------------------------------------- utils


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


def sha256_text(text: str) -> str:
    return hashlib.sha256(text.encode("utf-8")).hexdigest()


def stable_json(obj: Any) -> str:
    return json.dumps(obj, sort_keys=True, ensure_ascii=False, separators=(",", ":"))


def read_json(path: Path) -> Any:
    return json.loads(path.read_text())


def write_json(path: Path, obj: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_suffix(path.suffix + ".tmp")
    tmp.write_text(json.dumps(obj, indent=2, ensure_ascii=False, default=str))
    tmp.replace(path)


def load_queries() -> list[dict[str, Any]]:
    path = BENCH_DIR / CONFIG["queries"]["file"]
    return [json.loads(line) for line in path.read_text().splitlines() if line.strip()]


def is_intent_track(track: str) -> bool:
    """Intent questions: detailed ("intent") and their short twins ("intent_short")."""
    return track.startswith("intent")


def grading_query(q: dict[str, Any]) -> dict[str, Any]:
    """The question a person is graded against. A short prompt is graded against its detailed
    twin (`grade_as`), because the detailed one says what the user really wants."""
    return query_by_id(q["grade_as"]) if q.get("grade_as") else q


def query_by_id(query_id: str) -> dict[str, Any]:
    for q in load_queries():
        if q["query_id"] == query_id:
            return q
    raise SystemExit(f"Unknown query_id {query_id}")


def ensure_upstream() -> Path:
    """Clone the pinned upstream scorer once and put it on sys.path."""
    commit = CONFIG["upstream"]["commit"]
    if not (UPSTREAM_DIR / ".git").exists():
        UPSTREAM_DIR.parent.mkdir(parents=True, exist_ok=True)
        subprocess.run(["git", "clone", "--quiet", CONFIG["upstream"]["repo"], str(UPSTREAM_DIR)], check=True)
    head = subprocess.run(["git", "-C", str(UPSTREAM_DIR), "rev-parse", "HEAD"], capture_output=True, text=True, check=True).stdout.strip()
    if head != commit:
        subprocess.run(["git", "-C", str(UPSTREAM_DIR), "checkout", "--quiet", commit], check=True)
    if str(UPSTREAM_DIR) not in sys.path:
        sys.path.insert(0, str(UPSTREAM_DIR))
    return UPSTREAM_DIR


# ---------------------------------------------------------------- http


def http_json(
    method: str,
    url: str,
    *,
    headers: dict[str, str] | None = None,
    json_body: Any = None,
    params: Any = None,
    timeout: float = 120,
    retries: int = 2,
) -> tuple[int, Any, dict[str, str], float]:
    """Return (status, body, headers, latency_s). Retries only on 429/5xx/network errors."""
    last_exc: Exception | None = None
    for attempt in range(retries + 1):
        start = time.monotonic()
        try:
            with httpx.Client(timeout=timeout) as client:
                r = client.request(method, url, headers=headers, json=json_body, params=params)
            latency = time.monotonic() - start
            try:
                body = r.json()
            except ValueError:
                body = r.text
            if r.status_code in (429, 500, 502, 503, 504) and attempt < retries:
                time.sleep(3 * (attempt + 1))
                continue
            return r.status_code, body, dict(r.headers), latency
        except httpx.HTTPError as exc:
            last_exc = exc
            if attempt < retries:
                time.sleep(3 * (attempt + 1))
    raise RuntimeError(f"{method} {url} failed: {last_exc}")


# ---------------------------------------------------------------- spend


SPEND_LEDGER = DATA_DIR / "spend.jsonl"


def record_spend(service: str, what: str, usd: float, *, once_key: str | None = None, **extra: Any) -> None:
    """Append a spend row. With `once_key`, a retry of the same paid step is not counted twice."""
    SPEND_LEDGER.parent.mkdir(parents=True, exist_ok=True)
    if once_key and SPEND_LEDGER.exists():
        for line in SPEND_LEDGER.read_text().splitlines():
            if line.strip() and json.loads(line).get("once_key") == once_key:
                return
    row = {"at": now_iso(), "service": service, "what": what, "usd": round(usd, 6), **extra}
    if once_key:
        row["once_key"] = once_key
    with SPEND_LEDGER.open("a") as f:
        f.write(json.dumps(row, ensure_ascii=False) + "\n")


# ---------------------------------------------------------------- Convex (dev only)


def dev_deployment() -> str:
    """The Convex deployment the benchmark may touch. Refuses anything that is not a dev deployment."""
    env_local = REPO_DIR / ".env.local"
    values: dict[str, str] = {}
    if env_local.exists():
        for line in env_local.read_text().splitlines():
            if "=" in line and not line.lstrip().startswith("#"):
                k, v = line.split("=", 1)
                values[k.strip()] = v.split("#", 1)[0].strip().strip('"').strip("'")
    deployment = values.get("CONVEX_DEPLOYMENT", "")
    if not deployment.startswith("dev:"):
        raise SystemExit(f"Refusing to run: CONVEX_DEPLOYMENT in .env.local is not a dev deployment ({deployment or 'unset'})")
    for source in (values.get("CONVEX_DEPLOY_KEY", ""), os.environ.get("CONVEX_DEPLOY_KEY", "")):
        if source and not source.startswith("dev:"):
            raise SystemExit("Refusing to run: a non-dev CONVEX_DEPLOY_KEY is set; unset it first")
    return deployment


def convex_cli(*args: str, input_text: str | None = None, check: bool = True, timeout: int = 600) -> subprocess.CompletedProcess:
    """Run `npx convex ...` pinned to the dev deployment from .env.local."""
    env = {k: v for k, v in os.environ.items() if k not in ("CONVEX_DEPLOY_KEY", "CONVEX_URL")}
    env["CONVEX_DEPLOYMENT"] = dev_deployment()
    out = subprocess.run(["npx", "convex", *args], cwd=REPO_DIR, capture_output=True, text=True, timeout=timeout, input=input_text, env=env)
    if check and out.returncode != 0:
        raise RuntimeError(f"npx convex {args[0]} failed (exit {out.returncode}): {out.stderr.strip()[-800:]}")
    return out


def ledger_total(exclude: set[str] | None = None) -> float:
    if not SPEND_LEDGER.exists():
        return 0.0
    total = 0.0
    for line in SPEND_LEDGER.read_text().splitlines():
        if line.strip():
            row = json.loads(line)
            if not exclude or row["service"] not in exclude:
                total += float(row["usd"])
    return total


OPENROUTER_LEDGER_SERVICES = {"openrouter", "openrouter-judge"}


def ledger_window(services: set[str], start_iso: str, end_iso: str) -> float:
    """Sum ledger spend for these services between two ISO timestamps."""
    if not SPEND_LEDGER.exists():
        return 0.0
    total = 0.0
    for line in SPEND_LEDGER.read_text().splitlines():
        if line.strip():
            row = json.loads(line)
            if row["service"] in services and start_iso <= row["at"] <= end_iso:
                total += float(row["usd"])
    return total


def openrouter_usage() -> float:
    status, body, _, _ = http_json(
        "GET", "https://openrouter.ai/api/v1/key", headers={"Authorization": f"Bearer {secret('OPENROUTER_API_KEY')}"}, timeout=30
    )
    if status != 200:
        raise BudgetStop(f"Cannot read OpenRouter usage (HTTP {status}); refusing paid step")
    return float(body["data"]["usage"])


def openrouter_balance() -> float:
    """Money left on the OpenRouter account. Every key draws from it, whatever its own limit."""
    status, body, _, _ = http_json(
        "GET", "https://openrouter.ai/api/v1/credits", headers={"Authorization": f"Bearer {secret('OPENROUTER_API_KEY')}"}, timeout=30
    )
    if status != 200:
        raise BudgetStop(f"Cannot read OpenRouter balance (HTTP {status}); refusing paid step")
    data = body["data"]
    return float(data["total_credits"]) - float(data["total_usage"])


def tavily_usage() -> int:
    # The usage endpoint is strictly rate limited; honour retry-after instead of failing.
    for _ in range(3):
        status, body, headers, _ = http_json(
            "GET", "https://api.tavily.com/usage", headers={"Authorization": f"Bearer {secret('TAVILY_API_KEY')}"}, timeout=30, retries=0
        )
        if status != 429:
            break
        time.sleep(min(int(headers.get("retry-after", "60") or 60), 120) + 2)
    if status != 200:
        raise BudgetStop(f"Cannot read Tavily usage (HTTP {status}); refusing paid step")
    # Account-level plan usage; paygo may be enabled, so the guard must stop us first.
    account = body.get("account") or {}
    return int(account.get("plan_usage") or 0) + int(account.get("paygo_usage") or 0)


def tavily_guard(credits_needed: int = 2) -> int:
    used = tavily_usage()
    if used + credits_needed > TAVILY_CREDIT_STOP:
        raise BudgetStop(f"Tavily credit stop: {used} used + {credits_needed} needed > {TAVILY_CREDIT_STOP}")
    return used


def guard(estimate_usd: float = 0.0, *, label: str = "", balance_need: float | None = None) -> float:
    """Stop before a paid step if it could break the budget rules. Returns total spend so far.

    OpenRouter usage is read live (it covers ReacherX on Convex and the judge, same key).
    Every other provider is summed from the local ledger. The account balance must also cover
    `balance_need` (default: the estimate), so a step never starts that the account cannot pay for.
    """
    need = estimate_usd if balance_need is None else balance_need
    balance = openrouter_balance()
    if balance < need:
        raise BudgetStop(f"[{label}] OpenRouter account balance ${balance:.2f} < ${need:.2f} needed; top up first")
    or_usage = openrouter_usage()
    others = ledger_total(exclude=OPENROUTER_LEDGER_SERVICES)
    total = or_usage + others
    if total + estimate_usd >= HARD_STOP_USD:
        raise BudgetStop(f"[{label}] hard stop: spent ${total:.3f} + est ${estimate_usd:.3f} >= ${HARD_STOP_USD}")
    if or_usage + estimate_usd >= OPENROUTER_WARN_USD and os.environ.get("BENCH_ALLOW_OVER_WARN") != "1":
        raise BudgetStop(
            f"[{label}] OpenRouter warning: ${or_usage:.3f} + est ${estimate_usd:.3f} >= ${OPENROUTER_WARN_USD}. Get approval from the budget owner, then rerun with BENCH_ALLOW_OVER_WARN=1"
        )
    return total


# ---------------------------------------------------------------- person format


@dataclass
class Person:
    """One returned person, in the upstream PersonResult shape plus our extras."""

    rank: int
    name: str | None = None
    title: str | None = None
    company: str | None = None
    location: str | None = None
    linkedin_url: str | None = None
    email: str | None = None
    bio: str | None = None
    profile_urls: list[str] = field(default_factory=list)
    evidence: list[dict[str, Any]] = field(default_factory=list)  # [{url, text, published_at}]
    activity_date: str | None = None  # newest dated activity shown by the tool
    tool_score: float | None = None  # the tool's own relevance/fit score, if any
    raw: Any = None

    def to_dict(self) -> dict[str, Any]:
        return {k: v for k, v in self.__dict__.items()}


def clean(value: Any) -> str | None:
    if value is None:
        return None
    s = str(value).strip()
    return s or None


def linkedin_from(urls: list[str]) -> str | None:
    for u in urls:
        if u and "linkedin.com/in/" in u:
            return u
    return None
