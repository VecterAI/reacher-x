"""Small OpenRouter chat helper with exact cost capture and a disk cache."""

from __future__ import annotations

import json
import re
from typing import Any

from .core import CONFIG, DATA_DIR, guard, http_json, now_iso, read_json, record_spend, secret, sha256_text, stable_json, write_json

OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions"


def parse_json(content: str) -> Any:
    """Pull a JSON object out of a model reply (fenced or bare)."""
    m = re.search(r"```(?:json)?\s*(.*?)```", content, re.S)
    text = m.group(1) if m else content[content.find("{") : content.rfind("}") + 1]
    return json.loads(text)


def chat(
    system: str,
    user: str,
    *,
    model: str | None = None,
    purpose: str,
    max_tokens: int = 4000,
    estimate_usd: float = 0.02,
) -> dict[str, Any]:
    """Cached chat call. Returns {content, model, usage, cost_usd, cached}."""
    model = model or CONFIG["translator_model"]
    key = sha256_text(stable_json({"m": model, "s": system, "u": user, "t": max_tokens}))
    path = DATA_DIR / "cache" / "llm" / f"{key}.json"
    if path.exists():
        hit = read_json(path)
        hit["cached"] = True
        return hit

    guard(estimate_usd, label=purpose)
    status, body, _, latency = http_json(
        "POST",
        OPENROUTER_URL,
        headers={"Authorization": f"Bearer {secret('OPENROUTER_API_KEY')}"},
        json_body={
            "model": model,
            "temperature": 0,
            "max_tokens": max_tokens,
            "usage": {"include": True},
            "messages": [{"role": "system", "content": system}, {"role": "user", "content": user}],
        },
        timeout=180,
    )
    if status != 200 or not isinstance(body, dict) or "choices" not in body:
        raise RuntimeError(f"OpenRouter {purpose} failed: HTTP {status} {str(body)[:300]}")
    usage = body.get("usage") or {}
    cost = float(usage.get("cost") or 0.0)
    record_spend("openrouter", purpose, cost, model=model, tokens=usage.get("total_tokens"))
    out = {
        "at": now_iso(),
        "model": body.get("model", model),
        "purpose": purpose,
        "content": body["choices"][0]["message"].get("content") or "",
        "usage": usage,
        "cost_usd": cost,
        "latency_s": round(latency, 2),
    }
    write_json(path, out)
    out["cached"] = False
    return out
