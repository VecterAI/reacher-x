# Resolve any B2B identity in milliseconds

Live API · v2.0.0

# Overview

Real-time B2B data enrichment. Look up rich, structured information about **people**, **organizations**, professional **activity** (posts, comments, reactions), and career **opportunities** (jobs) — plus discovery search across all three.

Every endpoint is a single, focused lookup that returns fresh data on demand.

## Authentication

Every request requires your API key in the `X-renidly-apikey` header:

```
X-renidly-apikey: <your-api-key>
```

A missing key returns `401`; an invalid or unauthorized key returns `403`.

## Response envelope

Every endpoint returns the same top-level shape:

```json
{
  "success": true,
  "statusCode": 200,
  "message": "Data retrieved successfully",
  "errors": null,
  "data": { ... }
}
```

- `success` — `true` if the call succeeded, `false` otherwise.
- `statusCode` — mirrors the HTTP status.
- `message` — short human-readable summary.
- `errors` — `null` on success; a `{field: reason}` map on validation failure.
- `data` — the payload; its shape depends on the endpoint.

## Identifiers

Most lookups are keyed by an opaque LinkedIn identifier. You don't construct these — you obtain one from a `resolve-*` or `discover` call and pass it back.

Parameter

Identifies

How to get it

`entityId`

a person

`GET /person/resolve-handle` (from a handle), or Discover People

`entityId`

an activity

the activity ids returned by `GET /activity/feed`

`handle`

a person

the public slug at the end of a profile URL (`/in/ryanroslansky` → `ryanroslansky`)

`personEntityId`

a person

same token as a person's `entityId`

`entityIds`

one+ people

comma-separated person `entityId`s (max 100), for Enrich many people

`id`

an organization

`GET /organization/resolve-slug` (from a slug), or Discover Organizations

`slug`

an organization

the public slug at the end of a company URL (`/company/google` → `google`)

`organizationEntityIds`

one+ organizations

comma-separated organization `id`s

`opportunityEntityId`

a job/opportunity

Discover Opportunities, or `GET /organization/opportunities`

`geoEntityId`

a location

a LinkedIn geo id, used to scope Discover searches

A person's `entityId` looks like `ACoAA…`; an organization `id`, opportunity id, and geo id are numeric strings. Treat every identifier as an opaque token.

## Pagination

List endpoints page with `start` (a zero-based offset) and/or `cursor` (an opaque token). When an endpoint returns `nextCursor`, pass it back as `cursor` for the next page. `count` controls page size where supported. For `GET /activity/reactions`, `start` must be a multiple of 10.

## Billing

A successful (`200`) call deducts credits from your balance. Validation failures, authentication failures, and internal errors are **not** charged.

**Batch endpoints** (e.g. **Enrich many people**) charge **per item looked up** — one credit for each identifier in a successful request, including identifiers that come back as not-found (a not-found is still a lookup). A request rejected as a whole — for example, a malformed identifier anywhere in the batch — is **not** charged.

## Schemas

Shared models referenced across endpoints — response envelopes, the error shape, pagination, and request bodies.

SuccessResponse

successbooleanrequired

statusCodeintegerrequired

messagestring

errorsany?

dataany?required

Endpoint-specific payload (object or array).

ErrorResponse

successbooleanrequired

statusCodeintegerrequired

messagestring

errorsobject?

dataany?
