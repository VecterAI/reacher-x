"""Build the dashboard's data files from the scored results.

    uv run python -m harness.dashboard_data --judge final   # writes data/dashboard/*.json

Every number comes from harness.report (the same snapshot the public bundle checks). People rows
keep name, title, company, one public profile link, the judge's grade and summary, and for
ReacherX its own fit score and reason; emails and phone numbers are scrubbed. data/ is gitignored.
"""

from __future__ import annotations

import argparse
import json
import sys
from typing import Any

from .core import (
    CONFIG,
    DATA_DIR,
    grading_query,
    is_intent_track,
    load_queries,
    read_json,
    write_json,
)
from .public_bundle import EMAIL, scrub, slug
from .report import build as build_report
from .report import intent_criteria_ids, is_intent_hit

OUT = DATA_DIR / "dashboard"
NAMES = {
    "apollo": "Apollo",
    "clay": "Clay",
    "context_dev": "context.dev",
    "exa": "Exa",
    "firecrawl": "Firecrawl",
    "reacherx": "ReacherX",
    "reacherx_topfit": "ReacherX (top by fit)",
    "treg": "Treg",
}
# Short names for the question picker; the exact prompt is shown next to each.
LABELS = {
    "b2b_0014": "Telecom managers at Entergy",
    "rec_0020": "Fundraising head, VCs in Singapore",
    "inf_0028": "Grammy-winning singers on Instagram",
    "det_0010": "NLP academics in senior engineering",
    "int_0001": "Asking for an outbound sales tool",
    "int_0002": "Complaining about cloud costs",
    "int_0003": "Struggling to hire engineers",
    "int_0004": "Unhappy with their helpdesk tool",
    "int_0005": "Need help with paid ads (Salman's prompt)",
    "int_0006": "Need a bookkeeper or fractional CFO",
    "int_0007": "Short: can't hire engineers",
    "int_0008": "Short: unhappy with Zendesk",
    "int_0009": "Short: need help with paid ads",
    "int_0010": "Short: looking for a bookkeeper",
}
TRACK_NAMES = {"public": "Job or company lookup", "intent": "Asking for help right now", "intent_short": "Short version of an intent question"}


def web_url(u: str | None) -> bool:
    return bool(u) and u.startswith("http") and "@" not in u


def first_link(p: dict[str, Any]) -> str | None:
    for u in [p.get("linkedin_url"), *(p.get("profile_urls") or [])]:
        if u and "@" not in u and u.startswith("http"):
            return u
    return None


def build(judge_key: str) -> dict[str, list[dict[str, Any]]]:
    model = CONFIG["judge"][judge_key]
    results = build_report(judge_key, CONFIG["top_k"])
    if results["missing_verdicts"]:
        raise SystemExit(f"{len(results['missing_verdicts'])} verdicts missing; run harness.score first")
    queries = load_queries()

    summary = []
    for track, tools in results["summary"].items():
        for tool, s in tools.items():
            summary.append(
                {
                    "track": track,
                    "tool": NAMES.get(tool, tool),
                    "overall": round(s["overall"], 1),
                    "ndcg10": round(s["relevance_precision"], 1),
                    "coverage": round(s["effective_coverage"], 1),
                    "utility": round(s["information_utility"], 1),
                    "completion_pct": round(s["task_completion_rate"], 1),
                    "median_latency_s": s["median_latency_s"],
                    "cost_usd": s["total_cost_usd"],
                    "cost_per_usable_usd": s["cost_per_usable_usd"],
                    "queries_scored": s["queries_scored"],
                    "pending": len(s.get("pending") or []),
                    "intent_verified": s.get("intent_verified"),
                }
            )

    per_query = [
        {
            "tool": NAMES.get(r["tool"], r["tool"]),
            "query_id": r["query_id"],
            "track": r["track"],
            "overall": r["overall"],
            "returned": r["returned"],
            "passing": r["criteria_passing"],
            "verifiable": r["verifiable"],
            "intent_verified": r["intent_verified"],
            "ndcg10": r["ndcg_10"],
            "cost_usd": r["cost_usd"],
            "latency_s": r["latency_s"],
        }
        for r in results["rows"]
    ]

    questions = []
    for q in queries:
        qid = q["query_id"]
        if not any((DATA_DIR / "raw").glob(f"*/{qid}.json")):
            continue  # not run by any tool yet: nothing to show
        run_file = DATA_DIR / "reacherx_exports" / f"{qid}.json"
        rx = read_json(run_file) if run_file.exists() else {}
        full_file = DATA_DIR / "reacherx_exports" / f"{qid}.full.json"
        full = read_json(full_file) if full_file.exists() else None
        prospects = full if isinstance(full, list) else (full or {}).get("prospects") or []
        fits = [p.get("qualificationScore") for p in prospects if p.get("qualificationScore") is not None]
        questions.append(
            {
                "query_id": qid,
                "label": LABELS.get(qid, qid),
                "track": q["track"],
                "track_name": TRACK_NAMES.get(q["track"], q["track"]),
                "prompt": q["prompt"],
                "graded_as": q.get("grade_as"),
                "rx_run": bool(rx),
                "rx_found": (rx.get("counts") or {}).get("discovered"),
                "rx_shown": (rx.get("counts") or {}).get("qualified"),
                "rx_best_fit": max(fits) if fits else None,
                "rx_minutes": round(rx["latency_s"] / 60, 1) if rx.get("latency_s") else None,
                "rx_from_x": sum(1 for p in prospects if p.get("platform") == "twitter") if prospects else None,
            }
        )

    people = []
    for q in queries:
        qid = q["query_id"]
        intent_ids = intent_criteria_ids(model, grading_query(q)["query_id"]) if is_intent_track(q["track"]) else set()
        for raw_path in sorted((DATA_DIR / "raw").glob(f"*/{qid}.json")):
            tool = raw_path.parent.name
            if qid in (CONFIG.get("not_run") or {}).get(tool, {}):
                continue
            for p in read_json(raw_path).get("persons", [])[: CONFIG["top_k"]]:
                vp = DATA_DIR / "verdicts" / slug(model) / tool / qid / f"{int(p['rank']):02d}.json"
                if not vp.exists():
                    continue
                verdict = read_json(vp)
                ev = verdict["evaluation"]
                post = next((e.get("url") for e in (p.get("evidence") or []) if web_url(e.get("url"))), None)
                checked = list(dict.fromkeys(u for s in verdict.get("searches") or [] for u in s.get("urls") or [] if web_url(u)))[:3]
                raw = p.get("raw") if isinstance(p.get("raw"), dict) else {}
                is_rx = tool.startswith("reacherx")
                people.append(
                    {
                        "tool": NAMES.get(tool, tool),
                        "query_id": qid,
                        "rank": int(p["rank"]),
                        "name": p.get("name") or "",
                        "role": scrub(" · ".join(x for x in [p.get("title"), p.get("company")] if x) or (p.get("bio") or "")[:120]) or "",
                        "link": first_link(p),
                        "grade": round(float(ev["relevance_grade"]), 2),
                        "confirmed": ("yes" if is_intent_hit(ev, intent_ids) else "no") if intent_ids else "",
                        "verdict": scrub((ev.get("verification_summary") or "")[:400]) or "",
                        "rx_fit": float(p["tool_score"]) if is_rx and p.get("tool_score") is not None else None,
                        "rx_reason": scrub((raw.get("qualificationReasoning") or "")[:400]) if is_rx else "",
                        "post_url": post or "",
                        "checker_urls": " ".join(checked),
                    }
                )

    calibration = [
        {"query_id": r["query_id"], "fit_score": r["rx_fit"], "judge_grade": r["grade"]}
        for r in people
        if r["tool"] == NAMES["reacherx_topfit"] and r["rx_fit"] is not None
    ]
    return {"summary": summary, "per_query": per_query, "questions": questions, "people": people, "calibration": calibration}


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--judge", choices=["trial", "final"], default="final")
    args = ap.parse_args()
    data = build(args.judge)
    text = json.dumps(data, ensure_ascii=False)
    if EMAIL.search(text):
        raise SystemExit("NOT written: an email-like string remains; fix the scrub first")
    for name, rows in data.items():
        write_json(OUT / f"{name}.json", rows)
        print(f"{name:12s} {len(rows):4d} rows  {len(json.dumps(rows, ensure_ascii=False)) // 1024} KB")
    print(f"total {len(text) // 1024} KB -> {OUT}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
