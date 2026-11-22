# Resolve any B2B identity in milliseconds

GET

https://renidly.com/api/v2/opportunity/similar

1Defaultreacher-x-search-engine-development-previewreacher-x-search-engine-productionSend⌘↵

Get similar opportunities

Returns jobs similar to the given one — a quick way to broaden from a single relevant posting.

Show more

Request

opportunityEntityId\*stringquery

The job's identifier to find similar postings for.

**Use it for:** widening a job search from one good match.

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
