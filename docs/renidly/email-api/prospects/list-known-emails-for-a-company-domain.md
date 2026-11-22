# Resolve any B2B identity in milliseconds

GET

https://renidly.com/api/emails/v1/prospects

0Defaultreacher-x-search-engine-development-previewreacher-x-search-engine-productionSend⌘↵

List known emails for a company domain

Returns the emails we already hold for a company domain, paged with a cursor (**20 per page**). Use it to pull a company's contacts from data we've already gathered.

**Two modes (`kind`).**

- `full` — every email we have for the domain, **without** deliverability status.
- `verified_only` — only addresses confirmed deliverable.

**Billing** is on results — you pay for the emails returned **in each response**:

- `kind=full` → **1 credit per email** returned.
- `kind=verified_only` → **2 credits per email** returned.
- An empty page is **free**.

Paging with `cursor` fetches — and bills — the next page. If your balance can't cover the page you get `402` and nothing is charged.

**Caching:** repeat requests for the same page (same `domain` + `kind` + `cursor`) are served from cache — instant and free.

Show more

Request

domain\*stringquery

The company domain to list emails for (bare hostname).

kind\*stringquerySelect…fullverified_only

`full` — all known emails, no deliverability status. `verified_only` — deliverable addresses only.

cursorstringquery

Opaque page cursor. Omit for the first page; pass the previous response's `next_cursor` for the next. An empty `next_cursor` means the last page.

Responses

200400401402403429500503

200OK

HTTP `200`. A page of emails we already hold for the domain, ordered for stable cursor paging (**20 per page**). Pass `next_cursor` back as `cursor` for the next page; an empty `next_cursor` is the last page.

You're charged for the emails returned **in this response**, so paging fetches — and bills — the next set. Deliverability status is intentionally omitted for `full` results; verify an address to confirm it.

- `count` — emails in this page.
- `prospects` — array of `{ email, first_name, last_name }` (names may be empty).

Schema

successbooleanrequired

statusCodeintegerrequired

Mirrors the HTTP status code.

messagestringrequired

errorsobject?required

Always null on success.

dataany?required

Endpoint-specific payload (object or null).

ResponseHeadersCode examples

No response yet

Hit **Send** to fire a live request against the endpoint.
