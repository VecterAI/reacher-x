# Resolve any B2B identity in milliseconds

GET

https://renidly.com/api/v2/person/enrich-bulk

1Defaultreacher-x-search-engine-development-previewreacher-x-search-engine-productionSend⌘↵

Enrich many people (bulk full profile)

Fetches the complete profile for **up to 100 people in a single request** — the same rich payload as **Enrich a person**, returned for every `entityId` you pass. Use it to enrich a list in one call instead of looping over **Enrich a person** one id at a time.

Pass the people as `entityIds`: a comma-separated list of opaque person `entityId`s (the `ACoAA…` tokens from **Resolve handle** or Discover People). Duplicate ids are collapsed. Results are **not** guaranteed to come back in the order you sent them — match each profile to your input by its `entityId`.

### What you get back

`data` holds the batch result:

```json
{
  "requested": 100,
  "count": 98,
  "profiles": [{ "entityId": "ACoAA…", "firstName": "…", "headline": "…" }],
  "notFound": ["ACoAA…", "ACoAA…"]
}
```

- `requested` — how many unique people you asked for.
- `count` — how many returned a full profile.
- `profiles` — the full profile objects, each identical in shape to the payload of **Enrich a person**.
- `notFound` — well-formed ids that no longer resolve to a live profile (for example a deleted or deactivated account).

### Keep your ids clean — one bad id voids the batch

Every `entityId` must be a genuine, well-formed person token from **Resolve handle** or Discover People. If **any** id in the list is malformed or can't be verified, the **whole request is rejected** and **nothing is charged** — a single bad id discards the entire batch, including the good ids alongside it. Resolve/validate your ids first, then batch only clean ones.

### Billing

Billed **per person looked up**: one credit for each unique `entityId` in a successful request — whether it returns a full profile **or** lands in `notFound` (a not-found is still a lookup, so a batch of 100 valid ids costs 100 regardless of how many are still live). You are charged **nothing** when the request is rejected as a whole — a malformed id, a validation or authentication failure, or an internal error.

Show more

Request

entityIds\*stringquery

A comma-separated list of person `entityId`s (`ACoAA…`), **1–100 per request**, from **Resolve handle** or Discover People. Duplicate ids are collapsed before counting.

**Use it for:** enriching a whole list of known people in a single call.

Responses

200400401

200OK

Successful response. `data` carries the endpoint-specific payload.

Schema

successbooleanrequired

statusCodeintegerrequired

messagestring

errorsany?

dataany?required

Endpoint-specific payload (object or array).

ResponseHeadersCode examples

No response yet

Hit **Send** to fire a live request against the endpoint.
