# Resolve any B2B identity in milliseconds

GET

https://renidly.com/api/emails/v1/find

3Defaultreacher-x-search-engine-development-previewreacher-x-search-engine-productionSend⌘↵

Find a person's email

Given a first name, last name, and a company domain, returns the person's email at that company and confirms whether it's deliverable.

Once we've learned a company's email format, later lookups for other people at the same company are instant.

**Billing:** the endpoint's credit cost per lookup — whether or not an email is found, because a real search runs either way. Errors are not charged.

**Caching:** repeat lookups of the same name + domain are served from cache — instant and free.

Show more

Request

first_name\*stringquery

The person's first name.

last_name\*stringquery

The person's last name.

domain\*stringquery

The company's domain — a bare hostname (no `https://`, no `@`).

Responses

200400401403429500503

200OK

HTTP `200`. The lookup completed — check `found` in `data`:

- `email` — the discovered address; empty string when `found` is false.
- `found` — whether a deliverable address was confirmed.
- `catch_all` — whether the company's domain is a catch-all domain.
- `confidence` — `high` (mailbox confirmed) or `low` (nothing confirmed).

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
