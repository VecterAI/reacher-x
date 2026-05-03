# API Documentation - LinkdAPI

## API Documentation

Professional data API for developers

[Getting Started](/docs/intro)[Pricing](/docs/endpoints-cost)

GET

## Posts

[Try it](/playground?endpoint=%2Fapi%2Fv1%2Fsearch%2Fposts&folder=Search)

1 credit

search Posts (all filters available)

`/api/v1/search/posts?keyword=google&start=0&authorJobTitle=founder&datePosted=past-24h&sortBy=relevance`

### Query Parameters

`keyword`

string

Example:`google`

`start`

integer

Example:`0`

`authorCompany`

integer

Company ID

`authorIndustry`

string

industries ID

`authorJobTitle`

string

can be any title

Example:`founder`

`contentType`

string

can be "videos" or "photos" or "jobs" or "liveVideos" or "documents" or "collaborativeArticles"

`datePosted`

string

can be "past-24h" "past-week" "past-month" "past-year"

Example:`past-24h`

`fromMember`

string

profile URN

`fromOrganization`

string

Companies ID e.g "1337,1441"

`mentionsMember`

string

profiles URN e.g "ACoAAAAKXBwBikfbNJww68eYvcu2dqDYJhHbp4g"

`mentionsOrganization`

string

Companies ID e.g "1337,1441"

`sortBy`

string

either "relevance" or "date_posted"

Example:`relevance`

### Response Schema

Field

Type

Description

`posts`

array<object>

List of content posts

`urn`

string

uri

Unique internal identifier used for detailed profile queries

`postID`

string

utc-millisec

`postURL`

string

uri

URL link to this resource

`text`

string

style

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

`total`

integer

Total number of results available

`start`

integer

Pagination offset index

`count`

integer

Number of results in this page

`hasMore`

boolean

Whether more results are available via pagination

### Example Response

InteractiveRaw JSONCode

success:true

statusCode:200

message:"Data retrieved successfully"

errors:null

data:

posts:

\[0\]:

urn:"urn:li:activity:7391117514539429889"

postID:"7391117514539429889"

postURL:"https://www.linkedin.com/feed/update/urn:li:activity:7391117514539429889"

text:"Google's automation turned qualified leads into garbage. Google wants you on automated bidding immediately. They promise efficiency. They deliver volume. But a lot of that volume is unqualified. Without the right data, Google optimizes for whoever fills a form. Students. Competitors. People looking for jobs. Our process: 1. Manual bidding for first 60 days 2. Identify which leads become opportunities 3. Feed that data back to Google 4. Only then enable automation     One company using "maximize conversions" from day one was drowning in junk. Switched to our approach. Cost per qualified meeting dropped from $6,667 to $540. Automation without intelligence is expensive stupidity."

author:

name:"Scott Gelber"

headline:"Founder @ SRG Marketing | Helping Services and SaaS generate qualified sales opportunities with Google Ads | $3M+ pipeline generated for clients since 2023"

urn:"ACoAAAzCbYMBmCyaAqmF422UgTy1Uu25zlUrPgw"

id:"urn:li:member:214068611"

url:"https://www.linkedin.com/in/scott-gelber-36b8365b"

profilePictureURL:"https://media.licdn.com/dms/image/v2/C4D03AQHQNLXUoA7G8g/profile-displayphoto-shrink\_400\_400/profile-displayphoto-shrink\_400\_400/0/1528132973709?e=1763596800&v=beta&t=RT-qoyr\_b55Q\_kSZ5P0tWLFIIMqFeuIcz3BLexdsYLo"

postedAt:

timestamp:1762179735789

fullDate:"2025-11-03 14:22:15.00 +0000 UTC"

relativeDay:"1h"

engagements:

totalReactions:6

commentsCount:2

repostsCount:0

reactions:

\[0\]:

reactionType:"LIKE"

reactionCount:6

mediaContent:

\[0\]:

type:"video"

url:"https://dms.licdn.com/playlist/vid/v2/D4E05AQHuFfVR0WN8Cg/mp4-720p-30fp-crf28/B4EZpKGCtBKoBw-/0/1762179732496?e=1762790400&v=beta&t=rnrh2RHUMD1E\_Vhzi89DmSWdj8Aku1ankIlKdtyiCQs"

\[1\]:

urn:"urn:li:activity:7391021240167198720"

postID:"7391021240167198720"

postURL:"https://www.linkedin.com/feed/update/urn:li:activity:7391021240167198720"

text:"Hôm qua ngồi vọc Pomelli - AI tạo chiến dịch marketing chỉ từ 1 link website nhờ sao chép và phân tích DNA thương hiệu của bạn của Google vừa ra mắt, Thảo quay sang bảo bạn trong team: "Kiểu này các marketers, chắc khóc thét!" 👉 Bài phân tích đầy đủ bên dưới, mời anh em cùng đọc và thử ngay nhé! AI Leaders Vietnam - the first AI Agency in Vietnam #Marketing #AI #GooglePomelli #AIMarketing"

author:

name:"Le Uyen Thao"

headline:"🇻🇳🌟Innovation Lady | Vice Chair VNIDA| AI Expert |Manus AI Fellow |🏆National Champion at TECHFEST VN 2024 | ex-Unilever |ex- Vinamilk | FMCG Expert | Lifelong learner | 150.000 followers"

urn:"ACoAABYrFkMBC7rsx_EOLFLBZrG7-N-IDnL2aCQ"

id:"urn:li:member:371922499"

url:"https://www.linkedin.com/in/le-uyen-thao-b17680a4"

profilePictureURL:"https://media.licdn.com/dms/image/v2/D5603AQF05Cqqq2l2Uw/profile-displayphoto-shrink\_800\_800/B56ZesyiKDH8Ak-/0/1750950618832?e=1763596800&v=beta&t=iTxixaCGTWZK\_XIWGmSgkC1xcpDfXSw1-m9fO2NAmiE"

postedAt:

timestamp:1762156782190

fullDate:"2025-11-03 07:59:42.00 +0000 UTC"

relativeDay:"7h"

engagements:

totalReactions:14

commentsCount:0

repostsCount:0

reactions:

\[0\]:

reactionType:"LIKE"

reactionCount:11

\[1\]:

reactionType:"PRAISE"

reactionCount:3

mediaContent:

\[0\]:

type:"article"

url:"https://www.linkedin.com/pulse/pomelli-%25C3%25A1t-ch%25E1%25BB%25A7-b%25C3%25A0i-m%25E1%25BB%259Bi-t%25E1%25BB%25AB-google-t%25C3%25A1i-%25C4%2591%25E1%25BB%258Bnh-v%25E1%25BB%258B-vai-tr%25C3%25B2-marketers-thao-4jgdc?trackingId=26MHzve5TjeiG2yEGGgGKQ%3D%3D"

\[2\]:

urn:"urn:li:activity:7391014751109201920"

postID:"7391014751109201920"

postURL:"https://www.linkedin.com/feed/update/urn:li:activity:7391014751109201920"

text:"HOLY SH\*T... These AI Sales Agents do EVERYTHING 🤯 The same systems agencies charge $12K+ to build all packed inside Airtop.ai These AI agents handle it all: → Monitoring competitor activities  → Automating ICP scoring → Scraping news articles straight into Google Sheets → Turning any webpage into social posts → Extracting Instagram profile data → Collecting event speaker info in seconds → …and tons more automations All in one plug-and-play template library. To customize each agent, just chat with an Airtop’s Agent Builder. Anyone can do it! Want free access to Airtop’s Starter Plan? 1️⃣ Like this post 2️⃣ Comment “SEND” below  (must be connected) I might not be able to reply to everyone. Repost for priority access. P.S. No fluff. These are real workflows running inside our company You can clone them in minutes."

author:

name:"Divyanshi Sharma"

headline:"Your go-to for GTM, AI & Lead gen!"

urn:"ACoAADIWFJcBj5zbsAjb1mDBIFOlmqfumfLSZqs"

id:"urn:li:member:840307863"

url:"https://www.linkedin.com/in/divyanshis-saasleadgen"

profilePictureURL:"https://media.licdn.com/dms/image/v2/D4D03AQEURyQBRjrvSQ/profile-displayphoto-shrink\_800\_800/profile-displayphoto-shrink\_800\_800/0/1691938389426?e=1763596800&v=beta&t=\_7jCAy4S4XVpaPEP1kdzjxm4sNw5Uso\_GPwI1YbooY0"

postedAt:

timestamp:1762155235078

fullDate:"2025-11-03 07:33:55.00 +0000 UTC"

relativeDay:"8h"

engagements:

totalReactions:176

commentsCount:389

repostsCount:5

reactions:

\[0\]:

reactionType:"LIKE"

reactionCount:155

\[1\]:

reactionType:"EMPATHY"

reactionCount:11

\[2\]:

reactionType:"PRAISE"

reactionCount:6

\[3\]:

reactionType:"APPRECIATION"

reactionCount:2

\[4\]:

reactionType:"INTEREST"

reactionCount:2

mediaContent:

\[0\]:

type:"image"

url:"https://media.licdn.com/dms/image/v2/D5622AQH0GLFajWQWGw/feedshare-shrink\_2048\_1536/B56ZpIn7BuJQA0-/0/1762155126718?e=1763596800&v=beta&t=YJkKbgMf2G58oXXs8-E1B73QOgvlUT2FISybfRCahjI"

\[3\]:

urn:"urn:li:activity:7390792498127851520"

postID:"7390792498127851520"

postURL:"https://www.linkedin.com/feed/update/urn:li:activity:7390792498127851520"

text:"We don't need Google Dorks where we're going. I built Feynman because I was tired of piecing together OSINT tools and having a million tabs open, I'm sure boudjenane soufiane can relate so I built my own tool, which was certainly not easy in the beginning. It's intended for targeting and general open source investigations. What started as frustration turned into something I'm actually proud of. The video highlights how fast it is to pivot on publicly available information, this is a simple investigation into a Brazilian business. Watch how fast good tooling moves. This is what happens when programming meets open source intelligence and it's something anyone can achieve. #OSINT #HackThePlanet #InfoSec #Brazil #SIGINT #AI"

author:

name:"Vance Poitier"

headline:"Founder/CTO @ Stratir | Polymath"

urn:"ACoAAB6hvHwBrBg_2-w1P8AKzfllyxbrs-rfEGE"

id:"urn:li:member:513916028"

url:"https://www.linkedin.com/in/vance-poitier"

profilePictureURL:"https://media.licdn.com/dms/image/v2/D4E03AQG2kraFQoFsbQ/profile-displayphoto-crop\_800\_800/B4EZmgEdzcKYAM-/0/1759327150979?e=1763596800&v=beta&t=KFM858lYWtgaZ\_8T9XWbu\_6akGfVwplSdbHZhmB0jhE"

postedAt:

timestamp:1762102245838

fullDate:"2025-11-02 16:50:45.00 +0000 UTC"

relativeDay:"22h"

engagements:

totalReactions:101

commentsCount:16

repostsCount:10

reactions:

\[0\]:

reactionType:"LIKE"

reactionCount:83

\[1\]:

reactionType:"INTEREST"

reactionCount:8

\[2\]:

reactionType:"EMPATHY"

reactionCount:6

\[3\]:

reactionType:"PRAISE"

reactionCount:3

\[4\]:

reactionType:"APPRECIATION"

reactionCount:1

mediaContent:

\[0\]:

type:"video"

url:"https://dms.licdn.com/playlist/vid/v2/D4E05AQELkF89Xhk-Kw/mp4-720p-30fp-crf28/B4EZpFd4R1GUBw-/0/1762102241265?e=1762790400&v=beta&t=XtQ14v8MnzACxYYll8f0rU2PA758a4eIEPoSN8uxQA4"

\[4\]:

urn:"urn:li:activity:7390923173137059840"

postID:"7390923173137059840"

postURL:"https://www.linkedin.com/feed/update/urn:li:activity:7390923173137059840"

text:"My kids: “Wait… you typed everything? Word by word? No Google Translate??” Yup. Every. Single. Word. Painfully on Microsoft Word. Then manually translated it into Bahasa. It was my final year project more than 20 years ago — something I’d completely forgotten about until I found the old files today. And guess what it was about? Computer agents that could buy and sell stuff automatically on behalf of humans. Basically… AI Agents before AI Agents were cool. The tech? COM/DCOM, MSMQ — all fossils now. But the concept? Pretty much what I spend my days working on right now Back then it took me months (and probably a few sleepless nights). Today, an AI Agent could probably write the whole thing in five minutes. Wild how life loops back — What a time to be alive🚀"

author:

name:"Subash Palani"

headline:"Founder of Unstructured | I turn Teams into Startups | Council Member, MBAN"

urn:"ACoAAARClhYBzxLX1q6Qis4gGsPtRPmZ4QzKg8U"

id:"urn:li:member:71472662"

url:"https://www.linkedin.com/in/subash-palani"

profilePictureURL:"https://media.licdn.com/dms/image/v2/D5603AQGzRqVW96rwrw/profile-displayphoto-crop\_800\_800/B56ZmQEtJoJwAI-/0/1759058778864?e=1763596800&v=beta&t=koC3UPS3WtjauvaRyeFoqKw08QPQn11Q5smtheVpVHA"

postedAt:

timestamp:1762133401188

fullDate:"2025-11-03 01:30:01.00 +0000 UTC"

relativeDay:"14h"

engagements:

totalReactions:42

commentsCount:22

repostsCount:0

reactions:

\[0\]:

reactionType:"LIKE"

reactionCount:33

\[1\]:

reactionType:"EMPATHY"

reactionCount:3

\[2\]:

reactionType:"PRAISE"

reactionCount:3

\[3\]:

reactionType:"INTEREST"

reactionCount:2

\[4\]:

reactionType:"ENTERTAINMENT"

reactionCount:1

mediaContent:

\[0\]:

type:"image"

url:"https://media.licdn.com/dms/image/v2/D5622AQGQNAS07NrotQ/feedshare-shrink\_2048\_1536/B56ZpE59upJYAw-/0/1762092637636?e=1763596800&v=beta&t=PJJf6P-\_NaQM3hWJetBWWv8wLIkjLA8EfwlYcAyU1jw"

\[1\]:

type:"image"

url:"https://media.licdn.com/dms/image/v2/D5622AQEnJWCgm-73FQ/feedshare-shrink\_1280/B56ZpE59uaJkFk-/0/1762092637608?e=1763596800&v=beta&t=UGrlUoJQNZKHlgYxb3Ayp5qEV-J4W8XVWooyR9NFLpg"

\[2\]:

type:"image"

url:"https://media.licdn.com/dms/image/v2/D5622AQHAtw6sL1JEOw/feedshare-shrink\_2048\_1536/B56ZpE59ufG4Aw-/0/1762092637648?e=1763596800&v=beta&t=FtryG5Efok-ez4MXTEz2F-MInqTZ1qjp45XGMdFMbxs"

\[5\]:

urn:"urn:li:activity:7390964950204297216"

postID:"7390964950204297216"

postURL:"https://www.linkedin.com/feed/update/urn:li:activity:7390964950204297216"

text:"The biggest startup mistake of 2025: Trying to "disrupt" everything instead of connecting what already works. (This shift will make or break your startup in 2026) Here's what I'm seeing: Every founder thinks they need to reinvent the wheel. But users don't want disruption anymore. They want their 100+ tools to actually talk to each other. The winners aren't breaking industries. They're connecting them. ↳ Linear didn't disrupt project management. It made design + engineering + tracking seamless. ↳ Notion didn't kill docs. It connected documents + tasks + databases under one roof. ↳ Perplexity didn't out-build Google. It merged search + AI conversation perfectly. The pattern? Coherence beats disruption. Why coherence wins: • Lower friction = faster adoption • Deeper integration = higher retention   • Network effects through connectivity Disruption forces behavior change. Coherence adapts to existing behavior. That's why it scales faster. In 2026, ask yourself: "What's already working that I can amplify?" "Where does friction exist between tools?" "What workflow could I make invisible?" The next unicorns won't shout "We're different!" They'll whisper "We work better with everything you already use." Stop trying to break things. Start connecting them. --- 🧠 Follow me for more AI insights, software, startups. 💬 DM “startup” for a COMPLETELY FREE evaluation of your startup. Stop building products nobody uses. (or just book a call, link below 👇.)"

author:

name:"Matas Rimkus 🧠"

headline:"I help tech startups build products that reach millions of users. | Founder w/ 2 apps sold | AI Automation Wizard | 3 books published | TEDx speaker | DM “startup” for free value"

urn:"ACoAAFJqpQ4BNvU9FxDLjA9C9C4PMTHa7_KVIZc"

id:"urn:li:member:1382720782"

url:"https://www.linkedin.com/in/rimk"

profilePictureURL:"https://media.licdn.com/dms/image/v2/D4E03AQGHGmmBtz5F4A/profile-displayphoto-crop\_800\_800/B4EZoztX1ZIwAI-/0/1761804125951?e=1763596800&v=beta&t=oqhhpuoS1xraaJW7QpFjP2W1PMGID2k1zA3Cjd0lWz8"

postedAt:

timestamp:1762143361617

fullDate:"2025-11-03 04:16:01.00 +0000 UTC"

relativeDay:"11h"

engagements:

totalReactions:7

commentsCount:1

repostsCount:0

reactions:

\[0\]:

reactionType:"LIKE"

reactionCount:6

\[1\]:

reactionType:"EMPATHY"

reactionCount:1

mediaContent:

\[0\]:

type:"article"

url:"https://www.linkedin.com/pulse/successful-startups-connect-existing-tools-betterway-matas-rimkus--stwte?trackingId=wruWj8sZTKGquxflwBdNeQ%3D%3D"

\[6\]:

urn:"urn:li:activity:7391106475315589120"

postID:"7391106475315589120"

postURL:"https://www.linkedin.com/feed/update/urn:li:activity:7391106475315589120"

text:"Your traffic didn’t ghost you. Google’s AI did. If your analytics look quieter this month, it’s not your Wi-Fi. Google quietly changed how travelers find hotels, vacation rentals, and destinations... and the ripple effects are already here. Meet AI Overviews, Google’s feature that summarizes entire web pages before anyone clicks a link. It scrapes information from multiple sources, compiles an instant answer, and gives travelers what they need right on the results page. Great for guests. Brutal for clicks. Here’s what the data says: Ahrefs: 34% lower click-through rate when AI Overviews appear Amsive: 15% CTR drop across 700,000 keywords Pew Research: Users click links just 8% of the time when summaries appear, down from 15% That’s not a dip. That’s a search earthquake. And yet — being in the AI Overview still matters. It means your brand has authority, credibility, and structure strong enough for Google to cite. So the new game isn’t just ranking high. It’s being referenced first. Here’s what every hotel, rental, and destination team should know: Authority wins. Structured, trustworthy content gets pulled into AI summaries. Reviews talk. Google’s AI now performs sentiment analysis, surfacing themes (good or bad) right inside summaries. Big brands dominate. Smaller operators need backlinks, partnerships, and distinctive local stories to compete. Visibility ≠ Bookings. Impressions still matter, but only if your content and reputation drive action. This isn’t the end of SEO. It’s the start of search interpretation. And in that world, genuine storytelling and credibility are the only ranking factors that never change. Because hospitality storytelling, grounded in people and place, is the kind of content AI can’t fake. Curious where your property stands in this new AI landscape? Link in the comments."

author:

name:"Kay Walten"

headline:"AI for Hospitality | Direct Bookings, Guest Experience & Destination Marketing for Indie Hotels + Vacation Rentals"

urn:"ACoAAARbvdEBtYwF5GhOovEJTuzJgM0ancUVS2c"

id:"urn:li:member:73121233"

url:"https://www.linkedin.com/in/kaywalten"

profilePictureURL:"https://media.licdn.com/dms/image/v2/D4E03AQFRij4igTs9Pw/profile-displayphoto-crop\_800\_800/B4EZo6o5MVGoAM-/0/1761920392290?e=1763596800&v=beta&t=lYLER\_WKY44bZkw8WqvRrVJ839Ao8hOtC-iyNL\_k6d4"

postedAt:

timestamp:1762177103833

fullDate:"2025-11-03 13:38:23.00 +0000 UTC"

relativeDay:"2h"

engagements:

totalReactions:9

commentsCount:10

repostsCount:1

reactions:

\[0\]:

reactionType:"LIKE"

reactionCount:4

\[1\]:

reactionType:"EMPATHY"

reactionCount:4

\[2\]:

reactionType:"PRAISE"

reactionCount:1

mediaContent:

\[0\]:

type:"image"

url:"https://media.licdn.com/dms/image/v2/D4E22AQGLoE50B3u9Tg/feedshare-shrink\_2048\_1536/B4EZpJ8LFHHcAw-/0/1762177102620?e=1763596800&v=beta&t=H\_IlKcPIm4nDH7LigLmRtE1NnCM4mbgVHt7nyNjSVQs"

\[7\]:

urn:"urn:li:activity:7391087920037888000"

postID:"7391087920037888000"

postURL:"https://www.linkedin.com/feed/update/urn:li:activity:7391087920037888000"

text:"What if you could turn your ideas into real, working apps... just by describing them in plain English? That’s exactly what I experienced with Replit! It's a platform where you can vibe code your way from idea → prototype → production-ready app. No setup, no API headaches, no coding barrier. Just type what you want, refine it together, and watch your idea come to life. Here’s what blew my mind 👇 ✅ Connect Everything You Use: Dropbox, Google Drive, Notion, Slack — you can plug them into your Replit app instantly with Connectors. No API keys. Just log in and go. ✅ Create Anywhere: Replit has a mobile app on both iOS & Android, so I can literally build or update my project from a café or while traveling. ✅ All-in-One Platform: Code, database, hosting, auth — it’s all baked in. ✅ Built for Real Use: You can actually ship production-grade apps from it. Think of Replit as your creative cofounder — ready 24/7 to help you turn a sentence into software. I’ve already started brainstorming small internal tools and client dashboards to build next. If you’ve ever had an app idea sitting in your notes, this might be the sign to finally build it yourself. 👉 Start here & grab your $10 bonus: https://lnkd.in/g39hfFPC (Enjoy $10 bonus)"

author:

name:"Nayeem Sheikh"

headline:"AI & Tech enthusiast • Founder of The Simplified AI"

urn:"ACoAAA20PTkBhmI87KuT0EyJsb1IhESW_qyof7A"

id:"urn:li:member:229915961"

url:"https://www.linkedin.com/in/heynayeem"

profilePictureURL:"https://media.licdn.com/dms/image/v2/D5603AQFaQd6myvHpSw/profile-displayphoto-shrink\_800\_800/profile-displayphoto-shrink\_800\_800/0/1704368397984?e=1763596800&v=beta&t=aDfCkux3oQZbfrkP\_HLGJctm14qi4vkVa\_9mDyofdMM"

postedAt:

timestamp:1762172679910

fullDate:"2025-11-03 12:24:39.00 +0000 UTC"

relativeDay:"3h"

engagements:

totalReactions:221

commentsCount:29

repostsCount:8

reactions:

\[0\]:

reactionType:"LIKE"

reactionCount:197

\[1\]:

reactionType:"EMPATHY"

reactionCount:13

\[2\]:

reactionType:"PRAISE"

reactionCount:9

\[3\]:

reactionType:"INTEREST"

reactionCount:2

mediaContent:

\[0\]:

type:"video"

url:"https://dms.licdn.com/playlist/vid/v2/D5605AQGyTxJvEUQU2A/mp4-720p-30fp-crf28/B56ZpJrASfJsBw-/0/1762172674965?e=1762790400&v=beta&t=-uGX5EQTEHXM9C3UWOdhLNItZkR0VhwhG163QE6VKr0"

\[8\]:

urn:"urn:li:activity:7391127041833865217"

postID:"7391127041833865217"

postURL:"https://www.linkedin.com/feed/update/urn:li:activity:7391127041833865217"

text:"You can always spot an amateur or worse in marketing... They say 'marketeer' 🤦‍♂️. No, you are not a musketeer... We had a right royal barney about this in the UK in the early noughties. Common sense and one term prevailed. It was settled. It's 𝗺𝗮𝗿𝗸𝗲𝘁𝗲𝗿. FWIW: Marketeer - a person who sells goods or services in a market, aka a 𝘴𝘢𝘭𝘦𝘴 person. Marketer - a person that promotes something, aka a 𝘮𝘢𝘳𝘬𝘦𝘵𝘪𝘯𝘨 person. Google Trends has spoken. Glad that's settled. As you were. Flippin' amateeurs... #Marketer #NotMarketeer #LinkedInLeadbetter #UnchainedFriday"

author:

name:"Simon Leadbetter"

headline:"Founder @ We Are Unchained | Mini MBA"

urn:"ACoAAACDlGABHqh0t0pM33qnUSciVNrY_jlWFnA"

id:"urn:li:member:8623200"

url:"https://www.linkedin.com/in/simonleadbetter"

profilePictureURL:"https://media.licdn.com/dms/image/v2/D4D03AQEK7QIxLPYzhw/profile-displayphoto-shrink\_800\_800/profile-displayphoto-shrink\_800\_800/0/1732309288411?e=1763596800&v=beta&t=AAhibkWOJBS7OZES3qXHI4PBpuwt9CVZMfCrqQmn8rw"

postedAt:

timestamp:1762182007273

fullDate:"2025-11-03 15:00:07.00 +0000 UTC"

relativeDay:"44m"

engagements:

totalReactions:0

commentsCount:0

repostsCount:0

reactions:null

mediaContent:

\[0\]:

type:"image"

url:"https://media.licdn.com/dms/image/v2/D4E22AQFohHCfpWarjw/feedshare-shrink\_1280/B4EZpKJFjXHoAs-/0/1762180488023?e=1763596800&v=beta&t=u5MypjyjwLWgs1HiqR4p5Wq0IuAQRD68o4fveQIDNUw"

\[1\]:

type:"image"

url:"https://media.licdn.com/dms/image/v2/D4E22AQFFb63E3RX2VA/feedshare-shrink\_1280/B4EZpKJFjUGoAs-/0/1762180488013?e=1763596800&v=beta&t=tAFOct\_lQ9uez7FjU\_EJehjMn6MQko0fjH670fDdGh0"

\[9\]:

urn:"urn:li:activity:7391028665234530304"

postID:"7391028665234530304"

postURL:"https://www.linkedin.com/feed/update/urn:li:activity:7391028665234530304"

text:"My BBC interview on whether we should care about #Grokipedia and #ElonMusk and his attempts to rewrite history and the future in his own image? A lot of people have given up caring about this. And I think that is the most telling thing. That people might not care anymore. About a political #AI rewriting of What the next-generation Might think about life 😱 Wikipedia worked ✅ For a reason... It was ALL of us working on it together ❤️ Moderated and understood by humans. Unemcumbered by a profit motive. And for all humanity to use... 👍🏾 Loved by Google as trusted 💪🏽 And verified with backlinks... And used by us 'all' as true. Now we have Elon's #AI. It reminds of what R. Buckminster Fuller said many moons ago... "Humanity is acquiring all the right technology for all the wrong reasons." Will link to that below. Enjoy the interview."

author:

name:"Dan Södergren"

headline:"Equipping leaders to adapt to the world of AI and the future of work | TEDx and keynote speaker and author | Trusted by Kelloggs, Sodexo and more..."

urn:"ACoAAAH4KzwBaukpWo_0t_Lr4ojrmRudyn8Q0JA"

id:"urn:li:member:33041212"

url:"https://www.linkedin.com/in/dan-sodergren-futureofwork"

profilePictureURL:"https://media.licdn.com/dms/image/v2/D4E03AQEeJS-FIwE8\_g/profile-displayphoto-crop\_800\_800/B4EZm4aE5PKsAI-/0/1759735468909?e=1763596800&v=beta&t=jdWMgGiLuM3QjfYqHMyFrGumJPT2iuruSuHT-81Wy6k"

postedAt:

timestamp:1762158552464

fullDate:"2025-11-03 08:29:12.00 +0000 UTC"

relativeDay:"7h"

engagements:

totalReactions:18

commentsCount:5

repostsCount:1

reactions:

\[0\]:

reactionType:"LIKE"

reactionCount:13

\[1\]:

reactionType:"INTEREST"

reactionCount:4

\[2\]:

reactionType:"APPRECIATION"

reactionCount:1

mediaContent:

\[0\]:

type:"video"

url:"https://dms.licdn.com/playlist/vid/v2/D4E05AQHVZGJVXcshPw/mp4-720p-30fp-crf28/B4EZpI1KanGoBw-/0/1762158535528?e=1762790400&v=beta&t=kzMqdHAYRF-kHBr\_37J905pJL-DLnizthYQpGKguEX4"

total:249

start:10

count:10

hasMore:true
