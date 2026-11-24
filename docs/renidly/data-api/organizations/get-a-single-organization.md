# Resolve any B2B identity in milliseconds

GET

https://renidly.com/api/data/v1/companies/company

1Defaultreacher-x-search-engine-development-previewreacher-x-search-engine-productionSend⌘↵

Get a single organization

Retrieves complete details for one organization.

The response includes the basic record (name, tagline, description, type, website), headquarters location, headcount and follower count, industries and specialities, logos and cover images, founded year, and (when available) a Crunchbase URL.

Look an organization up by **either** our stable `id` **or** its `slug` — one is required. Prefer `id`: it's permanent, whereas a slug can change. Every response also returns this `id` for reliable future lookups.

If the organization is not currently in our database, the service attempts a real-time enrichment in the background.

Show more

Request

idstringquery

Our stable identifier for the organization (looks like `org_…`), returned on every record. Recommended over `slug` because it never changes.

_Example use case:_ a person's positions reference each employer by its `org_…` id — pass that straight here to pull the full company.

slugstringquery

The organization's public slug — the human-readable identifier at the end of its public URL. For a URL ending in `/google`, pass `google`. May change over time; use `id` for a stable reference.

Responses

200400401403429500503504

200OK

HTTP `200`, one of two outcomes:

- **Found** — `success: true`, `data` is the full organization record.
- **Not found** — `success: false`, `error_code` `1020`, `message` `"Company not found"`, `data` null. A miss is returned as `200` (not `404`) because a real lookup was performed, so the call is billed.

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
