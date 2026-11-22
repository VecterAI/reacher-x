# Resolve any B2B identity in milliseconds

GET

https://renidly.com/api/v2/opportunity/hiring-team

1Defaultreacher-x-search-engine-development-previewreacher-x-search-engine-productionSend⌘↵

Get the hiring team for an opportunity

Returns the people attached to a job as hiring contacts (recruiter / hiring manager) — the humans behind the posting.

Show more

Request

opportunityEntityId\*stringquery

The job's identifier.

**Use it for:** finding the right person to reach out to about a role.

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
