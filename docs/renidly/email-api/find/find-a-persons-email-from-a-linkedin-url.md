# Resolve any B2B identity in milliseconds

GET

https://renidly.com/api/emails/v1/find/linkedin

5Defaultreacher-x-search-engine-development-previewreacher-x-search-engine-productionSend⌘↵

Find a person's email from a LinkedIn URL

Give a LinkedIn profile URL (or the bare profile slug) and we identify the person and their current company, then search that company for their deliverable work email.

We search the person's current company using its listed website domain. `domain` comes back empty (and `found` is false) only when the company has no website on file.

**Billing:** the endpoint's credit cost per lookup — whether or not an email is found. A malformed URL is rejected (`400`) and not charged.

**Caching:** repeat lookups of the same URL are served from cache — instant and free.

Show less

Request

url\*stringquery

The LinkedIn profile URL, e.g. `https://www.linkedin.com/in/sundarpichai/`.

Responses

200400401403429500503

200OK

HTTP `200`. We identified the person from their LinkedIn URL and searched their current company for a deliverable work email.

- `email` — the discovered address; empty when `found` is false.
- `found` — whether a deliverable address was confirmed.
- `catch_all` — whether the company's domain is a catch-all domain.
- `confidence` — `high` (mailbox confirmed) or `low`.
- `first_name` / `last_name` — the identified person.
- `company` — their current company's name.
- `domain` — the company domain we searched, taken from the company's listed website; empty only when the company has no website on file (then `found` is false).
- `linkedin_url` — the normalized profile URL.

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
