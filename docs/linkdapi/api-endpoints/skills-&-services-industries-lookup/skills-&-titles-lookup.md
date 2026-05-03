# API Documentation - LinkdAPI

## API Documentation

Professional data API for developers

[Getting Started](/docs/intro)[Pricing](/docs/endpoints-cost)

GET

## Skills & Titles lookup

[Try it](/playground?endpoint=%2Fapi%2Fv1%2Fg%2Ftitle-skills-lookup&folder=Skills%20%26%20Services%20%26%20industries%20Lookup)

1 credit

Lookup a keyword to get relevant skills and job titles with their IDs. This is a suggestion-style endpoint for query autocomplete and filtering.

`/api/v1/g/title-skills-lookup?query=software`

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

color

Unique identifier for this resource

`type`

string

Entity type classification

`displayName`

string

`query`

string

### Example Response

InteractiveRaw JSONCode

success:true

statusCode:200

message:"Data retrieved successfully"

errors:null

data:

results:

\[0\]:

id:"242"

type:"SKILL"

displayName:"Software"

\[1\]:

id:"9"

type:"TITLE"

displayName:"Software Engineer"

\[2\]:

id:"602"

type:"SKILL"

displayName:"Software Development"

\[3\]:

id:"2130"

type:"SKILL"

displayName:"Software Development Life Cycle (SDLC)"

\[4\]:

id:"2157"

type:"SKILL"

displayName:"Software Project Management"

\[5\]:

id:"1989"

type:"SKILL"

displayName:"Enterprise Software"

\[6\]:

id:"39"

type:"TITLE"

displayName:"Senior Software Engineer"

\[7\]:

id:"3096"

type:"SKILL"

displayName:"Software Documentation"

\[8\]:

id:"2326"

type:"SKILL"

displayName:"Software as a Service (SaaS)"

\[9\]:

id:"366"

type:"SKILL"

displayName:"Microsoft Office"

query:"software"
