# Resolve any B2B identity in milliseconds

GET

https://renidly.com/api/v2/organization/opportunities

1Defaultreacher-x-search-engine-development-previewreacher-x-search-engine-productionSend⌘↵

Get an organization's opportunities (jobs)

Returns open jobs posted by one or more organizations. Accepts several organization ids at once.

Show more

Request

organizationEntityIds\*stringquery

Comma-separated organization ids. Combine companies in a single call.

**Use it for:** monitoring hiring across a set of target accounts.

startintegerquery

Zero-based offset for pagination.

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
