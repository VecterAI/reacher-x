# Resolve any B2B identity in milliseconds

GET

https://renidly.com/api/v2/organization/enrich-bulk

1Defaultreacher-x-search-engine-development-previewreacher-x-search-engine-productionSend⌘↵

Enrich many organizations

Fetches the complete company record for **up to 100 organizations in a single request** — the same payload as **Enrich an organization**, returned for every `id` you pass. Use it to enrich a list in one call instead of looping over **Enrich an organization** one id at a time.

Pass the companies as `ids`: a comma-separated list of numeric organization ids (from **Resolve slug** or Discover Organizations). Duplicate ids are collapsed. Results are **not** guaranteed to come back in the order you sent them — match each organization to your input by its `id`.

### What you get back

`data` holds the batch result:

```json
{
  "requested": 100,
  "count": 98,
  "organizations": [{ "id": "1441", "name": "…", "industry": "…" }],
  "notFound": ["1035", "1441"]
}
```

- `requested` — how many unique organizations you asked for.
- `count` — how many returned a full record.
- `organizations` — the full company objects, each identical in shape to the payload of **Enrich an organization**.
- `notFound` — well-formed ids that no longer resolve to a live organization (for example a removed or merged company page).

### Keep your ids clean — one bad id voids the batch

Every `id` must be a genuine, well-formed numeric organization id from **Resolve slug** or Discover Organizations. If **any** id in the list is malformed, the **whole request is rejected** and **nothing is charged** — a single bad id discards the entire batch, including the good ids alongside it. Resolve/validate your ids first, then batch only clean ones.

### Billing

Billed **per organization looked up**: successful request — whether it returns a full record **or** lands in `notFound` (a not-found is still a lookup, so a batch of 100 valid ids billed at the full cost regardless of how many are still live). You are charged **nothing** when the request is rejected as a whole — a malformed id, a validation or authentication failure, or an internal error.

Show more

Request

ids\*stringquery

A comma-separated list of numeric organization ids, **1–100 per request**, from **Resolve slug** or Discover Organizations. Duplicate ids are collapsed before counting.

**Use it for:** enriching a whole list of known organizations in a single call.

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
