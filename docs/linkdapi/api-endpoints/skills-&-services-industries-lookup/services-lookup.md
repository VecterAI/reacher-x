# API Documentation - LinkdAPI

## API Documentation

Professional data API for developers

[Getting Started](/docs/intro)[Pricing](/docs/endpoints-cost)

GET

## Services Lookup

[Try it](/playground?endpoint=%2Fapi%2Fv1%2Fg%2Fservices-lookup&folder=Skills%20%26%20Services%20%26%20industries%20Lookup)

1 credit

Lookup a keyword to get relevant services with their IDs. This is a suggestion-style endpoint for query autocomplete and filtering.

`/api/v1/g/services-lookup?query=software`

### Query Parameters

`query`

Required

string

Example:`software`

### Response Schema

Field

Type

Description

`results`

array<object>

`id`

string

utc-millisec

Unique identifier for this resource

`urn`

string

uri

Unique internal identifier used for detailed profile queries

`name`

string

Display name of the entity

`title`

string

Title of the job, post, or article

`query`

string

`count`

integer

Number of results in this page

### Example Response

InteractiveRaw JSONCode

success:true

statusCode:200

message:"Data retrieved successfully"

errors:null

data:

results:

\[0\]:

id:"50321"

urn:"urn:li:fsd_standardizedSkill:50321"

name:"Software Testing"

title:"Software Testing"

\[1\]:

id:"68"

urn:"urn:li:fsd_standardizedSkill:68"

name:"Technical Support"

title:"Technical Support"

\[2\]:

id:"2265"

urn:"urn:li:fsd_standardizedSkill:2265"

name:"Cybersecurity"

title:"Cybersecurity"

\[3\]:

id:"3166"

urn:"urn:li:fsd_standardizedSkill:3166"

name:"Custom Software Development"

title:"Custom Software Development"

\[4\]:

id:"50304"

urn:"urn:li:fsd_standardizedSkill:50304"

name:"Mobile Application Development"

title:"Mobile Application Development"

\[5\]:

id:"1383"

urn:"urn:li:fsd_standardizedSkill:1383"

name:"Application Development"

title:"Application Development"

query:"software"

count:20
