# Resolve any B2B identity in milliseconds

GET

https://renidly.com/api/data/v1/job-changes/search

1Defaultreacher-x-search-engine-development-previewreacher-x-search-engine-productionSend⌘↵

Search job-change events

Search job-change events — hiring signals, departures, and title changes.

Results are **sorted by freshness**: the feed opens with same-day detections and staler (detected long after the fact) events surface as you page deeper. Every real dated event is included — stale ones are never dropped, just ordered later. Each event includes a `detection_lag_days` field (days between the change and our detection; lower is fresher) and is enriched with the person (`profile_id` — our opaque `prsn_…` id —, `profile_handle`, names, headline, public URL) and the organization (`organization_id` — our opaque `org_…` id —, `organization_name`, `organization_slug`). Pass `profile_id` to the people endpoints or `organization_id` to the organization endpoints to pull the full record.

### Rules

- `days_ago` is an **optional** recency window on the detection time (range 1–365). Omit it to search across all events.
- Text filters (`geo_city`, `title`) require at least 3 characters.
- Pagination is capped at **10000 pages**; a higher `page` returns `400`.

Show less

Request

event_typestringqueryDon’t includejoinedlefttitle_change

Restrict to a specific event type:

- `joined` — person started a new position at an organization.
- `left` — person is no longer at an organization.
- `title_change` — person's title changed at the same organization.

organization_idsstringquery

Comma-separated organization ids — our opaque `org_…` ids (as returned on every organization record and on a profile's positions). Exact match — more precise than name search.

geo_citystringquery

Partial-match filter on the person's current city.

geo_country_codestringquery

Filter by the person's current 2-letter country code. Case-insensitive.

titlestringquery

Word-match filter on the new job title.

days_agointegerquery

Optional recency window on the **detection** time, in days (range 1–365). Omit it to search across all fresh events.

pageintegerquery

Page number (1-based). Capped at 10000; a higher value returns 400.

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
