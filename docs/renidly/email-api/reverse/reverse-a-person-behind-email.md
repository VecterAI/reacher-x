# Resolve any B2B identity in milliseconds

GET

https://renidly.com/api/emails/v1/reverse

5Defaultreacher-x-search-engine-development-previewreacher-x-search-engine-productionSend⌘↵

Resolve the profile behind an email

Given a professional email address, returns the person and company behind it — name, role, LinkedIn, work history, and company details.

Role accounts (info@, support@, …), disposable addresses, relay/forwarding addresses and invalid addresses are rejected with `422` before any work is done. A public-provider address (gmail, outlook, …) we don't already know returns `found: false` for free.

**Billing** (by outcome):

- A person **or** company is returned → the endpoint's credit cost.
- We searched but found no match → **3 credits**.
- There was nothing to look up → **free**.
- Unsupported address (`422`) or an error → **free**.

**Caching:** repeat lookups of the same address are served from cache — instant and free.

Show more

Request

email\*stringquery

The professional email address to look up.

Responses

200400401403422429500503

200OK

HTTP `200`. The professional profile behind the address. Check `found` for the person; `current_company` is included whenever we can resolve the domain's company, even when the person can't be individually identified.

- `found` — whether a specific person was identified.
- `confidence` — `high` / `medium` / `low` / `none`.
- `person` — the individual (or `null`): name, headline, summary, current title, LinkedIn URL, photo, location, industry, follower count, work `experience`, and `education`.
- `current_company` — the company (or `null`): name, website, LinkedIn URL, logo, industry, size, headcount, location, and specialities.

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
