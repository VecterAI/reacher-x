# API Documentation - LinkdAPI

## API Documentation

Professional data API for developers

[Getting Started](/docs/intro)[Pricing](/docs/endpoints-cost)

GET

## Job Function Lookup

[Try it](/playground?endpoint=%2Fapi%2Fv1%2Fjobs%2Ffuncs%2Flookup&folder=Jobs)

1 credit

Look up job functions by query. This provides suggestions for a given search term, which can be used as filters in the Search Jobs endpoint and other features.

`/api/v1/jobs/funcs/lookup?query=engineering`

### Query Parameters

`query`

Required

string

Example:`engineering`

### Response Schema

Field

Type

Description

`results`

array<object>

`id`

string

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

id:"eng"

urn:"urn:li:jobFunction:eng"

name:"Engineering"

title:"Engineering"

query:"engineering"

count:1
