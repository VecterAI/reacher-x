# Resolve any B2B identity in milliseconds

GET

https://renidly.com/api/data/v1/skills/search

0Defaultreacher-x-search-engine-development-previewreacher-x-search-engine-productionSend⌘↵

Search skills

Partial-match search on skill name. Useful for discovery — to find a skill's opaque `skl_` id, or its normalized name for the people-search `skills` filter.

`name` must be at least 3 characters.

Show more

Request

name\*stringquery

Partial-match search on skill name.

pageintegerquery

limitintegerquery

Responses

200400401403429500504

200OK

Successful page-numbered list response. `message` is always `"Data retrieved successfully"`; `data` is the array of results (empty when nothing matched); `pagination` carries `page`, `limit`, and `has_more`.

Schema

successbooleanrequired

statusCodeintegerrequired

messagestringrequired

Fixed value for every page-numbered list response.

errorsobject?required

dataany\[\]required

paginationobjectrequired

pageintegerrequired

limitintegerrequired

has_morebooleanrequired

ResponseHeadersCode examples

No response yet

Hit **Send** to fire a live request against the endpoint.
