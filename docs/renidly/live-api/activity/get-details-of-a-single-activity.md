# Resolve any B2B identity in milliseconds

GET

https://renidly.com/api/v2/activity/details

1Defaultreacher-x-search-engine-development-previewreacher-x-search-engine-productionSend⌘↵

Get details of a single activity

Returns the full content and metadata of one post/activity — text, media, author, and engagement counts.

Show more

Request

entityId\*stringquery

The activity's identifier, as returned in **Get activity feed**.

**Use it for:** hydrating one post you found in a feed.

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
