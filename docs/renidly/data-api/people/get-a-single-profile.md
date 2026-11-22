# Resolve any B2B identity in milliseconds

GET

https://renidly.com/api/data/v1/people/profile

1Defaultreacher-x-search-engine-development-previewreacher-x-search-engine-productionSend⌘↵

Get a single profile

Retrieves the full record for one professional.

The response includes the basic profile (name, headline, summary, location, languages), all positions (with employment metadata and organization detail), education, skills, certifications, publications, volunteering, and projects.

Look a person up by **either** our stable `id` **or** their `handle` — one is required. Prefer `id`: it's permanent, whereas a handle can change. Every response also returns this `id`, so you can store it and fetch reliably later.

If the profile is not currently in our database, the service attempts a real-time enrichment in the background. That may add 1–2 seconds to the response.

Show more

Request

idstringquery

Our stable identifier for the person (looks like `prsn_…`), returned on every record. Recommended over `handle` because it never changes.

_Example use case:_ you saved `prsn_06d0d44dogo2m` from a search result — fetch that exact person any time, even if they later rename their profile.

handlestringquery

The person's public profile handle — the slug at the end of their public URL. For a URL ending in `/ryanroslansky`, pass `ryanroslansky`. May change over time; use `id` for a stable reference.

Responses

200400401403429500503504

200OK

HTTP `200`, one of two outcomes:

- **Found** — `success: true`, `data` is the full profile record.
- **Not found** — `success: false`, `error_code` `1010`, `message` `"Profile not found"`, `data` null. A miss is returned as `200` (not `404`) because a real lookup was performed, so the call is billed.

Schema

successbooleanrequired

statusCodeintegerrequired

Mirrors the HTTP status code.

messagestringrequired

errorsobject?required

Always null on success.

dataany?required

Endpoint-specific payload (object, array, or null).

ResponseHeadersCode examples

No response yet

Hit **Send** to fire a live request against the endpoint.
