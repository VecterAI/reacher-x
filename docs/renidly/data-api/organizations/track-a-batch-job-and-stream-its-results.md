# Resolve any B2B identity in milliseconds

GET

https://renidly.com/api/data/v1/companies/batch/enrich

0Defaultreacher-x-search-engine-development-previewreacher-x-search-engine-productionSend⌘↵

Track a batch job and stream its results

Poll a job submitted via **Submit Batch Enrich** to watch progress and pull resolved organizations **as they complete** — you never wait for the whole batch.

**The cursor.** Results are an ordered, append-only stream. `after` is a bookmark of how many results you've already pulled (start at `0`). Each response returns only the items **after** that point, plus a `next_cursor`; send that back as `after` on your next poll. So you fetch each organization exactly once, in small live batches — a page is capped at **100** companies per call. (The cursor is for efficiency; a client that ignores it simply re-reads page one and gets no further — it can't pull everything in one call.)

**What you get.** `status` / `resolved` / `errors` / `total` for progress, a `companies` map keyed by **the id or slug you submitted** (full records, same shape as **Get Organization**), and a `not_found` list for inputs that didn't resolve.

**Free.** This endpoint is **not billed** — you already paid per resolve at enrich time, so poll as often as your plan's rate limit allows.

**Ownership.** A job is bound to your account, not to a single key — rotating or using a different key of yours still works, and a `job_id` that isn't yours (or one from the people batch endpoint) simply returns `404`.

Show more

Request

job_id\*stringquery

The opaque job token returned by **Submit Batch Enrich**.

afterintegerquery

Result cursor — the number of results you've already consumed. Start at `0`; thereafter pass back the `next_cursor` from your previous response.

Responses

200400401403404429503

200OK

The current job state plus the **next page of resolved organizations** (those after your `after` cursor). Poll repeatedly, advancing `after` to `next_cursor`, to stream results live. This endpoint is **free**.

Schema

successbooleanrequired

statusCodeintegerrequired

Mirrors the HTTP status.

messagestringrequired

errorsobject?required

dataobjectrequired

statusenumrequiredprocessing · completed · error

`processing` — still resolving, keep polling. `completed` — every item resolved. `error` — stopped early (see `error`); the partial results are still valid and yours to read.

errorstring

Reason when `status` is `error`. Currently only `insufficient_balance` (balance hit 0 mid-job; already-resolved organizations are kept).

totalintegerrequired

Unique items in the job.

resolvedintegerrequired

Items resolved to an organization so far.

errorsintegerrequired

Items that came back not-found so far.

next_cursorintegerrequired

Pass this back as `after` on the next poll to fetch only the newly-resolved items.

companiesobject

Map of **your input** (the id or slug you submitted) → the full organization record (same shape as **Get Organization**). Only the items in this page are included.

not_foundstring\[\]

Inputs in this page that didn't resolve to an organization (still billed — a real lookup was performed).

ResponseHeadersCode examples

No response yet

Hit **Send** to fire a live request against the endpoint.
