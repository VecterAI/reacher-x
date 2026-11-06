# People search benchmark

Compares ReacherX with Apollo, Clay, Exa, Firecrawl, context.dev and Treg People Search
on a small frozen query set ([issue #122](https://github.com/VecterAI/reacher-x/issues/122)).
Scoring reuses [People Search Bench](https://github.com/LessieAI/people-search-bench)
by LessieAI (criteria-grounded verification, padded nDCG@10, effective coverage,
information utility). Their code is cloned at a pinned commit and used as is.

- `queries.jsonl`: the frozen queries (4 drawn from People Search Bench with seed 122, 2 intent queries)
- `config.json`: the locked method, models, per-tool settings, queries not run, and every deviation from upstream

## Run

Needs [uv](https://docs.astral.sh/uv/) and a `.env.benchmark.local` at the repo root with the
keys you need (`OPENROUTER_API_KEY`, `TAVILY_API_KEY`, `EXA_API_KEY`, `FIRECRAWL_API_KEY`,
`CONTEXT_DEV_API_KEY`, `CLAY_API_KEY`, `TREG_TOKEN`, `TREG_TOKEN_REACHERX`).

```bash
cd benchmarks/people-search
uv run python -m harness.collect --queries all          # top 10 from each API tool
uv run python -m harness.reacherx_runner --query int_0002 --user-id <dev users _id> --credit-cap 55
uv run python -m harness.collect --tools reacherx,reacherx_topfit
uv run python -m harness.score --judge final            # verify every person on the web
uv run python -m harness.report --judge final           # results table, no keys needed
uv run python -m harness.public_bundle                  # shareable bundle (no emails or phones)
uv run python -m harness.public_bundle --rescore        # recompute every score from the bundle, no keys
```

Every answer, web search and verdict is cached under `data/` (git-ignored, it holds personal
data), so a rerun never pays twice.

## ReacherX runs

The runner only targets a Convex dev deployment, through internal functions in
`convex/benchmarkPeopleSearch.ts`. It turns `PAUSE_AUTONOMOUS_JOBS` off for the run and always
back on, stops the run, deletes the SocialAPI monitors and the benchmark workspace it created,
and can stop early at a LinkdAPI credit cap. `harness.linkdapi_key` swaps the dev LinkdAPI key
for a run and restores it (`status`, `use-prod`, `restore`; it prints fingerprints, never keys).

Spend guards stop before a paid step if OpenRouter usage passes $5 or total spend nears $9.50.
