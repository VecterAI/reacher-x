# Resolve any B2B identity in milliseconds

GET

https://renidly.com/api/v2/organization/resolve-slug

1Defaultreacher-x-search-engine-development-previewreacher-x-search-engine-productionSend⌘↵

Resolve a slug to an organization id

Converts a public company `slug` into its numeric `id`. Resolve once, then reuse the `id` across the other organization endpoints.

Show more

Request

slug\*stringquery

The company's public slug — the segment after `/company/` (`/company/google` → `google`).

**Use it for:** turning a company URL into a durable `id`.

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
