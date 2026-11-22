# Resolve any B2B identity in milliseconds

GET

https://renidly.com/api/v2/person/resolve-handle

1Defaultreacher-x-search-engine-development-previewreacher-x-search-engine-productionSend⌘↵

Resolve a handle to an entityId

Converts a public `handle` into the person's stable `entityId`. Resolve once, then reuse the `entityId` across the other person endpoints — it never changes even if the person renames their profile.

Show less

Request

handle\*stringquery

The person's public handle (slug from their profile URL).

**Use it for:** turning a profile URL into a durable `entityId`.

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
