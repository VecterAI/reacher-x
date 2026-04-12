# API Documentation - LinkdAPI

## API Documentation

Professional data API for developers

[Getting Started](/docs/intro)[Pricing](/docs/endpoints-cost)

GET

## Get Company Posts

[Try it](/playground?endpoint=%2Fapi%2Fv1%2Fcompanies%2Fcompany%2Fposts&folder=Companies)

1 credit

Get company posts by ID.

`/api/v1/companies/company/posts?id=1337&start=0`

### Query Parameters

`id`

Required

integer

company ID

Example:`1337`

`start`

integer

Example:`0`

### Response Schema

Field

Type

Description

`posts`

array<object>

List of content posts

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

uri

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

### Example Response

InteractiveRaw JSONCode

success:true

statusCode:200

message:"Data retrieved successfully"

errors:null

data:

posts:

\[0\]:

text:"Sometimes it’s easy to see when something’s a perfect fit, like finding that missing puzzle piece. It’s a lot like LinkedIn's job match, which weighs your skills and experience from your profile to the requirements of a job description, helping you instantly connect to roles where you’re a great fit."

url:"https://www.linkedin.com/feed/update/urn:li:activity:7404565613794471936"

urn:"urn:li:activity:7404565613794471936"

author:

name:"LinkedIn"

headline:"32,534,047 followers"

urn:"urn:li:fsd_company:1337"

id:"1337"

url:"https://www.linkedin.com/company/linkedin/posts"

profilePictureURL:"https://media.licdn.com/dms/image/v2/C560BAQHaVYd13rRz3A/company-logo\_400\_400/company-logo\_400\_400/0/1638831590218/linkedin\_logo?e=1767225600&v=beta&t=bQxicSjRF4C74w6IRjN\_xtRSK8CCnjvYn9BO9x1miyI"

type:"COMPANY"

postedAt:

timestamp:1765386012505

fullDate:"2025-12-10 17:00:12.00 +0000 UTC"

relativeDay:"23h"

edited:false

engagements:

totalReactions:197

commentsCount:29

repostsCount:8

reactions:

\[0\]:

reactionType:"LIKE"

reactionCount:179

\[1\]:

reactionType:"EMPATHY"

reactionCount:8

\[2\]:

reactionType:"APPRECIATION"

reactionCount:7

\[3\]:

reactionType:"INTEREST"

reactionCount:2

\[4\]:

reactionType:"PRAISE"

reactionCount:1

mediaContent:

\[0\]:

type:"document"

url:"https://media.licdn.com/dms/document/media/v2/D4D10AQHKcBYSOdk6rg/ads-document-pdf-analyzed/B4DZsJNJsyJoAY-/0/1765386002779?e=1766077200&v=beta&t=1FBPLJCJVE5MoK\_ZyVkmfF1pQ9YQASjPKsgm4ffFZG0"

resharedPostContent:null

\[1\]:

text:"Technology is moving faster, earning attention is harder than ever, and trust and relationships matter more. These shifts are reshaping the type of challenges small businesses face, and how they set priorities for the future. Here are three ways small businesses can meet the moment: 1) Invest in AI 2) Build your brand - leverage trusted voices and own your authenticity 3) Turn relationships into competitive advantages   Learn more at https://lnkd.in/eUaWgKVu, and share your knowledge in the comments below!"

url:"https://www.linkedin.com/feed/update/urn:li:activity:7403851707220422657"

urn:"urn:li:activity:7403851707220422657"

author:

name:"LinkedIn"

headline:"32,534,047 followers"

urn:"urn:li:fsd_company:1337"

id:"1337"

url:"https://www.linkedin.com/company/linkedin/posts"

profilePictureURL:"https://media.licdn.com/dms/image/v2/C560BAQHaVYd13rRz3A/company-logo\_400\_400/company-logo\_400\_400/0/1638831590218/linkedin\_logo?e=1767225600&v=beta&t=bQxicSjRF4C74w6IRjN\_xtRSK8CCnjvYn9BO9x1miyI"

type:"COMPANY"

postedAt:

timestamp:1765215803914

fullDate:"2025-12-08 17:43:23.00 +0000 UTC"

relativeDay:"2d"

edited:false

engagements:

totalReactions:198

commentsCount:32

repostsCount:10

reactions:

\[0\]:

reactionType:"LIKE"

reactionCount:177

\[1\]:

reactionType:"PRAISE"

reactionCount:7

\[2\]:

reactionType:"APPRECIATION"

reactionCount:7

\[3\]:

reactionType:"EMPATHY"

reactionCount:3

\[4\]:

reactionType:"INTEREST"

reactionCount:3

\[5\]:

reactionType:"ENTERTAINMENT"

reactionCount:1

mediaContent:

\[0\]:

type:"article"

url:"https://www.linkedin.com/pulse/how-small-businesses-turning-change-opportunity-karin-kimbrough-jatuc?trackingId=q%2BIQcFzgKV8ZnaL%2F8WXm5w%3D%3D"

resharedPostContent:null

\[2\]:

text:"This edition of In the Loop brings together new learning perks, emerging work trends, and stories of reinvention from across the LinkedIn community. What’s the one practice that consistently helps you move forward in your career?"

url:"https://www.linkedin.com/feed/update/urn:li:activity:7402693288669110274"

urn:"urn:li:activity:7402693288669110274"

author:

name:"LinkedIn"

headline:"32,534,047 followers"

urn:"urn:li:fsd_company:1337"

id:"1337"

url:"https://www.linkedin.com/company/linkedin/posts"

profilePictureURL:"https://media.licdn.com/dms/image/v2/C560BAQHaVYd13rRz3A/company-logo\_400\_400/company-logo\_400\_400/0/1638831590218/linkedin\_logo?e=1767225600&v=beta&t=bQxicSjRF4C74w6IRjN\_xtRSK8CCnjvYn9BO9x1miyI"

type:"COMPANY"

postedAt:

timestamp:1764939615409

fullDate:"2025-12-05 13:00:15.00 +0000 UTC"

relativeDay:"6d"

edited:false

engagements:

totalReactions:951

commentsCount:70

repostsCount:16

reactions:

\[0\]:

reactionType:"LIKE"

reactionCount:885

\[1\]:

reactionType:"EMPATHY"

reactionCount:27

\[2\]:

reactionType:"APPRECIATION"

reactionCount:20

\[3\]:

reactionType:"INTEREST"

reactionCount:13

\[4\]:

reactionType:"PRAISE"

reactionCount:5

\[5\]:

reactionType:"ENTERTAINMENT"

reactionCount:1

mediaContent:

\[0\]:

type:"article"

url:"https://www.linkedin.com/pulse/tools-trends-stories-shaping-your-next-career-move-linkedin-4booe?trackingId=1aJuOwydAyBk%2BSSRS%2BnlmQ%3D%3D"

resharedPostContent:null

\[3\]:

text:"Did you know: 1 in 5 people hired last year took a role that didn’t exist in 2000. The future of work is evolving faster than ever and AI is accelerating that transformation. Watch as LinkedIn Chief Economist Karin Kimbrough breaks down the data behind emerging roles, rising demand for AI literacy, and why human skills like collaboration and problem-solving will always stay essential. #AIinWork"

url:"https://www.linkedin.com/feed/update/urn:li:activity:7402391237586128899"

urn:"urn:li:activity:7402391237586128899"

author:

name:"LinkedIn"

headline:"32,534,047 followers"

urn:"urn:li:fsd_company:1337"

id:"1337"

url:"https://www.linkedin.com/company/linkedin/posts"

profilePictureURL:"https://media.licdn.com/dms/image/v2/C560BAQHaVYd13rRz3A/company-logo\_400\_400/company-logo\_400\_400/0/1638831590218/linkedin\_logo?e=1767225600&v=beta&t=bQxicSjRF4C74w6IRjN\_xtRSK8CCnjvYn9BO9x1miyI"

type:"COMPANY"

postedAt:

timestamp:1764867600819

fullDate:"2025-12-04 17:00:00.00 +0000 UTC"

relativeDay:"6d"

edited:false

engagements:

totalReactions:374

commentsCount:72

repostsCount:21

reactions:

\[0\]:

reactionType:"LIKE"

reactionCount:321

\[1\]:

reactionType:"INTEREST"

reactionCount:29

\[2\]:

reactionType:"EMPATHY"

reactionCount:14

\[3\]:

reactionType:"PRAISE"

reactionCount:4

\[4\]:

reactionType:"APPRECIATION"

reactionCount:4

\[5\]:

reactionType:"ENTERTAINMENT"

reactionCount:2

mediaContent:

\[0\]:

type:"video"

url:"https://dms.licdn.com/playlist/vid/v2/D4D10AQHqwVAYLJ-wug/mp4-720p-30fp-crf28/B4DZrmj2sBJIB0-/0/1764804762850?e=1766077200&v=beta&t=7HtxqVuIze5ly9T\_DaLOWEPydNx2a-U4BX8eEXPyFqg"

resharedPostContent:null

\[4\]:

text:"On the job hunt? Sending out hundreds of applications may seem like the right move, but it’s not about volume. It’s about alignment ✨ With LinkedIn Premium, job seekers can zero in on roles that match their experience and goals. Working smarter > applying harder."

url:"https://www.linkedin.com/feed/update/urn:li:activity:7402045284492587009"

urn:"urn:li:activity:7402045284492587009"

author:

name:"LinkedIn"

headline:"32,534,047 followers"

urn:"urn:li:fsd_company:1337"

id:"1337"

url:"https://www.linkedin.com/company/linkedin/posts"

profilePictureURL:"https://media.licdn.com/dms/image/v2/C560BAQHaVYd13rRz3A/company-logo\_400\_400/company-logo\_400\_400/0/1638831590218/linkedin\_logo?e=1767225600&v=beta&t=bQxicSjRF4C74w6IRjN\_xtRSK8CCnjvYn9BO9x1miyI"

type:"COMPANY"

postedAt:

timestamp:1764785119174

fullDate:"2025-12-03 18:05:19.00 +0000 UTC"

relativeDay:"1w"

edited:false

engagements:

totalReactions:285

commentsCount:33

repostsCount:9

reactions:

\[0\]:

reactionType:"LIKE"

reactionCount:253

\[1\]:

reactionType:"INTEREST"

reactionCount:13

\[2\]:

reactionType:"PRAISE"

reactionCount:7

\[3\]:

reactionType:"EMPATHY"

reactionCount:5

\[4\]:

reactionType:"APPRECIATION"

reactionCount:5

\[5\]:

reactionType:"ENTERTAINMENT"

reactionCount:2

mediaContent:

\[0\]:

type:"video"

url:"https://dms.licdn.com/playlist/vid/v2/D4D10AQEeytrMgl2w5w/mp4-720p-30fp-crf28/B4DZrlY7T\_GsB4-/0/1764785113007?e=1766077200&v=beta&t=IgXtpqTrh4glv6jzwZKeDTFTpGwEQ8oqc7eDCauuCPY"

resharedPostContent:null

\[5\]:

text:"This #GivingTuesday, join us and the entire LinkedIn community in sharing a story about the causes and nonprofits that matter most to you. ❤️"

url:"https://www.linkedin.com/feed/update/urn:li:activity:7401675066633342976"

urn:"urn:li:activity:7401675066633342976"

author:

name:"LinkedIn"

headline:"32,534,047 followers"

urn:"urn:li:fsd_company:1337"

id:"1337"

url:"https://www.linkedin.com/company/linkedin/posts"

profilePictureURL:"https://media.licdn.com/dms/image/v2/C560BAQHaVYd13rRz3A/company-logo\_400\_400/company-logo\_400\_400/0/1638831590218/linkedin\_logo?e=1767225600&v=beta&t=bQxicSjRF4C74w6IRjN\_xtRSK8CCnjvYn9BO9x1miyI"

type:"COMPANY"

postedAt:

timestamp:1764696852358

fullDate:"2025-12-02 17:34:12.00 +0000 UTC"

relativeDay:"1w"

edited:false

engagements:

totalReactions:276

commentsCount:23

repostsCount:12

reactions:

\[0\]:

reactionType:"LIKE"

reactionCount:244

\[1\]:

reactionType:"EMPATHY"

reactionCount:20

\[2\]:

reactionType:"PRAISE"

reactionCount:6

\[3\]:

reactionType:"APPRECIATION"

reactionCount:3

\[4\]:

reactionType:"INTEREST"

reactionCount:3

mediaContent:

\[0\]:

type:"video"

url:"https://dms.licdn.com/playlist/vid/v2/D5605AQFX82keGbQnQA/mp4-720p-30fp-crf28/B56ZrgIOR5MECM-/0/1764696848605?e=1766077200&v=beta&t=JQoZOS-Ms1-xYmfeUAQ0bmtj6HfT7EA-TvWG7NApU0c"

resharedPostContent:null

\[6\]:

text:"In this week’s newsletter, we’re spotlighting the power of purpose-driven choices. From human-centered leadership and meaningful giving to clearer boundaries and smarter career moves. A timely reminder that even amid change, people remain at the heart of work."

url:"https://www.linkedin.com/feed/update/urn:li:activity:7400160053837602817"

urn:"urn:li:activity:7400160053837602817"

author:

name:"LinkedIn"

headline:"32,534,047 followers"

urn:"urn:li:fsd_company:1337"

id:"1337"

url:"https://www.linkedin.com/company/linkedin/posts"

profilePictureURL:"https://media.licdn.com/dms/image/v2/C560BAQHaVYd13rRz3A/company-logo\_400\_400/company-logo\_400\_400/0/1638831590218/linkedin\_logo?e=1767225600&v=beta&t=bQxicSjRF4C74w6IRjN\_xtRSK8CCnjvYn9BO9x1miyI"

type:"COMPANY"

postedAt:

timestamp:1764335645160

fullDate:"2025-11-28 13:14:05.00 +0000 UTC"

relativeDay:"1w"

edited:false

engagements:

totalReactions:1337

commentsCount:156

repostsCount:32

reactions:

\[0\]:

reactionType:"LIKE"

reactionCount:1204

\[1\]:

reactionType:"EMPATHY"

reactionCount:65

\[2\]:

reactionType:"APPRECIATION"

reactionCount:51

\[3\]:

reactionType:"INTEREST"

reactionCount:10

\[4\]:

reactionType:"PRAISE"

reactionCount:7

mediaContent:

\[0\]:

type:"article"

url:"https://www.linkedin.com/pulse/gratitude-generosity-human-side-work-linkedin-pjire?trackingId=Q8O%2BAtIl0TsiKWhA4A3hsw%3D%3D"

resharedPostContent:null

\[7\]:

text:"Who is someone on your team you appreciate? Tag them. Tell them. Make their day."

url:"https://www.linkedin.com/feed/update/urn:li:activity:7399446834428964865"

urn:"urn:li:activity:7399446834428964865"

author:

name:"LinkedIn"

headline:"32,534,047 followers"

urn:"urn:li:fsd_company:1337"

id:"1337"

url:"https://www.linkedin.com/company/linkedin/posts"

profilePictureURL:"https://media.licdn.com/dms/image/v2/C560BAQHaVYd13rRz3A/company-logo\_400\_400/company-logo\_400\_400/0/1638831590218/linkedin\_logo?e=1767225600&v=beta&t=bQxicSjRF4C74w6IRjN\_xtRSK8CCnjvYn9BO9x1miyI"

type:"COMPANY"

postedAt:

timestamp:1764165600402

fullDate:"2025-11-26 14:00:00.00 +0000 UTC"

relativeDay:"2w"

edited:false

engagements:

totalReactions:397

commentsCount:187

repostsCount:16

reactions:

\[0\]:

reactionType:"LIKE"

reactionCount:337

\[1\]:

reactionType:"EMPATHY"

reactionCount:29

\[2\]:

reactionType:"APPRECIATION"

reactionCount:23

\[3\]:

reactionType:"PRAISE"

reactionCount:6

\[4\]:

reactionType:"INTEREST"

reactionCount:2

mediaContent:null

resharedPostContent:null

\[8\]:

text:"Green skills are surging. Verified skills are rising. And professionals everywhere are finding new ways to stand out. What’s one skill you’re focusing on before the year ends? Explore all the insights in the new issue of In the Loop."

url:"https://www.linkedin.com/feed/update/urn:li:activity:7395094138800463872"

urn:"urn:li:activity:7395094138800463872"

author:

name:"LinkedIn"

headline:"32,534,047 followers"

urn:"urn:li:fsd_company:1337"

id:"1337"

url:"https://www.linkedin.com/company/linkedin/posts"

profilePictureURL:"https://media.licdn.com/dms/image/v2/C560BAQHaVYd13rRz3A/company-logo\_400\_400/company-logo\_400\_400/0/1638831590218/linkedin\_logo?e=1767225600&v=beta&t=bQxicSjRF4C74w6IRjN\_xtRSK8CCnjvYn9BO9x1miyI"

type:"COMPANY"

postedAt:

timestamp:1763127836895

fullDate:"2025-11-14 13:43:56.00 +0000 UTC"

relativeDay:"3w"

edited:false

engagements:

totalReactions:1906

commentsCount:163

repostsCount:25

reactions:

\[0\]:

reactionType:"LIKE"

reactionCount:1772

\[1\]:

reactionType:"EMPATHY"

reactionCount:52

\[2\]:

reactionType:"PRAISE"

reactionCount:31

\[3\]:

reactionType:"APPRECIATION"

reactionCount:30

\[4\]:

reactionType:"INTEREST"

reactionCount:19

\[5\]:

reactionType:"ENTERTAINMENT"

reactionCount:2

mediaContent:

\[0\]:

type:"article"

url:"https://www.linkedin.com/pulse/new-ways-grow-prove-stay-informed-linkedin-linkedin-p9fce?trackingId=rU%2B1UGxNeJ1jX%2Fr6sVcTJw%3D%3D"

resharedPostContent:null
