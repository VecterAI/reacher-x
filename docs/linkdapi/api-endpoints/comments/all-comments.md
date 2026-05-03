# API Documentation - LinkdAPI

## API Documentation

Professional data API for developers

[Getting Started](/docs/intro)[Pricing](/docs/endpoints-cost)

GET

## All Comments

[Try it](/playground?endpoint=%2Fapi%2Fv1%2Fcomments%2Fall&folder=Comments)

1 credit

Get all comments made by a user using their URN.

`/api/v1/comments/all?urn=ACoAAAHT6VYBz_yVpo-jE-Or8WNKjArXMd-S6KM`

### Query Parameters

`urn`

Required

string

Example:`ACoAAAHT6VYBz_yVpo-jE-Or8WNKjArXMd-S6KM`

`cursor`

string

### Response Schema

Field

Type

Description

`comments`

array<object>

List of comments

`header`

string

`text`

string

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

array<object>

`type`

string

Entity type classification

`url`

string

uri

Direct URL to this resource

`resharedPostContent`

any

nullable

`Comment`

object

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

style

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

any

nullable

`cursor`

string

Cursor token for next page of results

### Example Response

InteractiveRaw JSONCode

success:true

statusCode:200

message:"Data retrieved successfully"

errors:null

data:

comments:

\[0\]:

header:"Seasoned Code commented on this"

text:"Hiring!! Backend Developer, Remote, $135k ✨ Reply if interested"

url:"https://www.linkedin.com/feed/update/urn:li:activity:7151832408143626240"

urn:"urn:li:activity:7151832408143626240"

author:

name:"CrackedDevs.com"

headline:"27,492 followers"

urn:""

id:"urn:li:company:100187062"

url:"https://www.linkedin.com/company/crackeddevs/posts"

postedAt:

timestamp:1705129720722

fullDate:"2024-01-13 07:08:40.00 +0000 UTC"

relativeDay:"1yr"

edited:false

engagements:

totalReactions:161

commentsCount:301

repostsCount:3

reactions:

\[0\]:

reactionType:"LIKE"

reactionCount:157

\[1\]:

reactionType:"EMPATHY"

reactionCount:4

mediaContent:

\[0\]:

type:"image"

url:"https://media.licdn.com/dms/image/v2/D4E10AQF-MgVhO9e3LQ/image-shrink\_1280/image-shrink\_1280/0/1705079397677?e=1742817600&v=beta&t=XqU-RC00INzaGaGX2XiyblKQDsvZOua7qNKaUcrHZkE"

resharedPostContent:null

Comment:

author:

name:"Seasoned Code"

headline:"Software engineer & Ethical hacker"

urn:"ACoAADvqvpUBQNmOpFV4gGBY_Hy7rDSfifRDdxw"

id:"urn:li:member:1005239957"

url:"https://www.linkedin.com/in/seasonedcode"

profilePictureURL:"https://media.licdn.com/dms/image/v2/D4E35AQFNQSry\_ozLMw/profile-framedphoto-shrink\_800\_800/profile-framedphoto-shrink\_800\_800/0/1715750634698?e=1742817600&v=beta&t=KGoHMV3UAfkW598PU2zUXgAOiO7DYAWPOejw8GchL8Y"

comment:"Great opportunity I'm interested :)"

createdAt:1705129713822

permalink:"https://www.linkedin.com/feed/update/urn:li:activity:7151621394462568448?commentUrn=urn%3Ali%3Acomment%3A%28activity%3A7151621394462568448%2C7151832379202969600%29&dashCommentUrn=urn%3Ali%3Afsd\_comment%3A%287151832379202969600%2Curn%3Ali%3Aactivity%3A7151621394462568448%29"

edited:false

engagements:

totalReactions:0

commentsCount:0

repostsCount:0

reactions:null

\[1\]:

header:"Seasoned Code commented on this"

text:"#everyone Assalamualaikom Jumma Mubarak 💕"

url:"https://www.linkedin.com/feed/update/urn:li:activity:7146396179969318912"

urn:"urn:li:activity:7146396179969318912"

author:

name:"Israt Jahan"

headline:"Attended Satkania M.U fazil madrasha"

urn:"ACoAAEW2zLEBF2P8EyyWkYr971Q99C7sSibAPP8"

id:"urn:li:member:1169607857"

url:"https://www.linkedin.com/in/israt-jahan-495848287"

profilePictureURL:"https://media.licdn.com/dms/image/v2/D4E03AQGzhzzibr\_dtw/profile-displayphoto-shrink\_800\_800/profile-displayphoto-shrink\_800\_800/0/1691765417095?e=1747872000&v=beta&t=-ztBEntXHTnisFWLM4ZShdlNkpaJAox6Cq--xnvE-vc"

postedAt:

timestamp:1703833622925

fullDate:"2023-12-29 07:07:02.00 +0000 UTC"

relativeDay:"1yr"

edited:false

engagements:

totalReactions:3

commentsCount:3

repostsCount:0

reactions:

\[0\]:

reactionType:"EMPATHY"

reactionCount:3

mediaContent:null

resharedPostContent:null

Comment:

author:

name:"Seasoned Code"

headline:"Software engineer & Ethical hacker"

urn:"ACoAADvqvpUBQNmOpFV4gGBY_Hy7rDSfifRDdxw"

id:"urn:li:member:1005239957"

url:"https://www.linkedin.com/in/seasonedcode"

profilePictureURL:"https://media.licdn.com/dms/image/v2/D4E35AQFNQSry\_ozLMw/profile-framedphoto-shrink\_800\_800/profile-framedphoto-shrink\_800\_800/0/1715750634698?e=1742817600&v=beta&t=KGoHMV3UAfkW598PU2zUXgAOiO7DYAWPOejw8GchL8Y"

comment:"Jumma Mubarak too thanks :)"

createdAt:1703833612611

permalink:"https://www.linkedin.com/feed/update/urn:li:activity:7146365533330812928?commentUrn=urn%3Ali%3Acomment%3A%28activity%3A7146365533330812928%2C7146396136709242881%29&dashCommentUrn=urn%3Ali%3Afsd\_comment%3A%287146396136709242881%2Curn%3Ali%3Aactivity%3A7146365533330812928%29"

edited:false

engagements:

totalReactions:1

commentsCount:1

repostsCount:0

reactions:

\[0\]:

reactionType:"EMPATHY"

reactionCount:1

\[2\]:

header:"Seasoned Code commented on this"

text:"Did you know, you can use <kbd> tags in your Markdown on GitHub to make text appear like a button. It's perfect for documenting things like keyboard shortcuts and game controls in your READMEs, wikis and issues."

url:"https://www.linkedin.com/feed/update/urn:li:activity:7146217506456686592"

urn:"urn:li:activity:7146217506456686592"

author:

name:"GitHub"

headline:"4,702,521 followers"

urn:""

id:"urn:li:company:1418841"

url:"https://www.linkedin.com/company/github/posts"

postedAt:

timestamp:1703791023840

fullDate:"2023-12-28 19:17:03.00 +0000 UTC"

relativeDay:"1yr"

edited:false

engagements:

totalReactions:3596

commentsCount:62

repostsCount:119

reactions:

\[0\]:

reactionType:"LIKE"

reactionCount:3086

\[1\]:

reactionType:"INTEREST"

reactionCount:357

\[2\]:

reactionType:"EMPATHY"

reactionCount:119

\[3\]:

reactionType:"PRAISE"

reactionCount:27

\[4\]:

reactionType:"APPRECIATION"

reactionCount:6

\[5\]:

reactionType:"ENTERTAINMENT"

reactionCount:1

mediaContent:

\[0\]:

type:"image"

url:"https://media.licdn.com/dms/image/v2/D5610AQF8YWupvdP3mQ/image-shrink\_1280/image-shrink\_1280/0/1703781003938?e=1742817600&v=beta&t=x8gP9Sw9TEGoEyyeDNGo2YsO6QBFSmKwMisdBZ5OxvE"

resharedPostContent:null

Comment:

author:

name:"Seasoned Code"

headline:"Software engineer & Ethical hacker"

urn:"ACoAADvqvpUBQNmOpFV4gGBY_Hy7rDSfifRDdxw"

id:"urn:li:member:1005239957"

url:"https://www.linkedin.com/in/seasonedcode"

profilePictureURL:"https://media.licdn.com/dms/image/v2/D4E35AQFNQSry\_ozLMw/profile-framedphoto-shrink\_800\_800/profile-framedphoto-shrink\_800\_800/0/1715750634698?e=1742817600&v=beta&t=KGoHMV3UAfkW598PU2zUXgAOiO7DYAWPOejw8GchL8Y"

comment:"Love this :)"

createdAt:1703791018952

permalink:"https://www.linkedin.com/feed/update/urn:li:activity:7146175481602580481?commentUrn=urn%3Ali%3Acomment%3A%28activity%3A7146175481602580481%2C7146217485950746624%29&dashCommentUrn=urn%3Ali%3Afsd\_comment%3A%287146217485950746624%2Curn%3Ali%3Aactivity%3A7146175481602580481%29"

edited:false

engagements:

totalReactions:0

commentsCount:0

repostsCount:0

reactions:null

cursor:"dXJuOmxpOmFjdGl2aXR5OjcxNDYyMTc1MDY0NTY2ODY1OTItMTcwMzc5MTAxODk1MQ=="
