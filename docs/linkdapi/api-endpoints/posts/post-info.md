# API Documentation - LinkdAPI

## API Documentation

Professional data API for developers

[Getting Started](/docs/intro)[Pricing](/docs/endpoints-cost)

GET

## Post Info

[Try it](/playground?endpoint=%2Fapi%2Fv1%2Fposts%2Finfo&folder=Posts)

1 credit

Get detailed information for a post by its URN.

`/api/v1/posts/info?urn=7430337505431957506`

### Query Parameters

`urn`

Required

integer

Example:`7430337505431957506`

### Response Schema

Field

Type

Description

`post`

object

`text`

string

`textAttributes`

array<object>

`length`

integer

`text`

string

`type`

string

Entity type classification

`urn`

string

Unique internal identifier used for detailed profile queries

`url`

string

uri

Direct URL to this resource

`url`

string

uri

Direct URL to this resource

`urn`

string

uri

Unique internal identifier used for detailed profile queries

`author`

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

uri

Unique identifier for this resource

`url`

string

uri

Direct URL to this resource

`profilePictureURL`

string

uri

URL of the profile photo

`type`

string

Entity type classification

`postedAt`

object

Timestamp

`timestamp`

integer

`fullDate`

string

style

Timestamp

`relativeDay`

string

`edited`

boolean

`engagements`

object

`totalReactions`

integer

`commentsCount`

integer

Numeric count

`repostsCount`

integer

Numeric count

`reactions`

array<object>

`reactionType`

string

`reactionCount`

integer

Numeric count

`mediaContent`

any

nullable

`resharedPostContent`

object

`text`

string

`textAttributes`

array<object>

`length`

integer

`text`

string

`type`

string

Entity type classification

`urn`

string

utc-millisec

Unique internal identifier used for detailed profile queries

`url`

string

uri

Direct URL to this resource

`url`

string

uri

Direct URL to this resource

`urn`

string

uri

Unique internal identifier used for detailed profile queries

`author`

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

uri

Unique identifier for this resource

`url`

string

uri

Direct URL to this resource

`profilePictureURL`

string

uri

URL of the profile photo

`type`

string

Entity type classification

`postedAt`

object

Timestamp

`timestamp`

integer

`fullDate`

string

style

Timestamp

`relativeDay`

string

`edited`

boolean

`engagements`

any

nullable

`mediaContent`

array<object>

`type`

string

Entity type classification

`text`

string

`resharedPostContent`

any

nullable

`comments`

array<object>

List of comments

`author`

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

uri

Unique identifier for this resource

`url`

string

uri

Direct URL to this resource

`profilePictureURL`

string

uri

URL of the profile photo

`comment`

string

`createdAt`

integer

Creation timestamp

`permalink`

string

uri

URL link to this resource

`edited`

boolean

`engagements`

object

`totalReactions`

integer

`commentsCount`

integer

Numeric count

`repostsCount`

integer

Numeric count

`reactions`

array<object>

`reactionType`

string

`reactionCount`

integer

Numeric count

### Example Response

InteractiveRaw JSONCode

success:true

statusCode:200

message:"Data retrieved successfully"

errors:null

data:

post:

text:"Even though I had over 80 applicants for the leadership role on my team, Andreas Wullrich was the number one choice to partner with me to scale for impact for Microsoft. I’m excited to bring great success to our customers who have partnered with us in Euorope and the Middle East. Let’s go!!!"

textAttributes:

\[0\]:

length:16

text:"Andreas Wullrich"

type:"profileMention"

urn:"ACoAAAFJa9cB-AzxaFxrvdqTB6jSXjRycvVT7zI"

url:"https://www.linkedin.com/in/ACoAAAFJa9cB-AzxaFxrvdqTB6jSXjRycvVT7zI"

\[1\]:

length:9

text:"Microsoft"

type:"companyMention"

urn:"1035"

url:"https://www.linkedin.com/company/microsoft/"

url:"https://www.linkedin.com/feed/update/urn:li:activity:7430337505431957506"

urn:"urn:li:activity:7430337505431957506"

author:

name:"Carol S. Scott"

headline:"Global AI Growth Leader @ Microsoft | Award-Winning AI Speaker | Cultivating Courageous Leadership in an AI-First World | AWS + Deloitte | London | EMEA"

urn:"ACoAAABndxkB6Xdp0bFXD5zOt9Oa28yw7OaP1Yw"

id:"urn:li:member:6780697"

url:"https://www.linkedin.com/in/carolsscott"

profilePictureURL:"https://media.licdn.com/dms/image/v2/D4E03AQH1E3FT9X6HXQ/profile-displayphoto-shrink\_800\_800/B4EZd.lzliHYAg-/0/1750175530421?e=1773878400&v=beta&t=PZttFrL2HIrPL7ERAMgrGOBKJqrN1O2luk8fZfA7u3c"

type:"PERSON"

postedAt:

timestamp:1771530510290

fullDate:"2026-02-19 19:48:30.00 +0000 UTC"

relativeDay:"1w"

edited:false

engagements:

totalReactions:20

commentsCount:2

repostsCount:0

reactions:

\[0\]:

reactionType:"LIKE"

reactionCount:11

\[1\]:

reactionType:"PRAISE"

reactionCount:9

mediaContent:null

resharedPostContent:

text:"After 5.5 years away, I’m excited to have boomeranged back to Microsoft and it truly feels like coming home! This week I joined as a CSAM Manager, focusing on supporting customers across Northern Europe by partnering closely to realize value at scale, empowering high‑performing teams, and turning strategy into meaningful outcomes with AI as an increasingly important (and practical) part of that journey. A big thanks to Mattias Ageheim for the referral and to Carol S. Scott for a great and professional process. Grateful for the warm welcome and energized by what’s ahead. If you’re curious about my new role, customer success, or what’s changed (and what hasn’t) at Microsoft I’m more than happy to connect and chat."

textAttributes:

\[0\]:

length:9

text:"Microsoft"

type:"companyMention"

urn:"1035"

url:"https://www.linkedin.com/company/microsoft/"

\[1\]:

length:15

text:"Mattias Ageheim"

type:"profileMention"

urn:"ACoAAAAFhnQBuCVcSSvnJMQfGjw5zyGKPPiaYz0"

url:"https://www.linkedin.com/in/ACoAAAAFhnQBuCVcSSvnJMQfGjw5zyGKPPiaYz0"

\[2\]:

length:14

text:"Carol S. Scott"

type:"profileMention"

urn:"ACoAAABndxkB6Xdp0bFXD5zOt9Oa28yw7OaP1Yw"

url:"https://www.linkedin.com/in/ACoAAABndxkB6Xdp0bFXD5zOt9Oa28yw7OaP1Yw"

url:"https://www.linkedin.com/feed/update/urn:li:activity:7430330172223971328"

urn:"urn:li:activity:7430330172223971328"

author:

name:"Andreas Wullrich"

headline:"Leading Professional Services Growth with focus on Customer Success in Cloud and SaaS environment | ex-COO | ex-Workday | Microsoft-boomeranger"

urn:"ACoAAAFJa9cB-AzxaFxrvdqTB6jSXjRycvVT7zI"

id:"urn:li:member:21588951"

url:"https://www.linkedin.com/in/andreaswullrich"

profilePictureURL:"https://media.licdn.com/dms/image/v2/D4D03AQGCn4WxpQKDaw/profile-displayphoto-shrink\_800\_800/B4DZagf9tyHQAc-/0/1746449456465?e=1773878400&v=beta&t=w9NQgys6NP1VrxWpEvuu6kbo8BmbtZpokJhC2WQyYwo"

type:"PERSON"

postedAt:

timestamp:1771528761917

fullDate:"2026-02-19 19:19:21.00 +0000 UTC"

relativeDay:"1w"

edited:false

engagements:null

mediaContent:

\[0\]:

type:"celebration"

text:"Starting a New Position"

resharedPostContent:null

comments:

\[0\]:

author:

name:"Francesca Condoluci"

headline:"Supervisor Customer Care EMEA/UK SMB @ PayPal | Global Customer Care Expert, Behavioral Coach and Yoga Instructor"

urn:"ACoAABsOG5UBujSxjQsbtmHpPUdXXKcSQcgYo6w"

id:"urn:li:member:453909397"

url:"https://www.linkedin.com/in/francesca-condoluci-07101b108"

profilePictureURL:"https://media.licdn.com/dms/image/v2/D4E03AQGhCLL8Qi2SvQ/profile-displayphoto-shrink\_800\_800/B4EZS3Ww2DHcAc-/0/1738242986124?e=1773878400&v=beta&t=DUAcmlectWOdqfxTVdaApLhvAfHXB8aMky2\_8gtspf8"

comment:"Wishing you and your team all the success! You truly inspire others to be their best selves, Carol!"

createdAt:1771579108466

permalink:"https://www.linkedin.com/feed/update/urn:li:ugcPost:7430337504530120704?commentUrn=urn%3Ali%3Acomment%3A%28ugcPost%3A7430337504530120704%2C7430541340951691265%29&dashCommentUrn=urn%3Ali%3Afsd\_comment%3A%287430541340951691265%2Curn%3Ali%3AugcPost%3A7430337504530120704%29"

edited:false

engagements:

totalReactions:1

commentsCount:0

repostsCount:0

reactions:

\[0\]:

reactionType:"LIKE"

reactionCount:1

\[1\]:

author:

name:"Andreas Wullrich"

headline:"Leading Professional Services Growth with focus on Customer Success in Cloud and SaaS environment | ex-COO | ex-Workday | Microsoft-boomeranger"

urn:"ACoAAAFJa9cB-AzxaFxrvdqTB6jSXjRycvVT7zI"

id:"urn:li:member:21588951"

url:"https://www.linkedin.com/in/andreaswullrich"

profilePictureURL:"https://media.licdn.com/dms/image/v2/D4D03AQGCn4WxpQKDaw/profile-displayphoto-shrink\_800\_800/B4DZagf9tyHQAc-/0/1746449456465?e=1773878400&v=beta&t=w9NQgys6NP1VrxWpEvuu6kbo8BmbtZpokJhC2WQyYwo"

comment:"Thanks, Carol S. Scott for the warm welcoming! You made it super-easy to accept and take the opportunity to be working together with the team and partnering with the most exciting customers and partners in EMEA. "

createdAt:1771875845092

permalink:"https://www.linkedin.com/feed/update/urn:li:ugcPost:7430337504530120704?commentUrn=urn%3Ali%3Acomment%3A%28ugcPost%3A7430337504530120704%2C7431785944569200641%29&dashCommentUrn=urn%3Ali%3Afsd\_comment%3A%287431785944569200641%2Curn%3Ali%3AugcPost%3A7430337504530120704%29"

edited:false

engagements:

totalReactions:0

commentsCount:0

repostsCount:0

reactions:null
