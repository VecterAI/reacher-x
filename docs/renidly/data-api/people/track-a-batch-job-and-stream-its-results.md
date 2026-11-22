# Resolve any B2B identity in milliseconds

GET

https://renidly.com/api/data/v1/people/batch/enrich

0Defaultreacher-x-search-engine-development-previewreacher-x-search-engine-productionSend⌘↵

Track a batch job and stream its results

Poll a job submitted via **Submit Batch Enrich** to watch progress and pull resolved profiles **as they complete** — you never wait for the whole batch.

**The cursor.** Results are an ordered, append-only stream. `after` is a bookmark of how many results you've already pulled (start at `0`). Each response returns only the items **after** that point, plus a `next_cursor`; send that back as `after` on your next poll. So you fetch each profile exactly once, in small live batches — a page is capped at **100** profiles per call. (The cursor is for efficiency; a client that ignores it simply re-reads page one and gets no further — it can't pull everything in one call.)

**What you get.** `status` / `resolved` / `errors` / `total` for progress, a `profiles` map keyed by **the id or handle you submitted** (full records, same shape as **Get Profile**), and a `not_found` list for inputs that didn't resolve.

**Free.** This endpoint is **not billed** — you already paid per resolve at enrich time, so poll as often as your plan's rate limit allows.

**Ownership.** A job is bound to your account, not to a single key — rotating or using a different key of yours still works, and a `job_id` that isn't yours simply returns `404`.

Show more

Request

job_id\*stringquery

The opaque job token returned by **Submit Batch Enrich**.

afterintegerquery

Result cursor — the number of results you've already consumed. Start at `0`; thereafter pass back the `next_cursor` from your previous response.

Responses

200400401403404429503

200OK

The current job state plus the **next page of resolved profiles** (those after your `after` cursor). Poll repeatedly, advancing `after` to `next_cursor`, to stream results live. This endpoint is **free**.

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

Reason when `status` is `error`. Currently only `insufficient_balance` (balance hit 0 mid-job; already-resolved profiles are kept).

totalintegerrequired

Unique items in the job.

resolvedintegerrequired

Items resolved to a profile so far.

errorsintegerrequired

Items that came back not-found so far.

next_cursorintegerrequired

Pass this back as `after` on the next poll to fetch only the newly-resolved items.

profilesobject

Map of **your input** (the id or handle you submitted) → the full profile record (same shape as **Get Profile**). Only the items in this page are included.

not_foundstring\[\]

Inputs in this page that didn't resolve to a profile (still billed — a real lookup was performed).

ResponseHeadersCode examples

No response yet

Hit **Send** to fire a live request against the endpoint.
