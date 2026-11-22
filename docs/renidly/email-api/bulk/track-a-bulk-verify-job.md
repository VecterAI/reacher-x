# Resolve any B2B identity in milliseconds

GET

https://renidly.com/api/emails/v1/verify/batch

0Defaultreacher-x-search-engine-development-previewreacher-x-search-engine-productionSend⌘↵

Track a bulk verify job

Poll a job from **Submit a bulk verify job** to watch progress and pull verdicts **as they complete**. `after` is a cursor — start at `0`, then pass back the `next_cursor` from each response (up to 100 addresses per page). This endpoint is **free** and always returns live progress (never cached).

Show less

Request

job_id\*stringquery

The opaque token returned at submit.

afterintegerquery

Result cursor — start at 0, then pass back `next_cursor`.

Responses

200400401403404429503

200OK

Current job state plus the next page of verdicts. Poll repeatedly, advancing `after` to `next_cursor`, to stream results as they land (up to **100** addresses per page). This endpoint is **free** — you were charged per address at submit time.

`data.results` is keyed by the **address you submitted**; each value is the same verdict shape as a single **Verify** (`email`, `deliverable`, `reason`, `catch_all`).

Schema

successbooleanrequired

statusCodeintegerrequired

messagestringrequired

errorsobject?required

dataobjectrequired

statusenumrequiredprocessing · completed · error

`processing` — still verifying, keep polling. `completed` — every address has a verdict. `error` — stopped early (see `error`); resolved results stay valid.

errorstring

Reason when `status` is `error` (e.g. `insufficient_balance`).

totalintegerrequired

Unique addresses in the job.

resolvedintegerrequired

Addresses verified so far.

errorsintegerrequired

Always 0 — every address gets a verdict.

next_cursorintegerrequired

Pass back as `after` on the next poll.

resultsobjectrequired

Map of submitted address → its verdict (this page only).

ResponseHeadersCode examples

No response yet

Hit **Send** to fire a live request against the endpoint.
