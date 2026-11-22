# Resolve any B2B identity in milliseconds

GET

https://renidly.com/api/data/v1/institutions/institution

1Defaultreacher-x-search-engine-development-previewreacher-x-search-engine-productionSend⌘↵

Get a single institution

Retrieves the canonical record for one educational institution: name, normalized name, public URL, ID.

Show less

Request

normalized_name\*stringquery

The institution's normalized name — lowercase, hyphenated. Discover available names with the Search Institutions endpoint.

Responses

200400401403429500504

200OK

HTTP `200`, one of two outcomes:

- **Found** — `success: true`, `data` is the full institution record.
- **Not found** — `success: false`, `error_code` `1040`, `message` `"Institution not found"`, `data` null. A miss is returned as `200` (not `404`) because a real lookup was performed, so the call is billed.

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
