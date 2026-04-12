# API Documentation - LinkdAPI

## API Documentation

Professional data API for developers

[Getting Started](/docs/intro)[Pricing](/docs/endpoints-cost)

GET

## Geo Look up

[Try it](/playground?endpoint=%2Fapi%2Fv1%2Fgeos%2Fname-lookup&folder=Geos%20Look%20up)

1 credit

Search locations and get their Geo IDs. This is a lookup endpoint that provides suggestions based on your query.

`/api/v1/geos/name-lookup?query=Washington`

### Query Parameters

`query`

Required

string

the search query it can be 1 char or multiple

Example:`Washington`

### Response Schema

Field

Type

Description

`geoIds`

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

geoIds:

\[0\]:

id:"104383890"

type:"GEO"

displayName:"Washington, District of Columbia, United States"

\[1\]:

id:"104116203"

type:"GEO"

displayName:"Seattle, Washington, United States"

\[2\]:

id:"106549849"

type:"GEO"

displayName:"Washington, Pennsylvania, United States"

\[3\]:

id:"119500900"

type:"GEO"

displayName:"Washington, England, United Kingdom"

\[4\]:

id:"101655364"

type:"GEO"

displayName:"Washington, Michigan, United States"

\[5\]:

id:"104145663"

type:"GEO"

displayName:"Redmond, Washington, United States"

\[6\]:

id:"107126158"

type:"GEO"

displayName:"Washington, Missouri, United States"

\[7\]:

id:"104583862"

type:"GEO"

displayName:"Washington, North Carolina, United States"

\[8\]:

id:"107079254"

type:"GEO"

displayName:"Washington, Illinois, United States"

\[9\]:

id:"105749350"

type:"GEO"

displayName:"Washington, Utah, United States"

query:"Washington"
