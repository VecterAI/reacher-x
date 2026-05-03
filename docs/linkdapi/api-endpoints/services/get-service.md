# API Documentation - LinkdAPI

## API Documentation

Professional data API for developers

[Getting Started](/docs/intro)[Pricing](/docs/endpoints-cost)

GET

## Get Service

[Try it](/playground?endpoint=%2Fapi%2Fv1%2Fservices%2Fservice%2Fdetails&folder=Services)

1 credit

Get service details by its VanityName (ID).

`/api/v1/services/service/details?vanityname=7144683349b511a503`

### Query Parameters

`vanityname`

Required

string

Example:`7144683349b511a503`

### Response Schema

Field

Type

Description

`service`

object

`vanityName`

string

`serviceID`

string

utc-millisec

`businessName`

string

`provider`

object

`firstName`

string

First name of the professional

`lastName`

string

Last name of the professional

`fullName`

string

Complete display name

`publicIdentifier`

string

Public username visible in profile URLs

`profilePictureURL`

string

uri

URL of the profile photo

`location`

object

Geographic location information

`city`

string

City name

`availabilityType`

string

`pricing`

object

`pricingType`

string

`servicesProvided`

array<object>

`name`

string

Display name of the entity

`urn`

string

uri

Unique internal identifier used for detailed profile queries

`requestProposalURL`

string

uri

URL link to this resource

`shareUrl`

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

service:

vanityName:"0000a8335a78437a53"

serviceID:"7301183869058273280"

businessName:"Aaiyna’s Services"

provider:

firstName:"Aaiyna"

lastName:"Jairath"

fullName:"Aaiyna Jairath"

publicIdentifier:"aaiyna-jairath-134302285"

profilePictureURL:"https://media.licdn.com/dms/image/v2/D4E03AQHFkfeK8IxJYw/profile-displayphoto-shrink\_800\_800/profile-displayphoto-shrink\_800\_800/0/1692632056442?e=1765411200&v=beta&t=DXmxyt62Dbkr9WLIgkRyAnfdMGt9zToe0dUACmpoCrw"

location:

city:"United Kingdom"

availabilityType:"Remote or in person"

pricing:

pricingType:"Contact for pricing"

servicesProvided:

\[0\]:

name:"Content Marketing"

urn:"urn:li:fsd_standardizedSkill:6182"

\[1\]:

name:"Content Strategy"

urn:"urn:li:fsd_standardizedSkill:5740"

\[2\]:

name:"Social Media Marketing"

urn:"urn:li:fsd_standardizedSkill:2174"

\[3\]:

name:"Digital Marketing"

urn:"urn:li:fsd_standardizedSkill:1836"

\[4\]:

name:"Search Engine Optimization (SEO)"

urn:"urn:li:fsd_standardizedSkill:512"

\[5\]:

name:"Advertising"

urn:"urn:li:fsd_standardizedSkill:69"

\[6\]:

name:"Event Marketing"

urn:"urn:li:fsd_standardizedSkill:2072"

\[7\]:

name:"Market Research"

urn:"urn:li:fsd_standardizedSkill:786"

\[8\]:

name:"Marketing Strategy"

urn:"urn:li:fsd_standardizedSkill:296"

\[9\]:

name:"Performance Marketing"

urn:"urn:li:fsd_standardizedSkill:11011"

requestProposalURL:"https://www.linkedin.com/services/page/0000a8335a78437a53/request-proposal"

shareUrl:"https://www.linkedin.com/services/page/0000a8335a78437a53"
