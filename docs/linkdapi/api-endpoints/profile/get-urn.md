# API Documentation - LinkdAPI

## API Documentation

Professional data API for developers

[Getting Started](/docs/intro)[Pricing](/docs/endpoints-cost)

GET

## Get URN

[Try it](/playground?endpoint=%2Fapi%2Fv1%2Fprofile%2Fusername-to-urn&folder=Profile)

1 credit

Get urn of profile by username

`/api/v1/profile/username-to-urn?username=ryanroslansky`

### Query Parameters

`username`

Required

string

Example:`ryanroslansky`

### Response Schema

Field

Type

Description

`urn`

string

Unique internal identifier used for detailed profile queries

`username`

string

Public username visible in profile URLs

### Example Response

InteractiveRaw JSONCode

success:true

statusCode:200

message:"Data retrieved successfully"

errors:null

data:

urn:"ACoAAAAKXBwBikfbNJww68eYvcu2dqDYJhHbp4g"

username:"ryanroslansky"
