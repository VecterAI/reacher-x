# API Documentation - LinkdAPI

## API Documentation

Professional data API for developers

[Getting Started](/docs/intro)[Pricing](/docs/endpoints-cost)

GET

## Get Hiring Team

[Try it](/playground?endpoint=%2Fapi%2Fv1%2Fjobs%2Fjob%2Fhiring-team&folder=Jobs)

1 credit

Get Hiring Team (People that posted this job)

`/api/v1/jobs/job/hiring-team?jobId=4355500759&start=0`

### Query Parameters

`jobId`

Required

integer

Example:`4355500759`

`start`

integer

Example:`0`

### Response Schema

Field

Type

Description

`members`

array<object>

List of team members or participants

`name`

string

Display name of the entity

`headline`

string

Professional headline or tagline

`urn`

string

Unique internal identifier used for detailed profile queries

`username`

string

Public username visible in profile URLs

`url`

string

uri

Direct URL to this resource

`profilePictureURL`

string

uri

URL of the profile photo

`role`

string

Role or position within a context

`total`

integer

Total number of results available

### Example Response

InteractiveRaw JSONCode

success:true

statusCode:200

message:"Data retrieved successfully"

errors:null

data:

members:

\[0\]:

name:"Elena Viganò"

headline:"HR experience demonstrating a history of exceptional work ethic and an elevated standard of thoroughness and accuracy."

urn:"ACoAACVg8ncBu1MVNdS2bun9M76LrPyqjjZ7Wbo"

username:"elena-vigano-mi"

url:"https://www.linkedin.com/in/elena-vigano-mi"

profilePictureURL:"https://media.licdn.com/dms/image/v2/C4D03AQG9Q\_LOsLd59w/profile-displayphoto-shrink\_800\_800/profile-displayphoto-shrink\_800\_800/0/1632122582996?e=1771459200&v=beta&t=PUu8CSyGt1MY5THdXZm4sMP6WQFieU4SlvtCUA5Gj1Q"

role:"Job poster"

total:1
