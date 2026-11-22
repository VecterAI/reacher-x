# Resolve any B2B identity in milliseconds

GET

https://renidly.com/api/v2/person/enrich

1Defaultreacher-x-search-engine-development-previewreacher-x-search-engine-productionSend⌘↵

Enrich a person (full profile)

Returns the complete profile for one person: identity, headline, summary, location, experience, education, skills, certifications, and more.

Identify the person by **either** their opaque `entityId` **or** their public `handle` — at least one is required. `handle` is convenient; `entityId` is the stable token (resolve a handle once via **Resolve handle**, then reuse it).

Show more

Request

entityIdstringquery

The person's opaque identifier (`ACoAA…`), from **Resolve handle** or Discover People.

**Use it for:** the stable, preferred way to fetch a known person.

handlestringquery

The person's public handle — the slug at the end of their profile URL (`/in/ryanroslansky` → `ryanroslansky`).

**Use it for:** looking someone up straight from their profile URL.

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
