# Resolve any B2B identity in milliseconds

GET

https://renidly.com/api/v2/person/interests

1Defaultreacher-x-search-engine-development-previewreacher-x-search-engine-productionSend⌘↵

Get a person's interests

Returns the entities the person follows — companies, groups, newsletters, and influencers — a window into their professional interests.

Show more

Request

entityId\*stringquery

The person's opaque identifier (`ACoAA…`).

**Use it for:** personalization and conversation-starter signals.

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
