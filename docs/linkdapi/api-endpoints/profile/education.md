# API Documentation - LinkdAPI

## API Documentation

Professional data API for developers

[Getting Started](/docs/intro)[Pricing](/docs/endpoints-cost)

GET

## Education

[Try it](/playground?endpoint=%2Fapi%2Fv1%2Fprofile%2Feducation&folder=Profile)

1 credit

Get a user’s complete education history by their URN.

`/api/v1/profile/education?urn=ACoAAAHT6VYBz_yVpo-jE-Or8WNKjArXMd-S6KM`

### Query Parameters

`urn`

Required

string

Example:`ACoAAAHT6VYBz_yVpo-jE-Or8WNKjArXMd-S6KM`

### Response Schema

Field

Type

Description

`education`

array<object>

Educational background

`duration`

string

Time period in this role

`durationParsed`

object

Structured start/end dates

`start`

object

Start date of the period

`year`

integer

`month`

integer

`day`

integer

`end`

object

End date of the period

`year`

integer

`month`

integer

`day`

integer

`university`

string

Name of the educational institution

`universityLink`

string

uri

URL to the institution page

`degree`

string

Degree or qualification earned

`description`

string

Detailed description or summary

`subDescription`

string

### Example Response

InteractiveRaw JSONCode

success:true

statusCode:200

message:"Data retrieved successfully"

data:

education:

\[0\]:

duration:"2000 - 2004"

durationParsed:

start:

year:2000

month:1

day:1

end:

year:2004

month:1

day:1

university:"University of Mumbai"

universityLink:"https://www.linkedin.com/company/15093732/"

degree:"BE Computers, Computer Engineering"

description:""

subDescription:""

\[1\]:

duration:"2012 - 2014"

durationParsed:

start:

year:2012

month:1

day:1

end:

year:2014

month:1

day:1

university:"Sikkim Manipal University Distance Education"

universityLink:"https://www.linkedin.com/search/results/all/?keywords=Sikkim+Manipal+University+Distance+Education"

degree:"Master of Business Administration (MBA), Accounting and Finance"

description:""

subDescription:""
