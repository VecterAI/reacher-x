# Resolve any B2B identity in milliseconds

GET

https://renidly.com/api/v2/discover/people

1Defaultreacher-x-search-engine-development-previewreacher-x-search-engine-productionSend⌘↵

Discover people

Search the people graph with a keyword and/or structured filters. Multi-value filters accept comma-separated values (OR within a filter; AND across filters). Provide at least a `keyword` or one filter for meaningful results.

Page with `start` (0–999) and `count` (max 50, default 20).

Show more

Request

keywordstringquery

Free-text query across people.

**Use it for:** a quick broad search before narrowing with filters.

firstNamestringquery

First name(s), comma-separated.

**Use it for:** pinning a specific person together with `lastName`.

lastNamestringquery

Last name(s), comma-separated.

**Use it for:** combine with `firstName` to identify an individual.

titlestringquery

Job title(s), comma-separated.

**Use it for:** role targeting (e.g. `cto,vp engineering`).

currentCompanystringquery

Current-employer organization id(s), comma-separated.

**Use it for:** finding current employees of target accounts.

pastCompanystringquery

Past-employer organization id(s), comma-separated.

**Use it for:** alumni / ex-employee sourcing.

schoolstringquery

School/institution id(s), comma-separated.

**Use it for:** alumni-based sourcing.

industrystringquery

Industry id(s), comma-separated.

**Use it for:** scoping to a sector.

geoEntityIdstringquery

Geo location id(s), comma-separated.

**Use it for:** geographic targeting of a market/region.

profileLanguagestringquery

Profile language code(s), comma-separated.

**Use it for:** language-based targeting.

serviceCategorystringquery

Service-category id(s), comma-separated (LinkedIn services taxonomy).

**Use it for:** finding service providers / freelancers by offering.

countintegerquery

Results per page (max 50, default 20).

startintegerquery

Zero-based offset (0–999).

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
