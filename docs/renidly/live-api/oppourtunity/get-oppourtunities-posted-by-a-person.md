# Resolve any B2B identity in milliseconds

GET

https://renidly.com/api/v2/opportunity/by-person

1Defaultreacher-x-search-engine-development-previewreacher-x-search-engine-productionSend⌘↵

Get opportunities posted by a person

Returns the jobs posted by a specific person (e.g. a recruiter). Page with `start` / `count`.

Show more

Request

personEntityId\*stringquery

The poster's opaque person identifier (`ACoAA…`).

**Use it for:** tracking a recruiter's or founder's open roles.

countintegerquery

Number of jobs to return (1–25, default 10).

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
