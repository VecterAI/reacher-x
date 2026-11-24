# Resolve any B2B identity in milliseconds

GET

https://renidly.com/api/v2/discover/organizations

1Defaultreacher-x-search-engine-development-previewreacher-x-search-engine-productionSend⌘↵

Discover organizations

Search the company graph. `keyword` is required; refine with size, location, industry, and hiring filters. Page with `start` (0–999) and `count` (max 50, default 25).

Show more

Request

keyword\*stringquery

Free-text company query (required).

**Use it for:** the primary company search term.

headcountRangestringquery

Company size bucket(s), comma-separated. Allowed values: `1-10`, `11-50`, `51-200`, `201-500`, `501-1000`, `1001-5000`, `5001-10000`, `10001+`.

**Use it for:** segmenting by company size (e.g. `51-200,201-500`).

industrystringquery

Industry id(s), comma-separated.

**Use it for:** scoping to a sector.

geoEntityIdstringquery

Headquarters geo location id(s), comma-separated.

**Use it for:** finding companies headquartered in a region.

hasJobsstringqueryDon’t includetruefalse

`true` to return only companies with open jobs, `false` to exclude them.

**Use it for:** focusing on companies that are actively hiring.

countintegerquery

Results per page (max 50, default 25).

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
