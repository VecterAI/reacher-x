# Resolve any B2B identity in milliseconds

GET

https://renidly.com/api/v2/person/lookalikes

1Defaultreacher-x-search-engine-development-previewreacher-x-search-engine-productionSend⌘↵

Get similar people

Returns profiles LinkedIn considers similar to the given person — a ready-made shortlist of comparable backgrounds.

Show less

Request

entityId\*stringquery

The person's opaque identifier (`ACoAA…`) to find lookalikes for.

**Use it for:** expanding a shortlist from one ideal candidate/persona.

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
