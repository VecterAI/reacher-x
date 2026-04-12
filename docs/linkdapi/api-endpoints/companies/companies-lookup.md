# API Documentation - LinkdAPI

## API Documentation

Professional data API for developers

[Getting Started](/docs/intro)[Pricing](/docs/endpoints-cost)

GET

## Companies Lookup

[Try it](/playground?endpoint=%2Fapi%2Fv1%2Fcompanies%2Fname-lookup&folder=Companies)

1 credit

Search companies by name. This is an autocomplete-style lookup, ideal when you have a brand or partial name and want suggestions for your query.

`/api/v1/companies/name-lookup?query=google`

### Query Parameters

`query`

Required

string

the search query it can be 1 char or multiple

Example:`google`

### Response Schema

Field

Type

Description

`companies`

array<object>

`id`

string

utc-millisec

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

companies:

\[0\]:

id:"1441"

type:"COMPANY"

displayName:"Google"

\[1\]:

id:"1594050"

type:"COMPANY"

displayName:"Google DeepMind"

\[2\]:

id:"14547137"

type:"COMPANY"

displayName:"Google Operations Center"

\[3\]:

id:"2171947"

type:"COMPANY"

displayName:"Google Fiber"

\[4\]:

id:"18336369"

type:"COMPANY"

displayName:"Google for Startups"

\[5\]:

id:"19184331"

type:"COMPANY"

displayName:"Google Summer of Code"

\[6\]:

id:"11162656"

type:"COMPANY"

displayName:"Google Developers Group"

\[7\]:

id:"28103"

type:"COMPANY"

displayName:"Mandiant (part of Google Cloud)"

\[8\]:

id:"98808973"

type:"COMPANY"

displayName:"Google Cloud Skills Boost"

\[9\]:

id:"67280347"

type:"COMPANY"

displayName:"Google Digital Academy (Skillshop)"

query:"google"
