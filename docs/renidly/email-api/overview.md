# Resolve any B2B identity in milliseconds

Email API · v1.0.0

# Overview

Check whether an email address is real and safe to send to, and find a person's work email from their name and company domain.

- **Verify** — you give an email address; we tell you whether it can receive mail and flag anything risky about it.
- **Find** — you give a first name, last name, and a company domain; we work out the person's email at that company and confirm it.
- **Find by LinkedIn** — you give a LinkedIn profile URL; we identify the person and their company, then work out their work email.
- **Reverse** — you give an email address; we return the professional profile (the person and their current company) behind it.
- **Bulk Verify / Bulk Find** — submit up to 1000 items in one request and poll for results as they land, instead of one call at a time.
- **Prospects** — list the emails we already know for a company domain.

## Authentication

Every endpoint except `GET /api/emails/v1/health` requires an API key sent in the `X-renidly-apikey` request header:

```
X-renidly-apikey: <your-api-key>
```

A missing key returns `401`; an invalid or unauthorized key returns `403`. Validation errors, authentication failures, rate-limit rejections, cached repeats, and "temporarily unavailable" responses are never charged.

## Response envelope

Every response shares the same head: `success`, `statusCode` (mirrors the HTTP status), `message`, `errors`, and `data`. On success your result is in `data`:

```json
{
  "success": true,
  "statusCode": 200,
  "message": "Email verified",
  "errors": null,
  "data": {}
}
```

On an error, `data` is `null` and `message` explains what happened; handler-level errors also carry a machine-readable `error_code`.

## Billing

You spend credits only when a call does real work and returns a result. You are **never** charged for: validation errors, authentication or rate-limit rejections, "temporarily unavailable" (`503`) responses, or any response served from cache (see **Caching**). If your balance can't cover a call it is rejected with `402` and nothing is charged.

Each endpoint has a base credit cost (shown on your dashboard). Some endpoints then bill by outcome:

Endpoint

What you pay

`GET /verify`

The endpoint's cost, per address checked — for any verdict.

`GET /find`

The endpoint's cost, per lookup — whether or not an email is found (a real search runs either way).

`GET /find/linkedin`

The endpoint's cost, per lookup — whether or not an email is found.

`GET /reverse`

The endpoint's cost when a person **or** company is returned; **3 credits** if we searched but found no match; **free** if there was nothing to look up, and **free** for unsupported addresses.

`GET /prospects`

Per email returned in the page — **1 credit each** for `kind=full`, **2 credits each** for `kind=verified_only`; an empty page is **free**.

`POST /verify/batch`

**Free** to submit. Each address is billed the `GET /verify` cost once it has a verdict.

`POST /find/batch`

**Free** to submit. Each person is billed the `GET /find` cost once resolved (found or not); a person that only fails temporarily is retried and **not** charged.

`GET .../batch` (track)

**Free** — you already paid per item; poll as often as your rate limit allows.

`GET /health`

**Free**, no key required.

## Caching

Repeat calls with the same inputs are served from a short-lived cache — instant and **free** (a cached response re-runs no work, so it can't charge). Cached: `verify`, `find`, `find/linkedin`, `reverse`, and `prospects` (per page). **Not** cached: bulk job tracking (`GET .../batch`), which always returns live progress. Cached results refresh automatically over time.

## When we can't be sure

Some domains are **catch-all**: they accept mail for every address, whether the mailbox exists or not. When we detect this we set `catch_all: true` and, where we can, still resolve the specific mailbox; when we genuinely can't confirm we say so (`risky`) rather than guess. If a check can't be completed right now, you get a `503` — transient, not charged, safe to retry.

## Error codes

Returned in the `error_code` field:

Code

Meaning

`VALIDATION_ERROR`

A parameter is missing or malformed

`1000`

An unexpected server error — retry

`1072`

Temporarily unavailable — retry (not charged)

`1080`

Insufficient balance for the request (not charged)

`1090`

Batch job not found or expired

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

Endpoint-specific payload (object or null).

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
