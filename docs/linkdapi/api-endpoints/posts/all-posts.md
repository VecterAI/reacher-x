# API Documentation - LinkdAPI

## API Documentation

Professional data API for developers

[Getting Started](/docs/intro)[Pricing](/docs/endpoints-cost)

GET

## All Posts

[Try it](/playground?endpoint=%2Fapi%2Fv1%2Fposts%2Fall&folder=Posts)

1 credit

Get all posts for a user by their URN. The first request returns 100 posts; subsequent pages return 20 posts each.

`/api/v1/posts/all?urn=ACoAAAHT6VYBz_yVpo-jE-Or8WNKjArXMd-S6KM&start=0`

### Query Parameters

`urn`

Required

string

Example:`ACoAAAHT6VYBz_yVpo-jE-Or8WNKjArXMd-S6KM`

`cursor`

string

`start`

integer

Example:`0`

### Response Schema

Field

Type

Description

`cursor`

string

Cursor token for next page of results

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

`url`

string

uri

Direct URL to this resource

`profilePictureURL`

string

uri

URL of the profile photo

`postedAt`

string

Timestamp

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

data:

cursor:"dXJuOmxpOmFjdGl2aXR5OjcyNjQxMjM0MjQxNTM3MTg3ODQtMTczMTkwMTk4NTE1OQ=="

posts:

\[0\]:

text:"How zepto launched in Gorakhpur 😂 #zepto #launch #startup #india"

url:"https://www.linkedin.com/feed/update/urn:li:activity:7284419957050789888"

urn:"urn:li:activity:7284419957050789888"

author:

name:"Naveen Rawat"

headline:"SWE @ Google | 123k+ @ LinkedIn"

urn:"urn:li:member:845693009"

url:"https://www.linkedin.com/in/naveen-rawat-100"

profilePictureURL:"https://media.licdn.com/dms/image/v2/D4D03AQGB44zd7uZlYw/profile-displayphoto-shrink\_800\_800/profile-displayphoto-shrink\_800\_800/0/1695908009708?e=1742428800&v=beta&t=KIB0u\_QLwdQQ3eIqXoGGQ-vvdZsnmZNZaxdCQpbAWR4"

postedAt:"7h"

edited:false

engagements:

totalReactions:435

commentsCount:46

repostsCount:2

reactions:

\[0\]:

reactionType:"LIKE"

reactionCount:297

\[1\]:

reactionType:"ENTERTAINMENT"

reactionCount:130

\[2\]:

reactionType:"PRAISE"

reactionCount:4

\[3\]:

reactionType:"EMPATHY"

reactionCount:3

\[4\]:

reactionType:"INTEREST"

reactionCount:1

mediaContent:

\[0\]:

type:"image"

url:"https://media.licdn.com/dms/image/v2/D4D22AQG9s1fgenoUFQ/feedshare-shrink\_2048\_1536/B4DZRd1VflHEAo-/0/1736741054273?e=1739404800&v=beta&t=PpPMrRK0wAgDqHD\_K7hVTEc7wzDddZdEp3HhjWR9ikg"

resharedPostContent:null

\[1\]:

text:"When Gukesh won the Chess World Championship last month, it was so heartwarming to see every Indian unite. Irrespective of the state, caste, religion, everyone was happy for him. Even the tax on the cash prize was waived off following the social media support. Similarly, in August 2023, for the Chandrayaan-3 landing on the moon, we had a screening in the Warsaw office in one of our conference rooms. It was beautiful. In CES 2025, which is one of the largest events for tech brands to show innovation, we had a presentation by Noise, as the first ever Indian brand. And this is important because this is how we show the world that we are no less than anyone else! And we are just getting started 🇮🇳 #CES2025 #india #innovation #softwareengineering"

url:"https://www.linkedin.com/feed/update/urn:li:activity:7283349550667304960"

urn:"urn:li:activity:7283349550667304960"

author:

name:"Naveen Rawat"

headline:"SWE @ Google | 123k+ @ LinkedIn"

urn:"urn:li:member:845693009"

url:"https://www.linkedin.com/in/naveen-rawat-100"

profilePictureURL:"https://media.licdn.com/dms/image/v2/D4D03AQGB44zd7uZlYw/profile-displayphoto-shrink\_800\_800/profile-displayphoto-shrink\_800\_800/0/1695908009708?e=1742428800&v=beta&t=KIB0u\_QLwdQQ3eIqXoGGQ-vvdZsnmZNZaxdCQpbAWR4"

postedAt:"3d"

edited:false

engagements:

totalReactions:791

commentsCount:48

repostsCount:1

reactions:

\[0\]:

reactionType:"LIKE"

reactionCount:711

\[1\]:

reactionType:"EMPATHY"

reactionCount:46

\[2\]:

reactionType:"PRAISE"

reactionCount:26

\[3\]:

reactionType:"APPRECIATION"

reactionCount:7

\[4\]:

reactionType:"ENTERTAINMENT"

reactionCount:1

mediaContent:

\[0\]:

type:"image"

url:"https://media.licdn.com/dms/image/v2/D4D22AQEB-0wp0naWjw/feedshare-shrink\_2048\_1536/B4DZROn0lzHYAo-/0/1736485850153?e=1739404800&v=beta&t=3UIKwhtzCEOpJDlORt\_rYCBCCTKzky-qrQLXxIQTors"

resharedPostContent:null

\[2\]:

text:"𝗣𝗹𝗲𝗮𝘀𝗲 𝗿𝗲𝗮𝗱 𝘁𝗵𝗶𝘀 𝘁𝗶𝗹𝗹 𝘁𝗵𝗲 𝗲𝗻𝗱. A few months ago, I made a post to raise funds for Prashant's father's cancer treatment. Thanks to everyone who helped during that time. The treatments included 20 chemotherapy, 32 radiation, and 15 immunotherapy sessions. Unfortunately, his father is no more with us and lost his life to cancer. Prashant, at this moment is in a lot of debt and I am posting this to raise funds for him to ease the financial burden and to also help his family rebuild their lives. He is the eldest and has to take care of his mother, his son and other members. And we are planning to raise 25 Lakhs. \[We already raised 1 Lakh as of posting\] You can donate using GPay / PayTM / PhonePe here: 9716753980 or on Ketto using: https://lnkd.in/ddwF7PXy Any like, comment or repost would be highly appreciated. If you are an influencer, please create a similar post if it's possible for you 🙏 Thank you. #help #cfbr #india #softwareengineering"

url:"https://www.linkedin.com/feed/update/urn:li:activity:7282618381541724160"

urn:"urn:li:activity:7282618381541724160"

author:

name:"Naveen Rawat"

headline:"SWE @ Google | 123k+ @ LinkedIn"

urn:"urn:li:member:845693009"

url:"https://www.linkedin.com/in/naveen-rawat-100"

profilePictureURL:"https://media.licdn.com/dms/image/v2/D4D03AQGB44zd7uZlYw/profile-displayphoto-shrink\_800\_800/profile-displayphoto-shrink\_800\_800/0/1695908009708?e=1742428800&v=beta&t=KIB0u\_QLwdQQ3eIqXoGGQ-vvdZsnmZNZaxdCQpbAWR4"

postedAt:"5d"

edited:false

engagements:

totalReactions:1089

commentsCount:91

repostsCount:23

reactions:

\[0\]:

reactionType:"LIKE"

reactionCount:836

\[1\]:

reactionType:"APPRECIATION"

reactionCount:230

\[2\]:

reactionType:"EMPATHY"

reactionCount:20

\[3\]:

reactionType:"PRAISE"

reactionCount:2

\[4\]:

reactionType:"ENTERTAINMENT"

reactionCount:1

mediaContent:

\[0\]:

type:"image"

url:"https://media.licdn.com/dms/image/v2/D4D22AQH6hD5aRqnjCg/feedshare-shrink\_2048\_1536/B4DZREO0jaGkAo-/0/1736311524684?e=1739404800&v=beta&t=u7hpyTwFfQgKyIAuzuWfc1FO5AX2xnSFixJl2q4FXhQ"

\[1\]:

type:"image"

url:"https://media.licdn.com/dms/image/v2/D4D22AQFyleB0WigDsQ/feedshare-shrink\_1280/B4DZREO0krG0Ak-/0/1736311524649?e=1739404800&v=beta&t=RZjPV1\_u7wqW3qPWUcdE\_Sq0tYzGBe47fS5UjevP5jY"

\[2\]:

type:"image"

url:"https://media.licdn.com/dms/image/v2/D4D22AQH00TeOxUNanA/feedshare-shrink\_800/B4DZREO0jWHYAk-/0/1736311524186?e=1739404800&v=beta&t=Swol7-UffKbhvSQL5r7bHnpXW-eaw0uvDCfUlQL6vVI"

resharedPostContent:null

\[3\]:

text:"𝗜𝗳 𝘆𝗼𝘂 𝘁𝗮𝗸𝗲 𝗰𝗮𝗿𝗲 𝗼𝗳 𝘆𝗼𝘂𝗿 𝗲𝗺𝗽𝗹𝗼𝘆𝗲𝗲𝘀, 𝘁𝗵𝗲𝘆 𝘄𝗶𝗹𝗹 𝘁𝗮𝗸𝗲 𝗰𝗮𝗿𝗲 𝗼𝗳 𝘁𝗵𝗲 𝗰𝗹𝗶𝗲𝗻𝘁𝘀 ❤️ Did you know that magicpin has launched “𝗛𝗠𝗣𝗩 𝗦𝗮𝗳𝗲 𝗗𝗲𝗹𝗶𝘃𝗲𝗿𝘆 𝗞𝗶𝘁𝘀” for their food delivery riders? Each of such actions goes a long way! That being said, I'd also like to add that there is no need to panic since this isn't a new virus and China's foreign ministry spokesperson Mao Ning also said that it's an usual annual occurrence and these infections peak during the winter season. So, nothing to be worried about. Just take care of your hygiene, wash your hands properly with soap, wear a mask in crowded places and see a doctor if you have a fever! PS: Nhi, koi exams cancel nhi hone wale and WFH bhi nhi milne wala :) #startup #empathy #india #magicpin #employeefirst"

url:"https://www.linkedin.com/feed/update/urn:li:activity:7282299822156500992"

urn:"urn:li:activity:7282299822156500992"

author:

name:"Naveen Rawat"

headline:"SWE @ Google | 123k+ @ LinkedIn"

urn:"urn:li:member:845693009"

url:"https://www.linkedin.com/in/naveen-rawat-100"

profilePictureURL:"https://media.licdn.com/dms/image/v2/D4D03AQGB44zd7uZlYw/profile-displayphoto-shrink\_800\_800/profile-displayphoto-shrink\_800\_800/0/1695908009708?e=1742428800&v=beta&t=KIB0u\_QLwdQQ3eIqXoGGQ-vvdZsnmZNZaxdCQpbAWR4"

postedAt:"6d"

edited:false

engagements:

totalReactions:504

commentsCount:55

repostsCount:2

reactions:

\[0\]:

reactionType:"LIKE"

reactionCount:458

\[1\]:

reactionType:"APPRECIATION"

reactionCount:23

\[2\]:

reactionType:"EMPATHY"

reactionCount:15

\[3\]:

reactionType:"PRAISE"

reactionCount:6

\[4\]:

reactionType:"INTEREST"

reactionCount:2

mediaContent:

\[0\]:

type:"image"

url:"https://media.licdn.com/dms/image/v2/D4D22AQEvA576OGyEhg/feedshare-shrink\_1280/B4DZQ\_s71EHcAs-/0/1736235575091?e=1739404800&v=beta&t=B2mQ9flbe8vBt3Qm1hSBreXc1i917yEHZXLXagx4xqM"

resharedPostContent:null

\[4\]:

text:"When I was trying to get rid of the gaming addiction, I used to listen to "Not Afraid" by Eminem on repeat. It helped me a lot during that time to keep under control. I was listening to it yesterday after such a long time and couldn't help but just look back in time and wonder how different life would have been if I hadn't quit gaming. I am sharing some lyrics here, in the hope that it helps someone take the initial steps towards whatever stops them. "And I just can't keep living this way So starting today I'm breaking out of this cage I'm standing up, I'ma face my demons I'm manning up, I'ma hold my ground I've had enough, now I'm so fed up Time to put my life back together right now." Happy New Year ❤️ #NewYear #SoftwareEngineering"

url:"https://www.linkedin.com/feed/update/urn:li:activity:7280105671541374976"

urn:"urn:li:activity:7280105671541374976"

author:

name:"Naveen Rawat"

headline:"SWE @ Google | 123k+ @ LinkedIn"

urn:"urn:li:member:845693009"

url:"https://www.linkedin.com/in/naveen-rawat-100"

profilePictureURL:"https://media.licdn.com/dms/image/v2/D4D03AQGB44zd7uZlYw/profile-displayphoto-shrink\_800\_800/profile-displayphoto-shrink\_800\_800/0/1695908009708?e=1742428800&v=beta&t=KIB0u\_QLwdQQ3eIqXoGGQ-vvdZsnmZNZaxdCQpbAWR4"

postedAt:"1w"

edited:false

engagements:

totalReactions:1023

commentsCount:87

repostsCount:2

reactions:

\[0\]:

reactionType:"LIKE"

reactionCount:882

\[1\]:

reactionType:"EMPATHY"

reactionCount:105

\[2\]:

reactionType:"APPRECIATION"

reactionCount:21

\[3\]:

reactionType:"PRAISE"

reactionCount:11

\[4\]:

reactionType:"INTEREST"

reactionCount:4

mediaContent:

\[0\]:

type:"image"

url:"https://media.licdn.com/dms/image/v2/D4D22AQHYuzy\_0D6rlQ/feedshare-shrink\_1280/B4DZQghhyTHwAk-/0/1735712448422?e=1739404800&v=beta&t=j1Cxx70CLYzSmOIsNAzBQjWpXH-y8XLNT08v31hgEDA"

resharedPostContent:null

\[5\]:

text:"Today morning was special. I thought I’d have my regular croissant and coffee for breakfast from Zepto. When the order came, I had a surprise box! It had some gifts and the cover says it’s manifesting a fantastic 2025 for me. Well, thanks :)) I know I am grownup but I still look forward to such surprises hahah! Thanks Zepto ❤️ #zepto #india #newyear #celebration"

url:"https://www.linkedin.com/feed/update/urn:li:activity:7279027850370838528"

urn:"urn:li:activity:7279027850370838528"

author:

name:"Naveen Rawat"

headline:"SWE @ Google | 123k+ @ LinkedIn"

urn:"urn:li:member:845693009"

url:"https://www.linkedin.com/in/naveen-rawat-100"

profilePictureURL:"https://media.licdn.com/dms/image/v2/D4D03AQGB44zd7uZlYw/profile-displayphoto-shrink\_800\_800/profile-displayphoto-shrink\_800\_800/0/1695908009708?e=1742428800&v=beta&t=KIB0u\_QLwdQQ3eIqXoGGQ-vvdZsnmZNZaxdCQpbAWR4"

postedAt:"2w"

edited:false

engagements:

totalReactions:962

commentsCount:56

repostsCount:0

reactions:

\[0\]:

reactionType:"LIKE"

reactionCount:890

\[1\]:

reactionType:"EMPATHY"

reactionCount:59

\[2\]:

reactionType:"PRAISE"

reactionCount:10

\[3\]:

reactionType:"APPRECIATION"

reactionCount:3

mediaContent:

\[0\]:

type:"image"

url:"https://media.licdn.com/dms/image/v2/D4D22AQEqGEx16Czl-w/feedshare-shrink\_2048\_1536/B4DZQRNO.DHUAo-/0/1735455476117?e=1739404800&v=beta&t=-ydzRsOlTsoi\_G1gwM4lJsIbUXWcvy0zco2n3KGhFNc"

\[1\]:

type:"image"

url:"https://media.licdn.com/dms/image/v2/D4D22AQGl5RqiEPCz-w/feedshare-shrink\_1280/B4DZQRNO9THUAk-/0/1735455473993?e=1739404800&v=beta&t=lRG6Zqv8bI-sjoRcp7DZrvGN5PuKxrMiYwvMbe0aDo8"

resharedPostContent:null

\[6\]:

text:"#softwareengineering #ai"

url:"https://www.linkedin.com/feed/update/urn:li:activity:7278619884228403200"

urn:"urn:li:activity:7278619884228403200"

author:

name:"Naveen Rawat"

headline:"SWE @ Google | 123k+ @ LinkedIn"

urn:"urn:li:member:845693009"

url:"https://www.linkedin.com/in/naveen-rawat-100"

profilePictureURL:"https://media.licdn.com/dms/image/v2/D4D03AQGB44zd7uZlYw/profile-displayphoto-shrink\_800\_800/profile-displayphoto-shrink\_800\_800/0/1695908009708?e=1742428800&v=beta&t=KIB0u\_QLwdQQ3eIqXoGGQ-vvdZsnmZNZaxdCQpbAWR4"

postedAt:"2w"

edited:false

engagements:

totalReactions:2788

commentsCount:41

repostsCount:39

reactions:

\[0\]:

reactionType:"LIKE"

reactionCount:2329

\[1\]:

reactionType:"ENTERTAINMENT"

reactionCount:314

\[2\]:

reactionType:"APPRECIATION"

reactionCount:78

\[3\]:

reactionType:"EMPATHY"

reactionCount:41

\[4\]:

reactionType:"INTEREST"

reactionCount:18

\[5\]:

reactionType:"PRAISE"

reactionCount:8

mediaContent:

\[0\]:

type:"image"

url:"https://media.licdn.com/dms/image/v2/D4D22AQGi3Hil2oXxUA/feedshare-shrink\_1280/B4DZQLaNRnHMAk-/0/1735358209311?e=1739404800&v=beta&t=Sg\_Gobg5N9-2hEP2swsly06wHScH5dVtX2pFIgY8-4w"

resharedPostContent:null

\[7\]:

text:"We are hiring for 2025 interns for Waymo. The positions are located out of the Google Warsaw office. 1. Backend: https://lnkd.in/diX6CAVQ 2. Mobile: https://lnkd.in/d5nk95XP #SoftwareEngineering #LifeAtGoogle #hiring #internship"

url:"https://www.linkedin.com/feed/update/urn:li:activity:7277561336027398146"

urn:"urn:li:activity:7277561336027398146"

author:

name:"Naveen Rawat"

headline:"SWE @ Google | 123k+ @ LinkedIn"

urn:"urn:li:member:845693009"

url:"https://www.linkedin.com/in/naveen-rawat-100"

profilePictureURL:"https://media.licdn.com/dms/image/v2/D4D03AQGB44zd7uZlYw/profile-displayphoto-shrink\_800\_800/profile-displayphoto-shrink\_800\_800/0/1695908009708?e=1742428800&v=beta&t=KIB0u\_QLwdQQ3eIqXoGGQ-vvdZsnmZNZaxdCQpbAWR4"

postedAt:"2w"

edited:false

engagements:

totalReactions:1055

commentsCount:61

repostsCount:10

reactions:

\[0\]:

reactionType:"LIKE"

reactionCount:1006

\[1\]:

reactionType:"EMPATHY"

reactionCount:23

\[2\]:

reactionType:"APPRECIATION"

reactionCount:21

\[3\]:

reactionType:"PRAISE"

reactionCount:3

\[4\]:

reactionType:"ENTERTAINMENT"

reactionCount:1

\[5\]:

reactionType:"INTEREST"

reactionCount:1

mediaContent:

\[0\]:

type:"image"

url:"https://media.licdn.com/dms/image/v2/D4D22AQFXh5aQdRfQEQ/feedshare-shrink\_2048\_1536/B4DZP8XXQaHYAo-/0/1735105831898?e=1739404800&v=beta&t=LrZhiRwEP5zXCFrBxr2blLUFTPZ04-AE0UE3rbd3zHw"

resharedPostContent:null

\[8\]:

text:"Ed Sheeran x Calum Scott! Have a good weekend :) #concert"

url:"https://www.linkedin.com/feed/update/urn:li:activity:7276540078053605377"

urn:"urn:li:activity:7276540078053605377"

author:

name:"Naveen Rawat"

headline:"SWE @ Google | 123k+ @ LinkedIn"

urn:"urn:li:member:845693009"

url:"https://www.linkedin.com/in/naveen-rawat-100"

profilePictureURL:"https://media.licdn.com/dms/image/v2/D4D03AQGB44zd7uZlYw/profile-displayphoto-shrink\_800\_800/profile-displayphoto-shrink\_800\_800/0/1695908009708?e=1742428800&v=beta&t=KIB0u\_QLwdQQ3eIqXoGGQ-vvdZsnmZNZaxdCQpbAWR4"

postedAt:"3w"

edited:false

engagements:

totalReactions:450

commentsCount:33

repostsCount:2

reactions:

\[0\]:

reactionType:"LIKE"

reactionCount:380

\[1\]:

reactionType:"EMPATHY"

reactionCount:63

\[2\]:

reactionType:"APPRECIATION"

reactionCount:5

\[3\]:

reactionType:"PRAISE"

reactionCount:2

mediaContent:

\[0\]:

type:"video"

url:"https://dms.licdn.com/playlist/vid/v2/D5605AQGTpKnOuoaELg/mp4-720p-30fp-crf28/B56ZPt2hX.HoBg-/0/1734862342273?e=1737374400&v=beta&t=unIG\_wLxKmYF-DJd3DoNh-e0pmBPwQC-1ZDjoO271oc"

resharedPostContent:null

\[9\]:

text:"There'll always be someone who cannot see your worth. Don't let that person be you. - Mel Robbins"

url:"https://www.linkedin.com/feed/update/urn:li:activity:7274636435196903425"

urn:"urn:li:activity:7274636435196903425"

author:

name:"Naveen Rawat"

headline:"SWE @ Google | 123k+ @ LinkedIn"

urn:"urn:li:member:845693009"

url:"https://www.linkedin.com/in/naveen-rawat-100"

profilePictureURL:"https://media.licdn.com/dms/image/v2/D4D03AQGB44zd7uZlYw/profile-displayphoto-shrink\_800\_800/profile-displayphoto-shrink\_800\_800/0/1695908009708?e=1742428800&v=beta&t=KIB0u\_QLwdQQ3eIqXoGGQ-vvdZsnmZNZaxdCQpbAWR4"

postedAt:"3w"

edited:false

engagements:

totalReactions:955

commentsCount:68

repostsCount:2

reactions:

\[0\]:

reactionType:"LIKE"

reactionCount:789

\[1\]:

reactionType:"EMPATHY"

reactionCount:121

\[2\]:

reactionType:"APPRECIATION"

reactionCount:31

\[3\]:

reactionType:"INTEREST"

reactionCount:9

\[4\]:

reactionType:"PRAISE"

reactionCount:5

mediaContent:null

resharedPostContent:null

\[10\]:

text:"𝐓𝐨𝐩 𝐫𝐮𝐥𝐞 𝐟𝐨𝐫 𝐥𝐢𝐟𝐞: Every master was a beginner who made a lot of mistakes. Every mistake is a learning opportunity. If we learn from our mistakes, it's called experience and it never goes to vain ;) And not all heroes mine coins—some just learn from their mistakes like Rahul. Keep inspiring smarter crypto moves! #growth #softwareengineering #ad #india"

url:"https://www.linkedin.com/feed/update/urn:li:activity:7275434644001411072"

urn:"urn:li:activity:7275434644001411072"

author:

name:"Naveen Rawat"

headline:"SWE @ Google | 123k+ @ LinkedIn"

urn:"urn:li:member:845693009"

url:"https://www.linkedin.com/in/naveen-rawat-100"

profilePictureURL:"https://media.licdn.com/dms/image/v2/D4D03AQGB44zd7uZlYw/profile-displayphoto-shrink\_800\_800/profile-displayphoto-shrink\_800\_800/0/1695908009708?e=1742428800&v=beta&t=KIB0u\_QLwdQQ3eIqXoGGQ-vvdZsnmZNZaxdCQpbAWR4"

postedAt:"3w"

edited:false

engagements:

totalReactions:229

commentsCount:39

repostsCount:0

reactions:

\[0\]:

reactionType:"LIKE"

reactionCount:211

\[1\]:

reactionType:"EMPATHY"

reactionCount:11

\[2\]:

reactionType:"APPRECIATION"

reactionCount:5

\[3\]:

reactionType:"PRAISE"

reactionCount:2

mediaContent:

\[0\]:

type:"image"

url:"https://media.licdn.com/dms/image/v2/D4D22AQF0uj4GD6MPTg/feedshare-shrink\_1280/B4DZPeJHmMGoAk-/0/1734598754739?e=1739404800&v=beta&t=hjKRUOB2PYUlAqb7V7VqkqbDVMeHtoWq0-K58gGalBY"

resharedPostContent:null

\[11\]:

text:"If you are interviewing with the big tech companies and you performed badly in one of the rounds, it doesn't mean that you'll be rejected straightaway. All the interviews done as part of the onsite interviews (which is usually 4-5 rounds) are looked at as a whole. If they had to reject you for the bad round, they'd do it immediately after the bad round itself but they take the whole set of interviews. I personally know a few people who were rated as No Hire but were eventually hired because they absolutely crushed the other rounds. Good luck! :) #softwareengineering #interviews #faang #offcampus"

url:"https://www.linkedin.com/feed/update/urn:li:activity:7270652344009146368"

urn:"urn:li:activity:7270652344009146368"

author:

name:"Naveen Rawat"

headline:"SWE @ Google | 123k+ @ LinkedIn"

urn:"urn:li:member:845693009"

url:"https://www.linkedin.com/in/naveen-rawat-100"

profilePictureURL:"https://media.licdn.com/dms/image/v2/D4D03AQGB44zd7uZlYw/profile-displayphoto-shrink\_800\_800/profile-displayphoto-shrink\_800\_800/0/1695908009708?e=1742428800&v=beta&t=KIB0u\_QLwdQQ3eIqXoGGQ-vvdZsnmZNZaxdCQpbAWR4"

postedAt:"1mo"

edited:false

engagements:

totalReactions:528

commentsCount:55

repostsCount:0

reactions:

\[0\]:

reactionType:"LIKE"

reactionCount:492

\[1\]:

reactionType:"EMPATHY"

reactionCount:17

\[2\]:

reactionType:"APPRECIATION"

reactionCount:9

\[3\]:

reactionType:"INTEREST"

reactionCount:8

\[4\]:

reactionType:"PRAISE"

reactionCount:2

mediaContent:

\[0\]:

type:"image"

url:"https://media.licdn.com/dms/image/v2/D5622AQEHxUqNjdkenA/feedshare-shrink\_2048\_1536/feedshare-shrink\_2048\_1536/0/1733458599679?e=1739404800&v=beta&t=p\_1hkKLVYtUWJIl7lB9-pvKVMRL8hFPusn6ssmF7B8s"

resharedPostContent:null

\[12\]:

text:"This tip has helped me land offers from the biggest of the tech companies in the world. During the interview, conduct yourself in such a way that after the interview if the interviewer asks themselves ,"Do I see myself working with this person?", the answer should be a definite yes. For sure, you need to do well in the interview but if you leave an impression that you are a good person to work with, it'll make a huge difference. And how do you do it? - Have a positive attitude throughout the interview. No sad face. - Greet the interviewer in the start of the interview and let them know how excited you are to be interviewing for the role. - Ask clarifying questions. - Communicate thoughts clearly. - Take appropriate pauses for thinking. Not all silence is bad. - Accept feedback gracefully and modify solution/answer as needed. - Towards the end of the interview, ask any questions you have about the company. - Before leaving the meeting, thank the interviewer for their time, they are human as well, after all. And most importantly, don't forget that the interviewer is there to help you not to fail you. They were in your position too a few years ago. So, be positive, be confident and follow the points mentioned above and I can assure you that you'll come out successful in most of the interviews. Lfg :) 𝐏𝐒: Do you have any such tips that you'd like to share? Let me know in the comments! #softwareengineering #interviews #hiring #job #placement #offcampus"

url:"https://www.linkedin.com/feed/update/urn:li:activity:7272819960492498944"

urn:"urn:li:activity:7272819960492498944"

author:

name:"Naveen Rawat"

headline:"SWE @ Google | 123k+ @ LinkedIn"

urn:"urn:li:member:845693009"

url:"https://www.linkedin.com/in/naveen-rawat-100"

profilePictureURL:"https://media.licdn.com/dms/image/v2/D4D03AQGB44zd7uZlYw/profile-displayphoto-shrink\_800\_800/profile-displayphoto-shrink\_800\_800/0/1695908009708?e=1742428800&v=beta&t=KIB0u\_QLwdQQ3eIqXoGGQ-vvdZsnmZNZaxdCQpbAWR4"

postedAt:"1mo"

edited:false

engagements:

totalReactions:1109

commentsCount:107

repostsCount:1

reactions:

\[0\]:

reactionType:"LIKE"

reactionCount:1015

\[1\]:

reactionType:"EMPATHY"

reactionCount:57

\[2\]:

reactionType:"INTEREST"

reactionCount:27

\[3\]:

reactionType:"APPRECIATION"

reactionCount:6

\[4\]:

reactionType:"PRAISE"

reactionCount:4

mediaContent:

\[0\]:

type:"image"

url:"https://media.licdn.com/dms/image/v2/D4D22AQFQhH0nVfDqjw/feedshare-shrink\_1280/B4DZO18d1VHMAk-/0/1733924357315?e=1739404800&v=beta&t=EiHjkEfJRGejFnQRkmUJlf2W7niaH1jw8Pt4CiDkLfI"

resharedPostContent:null

\[13\]:

text:"This post is for recruiters who hire Software Engineers internationally from India. Please help me reach them :) I have noticed that most of the hires that go outside the country are from FAANG and similar companies that have global presence and are very well known. And it makes complete sense to do so. However, there are also a lot of startups and other tech companies in India, which have equally competitive process and have very skilled employees. However, these companies are not known outside India. So, when folks from these companies apply internationally, please don't brush them off. I am mentioning a list of such companies. Please do consider them when hiring from India! Save this post, if possible :) The list is in no particular order. Myntra Flipkart Cred Zomato Swiggy Zepto Blinkit RazorPay CureFit Udaan PayU MakeMyTrip Unacademy Paytm 1mg Groww Ola Boat Please do like, comment or repost to reach more people! #softwareengineering #hiring #jobs #india"

url:"https://www.linkedin.com/feed/update/urn:li:activity:7266659809872027648"

urn:"urn:li:activity:7266659809872027648"

author:

name:"Naveen Rawat"

headline:"SWE @ Google | 123k+ @ LinkedIn"

urn:"urn:li:member:845693009"

url:"https://www.linkedin.com/in/naveen-rawat-100"

profilePictureURL:"https://media.licdn.com/dms/image/v2/D4D03AQGB44zd7uZlYw/profile-displayphoto-shrink\_800\_800/profile-displayphoto-shrink\_800\_800/0/1695908009708?e=1742428800&v=beta&t=KIB0u\_QLwdQQ3eIqXoGGQ-vvdZsnmZNZaxdCQpbAWR4"

postedAt:"1mo"

edited:true

engagements:

totalReactions:754

commentsCount:81

repostsCount:6

reactions:

\[0\]:

reactionType:"LIKE"

reactionCount:689

\[1\]:

reactionType:"APPRECIATION"

reactionCount:40

\[2\]:

reactionType:"EMPATHY"

reactionCount:16

\[3\]:

reactionType:"INTEREST"

reactionCount:4

\[4\]:

reactionType:"PRAISE"

reactionCount:3

\[5\]:

reactionType:"ENTERTAINMENT"

reactionCount:2

mediaContent:null

resharedPostContent:null

\[14\]:

text:"Most students don't know that, in the long term, it's good for you if you are not able to join a FAANG company straight out of college. Let me explain. 1. All companies have a salary range for each level. For example, salary range for some level 'L' can be between X lpa and (X + 10) lpa. 2. The salary difference between lower and higher bracket at higher levels is very high. 3. When you get promoted internally, you are usually given the lower bracket salary of the next level but if you were hired externally, you can negotiate and get yourself the higher bracket salary. So, if you have just graduated or yet to graduate and don't have a FAANG offer, don't worry :) There's always an opportunity for higher pay later! All the best :) #softwareengineering #placements #internship #faang #offcampus"

url:"https://www.linkedin.com/feed/update/urn:li:activity:7267752523631861760"

urn:"urn:li:activity:7267752523631861760"

author:

name:"Naveen Rawat"

headline:"SWE @ Google | 123k+ @ LinkedIn"

urn:"urn:li:member:845693009"

url:"https://www.linkedin.com/in/naveen-rawat-100"

profilePictureURL:"https://media.licdn.com/dms/image/v2/D4D03AQGB44zd7uZlYw/profile-displayphoto-shrink\_800\_800/profile-displayphoto-shrink\_800\_800/0/1695908009708?e=1742428800&v=beta&t=KIB0u\_QLwdQQ3eIqXoGGQ-vvdZsnmZNZaxdCQpbAWR4"

postedAt:"1mo"

edited:false

engagements:

totalReactions:1209

commentsCount:98

repostsCount:5

reactions:

\[0\]:

reactionType:"LIKE"

reactionCount:1125

\[1\]:

reactionType:"EMPATHY"

reactionCount:54

\[2\]:

reactionType:"INTEREST"

reactionCount:23

\[3\]:

reactionType:"APPRECIATION"

reactionCount:5

\[4\]:

reactionType:"PRAISE"

reactionCount:2

mediaContent:

\[0\]:

type:"image"

url:"https://media.licdn.com/dms/image/v2/D5622AQE4c3pEsorCdA/feedshare-shrink\_1280/feedshare-shrink\_1280/0/1732767228985?e=1739404800&v=beta&t=7nVRF99yauZ3J8xZn5Ogf7v0bLTGMPdevz0HCHtBu1Q"

resharedPostContent:null

\[15\]:

text:"How can someone be so cruel? Let's not wait for another such case to raise our voices. Government of India I believe both, the judge and her client, must be given the strictest punishment possible. #india #suicide"

url:"https://www.linkedin.com/feed/update/urn:li:activity:7272243748661583872"

urn:"urn:li:activity:7272243748661583872"

author:

name:"Naveen Rawat"

headline:"SWE @ Google | 123k+ @ LinkedIn"

urn:"urn:li:member:845693009"

url:"https://www.linkedin.com/in/naveen-rawat-100"

profilePictureURL:"https://media.licdn.com/dms/image/v2/D4D03AQGB44zd7uZlYw/profile-displayphoto-shrink\_800\_800/profile-displayphoto-shrink\_800\_800/0/1695908009708?e=1742428800&v=beta&t=KIB0u\_QLwdQQ3eIqXoGGQ-vvdZsnmZNZaxdCQpbAWR4"

postedAt:"1mo"

edited:false

engagements:

totalReactions:2459

commentsCount:108

repostsCount:46

reactions:

\[0\]:

reactionType:"LIKE"

reactionCount:1812

\[1\]:

reactionType:"APPRECIATION"

reactionCount:612

\[2\]:

reactionType:"INTEREST"

reactionCount:22

\[3\]:

reactionType:"EMPATHY"

reactionCount:9

\[4\]:

reactionType:"PRAISE"

reactionCount:4

mediaContent:

\[0\]:

type:"image"

url:"https://media.licdn.com/dms/image/v2/D4D22AQFuA7eePZ\_5vw/feedshare-shrink\_800/B4DZOwzJkLG0Ao-/0/1733838019353?e=1739404800&v=beta&t=nZo2CgM\_v5v9-CehIplTuEpG97WUVcWHlHmJCeLWaGY"

resharedPostContent:null

\[16\]:

text:"On Thursday, one of my juniors from the 2026 batch got an internship at a startup that pays 70k per month. And if they convert full time, it'll be 18 lpa. What's most interesting is that this was his first interview ever. And this is the reality of the undergraduate market for internship and new grad roles. Few open roles and much more applications. If you are someone in that boat, you'll need to put energy not just into your preparation but also in getting those interviews. Set aside some time every week to connect with folks from different companies, not just the FAANG ones. Network with them so that when needed, they will be able to help you to at least get an interview. And these small efforts compound. Do not be afraid to start your career from a small company. You'll have plenty of opportunities to switch later. One offer leads to another and then another. We got this! Good luck 🫶 #softwareengineering #offcampus #interviews"

url:"https://www.linkedin.com/feed/update/urn:li:activity:7271020456625733635"

urn:"urn:li:activity:7271020456625733635"

author:

name:"Naveen Rawat"

headline:"SWE @ Google | 123k+ @ LinkedIn"

urn:"urn:li:member:845693009"

url:"https://www.linkedin.com/in/naveen-rawat-100"

profilePictureURL:"https://media.licdn.com/dms/image/v2/D4D03AQGB44zd7uZlYw/profile-displayphoto-shrink\_800\_800/profile-displayphoto-shrink\_800\_800/0/1695908009708?e=1742428800&v=beta&t=KIB0u\_QLwdQQ3eIqXoGGQ-vvdZsnmZNZaxdCQpbAWR4"

postedAt:"1mo"

edited:false

engagements:

totalReactions:1691

commentsCount:116

repostsCount:5

reactions:

\[0\]:

reactionType:"LIKE"

reactionCount:1583

\[1\]:

reactionType:"EMPATHY"

reactionCount:60

\[2\]:

reactionType:"INTEREST"

reactionCount:23

\[3\]:

reactionType:"PRAISE"

reactionCount:15

\[4\]:

reactionType:"APPRECIATION"

reactionCount:10

mediaContent:null

resharedPostContent:null

\[17\]:

text:"Don't ask anyone what their salary / CTC is. When someone gets placed, the first thing we usually ask is "What's the CTC?" I've stopped asking now. I've been talking to students on the weekends, mostly new grads and believe me, the market is very bad. So many talented people who haven't given a single interview yet because they never got one. And so when someone gets an offer, irrespective of how high/low the company pays, I just congratulate them without asking the CTC. Because I know that the efforts that have gone behind that offer are much higher than their CTC. And also if it's low, it can hurt that person and make them feel bad to even say what their CTC is. Because they know they are being judged. There are better questions to be asked. - What did the entire process look like? - What tips would you like to share from your experience of clearing the interviews? - Are there any specific topics which are more important than the others? - Do you know which team you'd be joining? - Do you know the tech stack of the team? - If it's off-campus, can you share who your recruiter was? - Did the recruiting team explain what the onboarding process would look like? - What's the most thrilling part about the company that you look forward to after joining? These questions come across as genuine and make the candidate feel like you really appreciate their success and efforts. I would also recommend the same to you. When someone gets an offer, don't ask their CTC. Congratulate them because an offer is an offer, no matter how high/low the CTC is. #softwareengineering #salary #newgrad #internship"

url:"https://www.linkedin.com/feed/update/urn:li:activity:7264123424153718784"

urn:"urn:li:activity:7264123424153718784"

author:

name:"Naveen Rawat"

headline:"SWE @ Google | 123k+ @ LinkedIn"

urn:"urn:li:member:845693009"

url:"https://www.linkedin.com/in/naveen-rawat-100"

profilePictureURL:"https://media.licdn.com/dms/image/v2/D4D03AQGB44zd7uZlYw/profile-displayphoto-shrink\_800\_800/profile-displayphoto-shrink\_800\_800/0/1695908009708?e=1742428800&v=beta&t=KIB0u\_QLwdQQ3eIqXoGGQ-vvdZsnmZNZaxdCQpbAWR4"

postedAt:"1mo"

edited:false

engagements:

totalReactions:4795

commentsCount:182

repostsCount:41

reactions:

\[0\]:

reactionType:"LIKE"

reactionCount:4207

\[1\]:

reactionType:"EMPATHY"

reactionCount:284

\[2\]:

reactionType:"APPRECIATION"

reactionCount:241

\[3\]:

reactionType:"PRAISE"

reactionCount:32

\[4\]:

reactionType:"INTEREST"

reactionCount:28

\[5\]:

reactionType:"ENTERTAINMENT"

reactionCount:3

mediaContent:

\[0\]:

type:"image"

url:"https://media.licdn.com/dms/image/v2/D4D22AQEcM-Ip6x22mw/feedshare-shrink\_2048\_1536/feedshare-shrink\_2048\_1536/0/1731901983772?e=1739404800&v=beta&t=uvJRicb3-TUyrdylfastlWgIMTHEXB5Ct5OPiCmBtsk"

resharedPostContent:null

\[18\]:

text:"These are two of the best pieces of advice I got from a 43 year old colleague. 𝐓𝐢𝐩 𝟏: 𝐀𝐬 𝐰𝐞 𝐠𝐫𝐨𝐰 𝐢𝐧 𝐨𝐮𝐫 𝐜𝐚𝐫𝐞𝐞𝐫, 𝐰𝐞 𝐬𝐡𝐨𝐮𝐥𝐝 𝐞𝐯𝐞𝐧𝐭𝐮𝐚𝐥𝐥𝐲 𝐚𝐢𝐦 𝐭𝐨 𝐛𝐞 𝐚 𝐓-𝐬𝐡𝐚𝐩𝐞𝐝 𝐞𝐧𝐠𝐢𝐧𝐞𝐞𝐫. What this means is that you should have a deep expertise in a particular area (represented by the vertical bar in T) and should have enough understanding of the other domains so that you understand the whole picture. This makes that person a very special engineer. The domain for expertise could be front-end, backend-end, mobile development, database, AI, Machine Learning, Big Data or even a deep understanding of a particular language like Java. If your domain is AI and Machine Learning, I recommend Simplilearn. Simplilearn has a great collection of resources for AI and ML. I suggest exploring the program details and the syllabus to understand what you'll be learning: https://bit.ly/AIML-Naveen I recommend them because these value-packed courses are in collaboration with world renowned universities and institutions and have also been recommended by Forbes! And Simplilearn's hands-on, real-world projects equip you with the knowledge and expertise to excel in your chosen field by applying cutting-edge technologies. It ensures that you gain valuable experience and prepares you for real-world challenges and keeps you ahead in today's competitive job market. If you have any questions, feel free to ping me :) 𝐓𝐢𝐩 𝟐: 𝐋𝐨𝐨𝐤 𝐚𝐭 𝐞𝐯𝐞𝐫𝐲 𝐜𝐡𝐚𝐥𝐥𝐞𝐧𝐠𝐞 𝐚𝐬 𝐚𝐧 𝐨𝐩𝐩𝐨𝐫𝐭𝐮𝐧𝐢𝐭𝐲 𝐭𝐨 𝐥𝐞𝐚𝐫𝐧 𝐬𝐨𝐦𝐞𝐭𝐡𝐢𝐧𝐠 𝐧𝐞𝐰. For example, if you have to debug something, instead of being frustrated that you have to debug a system to resolve a bug, think of it as an opportunity to learn more about the system. It has helped me a lot personally and I've realized that it's applicable not just for engineering challenges but life situations too!I hope it helps you too :) All the best! 𝐏𝐒: What advice have you got from your seniors? :) #softwareengineering #ai #simplilearn #partnership #job #genAI #InvestInYourself"

url:"https://www.linkedin.com/feed/update/urn:li:activity:7273182348366528512"

urn:"urn:li:activity:7273182348366528512"

author:

name:"Naveen Rawat"

headline:"SWE @ Google | 123k+ @ LinkedIn"

urn:"urn:li:member:845693009"

url:"https://www.linkedin.com/in/naveen-rawat-100"

profilePictureURL:"https://media.licdn.com/dms/image/v2/D4D03AQGB44zd7uZlYw/profile-displayphoto-shrink\_800\_800/profile-displayphoto-shrink\_800\_800/0/1695908009708?e=1742428800&v=beta&t=KIB0u\_QLwdQQ3eIqXoGGQ-vvdZsnmZNZaxdCQpbAWR4"

postedAt:"1mo"

edited:false

engagements:

totalReactions:307

commentsCount:50

repostsCount:1

reactions:

\[0\]:

reactionType:"LIKE"

reactionCount:275

\[1\]:

reactionType:"EMPATHY"

reactionCount:16

\[2\]:

reactionType:"INTEREST"

reactionCount:11

\[3\]:

reactionType:"APPRECIATION"

reactionCount:4

\[4\]:

reactionType:"PRAISE"

reactionCount:1

mediaContent:

\[0\]:

type:"image"

url:"https://media.licdn.com/dms/image/v2/D4D22AQEaMiiflz78pw/feedshare-shrink\_2048\_1536/B4DZO1ukQyHYAo-/0/1733920707818?e=1739404800&v=beta&t=gcUGbBXw1D0nR6moDSl5YRbFT0m0piWr2SFtvLqvpE8"

resharedPostContent:null

\[19\]:

text:"Never imagined this! The new era of marketing is here :) Swiggy #marketing #india #latent"

url:"https://www.linkedin.com/feed/update/urn:li:activity:7266304049526833153"

urn:"urn:li:activity:7266304049526833153"

author:

name:"Naveen Rawat"

headline:"SWE @ Google | 123k+ @ LinkedIn"

urn:"urn:li:member:845693009"

url:"https://www.linkedin.com/in/naveen-rawat-100"

profilePictureURL:"https://media.licdn.com/dms/image/v2/D4D03AQGB44zd7uZlYw/profile-displayphoto-shrink\_800\_800/profile-displayphoto-shrink\_800\_800/0/1695908009708?e=1742428800&v=beta&t=KIB0u\_QLwdQQ3eIqXoGGQ-vvdZsnmZNZaxdCQpbAWR4"

postedAt:"1mo"

edited:true

engagements:

totalReactions:1016

commentsCount:79

repostsCount:4

reactions:

\[0\]:

reactionType:"LIKE"

reactionCount:798

\[1\]:

reactionType:"ENTERTAINMENT"

reactionCount:180

\[2\]:

reactionType:"EMPATHY"

reactionCount:17

\[3\]:

reactionType:"INTEREST"

reactionCount:14

\[4\]:

reactionType:"PRAISE"

reactionCount:5

\[5\]:

reactionType:"APPRECIATION"

reactionCount:2

mediaContent:

\[0\]:

type:"video"

url:"https://dms.licdn.com/playlist/vid/v2/D4D05AQEcmDmP9YPraQ/mp4-640p-30fp-crf28/mp4-640p-30fp-crf28/0/1732421881209?e=1737374400&v=beta&t=uXBMhz6xtYW7ROwzwhXPBMtp2DPYEkrDXY0yZa4nETs"

resharedPostContent:null
