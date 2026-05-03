# API Documentation - LinkdAPI

## API Documentation

Professional data API for developers

[Getting Started](/docs/intro)[Pricing](/docs/endpoints-cost)

GET

## Social Matrix

[Try it](/playground?endpoint=%2Fapi%2Fv1%2Fprofile%2Fsocial-matrix&folder=Profile)

1 credit

Get a user’s social metrics by username, including follower count and connections.

`/api/v1/profile/social-matrix?username=ryanroslansky`

### Query Parameters

`username`

Required

string

Example:`ryanroslansky`

### Response Schema

Field

Type

Description

`connectionsCount`

integer

Number of connections

`followersCount`

integer

Numeric count

### Example Response

InteractiveRaw JSONCode

success:true

statusCode:200

message:"Data retrieved successfully"

data:

connectionsCount:8041

followersCount:849253
