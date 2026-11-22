# Resolve any B2B identity in milliseconds

GET

https://renidly.com/api/v2/organization/affiliated

1Defaultreacher-x-search-engine-development-previewreacher-x-search-engine-productionSend⌘↵

Get affiliated pages

Returns the company's affiliated pages — subsidiaries, regional pages, and showcase pages linked to the main organization.

Show more

Request

id\*stringquery

The organization's numeric id.

**Use it for:** mapping a corporate family / brand structure.

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
