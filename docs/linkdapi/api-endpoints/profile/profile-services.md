# API Documentation - LinkdAPI

## API Documentation

Professional data API for developers

[Getting Started](/docs/intro)[Pricing](/docs/endpoints-cost)

GET

## Profile services

[Try it](/playground?endpoint=%2Fapi%2Fv1%2Fprofile%2Fservices&folder=Profile)

1 credit

Get profile services by URN

`/api/v1/profile/services?urn=ACoAACABYFIBg-2LsuVOL5nmempFYpxNnXkq63A`

### Query Parameters

`urn`

string

Example:`ACoAACABYFIBg-2LsuVOL5nmempFYpxNnXkq63A`

### Response Schema

Field

Type

Description

`services`

object

Services offered by the profile

`servicesProvided`

array<string>

`servicePageURL`

string

uri

URL link to this resource

`serviceId`

string

`requestProposalURL`

string

uri

URL link to this resource

### Example Response

InteractiveRaw JSONCode

success:true

statusCode:200

message:"Data retrieved successfully"

errors:null

data:

services:

servicesProvided:

\[0\]:"Graphic Design"

\[1\]:"Web Design"

\[2\]:"Web Development"

\[3\]:"Custom Software Development"

servicePageURL:"https://www.linkedin.com/services/page/7144683349b511a503"

serviceId:"7144683349b511a503"

requestProposalURL:"https://www.linkedin.com/in/maddierosejane/opportunities/services/request-proposal?servicePageVanityName=7144683349b511a503"
