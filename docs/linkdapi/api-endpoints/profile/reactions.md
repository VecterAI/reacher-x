# API Documentation - LinkdAPI

## API Documentation

Professional data API for developers

[Getting Started](/docs/intro)[Pricing](/docs/endpoints-cost)

GET

## Reactions

[Try it](/playground?endpoint=%2Fapi%2Fv1%2Fprofile%2Freactions&folder=Profile)

1 credit

Get all reactions associated with a user by their URN.

`/api/v1/profile/reactions?urn=ACoAAAHT6VYBz_yVpo-jE-Or8WNKjArXMd-S6KM`

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

`cursor`

string

Cursor token for next page of results

`reactions`

array<object>

`header`

string

`text`

string

style

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

cursor:"dXJuOmxpOmFjdGl2aXR5OjczMDcwOTk5ODI3ODY5Mjg2NDAtMTc0MjE0ODM5MTYxNQ=="

reactions:

\[0\]:

header:"Mansoor Shaikh likes this"

text:"Back at Meta, I interviewed a smart engineer with ~20 years of experience, but I had to fail them for a simple reason: They could barely code. It was so bad that most Meta junior engineers would have been stronger coders than this candidate. Based on the behavioral round, it seemed like this engineer had transitioned to a more high-level architect role at their company. This meant that they were very far removed from the day-to-day code and only engaged with the technical part of engineering through very broad strokes. Despite being huge, Meta is a lightning-fast place where engineers must put boots on the ground immediately and land commits as early as Week 1. This engineer certainly wouldn't have survived had we let them in. This was the best decision for both parties. It doesn't matter how senior you are as an engineer, you must keep your coding skills sharp to guarantee your relevance in the market. Learn the best way to do that here: https://lnkd.in/gWXbDnM2 #techcareergrowth #softwareengineering #growthtips #interviewtips #staffengineer"

url:"https://www.linkedin.com/feed/update/urn:li:activity:7307251328097882112"

urn:"urn:li:activity:7307251328097882112"

author:

name:"Alex Chiou"

headline:"Co-Founder @ Taro, Ex-Robinhood, Ex-Meta Tech Lead"

urn:"ACoAAAuZcwoBPlBN2NazFcacZUqv-5tBXFFzglg"

id:"urn:li:member:194605834"

url:"https://www.linkedin.com/in/alexander-chiou"

profilePictureURL:"https://media.licdn.com/dms/image/v2/C5603AQH\_UXSxccTnKQ/profile-displayphoto-shrink\_800\_800/profile-displayphoto-shrink\_800\_800/0/1658957420377?e=1747872000&v=beta&t=6l8oCMuEwpaiDCLyVEEDx5Qgq8rUGNCwFoyARfKEKOg"

postedAt:

timestamp:1742184478783

fullDate:"2025-03-17 04:07:58.00 +0000 UTC"

relativeDay:"19h"

edited:true

engagements:

totalReactions:1238

commentsCount:85

repostsCount:10

reactions:

\[0\]:

reactionType:"LIKE"

reactionCount:949

\[1\]:

reactionType:"ENTERTAINMENT"

reactionCount:222

\[2\]:

reactionType:"INTEREST"

reactionCount:28

\[3\]:

reactionType:"PRAISE"

reactionCount:17

\[4\]:

reactionType:"EMPATHY"

reactionCount:12

\[5\]:

reactionType:"APPRECIATION"

reactionCount:10

mediaContent:

\[0\]:

type:"image"

url:"https://media.licdn.com/dms/image/v2/D5622AQFsBo0CMTsG8A/feedshare-shrink\_2048\_1536/B56ZV5zzg5HoAo-/0/1741505378664?e=1744848000&v=beta&t=KEnif19OCbx4n0w7\_LK0o7KRMPJjQctnStVpdZCJGjs"

resharedPostContent:null

\[1\]:

header:"Mansoor Shaikh likes this"

text:"#OpenToWork After over four years of high impact HR work at Citizens, my role has been eliminated due to organizational changes following the retirement of Beth Johnson our Chief Experience Officer. As her group was distributed across other teams, my position was no longer needed. While transitions like these are never easy, I choose to see them as opportunities—moments to reflect, reset, and step boldly into what’s next. I am incredibly grateful for the opportunity to have worked alongside phenomenal leaders, shaping the people and talent strategies that drive digital, data, and AI transformation. My passion lies at the intersection of business strategy and human capital—ensuring that organizations evolve their people, culture, and leadership capabilities alongside technological advancements. What’s Next? I’m looking for my next leadership opportunity where I can: — Architect people strategies that fuel transformation, innovation, and growth —Align talent, culture, and organizational design to help businesses thrive in an AI-driven world —Build high-performing, inclusive teams and develop the next generation of leadership I bring expertise in: — AI, Data & Digital Transformation – Helping companies integrate AI, foster data literacy, and enable enterprise-wide analytics adoption. — HR Strategy for C-Suite Leaders – Partnering with executive teams across strategy, product, marketing, digital, experience design, and enterprise transformation. —Talent Acquisition , Culture & Workforce Strategy – Leading large-scale recruiting operations, succession planning, and workforce upskilling at national and global levels. While my time at Citizens is winding down, my energy for driving impact through people and culture is stronger than ever. If you know of organizations looking for an HR executive and culture carrier with a track record of enabling transformation and high performance, I’d love to connect. To my incredible network—thank you in advance for your support. Let’s talk, share ideas, and explore what’s next together! #HRLeadership #Transformation #PeopleStrategy #ExecutiveSearch #AIandHR #FutureOfWork #mindsetshift"

url:"https://www.linkedin.com/feed/update/urn:li:activity:7307218784979738624"

urn:"urn:li:activity:7307218784979738624"

author:

name:"Chad Reynolds"

headline:"Strategic HR Executive | Driving Data & Digital Transformation & Organizational Change | People & Culture Leader | Suicide Prevention | Top 150 Global Fundraiser for Movember 2021-2024"

urn:"ACoAAAnp5K0BqWTKRdxaPFkiyjUPxqyielbHOu4"

id:"urn:li:member:166323373"

url:"https://www.linkedin.com/in/chad-reynolds-citizensbank"

profilePictureURL:"https://media.licdn.com/dms/image/v2/D5603AQH8rH5XFvwl1A/profile-displayphoto-shrink\_800\_800/B56ZQi9fJEHIAc-/0/1735753332277?e=1747872000&v=beta&t=K5a9Jp9boouTSJEjphSJYEF80zIPRlo0tu5uc6lcXmI"

postedAt:

timestamp:1742176719899

fullDate:"2025-03-17 01:58:39.00 +0000 UTC"

relativeDay:"13h"

edited:false

engagements:

totalReactions:669

commentsCount:49

repostsCount:59

reactions:

\[0\]:

reactionType:"LIKE"

reactionCount:360

\[1\]:

reactionType:"APPRECIATION"

reactionCount:264

\[2\]:

reactionType:"EMPATHY"

reactionCount:34

\[3\]:

reactionType:"PRAISE"

reactionCount:11

mediaContent:

\[0\]:

type:"image"

url:"https://media.licdn.com/dms/image/v2/D5622AQE4lAzVP5dj6A/feedshare-shrink\_2048\_1536/B56ZWg6lEFGQAo-/0/1742161469872?e=1744848000&v=beta&t=lwlkB8WOjLtaYB3pWgx4Uqsc7Sj8wALoUWxPopwBBa0"

resharedPostContent:null

\[2\]:

header:"Mansoor Shaikh likes this"

text:"I am celebrating my failures today. Please comment - Congratulations, Keep Going, Awesome… something of that sort. Thank you! Update: I need to explain something. I fail everyday. So do you. We just don’t take time to celebrate it. Today, as I am taking a day off, decided to sit and celebrate my little failures. I failed to make chai for my wife once because I was lazy that day is an equal failure to I lost some business. Don’t think of too dramatic a failure. 🤣 Also this is a reminder to you. I am not seeking emotional support or empathy through this. I am celebrating my failure and I meant it. Partying today, meeting friends, chilling out in a cafe by myself. That sort celebrating the kutti failures. They should know I dedicated a day for them. They deserve it."

url:"https://www.linkedin.com/feed/update/urn:li:activity:7307218577487458305"

urn:"urn:li:activity:7307218577487458305"

author:

name:"Pradeep Soundararajan"

headline:"Driving growth by preventing bugs & regression | Founder CEO of Bugasura & Moolya"

urn:"ACoAAACM9ogB1e-QhbcMIo2ce_uTDK_771k-PnQ"

id:"urn:li:member:9238152"

url:"https://www.linkedin.com/in/testertested"

profilePictureURL:"https://media.licdn.com/dms/image/v2/D5603AQFclUuZENs8Pw/profile-displayphoto-shrink\_400\_400/profile-displayphoto-shrink\_400\_400/0/1727431695272?e=1747872000&v=beta&t=\_Yprh6OhtRmFR7Uajzro7te88stvw1GpXyRS1S7gHQw"

postedAt:

timestamp:1742176670429

fullDate:"2025-03-17 01:57:50.00 +0000 UTC"

relativeDay:"5d"

edited:true

engagements:

totalReactions:41

commentsCount:17

repostsCount:0

reactions:

\[0\]:

reactionType:"LIKE"

reactionCount:31

\[1\]:

reactionType:"EMPATHY"

reactionCount:4

\[2\]:

reactionType:"PRAISE"

reactionCount:4

\[3\]:

reactionType:"ENTERTAINMENT"

reactionCount:1

\[4\]:

reactionType:"APPRECIATION"

reactionCount:1

mediaContent:null

resharedPostContent:null

\[3\]:

header:"Mansoor Shaikh likes this"

text:"AI is quietly hijacking startup tech stacks—and it’s a problem. When I interview founders, I dig into \*why\* they insist on a specific stack for their first CTO hire. The answer? Almost always: 'AI told me.' They’ve used tools like ChatGPT to write job specs or build prototypes, then blindly locked in those suggestions. Here’s the kicker: Critical decisions—like the tech that powers your business—are being outsourced to trend-chasing LLMs instead of deliberate strategy. My advice? Strip \*all\* technical requirements from AI-generated specs. Let your CTO decide what’s best. Anyone else seeing this? What’s your take—smart shortcut or risky move?"

url:"https://www.linkedin.com/feed/update/urn:li:activity:7307208045757947904"

urn:"urn:li:activity:7307208045757947904"

author:

name:"Dan Boresjo"

headline:"Principal Developer | Chief Technology Officer (CTO)"

urn:"ACoAAAA09RQB20ifPgwFm_zMOr70ji9R6P3f7fc"

id:"urn:li:member:3470612"

url:"https://www.linkedin.com/in/dboresjo"

profilePictureURL:"https://media.licdn.com/dms/image/v2/C5103AQG2tXXS04Tjuw/profile-displayphoto-shrink\_200\_200/profile-displayphoto-shrink\_200\_200/0/1516234714504?e=1747872000&v=beta&t=nEl3EFYzGY2L0oklRyFJUNDlizPBC4jSYYFTS2vKu7U"

postedAt:

timestamp:1742174159469

fullDate:"2025-03-17 01:15:59.00 +0000 UTC"

relativeDay:"3d"

edited:false

engagements:

totalReactions:17

commentsCount:8

repostsCount:0

reactions:

\[0\]:

reactionType:"LIKE"

reactionCount:14

\[1\]:

reactionType:"INTEREST"

reactionCount:3

mediaContent:null

resharedPostContent:null

reactedComment:

author:

name:"John Crickett"

headline:"Helping you become a better software engineer by building real-world applications."

urn:"ACoAAAAADOIB1jesEqZdnwQE5csLme2tAbpHuMg"

id:"urn:li:member:3298"

url:"https://www.linkedin.com/in/johncrickett"

profilePictureURL:"https://media.licdn.com/dms/image/v2/D4E03AQFt6rZ2n09buA/profile-displayphoto-shrink\_800\_800/profile-displayphoto-shrink\_800\_800/0/1721990590702?e=1747872000&v=beta&t=PtJwH7ec0H0KUxUOJ4fwsTiAs3WuGm8d8C5Z8DHu0qo"

comment:"Then they're not looking for a CTO, they're looking for a software engineer."

createdAt:1741949320328

permalink:"https://www.linkedin.com/feed/update/urn:li:activity:7305920064304672768?commentUrn=urn%3Ali%3Acomment%3A%28activity%3A7305920064304672768%2C7306265002045329411%29&dashCommentUrn=urn%3Ali%3Afsd\_comment%3A%287306265002045329411%2Curn%3Ali%3Aactivity%3A7305920064304672768%29"

edited:false

engagements:

totalReactions:7

commentsCount:0

repostsCount:0

reactions:

\[0\]:

reactionType:"LIKE"

reactionCount:7

\[4\]:

header:"Mansoor Shaikh likes this"

text:"General Category, Male, Salaried Class, Taxpayer is the most (forced) giving person in the country. 😞 He only gives and receives nothing in return from government. No reservations in schools or jobs, no subsidies, no handouts, laws which hold you guilty unless proven otherwise, and responsibilities of all kinds. Let's all take some time out of our busy schedule to honour this class of givers. Being a male is tough 💔"

url:"https://www.linkedin.com/feed/update/urn:li:activity:7307207729054408704"

urn:"urn:li:activity:7307207729054408704"

author:

name:"Sumit Goyal"

headline:"@Fujitsu | Selenium | Playwright | API | Educator 👨‍💻 | Sharing Latest Interview Questions | 10 million + views 🚀🚀"

urn:"ACoAABsVEZsBtGIRagyeO_cOqAD_AdeOcAPw_eU"

id:"urn:li:member:454365595"

url:"https://www.linkedin.com/in/sumit-goyal-0771bb108"

profilePictureURL:"https://media.licdn.com/dms/image/v2/D5603AQFCm9ymjVtkrQ/profile-displayphoto-shrink\_800\_800/profile-displayphoto-shrink\_800\_800/0/1730643836484?e=1747872000&v=beta&t=Td3wdP-xgRaXnJhzM-c3r6bulOSn5LxXIq9x1xtxGkM"

postedAt:

timestamp:1742174083961

fullDate:"2025-03-17 01:14:43.00 +0000 UTC"

relativeDay:"1w"

edited:false

engagements:

totalReactions:55

commentsCount:4

repostsCount:0

reactions:

\[0\]:

reactionType:"LIKE"

reactionCount:47

\[1\]:

reactionType:"APPRECIATION"

reactionCount:6

\[2\]:

reactionType:"EMPATHY"

reactionCount:2

mediaContent:null

resharedPostContent:null

\[5\]:

header:"Mansoor Shaikh likes this"

text:"Another day to celebrate getting older. It’s a new year to learn, relearn, unlearn, and grow. Happy birthday to me🎉"

url:"https://www.linkedin.com/feed/update/urn:li:activity:7307207561596792832"

urn:"urn:li:activity:7307207561596792832"

author:

name:"Marvelous Ikechi"

headline:"Mobile & Web Engineer | Building Scalable & High-Performance Apps | React Native, React JS, Next JS"

urn:"ACoAACU17cABAbYWskfvJeMGuJxzOurhWzPGvcI"

id:"urn:li:member:624291264"

url:"https://www.linkedin.com/in/marvelous-ikechi"

profilePictureURL:"https://media.licdn.com/dms/image/v2/D5603AQFO\_9AnNZHJxQ/profile-displayphoto-shrink\_800\_800/profile-displayphoto-shrink\_800\_800/0/1701229237189?e=1747872000&v=beta&t=GOMGZFN89s6RAauIZ8sDukLjMeMmbmVFOsVUeTRIqUU"

postedAt:

timestamp:1742174044036

fullDate:"2025-03-17 01:14:04.00 +0000 UTC"

relativeDay:"6d"

edited:false

engagements:

totalReactions:33

commentsCount:15

repostsCount:1

reactions:

\[0\]:

reactionType:"LIKE"

reactionCount:24

\[1\]:

reactionType:"PRAISE"

reactionCount:5

\[2\]:

reactionType:"EMPATHY"

reactionCount:4

mediaContent:

\[0\]:

type:"image"

url:"https://media.licdn.com/dms/image/v2/D5622AQE4oansW\_Q6LQ/feedshare-shrink\_1280/B56ZWAN6XEHEAo-/0/1741612892579?e=1744848000&v=beta&t=vXdbiu43YKRXjx6TYzED2yytHJ8NENLvGGXa4Ea7VlU"

resharedPostContent:null

\[6\]:

header:"Mansoor Shaikh likes this"

text:"My most used code refactoring technique: Replace the comment with a method. It worries me that many developers think their intent is best explained by writing a verbose comment instead of creating a self-documenting structure. There are rare cases in which you must explain WHY, never WHAT."

url:"https://www.linkedin.com/feed/update/urn:li:activity:7307207388510486529"

urn:"urn:li:activity:7307207388510486529"

author:

name:"Niko Heikkilä (he/him)"

headline:"Need help with Extreme Programming, DevOps, Lean, TDD, CI/CD, Clean Architecture? Don't ask AI, talk to me instead!"

urn:"ACoAAA81IdMBuGLlIoc6GTG14t9PC7BxlBNheqg"

id:"urn:li:member:255140307"

url:"https://www.linkedin.com/in/nikoheikkila"

profilePictureURL:"https://media.licdn.com/dms/image/v2/D4D03AQGI9VS2Bk6W0A/profile-displayphoto-shrink\_800\_800/profile-displayphoto-shrink\_800\_800/0/1712670317271?e=1747872000&v=beta&t=EkcmLb5exqyhUNFHLKSvxw5vFOlyyXr53Dumh4gwpZA"

postedAt:

timestamp:1742174002769

fullDate:"2025-03-17 01:13:22.00 +0000 UTC"

relativeDay:"2d"

edited:false

engagements:

totalReactions:84

commentsCount:31

repostsCount:3

reactions:

\[0\]:

reactionType:"LIKE"

reactionCount:67

\[1\]:

reactionType:"INTEREST"

reactionCount:6

\[2\]:

reactionType:"APPRECIATION"

reactionCount:5

\[3\]:

reactionType:"PRAISE"

reactionCount:4

\[4\]:

reactionType:"EMPATHY"

reactionCount:2

mediaContent:null

resharedPostContent:null

\[7\]:

header:"Mansoor Shaikh likes this"

text:"Hey junior developers! Here are 4 simple but powerful techniques you can use right now to reduce coupling in your code. - Separating concerns  - Using encapsulation together with data hiding - Strategic use of abstractions - Managing the direction of dependencies Mastering these will cover 80% of your coupling problems and all it takes is a good understanding of core software design concepts like cohesion, coupling and abstraction. #softwaredevelopment #softwareengineering #softwaredesign"

url:"https://www.linkedin.com/feed/update/urn:li:activity:7307207327588257792"

urn:"urn:li:activity:7307207327588257792"

author:

name:"Nicholas Ocket"

headline:"I turn developers into software design experts. Join the About Coding Dojo!"

urn:"ACoAAAzhhT4B4H7vT1JD-pD_rsqF1pLI0HGJBVs"

id:"urn:li:member:216106302"

url:"https://www.linkedin.com/in/nicholas-ocket"

profilePictureURL:"https://media.licdn.com/dms/image/v2/D4E03AQHsFqzeS7u-EQ/profile-displayphoto-shrink\_800\_800/profile-displayphoto-shrink\_800\_800/0/1699215002632?e=1747872000&v=beta&t=ScFT1XaIE-IWHNUkgYWH\_01jog5rEsGejqGmDHAXk28"

postedAt:

timestamp:1742173988244

fullDate:"2025-03-17 01:13:08.00 +0000 UTC"

relativeDay:"1w"

edited:false

engagements:

totalReactions:12

commentsCount:15

repostsCount:0

reactions:

\[0\]:

reactionType:"LIKE"

reactionCount:11

\[1\]:

reactionType:"INTEREST"

reactionCount:1

mediaContent:null

resharedPostContent:null

\[8\]:

header:"Mansoor Shaikh likes this"

text:"Last year my feed was inundated with people telling everyone how they are in awe with generative AI and how it's going to replace everyone in IT. A few people kept obstinately telling them they were wrong. Today it's kind of half and half, people complain about the shortfalls of AI and almost everybody in the comment section basically tells them they are stupid for not prompting it right. The same people that kept telling everyone else they were wrong now have statistical evidence that AI hasn't replace everyone in IT yet. Shoutout to Michael Bolton and James Bach, your articles and comments did what every other tester should have, fended the zealots off and told everyone the emperor was nude. Maybe now we can find a middle ground where people like Wayne Roseberry study the use of LLMs for what they were intended and stop anthropomorphizing code just so we can feed our egos and line our pockets. Just sayin..."

url:"https://www.linkedin.com/feed/update/urn:li:activity:7307207250572402688"

urn:"urn:li:activity:7307207250572402688"

author:

name:"Bogdan Stefan Plesa"

headline:"Quality Assurance Engineer"

urn:"ACoAAAll9uQBpcOsGyz3kJIDnoKyaNDXEcXxMrA"

id:"urn:li:member:157677284"

url:"https://www.linkedin.com/in/bogdanplesa"

profilePictureURL:"https://media.licdn.com/dms/image/v2/D4E03AQGdxrLZSBGk1g/profile-displayphoto-shrink\_800\_800/profile-displayphoto-shrink\_800\_800/0/1678197942070?e=1747872000&v=beta&t=Vnqo4JBNnrPvNeqVAc4CKkNYx1fO\_jcU65VzHEJdPfg"

postedAt:

timestamp:1742173969882

fullDate:"2025-03-17 01:12:49.00 +0000 UTC"

relativeDay:"1d"

edited:true

engagements:

totalReactions:11

commentsCount:8

repostsCount:0

reactions:

\[0\]:

reactionType:"LIKE"

reactionCount:9

\[1\]:

reactionType:"INTEREST"

reactionCount:2

mediaContent:null

resharedPostContent:null

reactedComment:

author:

name:"Anna Royzman"

headline:"Technology Leader | International Speaker & Trainer | Quality Leadership Visionary►Organizing groundbreaking conferences"

urn:"ACoAAACjHO8BByaqqyWvp4tYmzHy77ZTO1ZiQnA"

id:"urn:li:member:10689775"

url:"https://www.linkedin.com/in/anna-royzman"

profilePictureURL:"https://media.licdn.com/dms/image/v2/C4E03AQEsre0daT75Gg/profile-displayphoto-shrink\_800\_800/profile-displayphoto-shrink\_800\_800/0/1575307514572?e=1747872000&v=beta&t=o3sLTxyDpLM6MdpJCvXpdiOy3EVmly\_r37gX8\_zYE6Q"

comment:"Bogdan Stefan Plesa i had the same experience with AI enhanced app generating sites. In general, I find that many ai-enhanced apps are just as non user-friendly as the ones without it."

createdAt:1742086005855

permalink:"https://www.linkedin.com/feed/update/urn:li:activity:7306822871819939840?commentUrn=urn%3Ali%3Acomment%3A%28activity%3A7306822871819939840%2C7306830387287130112%29&replyUrn=urn%3Ali%3Acomment%3A%28activity%3A7306822871819939840%2C7306838302697902081%29&dashCommentUrn=urn%3Ali%3Afsd\_comment%3A%287306830387287130112%2Curn%3Ali%3Aactivity%3A7306822871819939840%29&dashReplyUrn=urn%3Ali%3Afsd\_comment%3A%287306838302697902081%2Curn%3Ali%3Aactivity%3A7306822871819939840%29"

edited:false

engagements:

totalReactions:0

commentsCount:0

repostsCount:0

reactions:null

\[9\]:

header:"Mansoor Shaikh likes this"

text:"We’re hiring for Partner Solution Architects at Docusign Bengaluru. If you thrive on connecting the dots, crafting smart solutions, and making tech magic happen, this role might have your name on it. Curious? Let’s talk! #hiring"

url:"https://www.linkedin.com/feed/update/urn:li:activity:7307207002001178625"

urn:"urn:li:activity:7307207002001178625"

author:

name:"Amrit Prakash"

headline:"Senior Partner Solutions Architect @ Docusign | MBA in Marketing and Digital l ex-Adobe"

urn:"ACoAACY6PeMBw4HJnsF8A_DPuAJhPbgUcoVmXuQ"

id:"urn:li:member:641351139"

url:"https://www.linkedin.com/in/amritvprakash"

profilePictureURL:"https://media.licdn.com/dms/image/v2/D5603AQH8KVktwT86Xg/profile-displayphoto-shrink\_400\_400/profile-displayphoto-shrink\_400\_400/0/1713703712602?e=1747872000&v=beta&t=2-6kJfupCa9XT8ZxF2CUceOS3r38Z7Mb4mkgXzpEYAI"

postedAt:

timestamp:1742173910618

fullDate:"2025-03-17 01:11:50.00 +0000 UTC"

relativeDay:"1w"

edited:false

engagements:

totalReactions:25

commentsCount:3

repostsCount:5

reactions:

\[0\]:

reactionType:"LIKE"

reactionCount:24

\[1\]:

reactionType:"APPRECIATION"

reactionCount:1

mediaContent:null

resharedPostContent:null

\[10\]:

header:"Mansoor Shaikh likes this"

text:"The people who claim they will replace devs with LLMs also sell LLMs. Someone should look into that."

url:"https://www.linkedin.com/feed/update/urn:li:activity:7307206771016671232"

urn:"urn:li:activity:7307206771016671232"

author:

name:"David Forrest"

headline:"Writer and software developer"

urn:"ACoAAAY0UKcBnrSaljKMdFlu8fuUzCgfxx53ulw"

id:"urn:li:member:104091815"

url:"https://www.linkedin.com/in/david-forrest-39ba3a2a"

profilePictureURL:"https://media.licdn.com/dms/image/v2/C4D03AQFAsuwGD591pw/profile-displayphoto-shrink\_800\_800/profile-displayphoto-shrink\_800\_800/0/1517617831835?e=1747872000&v=beta&t=jGfvl3bNSMVOOEEraPszkxB5z2Skl-kXIRD6oWOsUpg"

postedAt:

timestamp:1742173855547

fullDate:"2025-03-17 01:10:55.00 +0000 UTC"

relativeDay:"17h"

edited:false

engagements:

totalReactions:18

commentsCount:3

repostsCount:1

reactions:

\[0\]:

reactionType:"LIKE"

reactionCount:9

\[1\]:

reactionType:"ENTERTAINMENT"

reactionCount:8

\[2\]:

reactionType:"EMPATHY"

reactionCount:1

mediaContent:null

resharedPostContent:null

\[11\]:

header:"Mansoor Shaikh likes this"

text:"When the AI-generated solution fails, can you fix it? If a dev's workflow starts looking like "Prompt -> Copy-Paste -> Ship", what happens when they encounter a problem AI can't solve? Deep debugging, critical thinking, and system design are skills we can't fully outsource to AI, yet. I’m seeing more devs lean on AI-generated code without fully understanding the mechanics. And I've seen this before: copying code from Stack Overflow without fully understanding it. But AI isn't just giving snippets, it's generating entire solutions. Want to stay ahead and grow as a dev? Don't just copy, ask AI to explain the solution before using it. If you can’t understand or verify the explanation, you shouldn’t ship it. AI should accelerate learning, not replace it."

url:"https://www.linkedin.com/feed/update/urn:li:activity:7307206727307845632"

urn:"urn:li:activity:7307206727307845632"

author:

name:"Stefan Olaru"

headline:"CTO | Architect | AWS | Serverless"

urn:"ACoAAAEkWqUBy6LHBoL_iAQZLXdqEtn2Nkkgcg0"

id:"urn:li:member:19159717"

url:"https://www.linkedin.com/in/stefanolaru"

profilePictureURL:"https://media.licdn.com/dms/image/v2/C4D03AQHl5XLNjDVXNQ/profile-displayphoto-shrink\_800\_800/profile-displayphoto-shrink\_800\_800/0/1579790966114?e=1747872000&v=beta&t=in3yktm0aDi8dVe7KjOwpNdXLbCHq5\_qP0bbaZC9ijw"

postedAt:

timestamp:1742173845126

fullDate:"2025-03-17 01:10:45.00 +0000 UTC"

relativeDay:"4d"

edited:false

engagements:

totalReactions:8

commentsCount:1

repostsCount:0

reactions:

\[0\]:

reactionType:"LIKE"

reactionCount:8

mediaContent:null

resharedPostContent:null

\[12\]:

header:"Mansoor Shaikh likes this"

text:"This boardroom is ideal for fast decision-making and effective communication. #technology #workplace #management Follow me if you are looking for an honest, pragmatic and funny perspective on technology. Hit the 🔔 on my profile to get a notification for all my new posts."

url:"https://www.linkedin.com/feed/update/urn:li:activity:7307206546709504000"

urn:"urn:li:activity:7307206546709504000"

author:

name:"Ralph Aboujaoude Diaz"

headline:"Global Head - Product and Operations Cybersecurity"

urn:"ACoAAAK5cogB0wz9h4jk2giGcg821baQkx7MXI0"

id:"urn:li:member:45707912"

url:"https://www.linkedin.com/in/ralph-aboujaoude-diaz-40838313"

profilePictureURL:"https://media.licdn.com/dms/image/v2/D4D03AQH8S22M9O8-WA/profile-displayphoto-shrink\_800\_800/profile-displayphoto-shrink\_800\_800/0/1712181489465?e=1747872000&v=beta&t=-xtxEAlMuAItpBX\_xXICrv4RtMTEu2fVcrzEq8dtQOc"

postedAt:

timestamp:1742173802068

fullDate:"2025-03-17 01:10:02.00 +0000 UTC"

relativeDay:"19h"

edited:false

engagements:

totalReactions:2565

commentsCount:247

repostsCount:51

reactions:

\[0\]:

reactionType:"LIKE"

reactionCount:1333

\[1\]:

reactionType:"ENTERTAINMENT"

reactionCount:1107

\[2\]:

reactionType:"EMPATHY"

reactionCount:57

\[3\]:

reactionType:"INTEREST"

reactionCount:37

\[4\]:

reactionType:"PRAISE"

reactionCount:23

\[5\]:

reactionType:"APPRECIATION"

reactionCount:8

mediaContent:

\[0\]:

type:"image"

url:"https://media.licdn.com/dms/image/v2/D4D22AQEUFnt3syCkHw/feedshare-shrink\_2048\_1536/B4DZWfuM3IHAAo-/0/1742141444333?e=1744848000&v=beta&t=wEOusfNDmLm3vlj\_bXaD7VoIKQWkPDHb\_CKGLkKbwmo"

resharedPostContent:null

\[13\]:

header:"Mansoor Shaikh likes this"

text:"The final 10% of any software engineering project takes 90% of the time. We all know that. But... So does the final 1% somehow. 😣"

url:"https://www.linkedin.com/feed/update/urn:li:activity:7307100514997952513"

urn:"urn:li:activity:7307100514997952513"

author:

name:"Matt Watson"

headline:"Product Driven Engineer, Founder/CTO for 20 years, Bootstrapped a SaaS company to a 9 figure exit, CEO of Full Scale"

urn:"ACoAAAAwlmsBBjRA9j-BTPSkS-\_YSkbDtj5vi8o"

id:"urn:li:member:3184235"

url:"https://www.linkedin.com/in/mattwatsonkc"

profilePictureURL:"https://media.licdn.com/dms/image/v2/C4E03AQEQlNsDbIUy6w/profile-displayphoto-shrink\_800\_800/profile-displayphoto-shrink\_800\_800/0/1651801144223?e=1747872000&v=beta&t=WFLDa8rEVmg8dY4dX2kNHOxQp1ZK3jE1xw6\_PBbpqPE"

postedAt:

timestamp:1742148522138

fullDate:"2025-03-16 18:08:42.00 +0000 UTC"

relativeDay:"1d"

edited:false

engagements:

totalReactions:48

commentsCount:14

repostsCount:1

reactions:

\[0\]:

reactionType:"LIKE"

reactionCount:38

\[1\]:

reactionType:"ENTERTAINMENT"

reactionCount:5

\[2\]:

reactionType:"APPRECIATION"

reactionCount:4

\[3\]:

reactionType:"INTEREST"

reactionCount:1

mediaContent:null

resharedPostContent:null

\[14\]:

header:"Mansoor Shaikh likes this"

text:"Are you ready for a faster Hugging Face? 🏃‍♀️💨 Do you want to be among the first to try the future? We are replacing LFS with Xet, the HF Hub's new 10x more performant storage technology. It's built to dramatically accelerate both uploads and downloads on the Hub. We've already migrated a few historical repos so you can already see how it looks: bigscience/bloom for instance. Join the waitlist then let us know how much faster the Hub is for your workloads 🔥 https://lnkd.in/emu6MN9e"

url:"https://www.linkedin.com/feed/update/urn:li:activity:7307100508995907584"

urn:"urn:li:activity:7307100508995907584"

author:

name:"Julien Chaumond"

headline:"CTO at Hugging Face"

urn:"ACoAAACGArQBeIsShtJCKN3fD399YabWHlFXTLc"

id:"urn:li:member:8782516"

url:"https://www.linkedin.com/in/julienchaumond"

profilePictureURL:"https://media.licdn.com/dms/image/v2/C4E03AQGewM4n-hRq2w/profile-displayphoto-shrink\_800\_800/profile-displayphoto-shrink\_800\_800/0/1551194736724?e=1747872000&v=beta&t=gAbmRie80WnyOtwcBZeV6zIihsBedrpmoAvjt8AOqus"

postedAt:

timestamp:1742148520707

fullDate:"2025-03-16 18:08:40.00 +0000 UTC"

relativeDay:"23h"

edited:false

engagements:

totalReactions:993

commentsCount:33

repostsCount:35

reactions:

\[0\]:

reactionType:"LIKE"

reactionCount:814

\[1\]:

reactionType:"PRAISE"

reactionCount:87

\[2\]:

reactionType:"EMPATHY"

reactionCount:69

\[3\]:

reactionType:"INTEREST"

reactionCount:18

\[4\]:

reactionType:"APPRECIATION"

reactionCount:5

mediaContent:

\[0\]:

type:"image"

url:"https://media.licdn.com/dms/image/v2/D4E22AQHFAIK3yG7\_Ig/feedshare-shrink\_2048\_1536/B4EZWe1cJeHgAs-/0/1742126565578?e=1744848000&v=beta&t=eHduUG4bkAlFOTFP6P0DLVOnBjuWl3r4f4Sb6SkwmWA"

resharedPostContent:null

\[15\]:

header:"Mansoor Shaikh likes this"

text:"Hi friends and connections, I’m seeking new opportunities and would appreciate your support. If you hear of any opportunities or just want to catch up, please send me a message or comment below. I’d love to reconnect. About me & what I’m looking for: 💼 I’m looking for Quality Engineering Specialist / Quality Engineer / Test Specialist / Software Engineer in Test / Senior Test Engineer roles. 🌎 I’m open to roles in Singapore. ⭐ I’ve previously worked at Quest Global, SP Group and Accenture. Do let me know if you know of any companies hiring such roles in Singapore, or if you can help with referrals for such roles at your organisation - that would be of great help :) Please comment or like this post to spread the message. Thank you for your help! #OpenToWork #JobSearch #Singapore"

url:"https://www.linkedin.com/feed/update/urn:li:activity:7307100235334348800"

urn:"urn:li:activity:7307100235334348800"

author:

name:"Rewati Joshi"

headline:"Test Automation Lead"

urn:"ACoAABbygBkBgN5gVoHIPKhePi7NbrAmqy797HA"

id:"urn:li:member:384991257"

url:"https://www.linkedin.com/in/revati-joshi"

profilePictureURL:"https://media.licdn.com/dms/image/v2/D5635AQEA7S69m3poZQ/profile-framedphoto-shrink\_800\_800/profile-framedphoto-shrink\_800\_800/0/1736686065475?e=1742817600&v=beta&t=SJVzyiRlr8mzMk431eNgAmuOWy4uA0PWn-DjACD72WY"

postedAt:

timestamp:1742148455461

fullDate:"2025-03-16 18:07:35.00 +0000 UTC"

relativeDay:"4d"

edited:false

engagements:

totalReactions:40

commentsCount:3

repostsCount:5

reactions:

\[0\]:

reactionType:"LIKE"

reactionCount:30

\[1\]:

reactionType:"APPRECIATION"

reactionCount:10

mediaContent:null

resharedPostContent:null

\[16\]:

header:"Mansoor Shaikh likes this"

text:"The hardest part about business is the part nobody ever talks about: business partners. I talked to a friend yesterday who tragically found out one his partners had stolen hundreds of thousands of dollars from the company and was being abusive to employees. These stories are not actually that rare. I've had my own problems with business partners that could have easily tanked my companies. Be careful you who you get into business with. Founder's vesting stock is a good thing."

url:"https://www.linkedin.com/feed/update/urn:li:activity:7307100093969539072"

urn:"urn:li:activity:7307100093969539072"

author:

name:"Matt Watson"

headline:"Product Driven Engineer, Founder/CTO for 20 years, Bootstrapped a SaaS company to a 9 figure exit, CEO of Full Scale"

urn:"ACoAAAAwlmsBBjRA9j-BTPSkS-\_YSkbDtj5vi8o"

id:"urn:li:member:3184235"

url:"https://www.linkedin.com/in/mattwatsonkc"

profilePictureURL:"https://media.licdn.com/dms/image/v2/C4E03AQEQlNsDbIUy6w/profile-displayphoto-shrink\_800\_800/profile-displayphoto-shrink\_800\_800/0/1651801144223?e=1747872000&v=beta&t=WFLDa8rEVmg8dY4dX2kNHOxQp1ZK3jE1xw6\_PBbpqPE"

postedAt:

timestamp:1742148421757

fullDate:"2025-03-16 18:07:01.00 +0000 UTC"

relativeDay:"6d"

edited:false

engagements:

totalReactions:25

commentsCount:17

repostsCount:0

reactions:

\[0\]:

reactionType:"LIKE"

reactionCount:19

\[1\]:

reactionType:"EMPATHY"

reactionCount:2

\[2\]:

reactionType:"APPRECIATION"

reactionCount:2

\[3\]:

reactionType:"INTEREST"

reactionCount:2

mediaContent:null

resharedPostContent:null

\[17\]:

header:"Mansoor Shaikh likes this"

text:"On Friday evening I landed at Newark Liberty Airport after my 20+ hours of travel. I was coming from Hyderabad, India where I had the privilege to spend the week at JPMorganChase Developer’s Conference - DEVUP where I had the honor of kicking off Track 2: Delivering Data & AI/ML Responsibly at Speed and Scale at the opening ceremony. DEVUP proved to be amazing once again from the amazing people I met to the content I learned I know I will leverage with my team starting on Monday! Thank you to the DEVUP Crew, Global Technology Leadership Team, India Leadership Team and Speakers for peaking my curiosity, peaking my interest in hit technology topics and lighting a fire that continues to spark innovation and creativity for months to come. #DEVUP #JPMC"

url:"https://www.linkedin.com/feed/update/urn:li:activity:7307099982786928640"

urn:"urn:li:activity:7307099982786928640"

author:

name:"Stacy Newman"

headline:"Executive Director, AI/ML Employee Data Experience; JPMC Prolific Inventor"

urn:"ACoAAAFO0usBw2ZonJMI-AWdgeDL1sRQqINY4P0"

id:"urn:li:member:21943019"

url:"https://www.linkedin.com/in/stacyanewman"

profilePictureURL:"https://media.licdn.com/dms/image/v2/D4E03AQGLtsa4i5FNcA/profile-displayphoto-shrink\_800\_800/profile-displayphoto-shrink\_800\_800/0/1724944654596?e=1747872000&v=beta&t=4pFBhzfqjNUIq1mJaZcOq2WZ2B40e0-HlAojGjvLeUE"

postedAt:

timestamp:1742148395249

fullDate:"2025-03-16 18:06:35.00 +0000 UTC"

relativeDay:"18h"

edited:false

engagements:

totalReactions:61

commentsCount:3

repostsCount:0

reactions:

\[0\]:

reactionType:"LIKE"

reactionCount:47

\[1\]:

reactionType:"PRAISE"

reactionCount:7

\[2\]:

reactionType:"EMPATHY"

reactionCount:7

mediaContent:

\[0\]:

type:"video"

url:"https://dms.licdn.com/playlist/vid/v2/D4E05AQFOWac1YzwX9Q/mp4-720p-30fp-crf28/B4EZWf.CvYHgBg-/0/1742145672076?e=1742817600&v=beta&t=kV8Us5E5oBC4heGH-h5L-C1fTeRC\_-0Xmygjvot8qdY"

resharedPostContent:null
