# Resolve any B2B identity in milliseconds

GET

https://renidly.com/api/data/v1/companies/search

1Defaultreacher-x-search-engine-development-previewreacher-x-search-engine-productionSend⌘↵

Search organizations

Multi-filter search across the organization graph.

### Required input

At least one of `name` or `website` must be provided.

### Min/max range rules

- `staff_count_max` must be **greater than** `staff_count_min` when both are set.
- `follower_count_max` must be **greater than** `follower_count_min` when both are set.

### Minimum text length

Text filters (`name`, `website`, `industries`, `industries_v2`, `hq_city`) require at least 3 characters.

### Pagination

Cursor-based: the response `pagination` block carries `next_cursor` — pass it back as the `cursor` parameter for the next page; when it's empty you've reached the end. Each result also carries its stable `id` (`org_…`).

Show more

Request

namestringquery

Partial-match search on organization name. At least one of `name` or `website` is required.

websitestringquery

Partial-match search on the organization's website URL. At least one of `name` or `website` is required.

staff_count_minintegerquery

Minimum number of employees (inclusive).

staff_count_maxintegerquery

Maximum number of employees. Must be greater than `staff_count_min` when both are provided.

follower_count_minintegerquery

Minimum follower count on the public page (inclusive).

follower_count_maxintegerquery

Maximum follower count. Must be greater than `follower_count_min` when both are provided.

industriesstringquery

Partial-match search within company industries.

industries_v2stringquery

Partial-match search within updated industry classifications.

hq_citystringquery

Partial-match filter on headquarters city.

hq_country_codestringquery

Filter by headquarters country code. Case-insensitive. Examples: `US`, `GB`, `DE`.

foundedintegerquery

Filter by exact founding year.

cursorstringquery

Opaque pagination cursor. Omit for the first page; for each subsequent page pass the `next_cursor` value from the previous response's `pagination` block. Treat it as a black box.

limitintegerquery

Responses

200400401403429500504

200OK

Successful cursor-paginated list response. `message` is always `"Data retrieved successfully"`; `data` is the array of results; `pagination.next_cursor` is the token for the next page (empty string once `has_more` is false).

Schema

successbooleanrequired

statusCodeintegerrequired

messagestringrequired

Fixed value for every cursor-paginated list response.

errorsobject?required

dataany\[\]required

paginationobjectrequired

limitintegerrequired

has_morebooleanrequired

next_cursorstringrequired

Opaque cursor token for the next page (looks like `cur_…`). Pass it back as the `cursor` query parameter. Empty string when `has_more` is false (no more results).

ResponseHeadersCode examples

No response yet

Hit **Send** to fire a live request against the endpoint.
