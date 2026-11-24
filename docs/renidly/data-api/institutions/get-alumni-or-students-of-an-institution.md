# Resolve any B2B identity in milliseconds

GET

https://renidly.com/api/data/v1/institutions/alumni

1Defaultreacher-x-search-engine-development-previewreacher-x-search-engine-productionSend⌘↵

Get alumni / students of an institution

Browse alumni and current students of an institution. Each result contains the person's profile plus the education record (degree, field of study, years) that links them to this institution.

### Selecting the institution

Identify the institution by `institution_id` (the opaque `inst_…` id, as returned by institution search and by education records) or by `normalized_name`. At least one is required; when both are provided, `institution_id` wins. Prefer `institution_id`: names resolve by exact match and may hit a different entity than you expect (e.g. the free-text entry `harvard` is not `harvard university`).

### Year-range validation

- `start_year_min`, `start_year_max`, `end_year_min`, `end_year_max` must all fall in range **1900 to current_year+10**.
- `start_year_max` must be ≥ `start_year_min` when both are provided.
- `end_year_max` must be ≥ `end_year_min` when both are provided.

### Minimum text length

`degree`, `field_of_study`, `geo_city` (when provided) must be at least 3 characters.

Show more

Request

institution_idstringquery

The institution's opaque id (`inst_…`), as returned by `GET /api/data/v1/institutions/search` and by profile education records. Takes precedence over `normalized_name` when both are set. Required unless `normalized_name` is provided.

normalized_namestringquery

The institution's normalized name (exact match). Ignored when `institution_id` is provided. Required unless `institution_id` is provided.

current_onlybooleanqueryDon’t includetruefalse

When true, returns only currently-enrolled students (end year is null or in the future).

degreestringquery

Partial-match filter on degree (e.g. `Master` matches `Master of Science`, `Master of Business Administration`).

field_of_studystringquery

Partial-match filter on field of study (e.g. `Computer` matches `Computer Science`, `Computer Engineering`).

start_year_minintegerquery

Minimum enrollment start year (inclusive). Max value is the current year.

start_year_maxintegerquery

Maximum enrollment start year (inclusive). Max value is current_year + 10. Must be ≥ `start_year_min` when both are set.

end_year_minintegerquery

Minimum graduation year (inclusive). Max value is current_year + 10.

end_year_maxintegerquery

Maximum graduation year (inclusive). Max value is current_year + 10. Must be ≥ `end_year_min` when both are set.

geo_country_codestringquery

Filter alumni by their current 2-letter country code. Case-insensitive.

geo_citystringquery

Partial-match filter on the alumni's current city.

sortstringqueryDon’t includenewestoldestrecently_graduated

Sort order:

- `newest` — most recent enrollment first.
- `oldest` — earliest enrollment first.
- `recently_graduated` — most recent graduation first.

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
