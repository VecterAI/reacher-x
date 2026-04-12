# API Documentation - LinkdAPI

## API Documentation

Professional data API for developers

[Getting Started](/docs/intro)[Pricing](/docs/endpoints-cost)

GET

## Similar services

[Try it](/playground?endpoint=%2Fapi%2Fv1%2Fservices%2Fservice%2Fsimilar&folder=Services)

1 credit

Get services similar to a given service by its VanityName (ID).

`/api/v1/services/service/similar?vanityname=7144683349b511a503`

### Query Parameters

`vanityname`

Required

string

Example:`7144683349b511a503`

### Response Schema

Field

Type

Description

`showAllUrl`

string

uri

URL link to this resource

`serviceProviders`

array<object>

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

`headline`

string

Professional headline or tagline

`servicePageURL`

string

uri

URL link to this resource

`serviceVanityName`

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

showAllUrl:"https://www.linkedin.com/search/results/services/?serviceCategory=%5B%22207%22%2C%22272%22%2C%22764%22%2C%223166%22%5D&trk=service\_providers\_search\_show\_all\_trk"

serviceProviders:

\[0\]:

firstName:"Olusegun"

lastName:"O."

fullName:"Olusegun O."

publicIdentifier:"olusegun-o-35635365"

profilePictureURL:"https://media.licdn.com/dms/image/v2/D4E03AQFLKanTKH\_M1w/profile-displayphoto-shrink\_800\_800/B4EZPhOr.gGcAg-/0/1734650545050?e=1765411200&v=beta&t=ip8iEHYS8IAsaAzb\_3azE79ufP9cV2peyZYkxSoo0YA"

headline:"Director@Hexvista | Technology"

servicePageURL:"https://www.linkedin.com/services/page/45762a336793892a19"

serviceVanityName:"45762a336793892a19"

requestProposalURL:"https://www.linkedin.com/services/page/45762a336793892a19/request-proposal"

\[1\]:

firstName:"Alperen"

lastName:"Belgic"

fullName:"Alperen Belgic"

publicIdentifier:"belgic"

profilePictureURL:"https://media.licdn.com/dms/image/v2/C5603AQHxVNlxfcpfgA/profile-displayphoto-shrink\_800\_800/profile-displayphoto-shrink\_800\_800/0/1630962271050?e=1765411200&v=beta&t=Dvv29GdLBzF2OCv8i9LTJYfyIhfzj4KK-BK8YxWhYQA"

headline:"Software Engineer helping streamline team operations"

servicePageURL:"https://www.linkedin.com/services/page/8a82843101a850aa53"

serviceVanityName:"8a82843101a850aa53"

requestProposalURL:"https://www.linkedin.com/services/page/8a82843101a850aa53/request-proposal"

\[2\]:

firstName:"Humera"

lastName:"Shaikh"

fullName:"Humera Shaikh"

publicIdentifier:"humera-shaikh-385279194"

profilePictureURL:"https://media.licdn.com/dms/image/v2/D4D03AQGbv2SymCck2g/profile-displayphoto-shrink\_800\_800/profile-displayphoto-shrink\_800\_800/0/1714056997304?e=1765411200&v=beta&t=e4g6wgUn8XkB1-rZgRbR7udhSmF2J7vUHtV6iWwNHhw"

headline:"Software Developer"

servicePageURL:"https://www.linkedin.com/services/page/714380329a2a33b076"

serviceVanityName:"714380329a2a33b076"

requestProposalURL:"https://www.linkedin.com/services/page/714380329a2a33b076/request-proposal"

\[3\]:

firstName:"Peter"

lastName:"Davies"

fullName:"Peter Davies"

publicIdentifier:"pkdavies"

profilePictureURL:"https://media.licdn.com/dms/image/v2/C4D03AQEX7MXGemE5sw/profile-displayphoto-shrink\_800\_800/profile-displayphoto-shrink\_800\_800/0/1612105928572?e=1765411200&v=beta&t=hWjALMunhnTW8GothZr4T3z-Ud807ZksCmrM-ZQNYNM"

headline:"Entrepreneur and Director at the Cyber Defence Service"

servicePageURL:"https://www.linkedin.com/services/page/7142943078b1712150"

serviceVanityName:"7142943078b1712150"

requestProposalURL:"https://www.linkedin.com/services/page/7142943078b1712150/request-proposal"

\[4\]:

firstName:"David"

lastName:"Brandon"

fullName:"David Brandon"

publicIdentifier:"davidwilliambrandon"

profilePictureURL:"https://media.licdn.com/dms/image/v2/C4E03AQHwJzPMGqzJwg/profile-displayphoto-shrink\_400\_400/profile-displayphoto-shrink\_400\_400/0/1644400370231?e=1765411200&v=beta&t=3-dwbMMLypOejoYo7INyfYr-er7K68d-AynbTyx7rZM"

headline:"Co-founder at RotaCloud"

servicePageURL:"https://www.linkedin.com/services/page/45476a3137b1527b6b"

serviceVanityName:"45476a3137b1527b6b"

requestProposalURL:"https://www.linkedin.com/services/page/45476a3137b1527b6b/request-proposal"
