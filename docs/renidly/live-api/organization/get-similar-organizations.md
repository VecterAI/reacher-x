# Resolve any B2B identity in milliseconds

GET

https://renidly.com/api/v2/organization/similar

1Defaultreacher-x-search-engine-development-previewreacher-x-search-engine-productionSend⌘↵

Get similar organizations

Returns companies LinkedIn considers similar to the given one — competitors and peers in one call.

Show more

Request

id\*stringquery

The organization's numeric id to find peers for.

**Use it for:** competitor mapping and account expansion.

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
