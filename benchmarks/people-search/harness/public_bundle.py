"""Write the shareable, re-checkable bundle and re-score it with no API keys.

    uv run python -m harness.public_bundle --judge final      # writes data/public/bundle.json
    uv run python -m harness.public_bundle --rescore          # recomputes scores from the bundle only

The bundle keeps what a reader needs to check every grade (name, public profile links,
the judge's per-criterion verdicts and evidence, search URLs) and drops emails, phone
numbers and raw provider payloads.
"""

from __future__ import annotations

import argparse
import json
import re
import sys
from typing import Any

from .core import CONFIG, DATA_DIR, ensure_upstream, grading_query, load_queries, now_iso, read_json, sha256_text, stable_json, write_json
from .report import build as build_report

ensure_upstream()

from benchmark.metrics import PersonEvaluation, compute_platform_scores, compute_query_metrics  # noqa: E402

BUNDLE = DATA_DIR / "public" / "bundle.json"  # stays out of git until publishing is decided
EMAIL = re.compile(r"[\w.+-]+@[\w-]+\.[\w.-]+")
PHONE = re.compile(r"\+?\d[\d\s().-]{7,}\d")
# Dates, year ranges and long numeric ids look like phone numbers to PHONE; keep them.
DATE_LIKE = re.compile(r"^(\d{4}-\d{2}-\d{2}([T ][\d:.]+)?|(19|20)\d{2}\s*[-/]\s*((19|20)\d{2}|\d{2})|\d{1,2}[/.-]\d{1,2}[/.-]\d{2,4})$")


def _phone_or_keep(m: re.Match) -> str:
    s = m.group(0).strip()
    if DATE_LIKE.match(s) or (s.isdigit() and len(s) > 15):
        return m.group(0)
    return "[phone]"


def scrub(text: str | None) -> str | None:
    if not text:
        return text
    return PHONE.sub(_phone_or_keep, EMAIL.sub("[email]", text))


def slug(model: str) -> str:
    return model.replace("/", "__").replace(":", "_")


def build(judge_key: str) -> dict[str, Any]:
    model = CONFIG["judge"][judge_key]
    # Score from the verdicts on disk now, so the summary and the people below come from one snapshot.
    results = build_report(judge_key, CONFIG["top_k"])
    if results["missing_verdicts"]:
        raise SystemExit(f"{len(results['missing_verdicts'])} verdicts missing; run harness.score first")
    queries = load_queries()
    people: list[dict[str, Any]] = []
    for q in queries:
        for raw_path in sorted((DATA_DIR / "raw").glob(f"*/{q['query_id']}.json")):
            tool = raw_path.parent.name
            res = read_json(raw_path)
            for p in res.get("persons", [])[: CONFIG["top_k"]]:
                vp = DATA_DIR / "verdicts" / slug(model) / tool / q["query_id"] / f"{p['rank']:02d}.json"
                if not vp.exists():
                    continue
                v = read_json(vp)
                ev = v["evaluation"]
                people.append(
                    {
                        "tool": tool,
                        "query_id": q["query_id"],
                        "rank": p["rank"],
                        "name": p.get("name"),
                        "title": scrub(p.get("title")),
                        "company": p.get("company"),
                        "location": p.get("location"),
                        "profile_urls": [u for u in (p.get("profile_urls") or []) if u and "@" not in u][:3],
                        "tool_score": p.get("tool_score"),
                        "evidence_urls": [e.get("url") for e in (p.get("evidence") or []) if e.get("url") and "@" not in e.get("url")][:3],
                        "judge_search_urls": [u for s in v.get("searches") or [] for u in s.get("urls") or [] if u and "@" not in u][:6],
                        "evaluation": {
                            "relevance_grade": ev["relevance_grade"],
                            "structural_score": ev["structural_score"],
                            "contextual_score": ev["contextual_score"],
                            "utility_score": ev["utility_score"],
                            "error": ev.get("error"),
                            "verification_summary": scrub(ev.get("verification_summary")),
                            "criteria_results": [
                                {k: (scrub(c.get(k)) if k == "evidence" else c.get(k)) for k in ("criterion_id", "description", "match", "confidence", "evidence")}
                                for c in ev.get("criteria_results") or []
                            ],
                        },
                    }
                )
    criteria = {}
    for q in queries:
        cp = DATA_DIR / "cache" / "criteria" / slug(model) / f"{grading_query(q)['query_id']}.json"
        if cp.exists():
            criteria[q["query_id"]] = read_json(cp)["criteria"]
    bundle = {
        "generated_at": now_iso(),
        "method": {"config": CONFIG, "upstream": CONFIG["upstream"], "judge": model},
        "queries": queries,
        "criteria": criteria,
        "query_rows": [{k: v for k, v in r.items() if k != "credits"} for r in results["rows"]],
        "summary": results["summary"],
        "people": people,
    }
    bundle["people_sha256"] = sha256_text(stable_json(people))
    return bundle


SCORE_FIELDS = ("overall", "relevance_precision", "effective_coverage", "information_utility", "task_completion_rate")


def check_scores(b: dict[str, Any]) -> bool:
    """Recompute every tool's scores from a bundle alone with the upstream metric code; True if all match."""
    top_k = b["method"]["config"]["top_k"]
    by_q: dict[tuple[str, str], list[dict]] = {}
    for p in b["people"]:
        by_q.setdefault((p["tool"], p["query_id"]), []).append(p)
    ok = True
    for track in dict.fromkeys(q["track"] for q in b["queries"]):
        qids = [q for q in b["queries"] if q["track"] == track]
        tools = sorted({r["tool"] for r in b["query_rows"] if r["track"] == track})
        for tool in tools:
            qms = []
            not_run = set((b["method"]["config"].get("not_run") or {}).get(tool, {}))
            for q in qids:
                if q["query_id"] in not_run:
                    continue  # same rule as the report: not run means left out, not zero
                rows = sorted(by_q.get((tool, q["query_id"]), []), key=lambda r: r["rank"])
                evals = [PersonEvaluation(person_name=r["name"] or "", relevance_grade=r["evaluation"]["relevance_grade"], structural_score=r["evaluation"]["structural_score"], contextual_score=r["evaluation"]["contextual_score"], utility_score=r["evaluation"]["utility_score"], error=r["evaluation"]["error"]) for r in rows]
                if any(r["tool"] == tool and r["query_id"] == q["query_id"] for r in b["query_rows"]):
                    qms.append(compute_query_metrics(q["query_id"], tool, q["category"], evals, requested_k=top_k))
            s = compute_platform_scores(tool, qms, total_queries=len(qms))  # same rule as the report
            got = s.model_dump()
            published = b["summary"][track][tool]
            bad = [f"{f} {got[f]:.2f} vs {published[f]:.2f}" for f in SCORE_FIELDS if abs(got[f] - published[f]) >= 0.01]
            ok &= not bad
            print(f"{track:6s} {tool:16s} overall {got['overall']:6.2f}  {'OK (all 5 scores match)' if not bad else 'MISMATCH: ' + '; '.join(bad)}")
    return ok


def rescore() -> int:
    return 0 if check_scores(read_json(BUNDLE)) else 1


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--judge", choices=["trial", "final"], default="final")
    ap.add_argument("--rescore", action="store_true")
    args = ap.parse_args()
    if args.rescore:
        return rescore()
    bundle = build(args.judge)
    if not check_scores(bundle):
        print("NOT written: scores recomputed from the bundle do not match its summary")
        return 1
    # Check everything that would be published, not only the people list, before writing.
    leaked = EMAIL.findall(json.dumps(bundle, ensure_ascii=False))
    if leaked:
        print(f"NOT written: {len(leaked)} email-like strings remain in the bundle; fix the scrub first")
        return 1
    write_json(BUNDLE, bundle)
    print(f"wrote {BUNDLE} ({len(bundle['people'])} people); no email-like strings")
    return 0


if __name__ == "__main__":
    sys.exit(main())
