# Resolve any B2B identity in milliseconds

GET

https://renidly.com/api/v2/activity/replies

1Defaultreacher-x-search-engine-development-previewreacher-x-search-engine-productionSend⌘↵

Get replies (comments) on an activity

Returns the comments on a post. Sort by relevance or recency, and page with `start` / `count`.

Show more

Request

entityId\*stringquery

The activity's identifier (from **Get activity feed**).

**Use it for:** reading the conversation under a post.

sortBystringqueryDon’t includerelevancedate_posted

`relevance` (default) or `date_posted` (newest first).

**Use it for:** `date_posted` to watch a live conversation.

countintegerquery

Number of replies to return (defaults to 10).

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
