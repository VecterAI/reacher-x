# Resolve any B2B identity in milliseconds

GET

https://renidly.com/api/v2/person/endorsements

1Defaultreacher-x-search-engine-development-previewreacher-x-search-engine-productionSend⌘↵

Get recommendations / endorsements

Returns the recommendations written for the person (and the people who wrote them) — strong social-proof and relationship signals.

Show less

Request

entityId\*stringquery

The person's opaque identifier (`ACoAA…`).

**Use it for:** trust signals and warm-intro paths via recommenders.

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
