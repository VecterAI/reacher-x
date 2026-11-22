# Resolve any B2B identity in milliseconds

GET

https://renidly.com/api/v2/activity/feed

1Defaultreacher-x-search-engine-development-previewreacher-x-search-engine-productionSend⌘↵

Get a person's activity feed

Returns a person's recent posts and shares. The response includes a `nextCursor` — pass it back as `cursor` to page through older activity.

Show less

Request

entityId\*stringquery

The person's opaque identifier (`ACoAA…`) whose activity to fetch.

**Use it for:** monitoring what a prospect or competitor is posting.

cursorstringquery

Opaque pagination token. Omit for the first page; pass the previous response's `nextCursor` to get the next page.

startintegerquery

Zero-based offset (alternative to `cursor`).

Responses

200400401

200OK

Successful response. `data` carries the endpoint-specific payload.

Schema

successbooleanrequired

statusCodeintegerrequired

messagestring

errorsany?

dataany?required

Endpoint-specific payload (object or array).

ResponseHeadersCode examples

No response yet

Hit **Send** to fire a live request against the endpoint.
