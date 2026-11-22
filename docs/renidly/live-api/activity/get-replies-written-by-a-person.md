# Resolve any B2B identity in milliseconds

GET

https://renidly.com/api/v2/activity/replies/by-author

1Defaultreacher-x-search-engine-development-previewreacher-x-search-engine-productionSend⌘↵

Get replies written by a person

Returns comments **authored by** a given person across LinkedIn (not the comments on one post). Page with `cursor` / `start`.

Show more

Request

entityId\*stringquery

The person's opaque identifier (`ACoAA…`) whose comments to fetch.

**Use it for:** gauging where and how actively someone engages.

cursorstringquery

Opaque pagination token from the previous response.

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
