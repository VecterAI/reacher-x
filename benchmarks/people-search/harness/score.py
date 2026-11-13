"""Score saved answers with the upstream People Search Bench verifier.

    uv run python -m harness.score --judge trial --tools exa --queries b2b_0014 --top-k 3

Upstream code is used as is (prompts, parsing, grade math). We only swap the web
search tool for a cached Tavily tool with basic depth and a per-person search cap,
share criteria across tools, and cache every verdict so nothing is paid twice.
"""

from __future__ import annotations

import argparse
import asyncio
import contextvars
import json
import sys
from typing import Any

from .core import (
    CONFIG,
    DATA_DIR,
    TAVILY_CREDIT_STOP,
    BudgetStop,
    ensure_upstream,
    grading_query,
    guard,
    load_queries,
    now_iso,
    read_json,
    record_spend,
    secret,
    sha256_text,
    stable_json,
    write_json,
)

ensure_upstream()

import os  # noqa: E402

os.environ.setdefault("OPENROUTER_API_KEY", secret("OPENROUTER_API_KEY"))
os.environ.setdefault("OPENROUTER_BASE_URL", "https://openrouter.ai/api/v1")

from benchmark.evaluators.criteria_evaluator import (  # noqa: E402
    VERIFICATION_SYSTEM_PROMPT,
    CriteriaEvaluator,
    QueryCriteria,
    _create_llm,
)
from benchmark.models import PersonResult, Query  # noqa: E402
from langchain.agents import create_agent  # noqa: E402
from langchain_core.callbacks import BaseCallbackHandler  # noqa: E402
from langchain_core.runnables import RunnableConfig  # noqa: E402
from langchain_core.tools import tool  # noqa: E402
from tavily import TavilyClient  # noqa: E402

VCFG = CONFIG["verifier"]
# USD per token, OpenRouter list price checked 2026-11-06; used to attribute judge spend.
JUDGE_PRICES = {"google/gemini-3.1-flash-lite": (0.25e-6, 1.5e-6), "google/gemini-2.5-flash-lite": (0.10e-6, 0.40e-6)}
RAW_TEXT_LIMIT = 6000
_person_ctx: contextvars.ContextVar[dict[str, Any]] = contextvars.ContextVar("person_ctx")
_tavily = TavilyClient(api_key=secret("TAVILY_API_KEY"))


def slug(model: str) -> str:
    return model.replace("/", "__").replace(":", "_")


CREDITS_PER_SEARCH = 1 if VCFG["search_depth"] == "basic" else 2
TAVILY_CACHE = DATA_DIR / "cache" / "tavily"
# Credits used on this key before the benchmark started (checked 2026-11-06: 0 of 1,000).
TAVILY_BASELINE = int(os.environ.get("BENCH_TAVILY_BASELINE", "0"))


def tavily_used_locally() -> int:
    """Only this harness uses the key, and every paid search is cached once, so this count is exact."""
    n = len(list(TAVILY_CACHE.glob("*.json"))) if TAVILY_CACHE.exists() else 0
    return TAVILY_BASELINE + n * CREDITS_PER_SEARCH


def tavily_budget_check(searches: int) -> None:
    used = tavily_used_locally()
    if used + searches * CREDITS_PER_SEARCH > TAVILY_CREDIT_STOP:
        raise BudgetStop(f"Tavily credit stop: {used} used + {searches * CREDITS_PER_SEARCH} needed > {TAVILY_CREDIT_STOP}")


def tavily_search_cached(q: str) -> dict[str, Any]:
    params = {"query": q, "search_depth": VCFG["search_depth"], "max_results": VCFG["max_results"], "include_answer": True}
    path = DATA_DIR / "cache" / "tavily" / f"{sha256_text(stable_json(params))}.json"
    if path.exists():
        return read_json(path)["response"]
    resp = _tavily.search(**params)
    write_json(path, {"at": now_iso(), "params": params, "response": resp})
    return resp


@tool
def web_search(query: str) -> str:
    """Search the live web for evidence about a person (name, role, company, location, posts). Returns the top results with snippets."""
    ctx = _person_ctx.get()
    if ctx["searches"] >= VCFG["max_searches_per_person"]:
        # A retry runs a fresh agent; hand it the results already paid for so it keeps the evidence.
        earlier = json.dumps(ctx["search_results"], ensure_ascii=False)
        return f"Search limit reached for this person. Results of the earlier searches: {earlier}"
    ctx["searches"] += 1
    resp = tavily_search_cached(query)
    ctx["search_log"].append({"query": query, "urls": [r.get("url") for r in resp.get("results", [])]})
    slim = {"answer": resp.get("answer"), "results": [{k: r.get(k) for k in ("title", "url", "content", "published_date")} for r in resp.get("results", [])]}
    ctx["search_results"].append({"query": query, **slim})
    return json.dumps(slim, ensure_ascii=False)


class TokenCounter(BaseCallbackHandler):
    def on_llm_end(self, response, **kwargs: Any) -> None:  # type: ignore[override]
        ctx = _person_ctx.get(None)
        if ctx is None:
            return
        for gens in response.generations:
            for g in gens:
                um = getattr(getattr(g, "message", None), "usage_metadata", None) or {}
                ctx["input_tokens"] += int(um.get("input_tokens") or 0)
                ctx["output_tokens"] += int(um.get("output_tokens") or 0)
                ctx["llm_calls"] += 1


class BenchEvaluator(CriteriaEvaluator):
    def _get_verification_agent(self):
        # Fresh agent per person so the search cap and token count are per person.
        llm = _create_llm(model_name=self.model_name, max_tokens=4096)
        return create_agent(model=llm, tools=[web_search], system_prompt=VERIFICATION_SYSTEM_PROMPT).with_config(
            RunnableConfig(recursion_limit=VCFG["recursion_limit"], callbacks=[TokenCounter()])
        )

    async def extract_criteria(self, query: Query) -> QueryCriteria:
        path = DATA_DIR / "cache" / "criteria" / slug(self.model_name) / f"{query.id}.json"
        if path.exists():
            return QueryCriteria(**read_json(path))
        if not self.model_name.endswith(":free"):  # a paid call, so it passes the same guard as each person
            guard(0.01, label=f"criteria {query.id}")
        crit = await super().extract_criteria(query)
        if crit.criteria:  # never cache a failed extraction
            write_json(path, crit.model_dump())
        return crit


# The checker must judge each person blind: facts and cited posts only, never a tool's own
# opinion of the person (its score, verdict, reasoning, or which search matched them).
TOOL_OPINION_KEYS = frozenset(
    {
        "qualificationScore",
        "qualificationReasoning",
        "qualificationStatus",
        "qualificationSources",  # its cited quotes stay, as evidence below
        "qualifiedAt",
        "matchReason",
        "matchedReason",
        "matchedQueries",
        "match",  # context.dev's own relevance confidence
    }
)
TOOL_OPINION_EVIDENCE = ("ReacherX fit reasoning:", "Matched search:")


def blind(value: Any) -> Any:
    """Drop every tool-opinion field, at any depth."""
    if isinstance(value, dict):
        return {k: blind(v) for k, v in value.items() if k not in TOOL_OPINION_KEYS}
    if isinstance(value, list):
        return [blind(v) for v in value]
    return value


def blind_evidence(evidence: list[dict[str, Any]]) -> list[dict[str, Any]]:
    out = []
    for ev in evidence:
        text = ev.get("text") or ""
        if text.startswith(TOOL_OPINION_EVIDENCE):
            continue
        out.append({**ev, "text": text.removeprefix("Matched post: ")})
    return out


def to_person_result(p: dict[str, Any]) -> PersonResult:
    raw_text = json.dumps(blind(p.get("raw")), ensure_ascii=False, default=str)
    if len(raw_text) > RAW_TEXT_LIMIT:
        raw_text = raw_text[:RAW_TEXT_LIMIT] + " ...(truncated)"
    extra: dict[str, Any] = {}
    if p.get("profile_urls"):
        extra["profile_urls"] = ", ".join(p["profile_urls"][:5])
    if p.get("activity_date"):
        extra["activity_date"] = p["activity_date"]
    for i, ev in enumerate(blind_evidence(p.get("evidence") or [])[:3], 1):
        txt = (ev.get("text") or "")[:800]
        extra[f"evidence_{i}"] = f"{ev.get('url') or ''} {('(' + ev['published_at'] + ')') if ev.get('published_at') else ''} {txt}".strip()
    return PersonResult(
        raw_text=raw_text,
        name=p.get("name"),
        title=p.get("title"),
        company=p.get("company"),
        location=p.get("location"),
        linkedin_url=p.get("linkedin_url"),
        email=p.get("email"),
        bio=p.get("bio"),
        extra=extra,
    )


async def score_one(ev: BenchEvaluator, model: str, tool_name: str, q: dict, persons: list[dict], sem: asyncio.Semaphore, retry_errors: bool, paid: bool):
    gq = grading_query(q)  # short prompts share their detailed twin's criteria
    query = Query(query_id=gq["query_id"], prompt=gq["prompt"], category=gq["category"])
    criteria = await ev.extract_criteria(query)
    if not criteria.criteria:
        raise RuntimeError(f"criteria extraction failed for {q['query_id']}")
    out_dir = DATA_DIR / "verdicts" / slug(model) / tool_name / q["query_id"]

    async def one(p: dict) -> dict:
        pr = to_person_result(p)
        key = sha256_text(pr.to_text())
        path = out_dir / f"{p['rank']:02d}.json"
        if path.exists():
            prev = read_json(path)
            if prev.get("person_hash") == key and (not prev["evaluation"].get("error") or not retry_errors):
                return prev
        async with sem:
            tavily_budget_check(VCFG["max_searches_per_person"])
            if paid:
                guard(0.02, label=f"judge {tool_name} {q['query_id']}")
            ctx = {"searches": 0, "search_log": [], "search_results": [], "input_tokens": 0, "output_tokens": 0, "llm_calls": 0}
            token = _person_ctx.set(ctx)
            try:
                # Upstream silently grades an empty or unparseable verdict as 0. Retry it,
                # and if it stays empty, mark it as a judge error so it is visible.
                for _attempt in range(3):
                    pe = await ev.verify_person(pr, query, criteria, timeout=VCFG["timeout_s"])
                    if pe.error or pe.criteria_results:
                        break
                if not pe.error and not pe.criteria_results:
                    pe.error = "empty verdict from judge after 3 attempts"
            finally:
                _person_ctx.reset(token)
        row = {
            "at": now_iso(),
            "judge": model,
            "tool": tool_name,
            "query_id": q["query_id"],
            "rank": p["rank"],
            "person_hash": key,
            "evaluation": pe.model_dump(),
            "searches": ctx["search_log"],
            "tokens": {"input": ctx["input_tokens"], "output": ctx["output_tokens"], "llm_calls": ctx["llm_calls"]},
        }
        write_json(path, row)
        pin, pout = JUDGE_PRICES.get(model, (0.0, 0.0))
        record_spend("openrouter-judge", f"judge {tool_name} {q['query_id']} #{p['rank']}", ctx["input_tokens"] * pin + ctx["output_tokens"] * pout, model=model)
        g = row["evaluation"]
        print(f"  {tool_name:12s} {q['query_id']} #{p['rank']:<2d} grade={g['relevance_grade']:.2f} util={g['utility_score']:.2f} searches={ctx['searches']} tok={ctx['input_tokens']}/{ctx['output_tokens']} {g.get('error') or ''}")
        return row

    return await asyncio.gather(*(one(p) for p in persons))


async def amain() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--judge", choices=["trial", "final"], default="trial")
    ap.add_argument("--tools", default="all")
    ap.add_argument("--queries", default="all")
    ap.add_argument("--top-k", type=int, default=CONFIG["top_k"])
    ap.add_argument("--concurrency", type=int, default=3)
    ap.add_argument("--retry-errors", action="store_true")
    args = ap.parse_args()

    model = CONFIG["judge"][args.judge]
    paid = not model.endswith(":free")
    ev = BenchEvaluator(model_name=model, max_search_results=VCFG["max_results"])
    sem = asyncio.Semaphore(args.concurrency)
    queries = {q["query_id"]: q for q in load_queries()}
    wanted_q = set(queries) if args.queries == "all" else set(args.queries.split(","))

    for path in sorted((DATA_DIR / "raw").glob("*/*.json")):
        tool_name, qid = path.parent.name, path.stem
        if (args.tools != "all" and tool_name not in args.tools.split(",")) or qid not in wanted_q:
            continue
        res = read_json(path)
        persons = res.get("persons", [])[: args.top_k]
        if not persons:
            print(f"  {tool_name:12s} {qid} no persons (status={res.get('status')}), counts as zero")
            continue
        try:
            await score_one(ev, model, tool_name, queries[qid], persons, sem, args.retry_errors, paid)
        except BudgetStop as stop:
            print(f"STOP {stop}")
            return 2
    return 0


if __name__ == "__main__":
    sys.exit(asyncio.run(amain()))
