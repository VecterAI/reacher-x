# API Documentation - LinkdAPI

## API Documentation

Professional data API for developers

[Getting Started](/docs/intro)[Pricing](/docs/endpoints-cost)

GET

## Get Company ID

[Try it](/playground?endpoint=%2Fapi%2Fv1%2Fcompanies%2Fcompany%2Funiversal-name-to-id&folder=Companies)

1 credit

Get a company’s ID using its universal name (username).

`/api/v1/companies/company/universal-name-to-id?universalName=google`

### Query Parameters

`universalName`

Required

string

Example:`google`

### Response Schema

Field

Type

Description

`id`

string

utc-millisec

Unique identifier for this resource

`universalName`

string

URL-friendly company identifier

### Example Response

InteractiveRaw JSONCode

success:true

statusCode:200

message:"Data retrieved successfully"

errors:null

data:

id:"1441"

universalName:"google"
