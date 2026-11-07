# People search benchmark

Compares ReacherX with Apollo, Clay, Exa, Firecrawl, context.dev and Treg People Search
on a small frozen query set ([issue #122](https://github.com/VecterAI/reacher-x/issues/122)).
Scoring reuses [People Search Bench](https://github.com/LessieAI/people-search-bench)
by LessieAI (criteria-grounded verification, padded nDCG@10, effective coverage,
information utility). Their code is cloned at a pinned commit and used as is.

- `queries.jsonl`: the frozen queries: 4 drawn from People Search Bench with seed 122, 6 intent queries
  (track `intent`), and one-line versions of 4 of them (track `intent_short`). A short query has
  `grade_as`, the id of its detailed twin, and is graded against that twin's criteria, so a vague
  prompt is judged on what the user really wanted. A question a tool has not been run on yet is
  left out of its scores, not counted as zero.
- `config.json`: the locked method, models, per-tool settings, queries not run, and every deviation from upstream

## Run

Needs [uv](https://docs.astral.sh/uv/) and a `.env.benchmark.local` at the repo root with the
keys you need (`OPENROUTER_API_KEY`, `TAVILY_API_KEY`, `EXA_API_KEY`, `FIRECRAWL_API_KEY`,
`CONTEXT_DEV_API_KEY`, `CLAY_API_KEY`, `TREG_TOKEN`, `TREG_TOKEN_REACHERX`).

```bash
cd benchmarks/people-search
uv run python -m harness.collect --queries all          # top 10 from each API tool
# ReacherX: one paid run per query it was run on (the others are listed under not_run in config.json)
for q in b2b_0014 int_0001 int_0002; do
  uv run python -m harness.reacherx_runner --query "$q" --user-id <dev users _id> --credit-cap 55
done
uv run python -m harness.collect --tools reacherx,reacherx_topfit
uv run python -m harness.score --judge final            # verify every person on the web
uv run python -m harness.report --judge final           # results table, no keys needed
uv run python -m harness.public_bundle                  # shareable bundle (no emails or phones)
uv run python -m harness.public_bundle --rescore        # recompute every score from the bundle, no keys
uv run python -m harness.dashboard_data --judge final   # data files for the results dashboard (gitignored)
```

Every answer, web search and verdict is cached under `data/` (git-ignored, it holds personal
data), so a rerun never pays twice.

## ReacherX runs

The runner only targets a Convex dev deployment, through internal functions in
`convex/benchmarkPeopleSearch.ts`. It turns `PAUSE_AUTONOMOUS_JOBS` off for the run and always
puts back the value it had before (removing it if it was unset), stops the run, deletes the
SocialAPI monitors and the benchmark workspace it created, and can stop early at a LinkdAPI
credit cap. `harness.provider_key` swaps the dev LinkdAPI or SocialAPI key for a run and
restores it (`linkdapi|socialapi|all` then `status|use-prod|restore`; it prints fingerprints,
never keys). Restore only after the run has deleted its SocialAPI monitors, since monitors
belong to the account whose key created them.

Spend guards stop before a paid step if OpenRouter usage passes $5 or total spend nears $9.50.
