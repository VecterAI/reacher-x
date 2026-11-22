# Resolve any B2B identity in milliseconds

GET

https://renidly.com/api/emails/v1/verify

2Defaultreacher-x-search-engine-development-previewreacher-x-search-engine-productionSend⌘↵

Verify an email address

Tells you whether an email address can receive mail, and flags anything risky (disposable provider, forwarding/relay address, a domain with no mail servers, or a catch-all domain).

**Billing:** the endpoint's credit cost per address checked — for any verdict (deliverable, undeliverable, or risky). Errors are not charged.

**Caching:** repeat checks of the same address are served from cache — instant and free.

Show less

Request

email\*stringquery

The email address to verify.

Responses

200400401403429500503

200OK

HTTP `200`. The address was checked — this does **not** by itself mean it's deliverable; read `data`:

- `email` — the address that was checked, normalized.
- `deliverable` — whether the mailbox can receive mail.
- `catch_all` — the domain accepts mail for **any** address; a specific mailbox can't always be individually confirmed.
- `mx_hosts` — the mail servers that handle mail for the domain.
- `reason` — why we returned this verdict:

  reason

  meaning

  `mailbox_accepts`

  The mailbox exists and accepts mail (deliverable).

  `mailbox_rejected`

  The mailbox does not exist (undeliverable).

  `catch_all`

  The domain accepts any address; treat as risky.

  `risky`

  Couldn't be confidently confirmed; may bounce.

  `invalid_syntax`

  Not a valid email address.

  `disposable`

  A temporary / throwaway email provider.

  `relay`

  A forwarding / relay address.

  `no_mx`

  The domain has no mail servers and can't receive email.

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
