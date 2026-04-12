# API Documentation - LinkdAPI

## API Documentation

Professional data API for developers

[Getting Started](/docs/intro)[Pricing](/docs/endpoints-cost)

GET

## Post's Comments

[Try it](/playground?endpoint=%2Fapi%2Fv1%2Fposts%2Fcomments&folder=Posts)

1 credit

Get all comments for a given post by its URN.

`/api/v1/posts/comments?urn=6860588340517838849&start=0&count=10`

### Query Parameters

`urn`

Required

integer

Example:`6860588340517838849`

`start`

integer

Example:`0`

`count`

integer

Example:`10`

`cursor`

string

### Response Schema

Field

Type

Description

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

style

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

author:

name:"Juan Sanson, Jr."

headline:"IT PMO Lead | Oracle Cloud Optimization | Public Sector Innovator | Army Veteran | Project Management Mentor | Digital Creator | Champion of RATS: Results. Actions. Tasks. Situation."

urn:"ACoAAAwxwuYB6YYnc9J8MhtMWO_BlV13KqUbti4"

id:"urn:li:member:204587750"

url:"https://www.linkedin.com/in/juansansonjr"

profilePictureURL:"https://media.licdn.com/dms/image/v2/D5603AQF4Z9VpTnZIhg/profile-displayphoto-shrink\_800\_800/profile-displayphoto-shrink\_800\_800/0/1715573805289?e=1763596800&v=beta&t=rmmpCuKfZz-y5xPSr5k\_IxwIrHh\_v6bpQg78rcL7mJI"

comment:"Juan Sanson, Jr. This projects by product is carbon black. Great for the efforts to provide clean energy from thr sun."

createdAt:1718303111781

permalink:"https://www.linkedin.com/feed/update/urn:li:ugcPost:6860588340165541888?commentUrn=urn%3Ali%3Acomment%3A%28ugcPost%3A6860588340165541888%2C7167352642728255488%29&replyUrn=urn%3Ali%3Acomment%3A%28ugcPost%3A6860588340165541888%2C7207085614951780354%29&dashCommentUrn=urn%3Ali%3Afsd\_comment%3A%287167352642728255488%2Curn%3Ali%3AugcPost%3A6860588340165541888%29&dashReplyUrn=urn%3Ali%3Afsd\_comment%3A%287207085614951780354%2Curn%3Ali%3AugcPost%3A6860588340165541888%29"

edited:false

engagements:

totalReactions:0

commentsCount:0

repostsCount:0

reactions:null

\[1\]:

author:

name:"Dr. KAVITHA ANDIAPPAN"

headline:"StartupTN mentor -Circular economy, Associate professor at Chennai institute of technology/ Annauniversity guideship on inorganic chemistry"

urn:"ACoAADBRY-kB7irOzcU6D3Cc0Z07J_XremrwfSg"

id:"urn:li:member:810640361"

url:"https://www.linkedin.com/in/dr-kavitha-andiappan-6b55941a7"

profilePictureURL:"https://media.licdn.com/dms/image/v2/D5603AQFKx1OE\_FD2pg/profile-displayphoto-crop\_800\_800/B56ZegGSg5HUAM-/0/1750737693411?e=1763596800&v=beta&t=C4grl8Pm0HmjfwWBHG73bqEYuvE3h1oFdYUHpT5QHYY"

comment:"Good for suatainability"

createdAt:1708926167721

permalink:"https://www.linkedin.com/feed/update/urn:li:ugcPost:6860588340165541888?commentUrn=urn%3Ali%3Acomment%3A%28ugcPost%3A6860588340165541888%2C7167755860977332225%29&dashCommentUrn=urn%3Ali%3Afsd\_comment%3A%287167755860977332225%2Curn%3Ali%3AugcPost%3A6860588340165541888%29"

edited:false

engagements:

totalReactions:3

commentsCount:0

repostsCount:0

reactions:

\[0\]:

reactionType:"EMPATHY"

reactionCount:3

\[2\]:

author:

name:"Juan Sanson, Jr."

headline:"IT PMO Lead | Oracle Cloud Optimization | Public Sector Innovator | Army Veteran | Project Management Mentor | Digital Creator | Champion of RATS: Results. Actions. Tasks. Situation."

urn:"ACoAAAwxwuYB6YYnc9J8MhtMWO_BlV13KqUbti4"

id:"urn:li:member:204587750"

url:"https://www.linkedin.com/in/juansansonjr"

profilePictureURL:"https://media.licdn.com/dms/image/v2/D5603AQF4Z9VpTnZIhg/profile-displayphoto-shrink\_800\_800/profile-displayphoto-shrink\_800\_800/0/1715573805289?e=1763596800&v=beta&t=rmmpCuKfZz-y5xPSr5k\_IxwIrHh\_v6bpQg78rcL7mJI"

comment:"Mr. Gates, there is project that I think needs consideration in much more r&d. It's a way to turn our waste to clean fuel. Green gas producers to clean fuel or energy. Landfills to parks or forests again. Anyone here can DM me on this, I really would like to hear Mr. Gate's thoughts on this."

createdAt:1708830033000

permalink:"https://www.linkedin.com/feed/update/urn:li:ugcPost:6860588340165541888?commentUrn=urn%3Ali%3Acomment%3A%28ugcPost%3A6860588340165541888%2C7167352642728255488%29&dashCommentUrn=urn%3Ali%3Afsd\_comment%3A%287167352642728255488%2Curn%3Ali%3AugcPost%3A6860588340165541888%29"

edited:false

engagements:

totalReactions:2

commentsCount:1

repostsCount:0

reactions:

\[0\]:

reactionType:"EMPATHY"

reactionCount:2

\[3\]:

author:

name:"Carolina Queuer"

headline:"Clinical embryologist at Tanner-Gomez"

urn:"ACoAADl6HCoBVViM7oalvwImk\_-mgadiZb1MK1w"

id:"urn:li:member:964303914"

url:"https://www.linkedin.com/in/carolina-queuer-2b6b3a22a"

comment:"Keep up the good work!"

createdAt:1643882666884

permalink:"https://www.linkedin.com/feed/update/urn:li:ugcPost:6860588340165541888?commentUrn=urn%3Ali%3Acomment%3A%28ugcPost%3A6860588340165541888%2C6894943645238448128%29&dashCommentUrn=urn%3Ali%3Afsd\_comment%3A%286894943645238448128%2Curn%3Ali%3AugcPost%3A6860588340165541888%29"

edited:false

engagements:

totalReactions:3

commentsCount:0

repostsCount:0

reactions:

\[0\]:

reactionType:"EMPATHY"

reactionCount:3

\[4\]:

author:

name:"Turatsinze Jr"

headline:"Zhejiang University Scholar | United Nations Bank Scholar|MEngr in Industrial Design Engineering"

urn:"ACoAAClSPX8BLJvOs66wv-4Ca4JEgXX3_DsgG5I"

id:"urn:li:member:693255551"

url:"https://www.linkedin.com/in/turatsinze-junior-%E5%BC%B5%E5%88%A9-msc-67b205174"

profilePictureURL:"https://media.licdn.com/dms/image/v2/D4E03AQGcWh9VeWmxpg/profile-displayphoto-shrink\_800\_800/profile-displayphoto-shrink\_800\_800/0/1721563393723?e=1763596800&v=beta&t=nz8zsXjDynh\_gWvYpmEBhsFHrI8tfogcldLwM5z0P-g"

comment:"Turatsinze Jr"

createdAt:1653546061558

permalink:"https://www.linkedin.com/feed/update/urn:li:ugcPost:6860588340165541888?commentUrn=urn%3Ali%3Acomment%3A%28ugcPost%3A6860588340165541888%2C6935474860169007104%29&dashCommentUrn=urn%3Ali%3Afsd\_comment%3A%286935474860169007104%2Curn%3Ali%3AugcPost%3A6860588340165541888%29"

edited:false

engagements:

totalReactions:1

commentsCount:0

repostsCount:0

reactions:

\[0\]:

reactionType:"EMPATHY"

reactionCount:1

\[5\]:

author:

name:"JOEY OAXACA MARTINEZ THE ADJUTANT GENERAL DOCTRINE"

headline:"boss..."

urn:"ACoAABFCr4kBz_sSXiKrOzmn4wQuiojKpmZeTZc"

id:"urn:li:member:289582985"

url:"https://www.linkedin.com/in/joey-oaxaca-martinez-the-adjutant-general-doctrine-8b5b9280"

comment:"Bill Gates, be you LL General Army Title Executive Senator. Bill Gates. As been knowing as they claim to my presence in a holding facility. Microsoft Windows 10 account  10 as x also ."

createdAt:1761219772621

permalink:"https://www.linkedin.com/feed/update/urn:li:ugcPost:6860588340165541888?commentUrn=urn%3Ali%3Acomment%3A%28ugcPost%3A6860588340165541888%2C7387091137183981568%29&dashCommentUrn=urn%3Ali%3Afsd\_comment%3A%287387091137183981568%2Curn%3Ali%3AugcPost%3A6860588340165541888%29"

edited:false

engagements:

totalReactions:0

commentsCount:1

repostsCount:0

reactions:null

\[6\]:

author:

name:"JOEY OAXACA MARTINEZ THE ADJUTANT GENERAL DOCTRINE"

headline:"boss..."

urn:"ACoAABFCr4kBz_sSXiKrOzmn4wQuiojKpmZeTZc"

id:"urn:li:member:289582985"

url:"https://www.linkedin.com/in/joey-oaxaca-martinez-the-adjutant-general-doctrine-8b5b9280"

comment:"Waz up with FCC title 15 rule trying to use my CEO title v and 15 th century 1519. But I am told I go back further then this. As why the government in City tease me with can't believe how much spent and not one dime given straight forward. As why I agree with them in there plan to erase the  whole family from existence. As today seeing the current map to said where lived is no longer the street. As seeing also public notice of proposal of permit to projects  having to do with been I posted to government "

createdAt:1761220390897

permalink:"https://www.linkedin.com/feed/update/urn:li:ugcPost:6860588340165541888?commentUrn=urn%3Ali%3Acomment%3A%28ugcPost%3A6860588340165541888%2C7387093730417291264%29&dashCommentUrn=urn%3Ali%3Afsd\_comment%3A%287387093730417291264%2Curn%3Ali%3AugcPost%3A6860588340165541888%29"

edited:false

engagements:

totalReactions:0

commentsCount:0

repostsCount:0

reactions:null

\[7\]:

author:

name:"Shuvo Mahmmud"

headline:"--Cybersecurity Specialist | Mitigating Digital Risks and Safeguarding Critical Assets with Advanced Solutions"

urn:"ACoAAEO2zx4BoRNm8Gus0aSkPqOtWx0gM\_-EB4A"

id:"urn:li:member:1136054046"

url:"https://www.linkedin.com/in/shuvo-mahmmud"

profilePictureURL:"https://media.licdn.com/dms/image/v2/D5603AQHEzNTA9zo5-g/profile-displayphoto-shrink\_800\_800/profile-displayphoto-shrink\_800\_800/0/1686578452134?e=1763596800&v=beta&t=T299L7umEOvMOz297\_i5l3pulnTiEG0DUEGosPQfnz8"

comment:"This is incredibly exciting! The "America's Clean Industrial Revolution" bill is a significant step towards a sustainable future. Kudos to Congress for taking the lead. 👏♻️ #Sustainability #CleanEnergy #FutureForward"

createdAt:1686038168373

permalink:"https://www.linkedin.com/feed/update/urn:li:ugcPost:6860588340165541888?commentUrn=urn%3Ali%3Acomment%3A%28ugcPost%3A6860588340165541888%2C7071756633760026624%29&dashCommentUrn=urn%3Ali%3Afsd\_comment%3A%287071756633760026624%2Curn%3Ali%3AugcPost%3A6860588340165541888%29"

edited:false

engagements:

totalReactions:3

commentsCount:0

repostsCount:0

reactions:

\[0\]:

reactionType:"EMPATHY"

reactionCount:2

\[1\]:

reactionType:"LIKE"

reactionCount:1

\[8\]:

author:

name:"Nicholas F. Krol"

headline:"Polymath, Global Ambassador"

urn:"ACoAAACubS0BuBYfmyQFIVRs5dLqxxWxda-ARa4"

id:"urn:li:member:11431213"

url:"https://www.linkedin.com/in/nicholas-f-krol-3519b33"

comment:"Walter Reed Army Institute of Research (WRAIR) has emerged as a world leader in HIV vaccine research and development. https://www.hivresearch.org/"

createdAt:1638779105766

permalink:"https://www.linkedin.com/feed/update/urn:li:ugcPost:6860588340165541888?commentUrn=urn%3Ali%3Acomment%3A%28ugcPost%3A6860588340165541888%2C6873537758426611712%29&dashCommentUrn=urn%3Ali%3Afsd\_comment%3A%286873537758426611712%2Curn%3Ali%3AugcPost%3A6860588340165541888%29"

edited:false

engagements:

totalReactions:1

commentsCount:0

repostsCount:0

reactions:

\[0\]:

reactionType:"EMPATHY"

reactionCount:1

\[9\]:

author:

name:"Jane A."

headline:"CEO OF SAGITTARIUS PUBLISHING. SONGWRITER AT ACM RECORDS. FENG SHUI CONSULTANT NYC."

urn:"ACoAAAceXiMBFujqibWdwMLt8DtOG5kX-cuGiMk"

id:"urn:li:member:119430691"

url:"https://www.linkedin.com/in/jane-a-b97bb633"

comment:"Please explain climate change?"

createdAt:1648962015970

permalink:"https://www.linkedin.com/feed/update/urn:li:ugcPost:6860588340165541888?commentUrn=urn%3Ali%3Acomment%3A%28ugcPost%3A6860588340165541888%2C6916247979427258368%29&dashCommentUrn=urn%3Ali%3Afsd\_comment%3A%286916247979427258368%2Curn%3Ali%3AugcPost%3A6860588340165541888%29"

edited:false

engagements:

totalReactions:4

commentsCount:0

repostsCount:0

reactions:

\[0\]:

reactionType:"EMPATHY"

reactionCount:3

\[1\]:

reactionType:"LIKE"

reactionCount:1

\[10\]:

author:

name:"Mamoune Ndiaye"

headline:"Secrétaire général chez DEM DEM"

urn:"ACoAADVgaxgByDn6NExfNpGc_BSdwcLT1h7bATE"

id:"urn:li:member:895511320"

url:"https://www.linkedin.com/in/mamoune-ndiaye-874aa320b"

profilePictureURL:"https://media.licdn.com/dms/image/v2/D4E35AQFMQQQYbxwCZQ/profile-framedphoto-shrink\_800\_800/profile-framedphoto-shrink\_800\_800/0/1632926851128?e=1762866000&v=beta&t=p35Yka8gDy-mAc4IFvgil5xPn-xK-Df860SCw0HhgG0"

comment:"#DemDem# west africa Senegal millions of young people are dying taking boats to go to Europe. #Raiseheresuccesshere"

createdAt:1638821474229

permalink:"https://www.linkedin.com/feed/update/urn:li:ugcPost:6860588340165541888?commentUrn=urn%3Ali%3Acomment%3A%28ugcPost%3A6860588340165541888%2C6873715464644685824%29&dashCommentUrn=urn%3Ali%3Afsd\_comment%3A%286873715464644685824%2Curn%3Ali%3AugcPost%3A6860588340165541888%29"

edited:false

engagements:

totalReactions:3

commentsCount:0

repostsCount:0

reactions:

\[0\]:

reactionType:"EMPATHY"

reactionCount:3

\[11\]:

author:

name:"JOEY OAXACA MARTINEZ THE ADJUTANT GENERAL DOCTRINE"

headline:"boss..."

urn:"ACoAABFCr4kBz_sSXiKrOzmn4wQuiojKpmZeTZc"

id:"urn:li:member:289582985"

url:"https://www.linkedin.com/in/joey-oaxaca-martinez-the-adjutant-general-doctrine-8b5b9280"

comment:"So what's the deal. As San Jose being the one to that not of I distributed denial of services. As just cause I represent San Jose one way you can't be doesn't justify any right."

createdAt:1761220034173

permalink:"https://www.linkedin.com/feed/update/urn:li:ugcPost:6860588340165541888?commentUrn=urn%3Ali%3Acomment%3A%28ugcPost%3A6860588340165541888%2C7387091137183981568%29&replyUrn=urn%3Ali%3Acomment%3A%28ugcPost%3A6860588340165541888%2C7387092234208362496%29&dashCommentUrn=urn%3Ali%3Afsd\_comment%3A%287387091137183981568%2Curn%3Ali%3AugcPost%3A6860588340165541888%29&dashReplyUrn=urn%3Ali%3Afsd\_comment%3A%287387092234208362496%2Curn%3Ali%3AugcPost%3A6860588340165541888%29"

edited:false

engagements:

totalReactions:0

commentsCount:0

repostsCount:0

reactions:null

cursor:"1005239957-1762258381900-988a7f771ad4b1b4588ab817986df94b"
