# Resolve any B2B identity in milliseconds

GET

https://renidly.com/api/v2/person/employment-history

1Defaultreacher-x-search-engine-development-previewreacher-x-search-engine-productionSend⌘↵

Get full employment history

Returns the person's complete position history — every role, company, and date range — in more depth than the summary on the enriched profile.

Show less

Request

entityId\*stringquery

The person's opaque identifier (`ACoAA…`).

**Use it for:** career-path analysis, tenure and seniority signals.

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
