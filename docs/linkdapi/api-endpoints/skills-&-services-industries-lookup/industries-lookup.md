# API Documentation - LinkdAPI

## API Documentation

Professional data API for developers

[Getting Started](/docs/intro)[Pricing](/docs/endpoints-cost)

GET

## industries Lookup

[Try it](/playground?endpoint=%2Fapi%2Fv1%2Fg%2Findustry-lookup&folder=Skills%20%26%20Services%20%26%20industries%20Lookup)

1 credit

Lookup a keyword to get relevant industries with their IDs. This is a suggestion-style endpoint for query autocomplete and filtering.

`/api/v1/g/industry-lookup?query=software`

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

id:"4"

urn:"urn:li:industry:4"

name:"Software Development"

title:"Software Development"

\[1\]:

id:"3130"

urn:"urn:li:industry:3130"

name:"Data Security Software Products"

title:"Data Security Software Products"

\[2\]:

id:"3102"

urn:"urn:li:industry:3102"

name:"IT System Custom Software Development"

title:"IT System Custom Software Development"

\[3\]:

id:"3101"

urn:"urn:li:industry:3101"

name:"Desktop Computing Software Products"

title:"Desktop Computing Software Products"

\[4\]:

id:"3100"

urn:"urn:li:industry:3100"

name:"Mobile Computing Software Products"

title:"Mobile Computing Software Products"

\[5\]:

id:"3099"

urn:"urn:li:industry:3099"

name:"Embedded Software Products"

title:"Embedded Software Products"

query:"software"

count:6
