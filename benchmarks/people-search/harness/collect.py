"""Collect top-K people from each tool for each frozen query.

    uv run python -m harness.collect --tools exa,firecrawl --queries b2b_0014

A saved answer is never fetched again (no double spend). Use --retry-errors to
re-run only answers that failed.
"""

from __future__ import annotations

import argparse
import sys
import traceback

from .connectors import CONNECTORS
from .core import CONFIG, DATA_DIR, BudgetStop, load_queries, now_iso, read_json, sha256_text, stable_json, write_json


def raw_path(tool: str, query_id: str):
    return DATA_DIR / "raw" / tool / f"{query_id}.json"


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--tools", default=",".join(CONNECTORS))
    ap.add_argument("--queries", default="all", help="comma list of query_ids, or 'all'")
    ap.add_argument("--top-k", type=int, default=CONFIG["top_k"])
    ap.add_argument("--retry-errors", action="store_true")
    args = ap.parse_args()

    tools = [t.strip() for t in args.tools.split(",") if t.strip()]
    unknown = set(tools) - set(CONNECTORS)
    if unknown:
        raise SystemExit(f"Unknown tools: {sorted(unknown)}")
    queries = load_queries()
    if args.queries != "all":
        wanted = set(args.queries.split(","))
        queries = [q for q in queries if q["query_id"] in wanted]
        if len(queries) != len(wanted):
            raise SystemExit("Some query_ids are not in queries.jsonl")

    for q in queries:
        for tool in tools:
            path = raw_path(tool, q["query_id"])
            if path.exists():
                prev = read_json(path)
                if prev.get("status") != "error" or not args.retry_errors:
                    print(f"skip  {tool:12s} {q['query_id']}  (saved, status={prev.get('status')})")
                    continue
            started = now_iso()
            try:
                res = CONNECTORS[tool](q, args.top_k)
            except BudgetStop as stop:
                print(f"STOP  {tool:12s} {q['query_id']}  {stop}")
                return 2
            except SystemExit as exc:
                print(f"wait  {tool:12s} {q['query_id']}  {exc}")
                continue
            except Exception as exc:  # keep the failure in the table, as the method requires
                res = {"tool": tool, "query_id": q["query_id"], "status": "error", "error": f"{type(exc).__name__}: {exc}", "trace": traceback.format_exc()[-2000:], "persons": [], "raw": [], "cost_usd": 0.0, "latency_s": 0.0}
            res["at"] = started
            res["query_prompt"] = q["prompt"]
            res["top_k"] = args.top_k
            res["raw_sha256"] = sha256_text(stable_json(res.get("raw")))
            write_json(path, res)
            print(f"{res['status']:5s} {tool:12s} {q['query_id']}  persons={len(res['persons'])} latency={res.get('latency_s')}s cost=${res.get('cost_usd', 0):.4f} {res.get('error') or ''}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
