"""Run ReacherX on one frozen query against a Convex DEV deployment and export results.

    uv run python -m harness.reacherx_runner --query b2b_0014 --user-id <users id>

Steps: budget check -> PAUSE_AUTONOMOUS_JOBS=false -> setup draft + workspace + one
prospecting cycle (convex/benchmarkPeopleSearch.ts) -> wait for discovery and
qualification -> stop the run and delete SocialAPI monitors -> PAUSE_AUTONOMOUS_JOBS=true
(always, even on failure) -> export. Cost = OpenRouter key usage delta (nothing else may
use the key during a run) + provider costs ReacherX records for the workspace.
"""

from __future__ import annotations

import argparse
import json
import re
import subprocess
import sys
import time
from datetime import datetime, timezone
from typing import Any

from .core import CONFIG, DATA_DIR, OPENROUTER_LEDGER_SERVICES, REPO_DIR, BudgetStop, guard, ledger_window, now_iso, openrouter_usage, query_by_id, read_json, record_spend, write_json

POLL_S = 30
TIMEOUT_S = 60 * 60
PER_RUN_CAP_USD = 1.5  # abort a single query's run past this OpenRouter spend
STABLE_POLLS = 2


def convex(*args: str) -> str:
    out = subprocess.run(["npx", "convex", *args], cwd=REPO_DIR, capture_output=True, text=True, timeout=600)
    if out.returncode != 0:
        raise RuntimeError(f"npx convex {args[0]} failed: {out.stderr.strip()[-800:]}")
    return out.stdout.strip()


def convex_run(fn: str, payload: dict[str, Any]) -> Any:
    raw = convex("run", f"benchmarkPeopleSearch:{fn}", json.dumps(payload))
    return json.loads(raw) if raw else None


def set_pause(paused: bool) -> None:
    convex("env", "set", "PAUSE_AUTONOMOUS_JOBS", "true" if paused else "false")


def _post_fields(raw: str) -> dict[str, Any]:
    """Evidence posts are stored as JSON strings cut at 1,500 chars; parse what survives."""
    try:
        return json.loads(raw)
    except ValueError:
        out: dict[str, Any] = {}
        for key, pat in (("id", r'"id":"(\d+)"'), ("createdAt", r'"createdAt":(\d+)'), ("platform", r'"platform":"(\w+)"'), ("text", r'"text":"((?:[^"\\]|\\.)*)')):
            m = re.search(pat, raw)
            if m:
                out[key] = int(m.group(1)) if key == "createdAt" else m.group(1).replace("\\n", "\n")
        return out


def _post_url(post: dict[str, Any], sp: dict[str, Any]) -> str | None:
    pid = post.get("id")
    if not pid:
        return post.get("url")
    if post.get("platform") == "linkedin":
        return f"https://www.linkedin.com/feed/update/urn:li:activity:{pid}/"
    user = (sp.get("twitter") or {}).get("username")
    return f"https://x.com/{user}/status/{pid}" if user else post.get("url")


def to_person(p: dict[str, Any]) -> dict[str, Any]:
    """Everything ReacherX shows a user about a prospect: profile, the post that matched, why it fits."""
    sp = p.get("socialProfiles") or {}
    ctx = p.get("discoveryContext") or {}
    li = (sp.get("linkedin") or {}).get("url") or ctx.get("linkedinProfileUrl")
    tw = (sp.get("twitter") or {}).get("url") or (
        f"https://x.com/{sp['twitter']['username']}" if (sp.get("twitter") or {}).get("username") else None
    )
    evidence = []
    for raw in p.get("evidencePosts") or []:
        post = _post_fields(raw)
        if post.get("text") or post.get("id"):
            evidence.append({"url": _post_url(post, sp), "text": "Matched post: " + str(post.get("text") or "")[:800], "published_at": _iso(post.get("createdAt"))})
    if not evidence and ctx.get("discoverySnippet"):
        evidence.append({"url": None, "text": "Matched post: " + ctx["discoverySnippet"][:800], "published_at": None})
    for s in p.get("qualificationSources") or []:
        evidence.append({"url": s.get("sourceUrl"), "text": (s.get("supportingQuote") or s.get("text") or "")[:800], "published_at": _iso(s.get("publishedAt"))})
    if ctx.get("matchedQueries"):
        evidence.append({"url": None, "text": "Matched search: " + "; ".join(ctx["matchedQueries"][:3]), "published_at": None})
    if p.get("qualificationReasoning"):
        evidence.append({"url": None, "text": "ReacherX fit reasoning: " + p["qualificationReasoning"][:800], "published_at": None})
    dates = [e["published_at"] for e in evidence if e.get("published_at")]
    return {
        "name": p.get("displayName"),
        "title": p.get("title"),
        "company": p.get("company"),
        "location": p.get("location"),
        "linkedin_url": li,
        "bio": p.get("briefIntro") or ctx.get("linkedinHeadline"),
        "profile_urls": [u for u in [li, tw, p.get("websiteUrl")] if u],
        "evidence": evidence,
        "activity_date": max(dates) if dates else None,
        "tool_score": p.get("qualificationScore"),
        "platform": p.get("platform"),
        "prospect_id": p.get("id"),
    }


def _iso(v: Any) -> str | None:
    if isinstance(v, (int, float)):
        return datetime.fromtimestamp(v / 1000, tz=timezone.utc).isoformat(timespec="seconds")
    return v if isinstance(v, str) else None


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--query", required=True)
    ap.add_argument("--user-id", required=True)
    ap.add_argument("--credit-cap", type=int, default=0, help="abort when LinkdAPI billable units used by this run exceed this (0 = no cap)")
    ap.add_argument("--export-only", action="store_true", help="redo only the export of a finished run (no new cycle, no spend)")
    ap.add_argument("--workspace-id", help="export-only: workspace of the finished run (else read from <query>.run.json)")
    ap.add_argument("--since-ms", type=float, help="export-only: run start in ms (cost window)")
    ap.add_argument("--or-delta", type=float, help="export-only: OpenRouter spend measured during the run")
    ap.add_argument("--latency-s", type=float, help="export-only: run duration in seconds")
    ap.add_argument("--aborted", help="export-only: why the run stopped early, if it did")
    args = ap.parse_args()
    q = query_by_id(args.query)
    use_case = CONFIG["tools"]["reacherx"]["use_case_by_category"][q["category"]]
    out_path = DATA_DIR / "reacherx_exports" / f"{q['query_id']}.json"
    if out_path.exists():
        print(f"skip {q['query_id']}: already exported (never re-run a paid query)")
        return 0
    if args.export_only:
        run_file = DATA_DIR / "reacherx_exports" / f"{q['query_id']}.run.json"
        if run_file.exists():
            saved = read_json(run_file)
            return finalize(q, use_case, saved["workspace_id"], saved, saved["or_delta"])
        if not (args.workspace_id and args.since_ms and args.or_delta is not None and args.latency_s):
            raise SystemExit("--export-only needs <query>.run.json or --workspace-id --since-ms --or-delta --latency-s")
        meta = {"started_at": datetime.fromtimestamp(args.since_ms / 1000, tz=timezone.utc).isoformat(timespec="seconds"), "since_ms": args.since_ms, "latency_s": args.latency_s, "aborted": args.aborted, "stop": "see run log", "final_status": None, "poll_log": []}
        write_json(run_file, {**meta, "workspace_id": args.workspace_id, "or_delta": args.or_delta})
        return finalize(q, use_case, args.workspace_id, meta, args.or_delta)

    guard(PER_RUN_CAP_USD, label=f"reacherx {q['query_id']}")
    or_before = openrouter_usage()
    started = time.monotonic()
    started_at = now_iso()
    log: list[dict[str, Any]] = []
    workspace_id = None
    status: dict[str, Any] | None = None
    aborted = None
    print(f"linkdapi circuit: {convex_run('resetLinkdApiCircuit', {})}")
    set_pause(False)
    try:
        prep = convex_run("prepareAndStart", {"userId": args.user_id, "queryId": q["query_id"], "prompt": q["prompt"], "useCaseKey": use_case})
        workspace_id, since_ms = prep["workspaceId"], prep["startedAt"]
        print(f"workspace {workspace_id} started ({use_case})")
        stable = 0
        last_key = None
        while time.monotonic() - started < TIMEOUT_S:
            time.sleep(POLL_S)
            status = convex_run("runStatus", {"workspaceId": workspace_id})
            spent = openrouter_usage() - or_before - ledger_window(OPENROUTER_LEDGER_SERVICES, started_at, now_iso())
            log.append({"t": round(time.monotonic() - started), "status": status, "openrouter_delta": round(spent, 4)})
            c = status["counts"]
            print(f"  t={log[-1]['t']}s wf={status['workflowState']} total={c['total']} pending={c['pending']} qualified={c['qualified']} spent=${spent:.3f}")
            if spent > PER_RUN_CAP_USD:
                aborted = f"per-run cap ${PER_RUN_CAP_USD} exceeded"
                break
            if args.credit_cap:
                units = convex_run("linkdApiUnitsSince", {"since": since_ms})["billableUnits"]
                log[-1]["linkdapi_units"] = units
                print(f"    linkdapi credits used this run: {units} / cap {args.credit_cap}")
                if units > args.credit_cap:
                    aborted = f"LinkdAPI credit cap {args.credit_cap} exceeded ({units})"
                    break
            done = status["workflowState"] in ("completed", "failed", "canceled") and c["pending"] == 0
            key = (status["workflowState"], c["total"], c["pending"], c["qualified"])
            stable = stable + 1 if done and key == last_key else (1 if done else 0)
            last_key = key
            if stable >= STABLE_POLLS:
                break
        else:
            aborted = f"timeout after {TIMEOUT_S}s"
        latency = time.monotonic() - started
    finally:
        stop = None
        if workspace_id:
            try:
                stop = convex_run("stopRun", {"workspaceId": workspace_id})
            except Exception as exc:  # report, but never skip re-pausing
                stop = {"error": str(exc)}
        set_pause(True)
        print(f"stopped: {stop}; PAUSE_AUTONOMOUS_JOBS=true")

    time.sleep(5)
    run_meta = {"started_at": started_at, "since_ms": since_ms, "latency_s": round(latency, 1), "aborted": aborted, "stop": stop, "final_status": status, "poll_log": log}
    # Other harness OpenRouter calls (judge, translations) during the window are not ReacherX's.
    others = ledger_window(OPENROUTER_LEDGER_SERVICES, started_at, now_iso())
    or_delta = round(max(openrouter_usage() - or_before - others, 0.0), 6)
    run_meta["openrouter_other_harness_usd"] = round(others, 6)
    # Save run facts first, so a failed export can be redone with --export-only.
    write_json(DATA_DIR / "reacherx_exports" / f"{q['query_id']}.run.json", {**run_meta, "workspace_id": workspace_id, "or_delta": or_delta})
    return finalize(q, use_case, workspace_id, run_meta, or_delta)


def finalize(q: dict, use_case: str, workspace_id: str, run_meta: dict[str, Any], or_delta: float) -> int:
    out_path = DATA_DIR / "reacherx_exports" / f"{q['query_id']}.json"
    since_ms, latency, started_at = run_meta["since_ms"], run_meta["latency_s"], run_meta["started_at"]
    aborted, stop, status, log = run_meta["aborted"], run_meta["stop"], run_meta["final_status"], run_meta["poll_log"]
    export = convex_run("exportProspects", {"workspaceId": workspace_id})
    costs = convex_run("runCosts", {"workspaceId": workspace_id, "since": since_ms - 60_000})
    provider_usd = round(sum(v["usd"] for v in costs["providers"].values()), 6)
    record_spend("reacherx-providers", f"reacherx run {q['query_id']}", provider_usd, breakdown=costs["providers"])

    fit_min = export["workspace"]["fitScoreMin"]
    qualified = [p for p in export["prospects"] if p["qualificationStatus"] == "qualified" and (p["qualificationScore"] or 0) >= fit_min]
    qualified.sort(key=lambda p: (-(p["qualificationScore"] or 0), p["createdAt"]))
    result = {
        "query_id": q["query_id"],
        "at": started_at,
        "input": {"prompt": q["prompt"], "useCaseKey": use_case, "workspaceId": workspace_id, "models": "production defaults (openai/gpt-6-luna-pro)"},
        "latency_s": round(latency, 1),
        "cost_usd": round(or_delta + provider_usd, 6),
        "cost_breakdown": {"openrouter_delta_usd": or_delta, "providers": costs["providers"], "llm_usd_recorded_in_app": costs["llmUsdRecorded"]},
        "aborted": aborted,
        "stop": stop,
        "final_status": status,
        "counts": {"discovered": len(export["prospects"]), "qualified": len(qualified)},
        "workspace": export["workspace"],
        "prospects": [to_person(p) for p in qualified[: CONFIG["top_k"]]],
        "poll_log": log,
    }
    write_json(out_path, result)
    write_json(DATA_DIR / "reacherx_exports" / f"{q['query_id']}.full.json", export)
    deleted = convex_run("deleteBenchmarkWorkspace", {"workspaceId": workspace_id})
    print(f"workspace delete requested: {deleted}")
    print(f"exported {len(result['prospects'])} of {len(qualified)} qualified ({len(export['prospects'])} discovered); cost ${result['cost_usd']:.4f}; {result['latency_s']}s")
    return 0


if __name__ == "__main__":
    try:
        sys.exit(main())
    except BudgetStop as stop:
        print(f"STOP {stop}")
        sys.exit(2)
