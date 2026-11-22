# Resolve any B2B identity in milliseconds

GET

https://renidly.com/api/v2/organization/headcount

1Defaultreacher-x-search-engine-development-previewreacher-x-search-engine-productionSend⌘↵

Get organization headcount data

Returns employee-count and headcount-distribution data for a company — useful for sizing and growth-trend signals.

Show more

Request

id\*stringquery

The organization's numeric id.

**Use it for:** company sizing and growth tracking.

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
