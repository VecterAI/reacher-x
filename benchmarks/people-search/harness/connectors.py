"""One connector per tool. Each returns a result dict saved verbatim by collect.py.

Result dict keys: tool, query_id, at, input (what we sent, no secrets), translation,
status ("ok" | "empty" | "error"), error, latency_s, cost_usd (cash), credits (free-tier
units), raw (full provider responses), persons (normalized, ranked).
"""

from __future__ import annotations

import json
from typing import Any, Callable

from .core import (
    BudgetStop,
    CONFIG,
    DATA_DIR,
    Person,
    clean,
    guard,
    http_json,
    linkedin_from,
    read_json,
    record_spend,
    secret,
    write_json,
)
from .llm import chat, parse_json, parse_reply

TREG_URL = "https://treg.to/call/"


def _result(tool: str, query: dict, **kw: Any) -> dict[str, Any]:
    base = {
        "tool": tool,
        "query_id": query["query_id"],
        "input": None,
        "translation": None,
        "status": "ok",
        "error": None,
        "latency_s": 0.0,
        "cost_usd": 0.0,
        "credits": None,
        "raw": [],
        "persons": [],
    }
    base.update(kw)
    return base


def _finish(res: dict[str, Any], persons: list[Person], top_k: int) -> dict[str, Any]:
    res["persons"] = [p.to_dict() for p in persons[:top_k]]
    if res["status"] == "ok" and not res["persons"]:
        res["status"] = "empty"
    return res


# ---------------------------------------------------------------- Exa


def exa(query: dict, top_k: int) -> dict[str, Any]:
    guard(0.02, label="exa")
    body = {
        "query": query["prompt"],
        "type": "auto",
        "category": "people",
        "numResults": top_k,
        "contents": {"text": {"maxCharacters": 1500}},
    }
    res = _result("exa", query, input=body)
    status, data, _, latency = http_json("POST", "https://api.exa.ai/search", headers={"x-api-key": secret("EXA_API_KEY")}, json_body=body)
    res["latency_s"] = round(latency, 2)
    res["raw"].append({"status": status, "body": data})
    if status != 200:
        res.update(status="error", error=f"HTTP {status}: {str(data)[:300]}")
        return res
    cost = float(((data.get("costDollars") or {}).get("total")) or 0.0)
    res["cost_usd"] = cost
    record_spend("exa", f"search {query['query_id']}", cost)

    persons: list[Person] = []
    for item in data.get("results") or []:
        ents = [e for e in item.get("entities") or [] if e.get("type") == "person"]
        props = (ents[0].get("properties") or ents[0]) if ents else {}
        work = props.get("workHistory") or props.get("work_history") or []
        latest = work[0] if work else {}
        company = latest.get("company")
        persons.append(
            Person(
                rank=len(persons) + 1,
                name=clean(props.get("name") or item.get("author")),
                title=clean(latest.get("title")) or clean(item.get("title")),
                company=clean(company.get("name") if isinstance(company, dict) else company),
                location=clean(props.get("location")),
                linkedin_url=linkedin_from([item.get("url", "")]),
                bio=clean(item.get("title")),
                profile_urls=[item["url"]] if item.get("url") else [],
                evidence=[{"url": item.get("url"), "text": (item.get("text") or "")[:1500], "published_at": item.get("publishedDate")}],
                activity_date=item.get("publishedDate"),
                tool_score=item.get("score"),
                raw=item,
            )
        )
    return _finish(res, persons, top_k)


# ---------------------------------------------------------------- Firecrawl

FIRECRAWL_EXTRACT_SYSTEM = """You turn web search results into person records for a people-search benchmark.
For each numbered result, identify the single main person the page is about (a profile page,
a bio, an article about one person). Use only the text given. Never guess or invent details.
Skip results that are not about one identifiable person.
Return only JSON: {"people": [{"result": <number>, "name": str, "title": str|null, "company": str|null,
"location": str|null, "linkedin_url": str|null, "bio": str|null}]}"""


def firecrawl(query: dict, top_k: int) -> dict[str, Any]:
    guard(0.02, label="firecrawl")
    body = {"query": query["prompt"], "limit": top_k}
    res = _result("firecrawl", query, input=body)
    status, data, _, latency = http_json(
        "POST", "https://api.firecrawl.dev/v2/search", headers={"Authorization": f"Bearer {secret('FIRECRAWL_API_KEY')}"}, json_body=body
    )
    res["raw"].append({"status": status, "body": data})
    res["latency_s"] = round(latency, 2)
    if status != 200 or not isinstance(data, dict) or not data.get("success", True):
        res.update(status="error", error=f"HTTP {status}: {str(data)[:300]}")
        return res
    res["credits"] = {"firecrawl": data.get("creditsUsed")}
    web = ((data.get("data") or {}).get("web")) or []
    if not web:
        return _finish(res, [], top_k)

    listing = "\n\n".join(
        f"[{i}] {r.get('title') or ''}\nURL: {r.get('url') or ''}\n{r.get('description') or ''}" for i, r in enumerate(web, 1)
    )
    ext = chat(FIRECRAWL_EXTRACT_SYSTEM, f"Search request: {query['prompt']}\n\nResults:\n{listing}", purpose=f"firecrawl-extract {query['query_id']}")
    res["translation"] = {"kind": "person_extraction", "model": ext["model"], "content": ext["content"], "cost_usd": ext["cost_usd"]}
    res["latency_s"] = round(latency + float(ext.get("latency_s") or 0), 2)
    people = (parse_reply(ext) or {}).get("people") or []
    # Keep at most one person per web result, and skip result numbers that are not valid.
    by_result: dict[int, dict] = {}
    for p in people:
        try:
            idx = int(p.get("result"))
        except (TypeError, ValueError):
            continue
        if 1 <= idx <= len(web) and idx not in by_result:
            by_result[idx] = p
    persons: list[Person] = []
    for idx in sorted(by_result):
        p = by_result[idx]
        src = web[idx - 1]
        url = src.get("url")
        persons.append(
            Person(
                rank=len(persons) + 1,
                name=clean(p.get("name")),
                title=clean(p.get("title")),
                company=clean(p.get("company")),
                location=clean(p.get("location")),
                linkedin_url=clean(p.get("linkedin_url")) or linkedin_from([url or ""]),
                bio=clean(p.get("bio")),
                profile_urls=[url] if url else [],
                evidence=[{"url": url, "text": f"{src.get('title') or ''}\n{src.get('description') or ''}", "published_at": None}],
                raw=src,
            )
        )
    return _finish(res, persons, top_k)


# ---------------------------------------------------------------- context.dev

CONTEXT_DEV_ULTRA_CREDITS = 50


def context_dev(query: dict, top_k: int) -> dict[str, Any]:
    auth = {"Authorization": f"Bearer {secret('CONTEXT_DEV_API_KEY')}"}
    st, usage, _, _ = http_json("GET", "https://api.context.dev/v1/org/usage", headers=auth, timeout=30)
    remaining = None
    if st == 200 and isinstance(usage, dict):
        for k in ("credits_remaining", "remaining", "balance", "credits"):
            v = usage.get(k)
            if isinstance(v, (int, float)):
                remaining = v
                break
    if remaining is not None and remaining < CONTEXT_DEV_ULTRA_CREDITS:
        raise BudgetStop(f"context.dev has {remaining} credits, an ultra page needs {CONTEXT_DEV_ULTRA_CREDITS}")
    body = {"query": query["prompt"], "mode": CONFIG["tools"]["context_dev"]["mode"]}
    res = _result("context_dev", query, input=body)
    status, data, _, latency = http_json("POST", "https://api.context.dev/v1/people/search", headers=auth, json_body=body, timeout=120, retries=0)
    res["latency_s"] = round(latency, 2)
    res["raw"].append({"status": status, "body": data, "credits_before": remaining})
    if status != 200:
        res.update(status="error", error=f"HTTP {status}: {str(data)[:300]}")
        return res
    res["credits"] = {"context_dev": ((data.get("key_metadata") or {}).get("credits_consumed"))}
    persons: list[Person] = []
    for r in data.get("results") or []:
        role = r.get("role") or {}
        comp = role.get("company") or {}
        loc = r.get("location") or {}
        profiles = r.get("profiles") or []
        match = r.get("match") or {}
        persons.append(
            Person(
                rank=len(persons) + 1,
                name=clean(r.get("name")),
                title=clean(role.get("title")),
                company=clean(comp.get("name")),
                location=clean(", ".join(x for x in [loc.get("city"), loc.get("region"), loc.get("country_code")] if x)),
                linkedin_url=linkedin_from(profiles),
                bio=clean(r.get("description")),
                profile_urls=profiles,
                evidence=[{"url": None, "text": json.dumps(match, ensure_ascii=False), "published_at": None}] if match else [],
                activity_date=role.get("started_on"),
                tool_score=match.get("confidence"),
                raw=r,
            )
        )
    return _finish(res, persons, top_k)


# ---------------------------------------------------------------- Clay

CLAY_BASE = "https://api.clay.com/public/v0"


def _clay_reference() -> str:
    path = DATA_DIR / "cache" / "clay_reference.json"
    if path.exists():
        return read_json(path)["reference"]
    st, data, _, _ = http_json("GET", f"{CLAY_BASE}/search/query-mode/reference", headers={"clay-api-key": secret("CLAY_API_KEY")}, timeout=60)
    if st != 200:
        raise RuntimeError(f"Clay reference failed: HTTP {st}")
    write_json(path, data)
    return data["reference"]


BROADEN_NOTE = "That query returned 0 people. Write one broader query that still matches the request's core intent."


def _clay_translate(query: dict, attempt: int, previous: str | None) -> tuple[str, dict]:
    user = (
        "Do not ask follow-up questions. Write the best Clay search query that returns PEOPLE for this request, "
        "then reply with only the query inside one ```clay code block.\n\nRequest: " + query["prompt"]
    )
    if previous:
        user += f"\n\nPrevious query:\n```clay\n{previous}\n```\n{BROADEN_NOTE}"
    tr = chat(_clay_reference(), user, purpose=f"clay-translate {query['query_id']} #{attempt}", max_tokens=3000, estimate_usd=0.03)
    content = tr["content"]
    q = content.split("```clay", 1)[1].split("```", 1)[0].strip() if "```clay" in content else parse_fenced(content)
    return q, {"attempt": attempt, "kind": "clay_query", "model": tr["model"], "content": content, "cost_usd": tr["cost_usd"]}


def clay(query: dict, top_k: int) -> dict[str, Any]:
    """Filter-based tool: one automatic broadening retry when the first query finds nobody."""
    headers = {"clay-api-key": secret("CLAY_API_KEY")}
    res = _result("clay", query, input=[], translation=[])
    previous: str | None = None
    page: dict = {}
    for attempt in (1, 2):
        clay_query, tr = _clay_translate(query, attempt, previous)
        res["translation"].append(tr)
        res["input"].append({"query": clay_query, "limit": top_k})
        st, created, _, lat1 = http_json("POST", f"{CLAY_BASE}/search/query-mode", headers=headers, json_body={"query": clay_query}, retries=0)
        res["raw"].append({"step": f"create#{attempt}", "status": st, "body": created})
        res["latency_s"] = round(res["latency_s"] + lat1, 2)
        if st != 200:
            res.update(status="error", error=f"create HTTP {st}: {str(created)[:300]}")
            return res
        st, page, _, lat2 = http_json("POST", f"{CLAY_BASE}/search/query-mode/{created['search_id']}/run", headers=headers, json_body={"limit": top_k}, retries=0)
        res["raw"].append({"step": f"run#{attempt}", "status": st, "body": page})
        res["latency_s"] = round(res["latency_s"] + lat2, 2)
        if st != 200:
            res.update(status="error", error=f"run HTTP {st}: {str(page)[:300]}")
            return res
        if page.get("data"):
            break
        previous = clay_query
    res["credits"] = {"clay_period_quota": page.get("period_quota")}
    if page.get("source_type") != "people":
        res.update(status="error", error=f"Clay returned {page.get('source_type')}, not people")
        return res
    persons: list[Person] = []
    for r in page.get("data") or []:
        exps = r.get("matched_experiences") or []
        cur = next((e for e in exps if e.get("is_current")), exps[0] if exps else {})
        loc = r.get("location") or {}
        persons.append(
            Person(
                rank=len(persons) + 1,
                name=clean(r.get("name") or " ".join(x for x in [r.get("first_name"), r.get("last_name")] if x)),
                title=clean(cur.get("title")),
                company=clean(cur.get("company")),
                location=clean(loc.get("name") or ", ".join(x for x in [loc.get("city"), loc.get("state_or_province")] if x)),
                linkedin_url=clean(r.get("linkedin_url")),
                profile_urls=[r["linkedin_url"]] if r.get("linkedin_url") else [],
                activity_date=cur.get("start_date"),
                raw=r,
            )
        )
    return _finish(res, persons, top_k)


def parse_fenced(content: str) -> str:
    if "```" in content:
        return content.split("```", 2)[1].split("\n", 1)[-1].strip()
    return content.strip()


# ---------------------------------------------------------------- Treg helpers


def _treg_call(endpoint: str, token_var: str, *, json_body: Any = None, params: Any = None, extra_headers: dict | None = None):
    headers = {"X-Treg-Token": secret(token_var), "X-Treg-Key-Protocol": "1", **(extra_headers or {})}
    status, data, resp_headers, latency = http_json("POST", TREG_URL + endpoint, headers=headers, json_body=json_body, params=params, retries=0)
    micro = resp_headers.get("x-treg-cost-micro")
    cost = int(micro) / 1_000_000 if micro and micro.isdigit() else 0.0
    return status, data, cost, latency, {k: v for k, v in resp_headers.items() if k.lower().startswith("x-treg")}


def treg_balance(token_var: str) -> float | None:
    headers = {"X-Treg-Token": secret(token_var), "X-Treg-Key-Protocol": "1"}
    st, orgs, _, _ = http_json("GET", "https://treg.to/orgs", headers=headers, timeout=30)
    if st != 200:
        return None
    rows = orgs if isinstance(orgs, list) else orgs.get("orgs", [orgs])
    oid = rows[0].get("org_id") or rows[0].get("id")
    st, bal, _, _ = http_json("GET", f"https://treg.to/orgs/{oid}/balance", headers=headers, params={"limit": 1}, timeout=30)
    if st != 200:
        return None
    if isinstance(bal.get("balance_usd"), (int, float)):
        return float(bal["balance_usd"])
    if isinstance(bal.get("balance_micro"), (int, float)):
        return float(bal["balance_micro"]) / 1_000_000
    return None


def _payload(data: Any) -> Any:
    if isinstance(data, dict) and "output" in data and isinstance(data["output"], dict):
        return data["output"]
    return data


# ---------------------------------------------------------------- Treg People Search (routed)


def treg(query: dict, top_k: int) -> dict[str, Any]:
    cap = float(CONFIG["tools"]["treg"]["max_cost_per_call_usd"])
    guard(cap, label="treg")
    body = {"q": query["prompt"], "limit": top_k}
    res = _result("treg", query, input={**body, "max_cost_usd": cap})
    status, data, cost, latency, th = _treg_call("treg.people.search", "TREG_TOKEN_REACHERX", json_body=body, extra_headers={"X-Treg-Route-Max-Cost": str(cap)})
    res.update(latency_s=round(latency, 2), cost_usd=cost)
    res["raw"].append({"status": status, "body": data, "treg_headers": th})
    record_spend("treg", f"treg.people.search {query['query_id']}", cost, token="TREG_TOKEN_REACHERX")
    if status != 200:
        res.update(status="error", error=f"HTTP {status}: {str(data)[:300]}")
        return res
    rows = (_payload(data) or {}).get("people") or []
    persons: list[Person] = []
    for r in rows:
        urls = [u for u in [r.get("linkedin_url"), r.get("linkedin"), r.get("profile_url"), r.get("url")] if isinstance(u, str)]
        persons.append(
            Person(
                rank=len(persons) + 1,
                name=clean(r.get("full_name") or r.get("name")),
                title=clean(r.get("title") or r.get("headline")),
                company=clean(r.get("company") or r.get("company_name")),
                location=clean(r.get("location") or r.get("country")),
                linkedin_url=linkedin_from(urls),
                email=clean(r.get("email")),
                bio=clean(r.get("summary") or r.get("headline")),
                profile_urls=urls,
                raw=r,
            )
        )
    return _finish(res, persons, top_k)


# ---------------------------------------------------------------- Apollo (via Treg)

APOLLO_SYSTEM = """You translate a people-search request into Apollo.io People API Search filters.
Use only these fields, and leave out any field the request does not imply:
- person_titles: list of job titles (matched loosely, OR across the list)
- person_seniorities: subset of owner, founder, c_suite, partner, vp, head, director, manager, senior, entry, intern
- person_locations: where the person lives, e.g. "Singapore" or "California, US"
- organization_locations: where the company is headquartered
- q_organization_domains_list: company website domains, e.g. "entergy.com"
- organization_num_employees_ranges: employee bands as "min,max" strings
- q_keywords: a short free-text keyword string
Return only JSON with those keys."""

APOLLO_FILTER_KEYS = {
    "person_titles",
    "person_seniorities",
    "person_locations",
    "organization_locations",
    "q_organization_domains_list",
    "organization_num_employees_ranges",
    "q_keywords",
}
APOLLO_ENRICH_USD = 0.026


def _apollo_enrich_token(needed_usd: float) -> str:
    """Use Khalid's Treg team first, then Salman's backup team."""
    for var in ("TREG_TOKEN", "TREG_TOKEN_REACHERX"):
        bal = treg_balance(var)
        if bal is not None and bal >= needed_usd + 0.05:
            return var
    raise BudgetStop("No Treg team has enough balance for an Apollo enrich")


def apollo(query: dict, top_k: int) -> dict[str, Any]:
    """Filter-based tool: one automatic broadening retry when the first search finds nobody."""
    res = _result("apollo", query, input=[], translation=[])
    total_cost = 0.0
    previous: dict | None = None
    found: list[dict] = []
    for attempt in (1, 2):
        user = f"Request: {query['prompt']}"
        if previous is not None:
            user += f"\n\nPrevious filters:\n{json.dumps(previous)}\n{BROADEN_NOTE.replace('query', 'filter set')}"
        tr = chat(APOLLO_SYSTEM, user, purpose=f"apollo-translate {query['query_id']} #{attempt}", max_tokens=1500)
        filters = {k: v for k, v in (parse_reply(tr) or {}).items() if k in APOLLO_FILTER_KEYS and v}
        body = {**filters, "page": 1, "per_page": top_k}
        res["translation"].append({"attempt": attempt, "kind": "apollo_filters", "model": tr["model"], "content": tr["content"], "cost_usd": tr["cost_usd"]})
        res["input"].append({"search": body})
        status, data, cost, latency, th = _treg_call("apollo.people.search", "TREG_TOKEN", json_body=body)
        total_cost += cost
        res["raw"].append({"step": f"search#{attempt}", "status": status, "body": data, "treg_headers": th})
        res["latency_s"] = round(res["latency_s"] + latency, 2)
        record_spend("treg", f"apollo.people.search {query['query_id']} #{attempt}", cost, token="TREG_TOKEN")
        if status != 200:
            res.update(status="error", error=f"search HTTP {status}: {str(data)[:300]}")
            return res
        found = (_payload(data) or {}).get("people") or []
        if found:
            break
        previous = filters
    persons: list[Person] = []
    for p in found[:top_k]:
        token_var = _apollo_enrich_token(APOLLO_ENRICH_USD)
        guard(APOLLO_ENRICH_USD, label="apollo-enrich")
        st, en, c, lat, th = _treg_call("apollo.people.enrich", token_var, params={"id": p.get("id")})
        total_cost += c
        res["latency_s"] = round(res["latency_s"] + lat, 2)
        record_spend("treg", f"apollo.people.enrich {query['query_id']}", c, token=token_var)
        res["raw"].append({"step": "enrich", "apollo_id": p.get("id"), "status": st, "body": en, "treg_headers": th, "token": token_var})
        person = ((_payload(en) or {}).get("person") if st == 200 else None) or {}
        org = person.get("organization") or p.get("organization") or {}
        loc = ", ".join(x for x in [person.get("city"), person.get("state"), person.get("country")] if x)
        persons.append(
            Person(
                rank=len(persons) + 1,
                name=clean(person.get("name") or " ".join(x for x in [p.get("first_name"), p.get("last_name_obfuscated") or p.get("last_name")] if x)),
                title=clean(person.get("title") or p.get("title")),
                company=clean(org.get("name")),
                location=clean(loc),
                linkedin_url=clean(person.get("linkedin_url")),
                email=clean(person.get("email")),
                bio=clean(person.get("headline")),
                profile_urls=[u for u in [person.get("linkedin_url"), person.get("twitter_url")] if u],
                raw={"search": p, "enrich": person},
            )
        )
    res["cost_usd"] = round(total_cost, 6)
    return _finish(res, persons, top_k)


# ---------------------------------------------------------------- ReacherX


def _reacherx_view(query: dict, top_k: int, tool: str, qualified_only: bool) -> dict[str, Any]:
    from .reacherx_runner import to_person

    base = DATA_DIR / "reacherx_exports" / query["query_id"]
    full_path, run_path = base.with_suffix(".full.json"), base.with_suffix(".json")
    if not full_path.exists() or not run_path.exists():
        raise SystemExit(f"Run the ReacherX runner for {query['query_id']} first")
    full, run = read_json(full_path), read_json(run_path)
    fit_min = full["workspace"]["fitScoreMin"]
    rows = [x for x in full["prospects"] if x.get("qualificationScore") is not None and x.get("qualificationStatus") in ("qualified", "disqualified")]
    if qualified_only:
        rows = [x for x in rows if x["qualificationStatus"] == "qualified" and x["qualificationScore"] >= fit_min]
    rows.sort(key=lambda x: (-(x["qualificationScore"] or 0), x["createdAt"]))
    res = _result(tool, query, input=run.get("input"), latency_s=run.get("latency_s", 0.0), cost_usd=run.get("cost_usd", 0.0),
                  raw=[{"counts": run.get("counts"), "aborted": run.get("aborted"), "cost_breakdown": run.get("cost_breakdown")}])
    persons = []
    for x in rows[:top_k]:
        r = to_person(x)
        persons.append(
            Person(
                rank=len(persons) + 1,
                **{k: clean(r.get(k)) for k in ("name", "title", "company", "location", "linkedin_url", "bio", "activity_date")},
                profile_urls=list(r.get("profile_urls") or []),
                evidence=list(r.get("evidence") or []),
                tool_score=r.get("tool_score"),
                raw=x,
            )
        )
    return _finish(res, persons, top_k)


def reacherx(query: dict, top_k: int) -> dict[str, Any]:
    """PRIMARY (frozen): what a ReacherX user sees: qualified prospects only (fit >= 70), best fit first."""
    return _reacherx_view(query, top_k, "reacherx", qualified_only=True)


def reacherx_topfit(query: dict, top_k: int) -> dict[str, Any]:
    """SECONDARY view (added after seeing pilot results): top K by fit score including prospects
    below the qualification bar. Same run, no extra spend. Also feeds fit-score calibration."""
    return _reacherx_view(query, top_k, "reacherx_topfit", qualified_only=False)


CONNECTORS: dict[str, Callable[[dict, int], dict[str, Any]]] = {
    "reacherx": reacherx,
    "reacherx_topfit": reacherx_topfit,
    "apollo": apollo,
    "treg": treg,
    "exa": exa,
    "firecrawl": firecrawl,
    "context_dev": context_dev,
    "clay": clay,
}
