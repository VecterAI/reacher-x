# API Documentation - LinkdAPI

## API Documentation

Professional data API for developers

[Getting Started](/docs/intro)[Pricing](/docs/endpoints-cost)

GET

## Contact Info

[Try it](/playground?endpoint=%2Fapi%2Fv1%2Fprofile%2Fcontact-info&folder=Profile)

1 credit

Retrieve a profile’s contact details by username. Email and phone number are included only if the user has made them public.

`/api/v1/profile/contact-info?username=hnaser`

### Query Parameters

`username`

Required

string

Example:`hnaser`

### Response Schema

Field

Type

Description

`emailAddress`

any

nullable

`phoneNumber`

any

nullable

`websites`

array<object>

`url`

string

uri

Direct URL to this resource

`category`

string

### Example Response

InteractiveRaw JSONCode

success:true

statusCode:200

message:"Data retrieved successfully"

data:

emailAddress:null

phoneNumber:null

websites:

\[0\]:

url:"http://backend.husseinnasser.com"

category:"PERSONAL"

\[1\]:

url:"https://anchor.fm/s/1eb6d14/podcast/rss"

category:"RSS"

\[2\]:

url:"https://www.youtube.com/HusseinNasser-software-engineering"

category:"OTHER"
