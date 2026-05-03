# API Documentation - LinkdAPI

## API Documentation

Professional data API for developers

[Getting Started](/docs/intro)[Pricing](/docs/endpoints-cost)

GET

## People

[Try it](/playground?endpoint=%2Fapi%2Fv1%2Fsearch%2Fpeople&folder=Search)

1 credit

Search people using all available filters. Note: Each page may return fewer than 10 results because restricted or non-enrichable member profiles are automatically filtered out.

`/api/v1/search/people?start=0&currentCompany=1337,1441&geoUrn=103644278,90009633&industry=4,7&profileLanguage=en&pastCompany=1035,1441&school=1792,739903&title=founder&count=25`

### Query Parameters

`keyword`

string

optional keyword

`start`

integer

pagination increment by ${count} to go to next page for example count = 50 for next page make start = 50 next page start = 100

Example:`0`

`currentCompany`

string

companies ID

Example:`1337,1441`

`firstName`

string

`geoUrn`

string

geos ID

Example:`103644278,90009633`

`industry`

string

industries ID

Example:`4,7`

`lastName`

string

`profileLanguage`

string

en for English, ch for Chinese, etc...

Example:`en`

`pastCompany`

string

companies ID

Example:`1035,1441`

`school`

string

school IDs

Example:`1792,739903`

`serviceCategory`

string

services ID provided by the profile

`title`

string

Example:`founder`

`count`

integer

min 1 max 50

Example:`25`

### Response Schema

Field

Type

Description

`people`

array<object>

List of professional profiles

`urn`

string

Unique internal identifier used for detailed profile queries

`profileID`

string

utc-millisec

Numeric profile identifier

`url`

string

uri

Direct URL to this resource

`firstName`

string

First name of the professional

`lastName`

string

Last name of the professional

`fullName`

string

Complete display name

`headline`

string

Professional headline or tagline

`location`

string

Geographic location information

`profilePictureURL`

string

uri

URL of the profile photo

`premium`

boolean

Whether the user has a premium subscription

`total`

integer

Total number of results available

`start`

integer

Pagination offset index

`count`

integer

Number of results in this page

`hasMore`

boolean

Whether more results are available via pagination

### Example Response

InteractiveRaw JSONCode

success:true

statusCode:200

message:"Data retrieved successfully"

errors:null

data:

people:

\[0\]:

urn:"ACoAAABhUGoBl6a8qJ3OFxx-aiBw_bx7Y4IqN6Y"

profileID:"6377578"

url:"https://www.linkedin.com/in/debangsu"

firstName:"Debangsu"

lastName:"S."

fullName:"Debangsu S."

headline:"Software Engineer at Google"

location:"Stanford, CA"

profilePictureURL:"https://media.licdn.com/dms/image/v2/C5603AQHduUuP2W2RUg/profile-displayphoto-shrink\_100\_100/profile-displayphoto-shrink\_100\_100/0/1516249909449?e=1763596800&v=beta&t=MBFBzQpLjNE35Dx5bBkuw7OFrSYPsyk8peh-B9Q2i-E"

premium:false

\[1\]:

urn:"ACoAAAAhQbUBx2X8uf_GA4CRj7OjdGqRMoY_T0s"

profileID:"2179509"

url:"https://www.linkedin.com/in/shreem"

firstName:"Shree"

lastName:"Madhavapeddi"

fullName:"Shree Madhavapeddi"

headline:"Product Management"

location:"San Diego, CA"

profilePictureURL:"https://media.licdn.com/dms/image/v2/C4D03AQG5Az\_UbWkDjA/profile-displayphoto-shrink\_100\_100/profile-displayphoto-shrink\_100\_100/0/1516258925462?e=1763596800&v=beta&t=zWnRODDPK3-Oe2vnSc3Ix7mPQ0L\_CDjrDQN\_pbupzPg"

premium:false

total:2

start:0

count:10

hasMore:false
