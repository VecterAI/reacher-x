# Resolve any B2B identity in milliseconds

GET

https://renidly.com/api/v2/activity/reactions

1Defaultreacher-x-search-engine-development-previewreacher-x-search-engine-productionSend⌘↵

Get reactions on an activity

Returns the people who reacted to a post, plus the total count and page metadata. Paginate with `start` in steps of 10.

Show more

Request

entityId\*stringquery

The activity's identifier (from **Get activity feed**).

**Use it for:** surfacing engaged audiences around a post.

startintegerquery

Zero-based offset. **Must be a multiple of 10** (0, 10, 20, …); other values are rejected with `400`.

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
