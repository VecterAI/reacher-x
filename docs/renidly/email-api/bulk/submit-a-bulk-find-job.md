# Resolve any B2B identity in milliseconds

POST

https://renidly.com/api/emails/v1/find/batch

0Defaultreacher-x-search-engine-development-previewreacher-x-search-engine-productionSend⌘↵

Submit a bulk find job

Find work emails for up to **1000 people in a single request**. Send an array of `{ first_name, last_name, domain }`; we resolve each in the background at a controlled pace. Poll the `GET` on this same path to stream results.

**Billing.** Each person is charged the same as a single **Find**, once it reaches a definitive result (found or not-found). Transient failures are retried and not charged. Balance is pre-checked at submit (`402` if short, nothing charged); if it hits 0 mid-job the job stops and resolved results are kept. **Lifetime:** 6 hours.

Show less

Request

Body\*application/json

FormRaw JSON

queries\*object\[\]

first_name\*string

last_name\*string

domain\*string

The company domain — a bare hostname (no \`https://\`, no \`@\`).

Add item

The people to resolve. Duplicate and incomplete entries are dropped.

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
