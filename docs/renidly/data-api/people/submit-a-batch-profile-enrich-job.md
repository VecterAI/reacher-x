# Resolve any B2B identity in milliseconds

POST

https://renidly.com/api/data/v1/people/batch/enrich

0Defaultreacher-x-search-engine-development-previewreacher-x-search-engine-productionSend⌘↵

Submit a batch profile-enrich job

Enrich up to **1000 profiles in a single request** instead of making one call per profile.

**Why this exists.** Resolving a profile that isn't already in our database triggers a real-time enrichment, which is rate-limited and takes ~1 second. Firing a thousand of those yourself, in parallel, would hammer the upstream and time out. This endpoint takes the whole list at once, returns immediately, and resolves the items **at a controlled pace in the background**. You then poll **Track Batch Enrich** to stream results as they land.

**How it works.**

1.  Send any mix of `ids` and `handles` (at least one item; **≤ 1000 unique** after de-duplication — duplicates and blank/whitespace entries are dropped, and every `ids` value must be a valid `prsn_…` id).
2.  We check your balance covers the unique count. If it doesn't, the request is rejected with `402` and **nothing is charged**.
3.  We accept the job (`202`) and return an opaque **`job_id`**.
4.  A background worker resolves each item — database first, falling back to a live enrichment on a miss — saving each result as it completes.

**Always-fresh option.** Set `enrich_live: true` to force a live fetch for **every** item (skipping the database shortcut), so you always get the newest record. It's slower but guaranteed current; the price is unchanged.

**Billing.** You are charged **1 credit per item that reaches a definitive result — whether _found_ or _not-found_** — because each is a real lookup performed on your behalf (this mirrors **Get Profile**, which also bills a not-found). Items that fail only due to a _transient_ upstream error are **retried, not charged**. If your balance reaches 0 mid-job, the job stops with `status: error` (`insufficient_balance`) and every profile already resolved stays available.

**Lifetime.** A job and its results live for **6 hours**, then expire.

Read results with **Track Batch Enrich** (the `GET` on this same path).

Show more

Request

Body\*application/json

FormRaw JSON

idsstring\[\]

Add item

Stable \`prsn\_…\` ids to enrich. Every value must be a valid id.

handlesstring\[\]

Add item

Public profile handles to enrich (the slug at the end of the public URL).

enrich_livebooleanDon’t includetruefalse

Controls freshness vs. speed for the whole batch. - \`false\` (default) — each item is served from our database, resolving live only when we don't already have it. Fastest and recommended. - \`true\` — \*\*every\*\* item is fetched fresh from the live source, so you get the most up-to-date record even if we already had one. Slower, but guaranteed current. Billing is identical either way.

Responses

202400401402403429503

202Accepted

The batch was accepted and queued. `data.job_id` is the opaque token you poll for results — see **Track Batch Enrich**. Valid for 6 hours.

Schema

successbooleanrequired

statusCodeintegerrequired

Mirrors the HTTP status.

messagestringrequired

errorsobject?required

dataobjectrequired

job_idstringrequired

Opaque job token. Poll it via Track Batch Enrich.

ResponseHeadersCode examples

No response yet

Hit **Send** to fire a live request against the endpoint.
