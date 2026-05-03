# API Documentation - LinkdAPI

## API Documentation

Professional data API for developers

[Getting Started](/docs/intro)[Pricing](/docs/endpoints-cost)

GET

## Reactions

[Try it](/playground?endpoint=%2Fapi%2Fv1%2Farticles%2Farticle%2Freactions&folder=Articles)

1 credit

Get all reactions for an article by its URN.

`/api/v1/articles/article/reactions?urn=6860588340165541888&start=0`

### Query Parameters

`urn`

Required

string

the thread Urn get it from articles info endpoint

Example:`6860588340165541888`

`start`

integer

Example:`0`

### Response Schema

Field

Type

Description

`currentPage`

integer

`pages`

integer

`reactions`

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

`totalReactions`

integer

### Example Response

InteractiveRaw JSONCode

success:true

statusCode:200

message:"Data retrieved successfully"

errors:null

data:

currentPage:1

pages:741

reactions:

\[0\]:

actor:

name:"Davina Dugnas"

headline:"🎨 Award-Winning Independent Digital Artist @ Rock Water Gallery 🌊 | Singer and songwriter music creator selling accessible prints original pieces 🌍 | Committed to eco-friendly practices inspiring through art."

urn:"ACoAADib1hQB5MpuTBKg3irN6n403JCt4lKyaG4"

id:"949736980"

url:"https://www.linkedin.com/in/ACoAADib1hQB5MpuTBKg3irN6n403JCt4lKyaG4"

profilePictureURL:"https://media.licdn.com/dms/image/v2/D5603AQFeiZgj64IgrA/profile-displayphoto-shrink\_800\_800/profile-displayphoto-shrink\_800\_800/0/1706693855612?e=1763596800&v=beta&t=e\_KPHOgia657UgIX-kddf-h4gm7Tw1YjmHkwHmZQkK8"

reactionType:"APPRECIATION"

\[1\]:

actor:

name:"Yulia Gusarova"

headline:"QA Engineer"

urn:"ACoAAEdMcQoB9mGy2mWnH-rWgRa8MR8FDL9CoAE"

id:"1196192010"

url:"https://www.linkedin.com/in/ACoAAEdMcQoB9mGy2mWnH-rWgRa8MR8FDL9CoAE"

profilePictureURL:"https://media.licdn.com/dms/image/v2/D4D03AQGxHM4YK\_QPvg/profile-displayphoto-crop\_800\_800/B4DZeHM3R3GUAI-/0/1750319987824?e=1763596800&v=beta&t=Xap\_DCRurt6nGvWDa0MwrmwxKMCedeLKAqemdUQsMgE"

reactionType:"LIKE"

\[2\]:

actor:

name:"Sharmila Tapkir"

headline:"--"

urn:"ACoAADljZgsBVeVBJ9z77iyNNDSjIQjidaP-IR8"

id:"962815499"

url:"https://www.linkedin.com/in/ACoAADljZgsBVeVBJ9z77iyNNDSjIQjidaP-IR8"

profilePictureURL:"https://media.licdn.com/dms/image/v2/D4D03AQF25uJlOlzT4w/profile-displayphoto-shrink\_800\_800/B4DZVvCedUHAAc-/0/1741324676231?e=1763596800&v=beta&t=mazpUMWKvMx-TZVsysBOHvUcXItOlW-\_h9l9I0e\_1yw"

reactionType:"LIKE"

\[3\]:

actor:

name:"Muhammad Faisal Haroon"

headline:"I help people grow their wealth through systematic trading that aims to produce exceptional risk adjusted returns. I am a Computer scientist, a quantitative trader, AI/ML data science researcher, and a lifelong learner."

urn:"ACoAAAEp6LUBxoJV1Vftxve2XBriHb4JHTbsHoQ"

id:"19523765"

url:"https://www.linkedin.com/in/ACoAAAEp6LUBxoJV1Vftxve2XBriHb4JHTbsHoQ"

profilePictureURL:"https://media.licdn.com/dms/image/v2/D5603AQFbfljNQle7dQ/profile-displayphoto-crop\_800\_800/B56ZiZVgFaH0AI-/0/1754919207658?e=1763596800&v=beta&t=0FJgrNZusifsA6mHhjo3pOsHl4qkGrp5ynyfYZSHUI8"

reactionType:"LIKE"

\[4\]:

actor:

name:"Lookup Contact"

headline:"24 followers"

urn:""

id:"103837923"

url:"https://www.linkedin.com/company/lookupcontact/"

reactionType:"LIKE"

\[5\]:

actor:

name:"謝佳芬"

headline:"--"

urn:"ACoAADMaKoABZ-AfGSi4u1ZLnU1AVcI3GF6oQic"

id:"857352832"

url:"https://www.linkedin.com/in/ACoAADMaKoABZ-AfGSi4u1ZLnU1AVcI3GF6oQic"

profilePictureURL:"https://media.licdn.com/dms/image/v2/D4E03AQGAU-8uiLZfgQ/profile-displayphoto-shrink\_800\_800/B4EZTN42jSGYAg-/0/1738621021171?e=1763596800&v=beta&t=tN4wd3msRJtjgWy4J6JY421Em3zSqhvoaUEyE3DYmGs"

reactionType:"LIKE"

\[6\]:

actor:

name:"Aureliusz Lubomski"

headline:"--"

urn:"ACoAAF67CzUBR8VM2KMHn8yJMeenyQldJ3RO08g"

id:"1589316405"

url:"https://www.linkedin.com/in/ACoAAF67CzUBR8VM2KMHn8yJMeenyQldJ3RO08g"

reactionType:"LIKE"

\[7\]:

actor:

name:"Fealty Giroux"

headline:"Business Specialist at Microsoft"

urn:"ACoAAFvNCwcBv9FSgpp3gRYPXz3Trh_Po7hPceI"

id:"1540164359"

url:"https://www.linkedin.com/in/ACoAAFvNCwcBv9FSgpp3gRYPXz3Trh\_Po7hPceI"

profilePictureURL:"https://media.licdn.com/dms/image/v2/D4D03AQEZD89Vle\_n-w/profile-displayphoto-crop\_800\_800/B4DZhaH.NUG8AM-/0/1753858697897?e=1763596800&v=beta&t=yKTgu6smDQTUND3YcfWXEOrxKzLtj6nP3PllHhRkJbk"

reactionType:"LIKE"

\[8\]:

actor:

name:"Beau Bennett MBA"

headline:"📈 Startup Business Expert | 3x Founder | Vice President | United Nations Speaker | International Business Trainer | Swiss Army Knife | 🏃 Ran 26 miles in 24 hours."

urn:"ACoAABeky1ABIscJO1Pyb1Gp4SdLJllScKNVIGI"

id:"396675920"

url:"https://www.linkedin.com/in/ACoAABeky1ABIscJO1Pyb1Gp4SdLJllScKNVIGI"

profilePictureURL:"https://media.licdn.com/dms/image/v2/D4E03AQGFeIrwdiXCfQ/profile-displayphoto-shrink\_800\_800/B4EZY.hecZGYAc-/0/1744805686189?e=1763596800&v=beta&t=SlDC7fg6p\_31ybOy41j4WlaeadfMz6aJGwTOIq\_M8BQ"

reactionType:"LIKE"

\[9\]:

actor:

name:"Olga Borzova"

headline:"SERVICES (REST, SOAP), SQL, SWIFT, FIXML, Financial Markets"

urn:"ACoAAAq1bIMB6CKNiPmWiLte5i4xO-ChYA67Bb8"

id:"179661955"

url:"https://www.linkedin.com/in/ACoAAAq1bIMB6CKNiPmWiLte5i4xO-ChYA67Bb8"

profilePictureURL:"https://media.licdn.com/dms/image/v2/D4E03AQH3sZUZBGY8VA/profile-displayphoto-shrink\_800\_800/profile-displayphoto-shrink\_800\_800/0/1676146135230?e=1763596800&v=beta&t=28AjmixduFjzxUTjaAnLY72\_nPS\_cj7WuehaE6b2i9c"

reactionType:"LIKE"

totalReactions:7410
