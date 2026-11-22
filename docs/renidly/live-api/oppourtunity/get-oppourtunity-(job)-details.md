# Resolve any B2B identity in milliseconds

GET

https://renidly.com/api/v2/opportunity/details

1Defaultreacher-x-search-engine-development-previewreacher-x-search-engine-productionSend⌘↵

Get opportunity (job) details

Returns the full posting for one job — title, description, company, location, employment type, and apply metadata.

Show more

Request

opportunityEntityId\*stringquery

The job's identifier, from Discover Opportunities or **Get organization opportunities**.

**Use it for:** hydrating a job you found in search.

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
