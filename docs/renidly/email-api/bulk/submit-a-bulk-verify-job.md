# Resolve any B2B identity in milliseconds

POST

https://renidly.com/api/emails/v1/verify/batch

0Defaultreacher-x-search-engine-development-previewreacher-x-search-engine-productionSend⌘↵

Submit a bulk verify job

Verify up to **1000 addresses in a single request** instead of one call each. We accept the job immediately, return a `job_id`, and verify the addresses at a controlled pace in the background. Poll the `GET` on this same path to stream verdicts as they land.

**How it works.**

1.  Send `emails` (1–1000 unique, valid addresses; duplicates and blanks are dropped).
2.  We check your balance covers the unique count; if not, the request is rejected with `402` and **nothing is charged**.
3.  We accept the job (`202`) and return an opaque `job_id`.

**Billing.** Each address is charged the same as a single **Verify**, once it has a verdict. Addresses that fail only on a transient error are retried and not charged. If your balance hits 0 mid-job it stops with `status: error` and everything already verified stays available.

**Lifetime.** A job and its results live for **6 hours**.

Show more

Request

Body\*application/json

FormRaw JSON

emails\*string\[\]

Add item

The addresses to verify. Duplicates and blank entries are dropped.

Responses

202400401402403429503

202Accepted

The bulk job was accepted and queued. `data.job_id` is the opaque token you poll for results (the `GET` on the same path). Valid for 6 hours.

Schema

successbooleanrequired

statusCodeintegerrequired

Mirrors the HTTP status.

messagestringrequired

errorsobject?required

dataobjectrequired

job_idstringrequired

Opaque job token. Poll it with GET on the same path.

ResponseHeadersCode examples

No response yet

Hit **Send** to fire a live request against the endpoint.
