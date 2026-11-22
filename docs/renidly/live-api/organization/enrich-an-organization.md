# Resolve any B2B identity in milliseconds

GET

https://renidly.com/api/v2/organization/enrich

2Defaultreacher-x-search-engine-development-previewreacher-x-search-engine-productionSend⌘↵

Enrich an organization

Returns the complete company record — name, tagline, description, industry, size, headquarters, website, and more — keyed by the organization `id`. (Resolve a slug to an `id` first via **Resolve slug** if you only have the public slug.)

Show more

Request

id\*stringquery

The organization's numeric id (from **Resolve slug** or Discover Organizations).

**Use it for:** the canonical company lookup.

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
