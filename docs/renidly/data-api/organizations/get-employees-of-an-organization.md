# Resolve any B2B identity in milliseconds

GET

https://renidly.com/api/data/v1/companies/employees

1Defaultreacher-x-search-engine-development-previewreacher-x-search-engine-productionSend⌘↵

Get employees of an organization

Returns people who work or worked at the given organization. Filters combine with **AND** (e.g. `geo_country_code` and `geo_city` both apply).

### Pagination

Cursor-based: the response `pagination` block carries `next_cursor` — pass it back as `cursor` for the next page; when it's empty you've reached the end. The cursor is opaque (treat it as a black box).

### Year and month validation

- `start_month` (when provided) must be in range **1–12** and is used only with `start_year`.
- `start_year` (when provided) must be between **1900 and the current year**, and matches people who **started in exactly that year** (or year+month).

### Sort

When `sort` is `recently_left`, set `current_only=false` — otherwise no leavers will be in the result set.

### Minimum text length

`geo_city` and `title` (when provided) must be at least 3 characters.

Show more

Request

slug\*stringquery

The organization's public slug.

current_onlybooleanqueryDon’t includetruefalse

When true, only returns people currently at the organization. When false (default), former employees are included.

titlestringquery

Partial-match filter on job title (e.g. `software engineer` matches `Senior Software Engineer`, `Software Engineer II`). Case-insensitive, min 3 characters. Combine with `current_only=true` to target a role held by people currently at the organization.

geo_country_codestringquery

Filter employees by their current 2-letter country code. Case-insensitive.

geo_citystringquery

Partial-match filter on the employee's current city.

start_yearintegerquery

Employment start year. Must be 1900 ≤ year ≤ current year. Returns employees whose start year matches this value (refine further with `start_month`).

start_monthintegerquery

Refines `start_year` with a specific month. Only used together with `start_year`.

sortstringqueryDon’t includenewestrecently_leftoldest

Sort order:

- `newest` — most recent hires first.
- `oldest` — longest tenure first.
- `recently_left` — most recent departures first. Use with `current_only=false`.

cursorstringquery

Opaque pagination cursor. Omit for the first page; for each subsequent page pass the `next_cursor` value from the previous response. Treat it as a black box.

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
