# Resolve any B2B identity in milliseconds

Data API · v1.0.0

# Overview

Access professional profile intelligence: people, organizations, education, and job-change signals.

## Authentication

Every endpoint except `GET /api/data/v1/health` requires an API key sent in the `X-renidly-apikey` request header:

```
X-renidly-apikey: <your-api-key>
```

A missing key returns `401`; an invalid or unauthorized key returns `403`. Calls are billed **per successful (`200`) response** — validation errors, authentication failures, and cache hits are not charged.

## Identifiers

Every resource is addressed by a **stable, opaque, prefixed id**. The prefix tells you the object type; the token is permanent and meaningless on its own (it can't be guessed, enumerated, or parsed). Store these ids and look records up by them — unlike a person's handle or a company's slug, an id never changes.

Prefix

Object

Example

Where it comes from / where to use it

`prsn_`

Person

`prsn_06d0d44dogo2m`

The `id` on every profile. Pass it to **Get Profile** (`id`).

`org_`

Organization

`org_5ehe8408s7tme`

The `id` on every organization, and each position's `organization_id` on a profile. Pass it to **Get Organization** (`id`) or the job-changes `organization_ids` filter.

`inst_`

Institution

`inst_4k8s2j9d1xph`

The `id` on every institution record. Pass it to the people-search `institution_ids` filter.

`cur_`

Cursor

`cur_5ehe8408s7tme`

The `next_cursor` returned by cursor-paginated lists. Pass it back as `cursor`. Treat it as a black box.

On the single-resource endpoints a human-readable handle/slug is accepted as a convenience alternative (`handle` for people, `slug` for organizations), but the `id` is preferred because it is permanent.

## Response envelope

**Single resource (success):**

```json
{
  "success": true,
  "message": "Profile retrieved successfully",
  "data": { ... }
}
```

**List with pagination (success):**

```json
{
  "success": true,
  "data": [ ... ],
  "pagination": { "page": 1, "limit": 20, "has_more": true }
}
```

**Error:**

```json
{
  "success": false,
  "message": "Profile not found",
  "error_code": "1010"
}
```

## Pagination

Most list endpoints use **page-based** pagination: pass `page` and `limit`; the response `pagination` block carries `has_more`; increment `page` to continue.

**People search uses cursor pagination** instead: pass `limit` and an opaque `cursor`; the response `pagination` block carries `next_cursor`, which you pass back as `cursor` for the next page. Deep pages stay as fast as the first.

## Filter combination rules

Filters combine with AND across parameters. Within comma-separated values (`skills`, `organization_slugs`, `institution_ids`, `certifications`), entries combine with OR — at least one must match. `skills` can require ALL via `skills_match=all`.

## Text search rules

People-search text filters (`first_name`, `last_name`, `headline`, `summary`, `geo_city`, `title`) match with **prefix (typeahead) and fuzzy (typo-tolerant)** semantics: `joh` matches `John`, and `jhon` also matches `John`. Other endpoints use case-insensitive partial matching. Text filters require a minimum of 3 characters (2 for skill name search).

## Error codes

Custom error codes returned in the `error_code` field:

Code

Meaning

`1010`

Profile not found

`1011`

Invalid profile data

`1020`

Organization not found

`1021`

Invalid organization data

`1030`

Skill not found

`1040`

Institution not found

`1060`

JSON parsing failed

`1072`

Service temporarily unavailable — try again later

`1074`

Rate limit exceeded

## Schemas

Shared models referenced across endpoints — response envelopes, the error shape, pagination, and request bodies.

SuccessResponse

successbooleanrequired

statusCodeintegerrequired

Mirrors the HTTP status code.

messagestringrequired

errorsobject?required

Always null on success.

dataany?required

Endpoint-specific payload (object, array, or null).

PaginatedResponse

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

Pagination

pageintegerrequired

limitintegerrequired

has_morebooleanrequired

CursorPaginatedResponse

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

CursorPagination

limitintegerrequired

has_morebooleanrequired

next_cursorstringrequired

Opaque cursor token for the next page (looks like `cur_…`). Pass it back as the `cursor` query parameter. Empty string when `has_more` is false (no more results).

ErrorResponse

successbooleanrequired

statusCodeintegerrequired

Mirrors the HTTP status code.

messagestringrequired

error_codestringrequired

Stable machine-readable code (the per-response tables below list the exact codes).

errorsobject?required

dataany?required

ValidationErrorResponse

successbooleanrequired

statusCodeintegerrequired

messagestringrequired

error_codestringrequired

errorsobjectrequired

dataany?required

AuthErrorResponse

successbooleanrequired

statusCodeintegerrequired

messagestringrequired

errorsobject?required

dataany?required
