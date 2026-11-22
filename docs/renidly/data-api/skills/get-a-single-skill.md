# Resolve any B2B identity in milliseconds

GET

https://renidly.com/api/data/v1/skills/skill

0Defaultreacher-x-search-engine-development-previewreacher-x-search-engine-productionSend⌘↵

Get a single skill

Retrieves one skill by its opaque `skl_` id (as returned by the Search Skills endpoint). Lightweight — returns the skill's id, name, and normalized name.

Show more

Request

id\*stringquery

The skill's opaque `skl_` id. Obtain it from the Search Skills endpoint.

Responses

200400401403429500504

200OK

HTTP `200`, one of two outcomes:

- **Found** — `success: true`, `data` is the skill record.
- **Not found** — `success: false`, `error_code` `1030`, `message` `"Skill not found"`, `data` null. A miss is returned as `200` (not `404`) because a real lookup was performed, so the call is billed.

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
