"""Turn saved answers + verdicts into the results table (no API keys needed).

    uv run python -m harness.report --judge trial --top-k 3

Scores use the upstream People Search Bench metric code (padded nDCG@10, effective
coverage, information utility). Extra columns follow the issue thread: returned,
unique, criteria-passing, verifiable, stale/unknown, latency, cost per usable person.
"""

from __future__ import annotations

import argparse
import re
import sys
from datetime import datetime, timedelta
from statistics import median
from typing import Any

from .core import CONFIG, DATA_DIR, ensure_upstream, load_queries, now_iso, read_json, write_json

ensure_upstream()

from benchmark.metrics import PersonEvaluation, compute_platform_scores, compute_query_metrics  # noqa: E402

STALE_AFTER_DAYS = 180
INTENT_SINCE = "2026-10-01"


def slug(model: str) -> str:
    return model.replace("/", "__").replace(":", "_")


def identity(p: dict[str, Any]) -> str:
    li = (p.get("linkedin_url") or "").lower().rstrip("/")
    m = re.search(r"linkedin\.com/in/([^/?#]+)", li)
    if m:
        return "li:" + m.group(1)
    return "name:" + re.sub(r"[^a-z]", "", (p.get("name") or "").lower().split(",")[0])


def parse_date(s: str | None) -> datetime | None:
    if not s:
        return None
    for fmt in ("%Y-%m-%dT%H:%M:%S", "%Y-%m-%d", "%Y-%m"):
        try:
            return datetime.strptime(s[: len(datetime.now().strftime(fmt))], fmt)
        except ValueError:
            continue
    return None


POST_WORDS = re.compile(r"\bpost(s|ed)?\b|social", re.I)


def intent_criteria_ids(model: str, query_id: str) -> set[str]:
    """Criteria about a public post (did they post, when, what about). Used for the intent track."""
    path = DATA_DIR / "cache" / "criteria" / slug(model) / f"{query_id}.json"
    if not path.exists():
        return set()
    crit = read_json(path)["criteria"]
    return {c["id"] for c in crit if POST_WORDS.search(c.get("field_hint", "") + " " + c.get("description", ""))}


def is_intent_hit(ev: dict[str, Any], ids: set[str]) -> bool:
    if not ids or ev.get("error"):
        return False
    got = {c["criterion_id"]: c["match"] for c in ev.get("criteria_results") or []}
    return all(got.get(i) == "met" for i in ids)


def is_verifiable(ev: dict[str, Any]) -> bool:
    crs = ev.get("criteria_results") or []
    if ev.get("error") or not crs:
        return False
    confident = sum(1 for c in crs if c.get("confidence") in ("high", "medium"))
    return confident * 2 >= len(crs)


def build(judge_key: str, top_k: int) -> dict[str, Any]:
    model = CONFIG["judge"][judge_key]
    queries = load_queries()
    tools = sorted({p.parent.name for p in (DATA_DIR / "raw").glob("*/*.json")})
    rows: list[dict[str, Any]] = []
    metrics_by_tool_track: dict[tuple[str, str], list] = {}
    missing: list[str] = []

    for q in queries:
        for tool in tools:
            rp = DATA_DIR / "raw" / tool / f"{q['query_id']}.json"
            if not rp.exists():
                continue
            res = read_json(rp)
            persons = res.get("persons", [])[:top_k]
            evals: list[PersonEvaluation] = []
            verdicts: list[dict[str, Any]] = []
            for p in persons:
                vp = DATA_DIR / "verdicts" / slug(model) / tool / q["query_id"] / f"{p['rank']:02d}.json"
                if not vp.exists():
                    missing.append(f"{tool}/{q['query_id']}#{p['rank']}")
                    continue
                v = read_json(vp)
                verdicts.append(v)
                evals.append(PersonEvaluation(**v["evaluation"]))
            intent_ids = intent_criteria_ids(model, q["query_id"]) if q["track"] == "intent" else set()
            qm = compute_query_metrics(q["query_id"], tool, q["category"], evals, requested_k=CONFIG["top_k"])
            metrics_by_tool_track.setdefault((tool, q["track"]), []).append(qm)

            run_at = parse_date(res.get("at")) or datetime.now()
            stale_unknown = 0
            for p in persons:
                d = parse_date(p.get("activity_date"))
                limit = parse_date(INTENT_SINCE) if q["track"] == "intent" else run_at - timedelta(days=STALE_AFTER_DAYS)
                if d is None or d < limit:
                    stale_unknown += 1
            qualified = qm.num_qualified
            cost = float(res.get("cost_usd") or 0.0)
            rows.append(
                {
                    "tool": tool,
                    "query_id": q["query_id"],
                    "track": q["track"],
                    "category": q["category"],
                    "status": res.get("status"),
                    "returned": len(persons),
                    "unique": len({identity(p) for p in persons}),
                    "criteria_passing": qualified,
                    "verifiable": sum(1 for v in verdicts if is_verifiable(v["evaluation"])),
                    "intent_verified": sum(1 for v in verdicts if is_intent_hit(v["evaluation"], intent_ids)) if q["track"] == "intent" else None,
                    "stale_or_unknown": stale_unknown,
                    "ndcg_10": round(qm.ndcg_10, 4),
                    "utility": round(qm.utility_score, 4),
                    "latency_s": res.get("latency_s"),
                    "cost_usd": round(cost, 4),
                    "credits": res.get("credits"),
                    "cost_per_usable_usd": round(cost / qualified, 4) if qualified else None,
                    "raw_sha256": res.get("raw_sha256"),
                    "judge_tokens": {
                        "input": sum(v["tokens"]["input"] for v in verdicts),
                        "output": sum(v["tokens"]["output"] for v in verdicts),
                    },
                    "tavily_searches": sum(len(v.get("searches") or []) for v in verdicts),
                }
            )

    summary: dict[str, dict[str, Any]] = {}
    for (tool, track), qms in sorted(metrics_by_tool_track.items()):
        # Queries the tool was never run on are excluded, not scored as zero (see config not_run).
        not_run = set((CONFIG.get("not_run") or {}).get(tool, {}))
        n_track = sum(1 for q in queries if q["track"] == track and q["query_id"] not in not_run)
        s = compute_platform_scores(tool, qms, total_queries=n_track).model_dump()
        s["queries_scored"] = n_track
        s["not_run"] = sorted(q["query_id"] for q in queries if q["track"] == track and q["query_id"] in not_run)
        mine = [r for r in rows if r["tool"] == tool and r["track"] == track]
        lat = [r["latency_s"] for r in mine if r["latency_s"]]
        s["median_latency_s"] = round(median(lat), 2) if lat else None
        s["total_cost_usd"] = round(sum(r["cost_usd"] for r in mine), 4)
        usable = sum(r["criteria_passing"] for r in mine)
        s["cost_per_usable_usd"] = round(s["total_cost_usd"] / usable, 4) if usable else None
        if track == "intent":
            hits = sum(r["intent_verified"] or 0 for r in mine)
            s["intent_verified"] = hits
            s["intent_precision"] = round(100 * hits / max(sum(r["returned"] for r in mine), 1), 1)
            s["cost_per_intent_hit_usd"] = round(s["total_cost_usd"] / hits, 4) if hits else None
        summary.setdefault(track, {})[tool] = s

    return {"at": now_iso(), "judge": model, "top_k_scored": top_k, "rows": rows, "summary": summary, "missing_verdicts": missing}


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--judge", choices=["trial", "final"], default="trial")
    ap.add_argument("--top-k", type=int, default=CONFIG["top_k"])
    args = ap.parse_args()
    out = build(args.judge, args.top_k)
    path = DATA_DIR / "results" / f"{args.judge}_top{args.top_k}.json"
    write_json(path, out)

    for track, tools in out["summary"].items():
        print(f"\n== {track} track (judge {out['judge']}, top {args.top_k} scored)")
        print(f"{'tool':12s} {'overall':>7s} {'nDCG@10':>7s} {'cover':>6s} {'util':>6s} {'TCR':>5s} {'lat_s':>6s} {'cost$':>7s} {'$/usable':>8s}")
        for tool, s in sorted(tools.items(), key=lambda kv: -kv[1]["overall"]):
            cpu = f"{s['cost_per_usable_usd']:.4f}" if s["cost_per_usable_usd"] is not None else "-"
            print(f"{tool:12s} {s['overall']:7.1f} {s['relevance_precision']:7.1f} {s['effective_coverage']:6.1f} {s['information_utility']:6.1f} {s['task_completion_rate']:5.0f} {s['median_latency_s'] or 0:6.1f} {s['total_cost_usd']:7.4f} {cpu:>8s}")
    print(f"\n{'tool':12s} {'query':9s} {'ret':>3s} {'uniq':>4s} {'pass':>4s} {'verif':>5s} {'intent':>6s} {'undated':>7s}")
    for r in out["rows"]:
        it = "-" if r["intent_verified"] is None else str(r["intent_verified"])
        print(f"{r['tool']:12s} {r['query_id']:9s} {r['returned']:3d} {r['unique']:4d} {r['criteria_passing']:4d} {r['verifiable']:5d} {it:>6s} {r['stale_or_unknown']:7d}")
    if out["missing_verdicts"]:
        print(f"\nMissing verdicts: {len(out['missing_verdicts'])} (score them first)")
    print(f"\nSaved {path}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
