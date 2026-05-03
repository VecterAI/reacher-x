# API Documentation - LinkdAPI

## API Documentation

Professional data API for developers

[Getting Started](/docs/intro)[Pricing](/docs/endpoints-cost)

GET

## About

[Try it](/playground?endpoint=%2Fapi%2Fv1%2Fprofile%2Fabout&folder=Profile)

1 credit

Get profile metadata, including last update and verification details.

`/api/v1/profile/about?urn=ACoAABV-k2IBBOzC_m_-Tap6jgcz-uybkCGszn8`

### Query Parameters

`urn`

Required

string

Example:`ACoAABV-k2IBBOzC_m_-Tap6jgcz-uybkCGszn8`

### Response Schema

Field

Type

Description

`contactInformation`

string

`joined`

string

Date the profile was created

`profilePhoto`

string

`VerificationInfo`

object

`isVerified`

boolean

Boolean flag

`verifiedSince`

string

`verifiedBy`

string

`issuedBy`

string

Boolean flag

### Example Response

InteractiveRaw JSONCode

success:true

statusCode:200

message:"Data retrieved successfully"

errors:null

data:

contactInformation:"Updated less than 3 months ago"

joined:"August 2014"

profilePhoto:"Updated over 1 year ago"

VerificationInfo:

isVerified:true

verifiedSince:"Over 1 year ago"

verifiedBy:"Verified by CLEAR using government ID"

issuedBy:"Yunling used an ID issued by China."
