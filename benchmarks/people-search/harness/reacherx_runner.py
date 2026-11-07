"""Run ReacherX on one frozen query against a Convex DEV deployment and export results.

    uv run python -m harness.reacherx_runner --query b2b_0014 --user-id <users id>

Steps: budget check -> PAUSE_AUTONOMOUS_JOBS=false -> setup draft + workspace + one
prospecting cycle (convex/benchmarkPeopleSearch.ts) -> wait for discovery and
qualification -> stop the run and delete SocialAPI monitors -> PAUSE_AUTONOMOUS_JOBS back to
its value before the run (always, even on failure) -> export. Cost = OpenRouter key usage delta (nothing else may
use the key during a run) + provider costs ReacherX records for the workspace.
"""

from __future__ import annotations

import argparse
import json
import re
import sys
import time
from datetime import datetime, timezone
from typing import Any

from .core import (
    CONFIG,
    DATA_DIR,
    OPENROUTER_LEDGER_SERVICES,
    BudgetStop,
    convex_cli,
    dev_deployment,
    guard,
    ledger_window,
    now_iso,
    openrouter_balance,
    openrouter_usage,
    query_by_id,
    read_json,
    record_spend,
    write_json,
)

POLL_S = 30
TIMEOUT_S = 60 * 60
PER_RUN_CAP_USD = 1.5  # abort a single query's run past this OpenRouter spend
RUN_BALANCE_NEED_USD = 0.6  # about twice the OpenRouter cost of one intent run so far
MIN_BALANCE_USD = 0.1  # stop a run cleanly before the account runs dry
STABLE_POLLS = 2
MAX_POLL_FAILURES = 3  # consecutive failed status reads before a still-running run is given up


def convex_run(fn: str, payload: dict[str, Any]) -> Any:
    raw = convex_cli("run", f"benchmarkPeopleSearch:{fn}", json.dumps(payload)).stdout.strip()
    return json.loads(raw) if raw else None


PAUSE_VAR = "PAUSE_AUTONOMOUS_JOBS"


def get_pause() -> str | None:
    """Current value on dev, or None when unset. Fails before any change if it cannot be read."""
    out = convex_cli("env", "get", PAUSE_VAR, check=False, timeout=120)
    if out.returncode != 0:
        raise SystemExit(f"Could not read {PAUSE_VAR} on dev (exit {out.returncode}); nothing changed")
    return out.stdout.strip() or None


def restore_pause(value: str | None) -> None:
    if value is None:
        convex_cli("env", "remove", PAUSE_VAR)
    else:
        convex_cli("env", "set", PAUSE_VAR, value)


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
    dev_deployment()  # refuse anything but a dev deployment before any read or write
    q = query_by_id(args.query)
    use_case = CONFIG["tools"]["reacherx"]["use_case_by_category"][q["category"]]
    exports = DATA_DIR / "reacherx_exports"
    out_path = exports / f"{q['query_id']}.json"
    run_file = exports / f"{q['query_id']}.run.json"
    if out_path.exists():
        print(f"skip {q['query_id']}: already exported (never re-run a paid query)")
        return 0
    if args.export_only:
        if run_file.exists():
            saved = read_json(run_file)
            or_delta = saved.get("or_delta")
            if or_delta is None:
                # The run stopped before its final measurement: estimate it, and say so.
                others = ledger_window(OPENROUTER_LEDGER_SERVICES, saved["started_at"], now_iso())
                or_delta = round(max(openrouter_usage() - saved["or_before"] - others, 0.0), 6)
                saved["or_delta_estimated"] = True
            return finalize(q, use_case, saved["workspace_id"], saved, or_delta)
        if not (args.workspace_id and args.since_ms and args.or_delta is not None and args.latency_s):
            raise SystemExit("--export-only needs <query>.run.json or --workspace-id --since-ms --or-delta --latency-s")
        meta = {"started_at": datetime.fromtimestamp(args.since_ms / 1000, tz=timezone.utc).isoformat(timespec="seconds"), "since_ms": args.since_ms, "latency_s": args.latency_s, "aborted": args.aborted, "stop": "see run log", "final_status": None, "poll_log": []}
        write_json(run_file, {**meta, "workspace_id": args.workspace_id, "or_delta": args.or_delta})
        return finalize(q, use_case, args.workspace_id, meta, args.or_delta)
    if run_file.exists():
        raise SystemExit(f"A paid run for {q['query_id']} already happened without an export. Recover it with --export-only; a second paid run is refused.")

    guard(PER_RUN_CAP_USD, label=f"reacherx {q['query_id']}", balance_need=RUN_BALANCE_NEED_USD)
    or_before = openrouter_usage()
    started = time.monotonic()
    started_at = now_iso()
    log: list[dict[str, Any]] = []
    workspace_id = None
    since_ms = None
    status: dict[str, Any] | None = None
    aborted = None
    stop = None
    pause_before = get_pause()
    print(f"linkdapi circuit: {convex_run('resetLinkdApiCircuit', {})}")
    convex_cli("env", "set", PAUSE_VAR, "false")
    try:
        requested_ms = time.time() * 1000
        try:
            prep = convex_run("prepareAndStart", {"userId": args.user_id, "queryId": q["query_id"], "prompt": q["prompt"], "useCaseKey": use_case})
            workspace_id, since_ms = prep["workspaceId"], prep["startedAt"]
        except Exception as exc:
            # A timeout can land after the workspace was created; find it so it is stopped and cleaned up.
            found = convex_run("findRunWorkspace", {"userId": args.user_id, "queryId": q["query_id"], "since": requested_ms - 60_000})
            if not found:
                raise
            workspace_id, since_ms = found["workspaceId"], found["createdAt"]
            aborted = f"start failed after the workspace was created: {type(exc).__name__}: {exc}"[:300]
            write_json(run_file, {"started_at": started_at, "since_ms": since_ms, "workspace_id": workspace_id, "or_before": or_before, "or_delta": None, "aborted": aborted, "stop": None, "final_status": None, "poll_log": [], "latency_s": None})
            raise
        # Recovery facts go to disk before polling, so a crash can still be exported.
        write_json(run_file, {"started_at": started_at, "since_ms": since_ms, "workspace_id": workspace_id, "or_before": or_before, "or_delta": None, "aborted": "run did not finish", "stop": None, "final_status": None, "poll_log": [], "latency_s": None})
        print(f"workspace {workspace_id} started ({use_case})")
        stable = 0
        last_key = None
        poll_failures = 0
        while time.monotonic() - started < TIMEOUT_S:
            time.sleep(POLL_S)
            try:
                status = convex_run("runStatus", {"workspaceId": workspace_id})
            except Exception as exc:  # often transient (network, CLI timeout): retry on the next poll
                poll_failures += 1
                print(f"  status read failed ({poll_failures}/{MAX_POLL_FAILURES}): {type(exc).__name__}: {exc}"[:200])
                if poll_failures >= MAX_POLL_FAILURES:
                    aborted = f"status read failed {poll_failures} times in a row: {type(exc).__name__}: {exc}"[:300]
                    break
                continue
            poll_failures = 0
            try:  # spend that can't be read can't be capped: stop instead of running on unchecked
                spent = openrouter_usage() - or_before - ledger_window(OPENROUTER_LEDGER_SERVICES, started_at, now_iso())
                balance = openrouter_balance()
            except Exception as exc:
                aborted = f"could not read OpenRouter spend: {type(exc).__name__}: {exc}"[:300]
                break
            log.append({"t": round(time.monotonic() - started), "status": status, "openrouter_delta": round(spent, 4)})
            c = status["counts"]
            print(f"  t={log[-1]['t']}s wf={status['workflowState']} total={c['total']} pending={c['pending']} qualified={c['qualified']} spent=${spent:.3f}")
            if status.get("workspaceStatus") == "limit_reached":
                aborted = "start declined: plan limit reached"
                break
            if spent > PER_RUN_CAP_USD:
                aborted = f"per-run cap ${PER_RUN_CAP_USD} exceeded"
                break
            if balance < MIN_BALANCE_USD:
                aborted = f"OpenRouter account balance down to ${balance:.2f}; stopped cleanly"
                break
            if args.credit_cap:
                try:
                    used = convex_run("linkdApiUnitsSince", {"since": since_ms})
                except Exception as exc:  # a cap that can't be checked can't be enforced: stop
                    aborted = f"could not read LinkdAPI credits: {type(exc).__name__}: {exc}"[:300]
                    break
                units = used["billableUnits"]
                log[-1]["linkdapi_units"] = units
                print(f"    linkdapi credits used this run: {units} / cap {args.credit_cap}")
                if used.get("capped"):
                    aborted = f"LinkdAPI event read hit its limit at {units} credits; true use unknown, stopping"
                    break
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
    finally:
        if workspace_id:
            try:
                stop = convex_run("stopRun", {"workspaceId": workspace_id})
            except Exception as exc:  # report, but never skip restoring the pause flag
                stop = {"error": str(exc)[:500]}
        restore_pause(pause_before)
        print(f"stopped: {stop}; {PAUSE_VAR} restored to {pause_before or '(unset)'}")
        if workspace_id:
            write_json(run_file, {"started_at": started_at, "since_ms": since_ms, "workspace_id": workspace_id, "or_before": or_before, "or_delta": None, "aborted": aborted or "run did not finish", "stop": stop, "final_status": status, "poll_log": log, "latency_s": round(time.monotonic() - started, 1)})

    time.sleep(5)
    run_meta = read_json(run_file)
    run_meta["aborted"] = aborted
    # Other harness OpenRouter calls (judge, translations) during the window are not ReacherX's.
    others = ledger_window(OPENROUTER_LEDGER_SERVICES, started_at, now_iso())
    run_meta["or_delta"] = round(max(openrouter_usage() - or_before - others, 0.0), 6)
    run_meta["openrouter_other_harness_usd"] = round(others, 6)
    write_json(run_file, run_meta)
    return finalize(q, use_case, workspace_id, run_meta, run_meta["or_delta"])


def finalize(q: dict, use_case: str, workspace_id: str, run_meta: dict[str, Any], or_delta: float) -> int:
    out_path = DATA_DIR / "reacherx_exports" / f"{q['query_id']}.json"
    since_ms, latency, started_at = run_meta["since_ms"], run_meta.get("latency_s"), run_meta["started_at"]
    aborted, stop, status, log = run_meta.get("aborted"), run_meta.get("stop"), run_meta.get("final_status"), run_meta.get("poll_log") or []
    export = convex_run("exportProspects", {"workspaceId": workspace_id})
    costs = convex_run("runCosts", {"workspaceId": workspace_id, "since": since_ms - 60_000})
    provider_usd = round(sum(v["usd"] for v in costs["providers"].values()), 6)
    record_spend("reacherx-providers", f"reacherx run {q['query_id']}", provider_usd, once_key=f"reacherx:{q['query_id']}:{workspace_id}", breakdown=costs["providers"])
    warnings = []
    if costs.get("providerEventsCapped"):
        warnings.append("provider cost events hit the read cap; provider cost is a lower bound")
    if costs.get("llmEventsCapped"):
        warnings.append("in-app LLM usage events hit the read cap; llm_usd_recorded_in_app is a lower bound")
    if run_meta.get("or_delta_estimated"):
        warnings.append("OpenRouter spend estimated after the run stopped early; may include later spend")
    cleanup_problem = isinstance(stop, dict) and (stop.get("error") or stop.get("monitorFailures"))
    if cleanup_problem:
        warnings.append(f"stopRun did not finish cleanly: {stop}; workspace kept so its SocialAPI monitors can be cleaned up")

    fit_min = export["workspace"]["fitScoreMin"]
    qualified = [p for p in export["prospects"] if p["qualificationStatus"] == "qualified" and (p["qualificationScore"] or 0) >= fit_min]
    qualified.sort(key=lambda p: (-(p["qualificationScore"] or 0), p["createdAt"]))
    result = {
        "query_id": q["query_id"],
        "at": started_at,
        "input": {"prompt": q["prompt"], "useCaseKey": use_case, "workspaceId": workspace_id, "models": "production defaults (openai/gpt-6-luna-pro)"},
        "latency_s": latency,
        "cost_usd": round(or_delta + provider_usd, 6),
        "cost_breakdown": {"openrouter_delta_usd": or_delta, "providers": costs["providers"], "llm_usd_recorded_in_app": costs["llmUsdRecorded"]},
        "warnings": warnings,
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
    for w in warnings:
        print(f"WARNING: {w}")
    if cleanup_problem:
        print("Workspace NOT deleted. Fix the monitor cleanup, then delete it from the app.")
        return 3
    deleted = convex_run("deleteBenchmarkWorkspace", {"workspaceId": workspace_id, "queryId": q["query_id"], "runStartedAt": since_ms})
    print(f"workspace delete requested: {deleted}")
    print(f"exported {len(result['prospects'])} of {len(qualified)} qualified ({len(export['prospects'])} discovered); cost ${result['cost_usd']:.4f}; {latency}s")
    return 0


if __name__ == "__main__":
    try:
        sys.exit(main())
    except BudgetStop as stop:
        print(f"STOP {stop}")
        sys.exit(2)
