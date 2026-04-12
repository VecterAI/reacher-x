# API Documentation - LinkdAPI

## API Documentation

Professional data API for developers

[Getting Started](/docs/intro)[Pricing](/docs/endpoints-cost)

GET

## Profile overview

[Try it](/playground?endpoint=%2Fapi%2Fv1%2Fprofile%2Foverview&folder=Profile)

2 credits

\##### Fetch a user’s basic profile information by their username.

`/api/v1/profile/overview?username=ryanroslansky`

### Query Parameters

`username`

Required

string

Example:`ryanroslansky`

### Response Schema

Field

Type

Description

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

`publicIdentifier`

string

Public username visible in profile URLs

`followerCount`

integer

Number of followers

`connectionsCount`

integer

Number of connections

`creator`

boolean

Whether the profile has creator mode enabled

`qualityProfile`

boolean

Whether the profile meets quality thresholds

`joined`

integer

Date the profile was created

`profileID`

string

color

Numeric profile identifier

`urn`

string

Unique internal identifier used for detailed profile queries

`CurrentPositions`

array<object>

`urn`

string

utc-millisec

Unique internal identifier used for detailed profile queries

`name`

string

Display name of the entity

`url`

string

uri

Direct URL to this resource

`logoURL`

string

uri

URL of the company or entity logo

`isTopVoice`

boolean

Whether the user is a recognized top voice

`premium`

boolean

Whether the user has a premium subscription

`influencer`

boolean

Whether the user is a platform influencer

`location`

object

Geographic location information

`countryCode`

string

ISO country code

`countryName`

string

`city`

string

City name

`region`

string

State, province, or region

`fullLocation`

string

Complete location string

`geoCountryUrn`

string

uri

Geographic country identifier

`geoRegionUrn`

string

uri

Geographic region identifier

`backgroundImageURL`

string

uri

URL of the background/cover image

`profilePictureURL`

string

uri

URL of the profile photo

`supportedLocales`

array<object>

`country`

string

Country name

`language`

string

### Example Response

InteractiveRaw JSONCode

success:true

statusCode:200

message:"Data retrieved successfully"

errors:null

data:

firstName:"Ryan"

lastName:"Roslansky"

fullName:"Ryan Roslansky"

headline:"CEO at LinkedIn"

publicIdentifier:"ryanroslansky"

followerCount:887877

connectionsCount:8624

creator:true

qualityProfile:true

joined:1086269234000

profileID:"678940"

urn:"ACoAAAAKXBwBikfbNJww68eYvcu2dqDYJhHbp4g"

CurrentPositions:

\[0\]:

urn:"1337"

name:"LinkedIn"

url:"https://www.linkedin.com/company/linkedin/"

logoURL:"https://media.licdn.com/dms/image/v2/C560BAQHaVYd13rRz3A/company-logo\_400\_400/company-logo\_400\_400/0/1638831590218/linkedin\_logo?e=1761782400&v=beta&t=x\_9t8LMKN1X\_iOpOKN33-CV7fzDbS5ZZY-S9gp6KmrU"

isTopVoice:true

premium:true

influencer:true

location:

countryCode:"US"

countryName:"United States"

city:"San Francisco Bay Area"

region:"San Francisco Bay Area"

fullLocation:"San Francisco Bay Area"

geoCountryUrn:"urn:li:fsd_geo:103644278"

geoRegionUrn:"urn:li:fsd_geo:90000084"

backgroundImageURL:"https://media.licdn.com/dms/image/v2/C4D16AQHXtyQ-bg4B2Q/profile-displaybackgroundimage-shrink\_350\_1400/profile-displaybackgroundimage-shrink\_350\_1400/0/1580864697728?e=1761782400&v=beta&t=5WI2KjHGu4yAkVC47GmTmH\_EZBLimOEWwMAwIhKJz-o"

profilePictureURL:"https://media.licdn.com/dms/image/v2/C4D03AQELbnIckyItlw/profile-displayphoto-shrink\_800\_800/profile-displayphoto-shrink\_800\_800/0/1667929254389?e=1761782400&v=beta&t=KEPEFMp-rGZfNCq7BJ3Pm8-RKEdWShSdERdcy6k4HWQ"

supportedLocales:

\[0\]:

country:"US"

language:"en"
