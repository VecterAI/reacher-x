# API Documentation - LinkdAPI

## API Documentation

Professional data API for developers

[Getting Started](/docs/intro)[Pricing](/docs/endpoints-cost)

GET

## Comment's Likes

[Try it](/playground?endpoint=%2Fapi%2Fv1%2Fcomments%2Flikes&folder=Comments)

1 credit

Get all likes for a comment using its URN.

`/api/v1/comments/likes?urn=7366111065878716416,7366148912597852160&start=0`

### Query Parameters

`urn`

Required

string

Example:`7366111065878716416,7366148912597852160`

`start`

string

Example:`0`

### Response Schema

Field

Type

Description

`currentPage`

integer

`likes`

array<object>

`actor`

object

`name`

string

Display name of the entity

`headline`

string

Professional headline or tagline

`urn`

string

Unique internal identifier used for detailed profile queries

`id`

string

utc-millisec

Unique identifier for this resource

`url`

string

uri

Direct URL to this resource

`profilePictureURL`

string

uri

URL of the profile photo

`reactionType`

string

`pages`

integer

`totalLikes`

integer

### Example Response

InteractiveRaw JSONCode

success:true

statusCode:200

message:"Data retrieved successfully"

errors:null

data:

currentPage:1

likes:

\[0\]:

actor:

name:"Nate Hedglin"

headline:"Lead Software Engineer"

urn:"ACoAAAvcxBkB2L3d4YiHfFwxPkGA7vyID3MhuIs"

id:"199017497"

url:"https://www.linkedin.com/in/ACoAAAvcxBkB2L3d4YiHfFwxPkGA7vyID3MhuIs"

profilePictureURL:"https://media.licdn.com/dms/image/v2/C5603AQHPXKUrU-8MvQ/profile-displayphoto-shrink\_800\_800/profile-displayphoto-shrink\_800\_800/0/1657655108694?e=1759363200&v=beta&t=Jejb-Xxfax7irxQKF3G70aTtxlCDRU00jMuAP0Uqee4"

reactionType:"LIKE"

\[1\]:

actor:

name:"Mamoudou SYLLA"

headline:"Software Engineer | C/C++ | JAVA | PYTHON"

urn:"ACoAAB55N70BPD5UTDLXoSel0adPZUlpNECriYA"

id:"511260605"

url:"https://www.linkedin.com/in/ACoAAB55N70BPD5UTDLXoSel0adPZUlpNECriYA"

profilePictureURL:"https://media.licdn.com/dms/image/v2/C4E03AQFC4LWL3g-8pA/profile-displayphoto-shrink\_800\_800/profile-displayphoto-shrink\_800\_800/0/1582395677393?e=1759363200&v=beta&t=\_XxfUTx3BmJ59s\_Z-iGBlmvoajzPoVMRnEn6Kli65g0"

reactionType:"LIKE"

\[2\]:

actor:

name:"Karl Nicholas"

headline:"Java Enterprise Developer"

urn:"ACoAABTenTgBUOU6MNmX9iLvvrvc-vDh4Av1BSM"

id:"350133560"

url:"https://www.linkedin.com/in/ACoAABTenTgBUOU6MNmX9iLvvrvc-vDh4Av1BSM"

profilePictureURL:"https://media.licdn.com/dms/image/v2/D4E35AQE\_\_yAg9AoIjQ/profile-framedphoto-shrink\_800\_800/B4EZVhdtfvHcAg-/0/1741096933804?e=1757070000&v=beta&t=wDfxhn1GZz9GlG7142KUmgA7K89LH0\_lGWE4MMAyUoo"

reactionType:"LIKE"

pages:1

totalLikes:3
