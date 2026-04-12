# API Documentation - LinkdAPI

## API Documentation

Professional data API for developers

[Getting Started](/docs/intro)[Pricing](/docs/endpoints-cost)

GET

## Info

[Try it](/playground?endpoint=%2Fapi%2Fv1%2Farticles%2Farticle%2Finfo&folder=Articles)

1 credit

Get an article using its URL.

`/api/v1/articles/article/info?url=https://www.linkedin.com/pulse/time-congress-launch-americas-clean-industrial-revolution-bill-gates/`

### Query Parameters

`url`

Required

string

Example:`https://www.linkedin.com/pulse/time-congress-launch-americas-clean-industrial-revolution-bill-gates/`

### Response Schema

Field

Type

Description

`article`

object

`urn`

string

utc-millisec

Unique internal identifier used for detailed profile queries

`title`

string

Title of the job, post, or article

`contentHtml`

string

style

`author`

object

`isInfluencer`

boolean

Boolean flag

`followerCount`

integer

Number of followers

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

`publishedAt`

integer

Timestamp

`state`

string

`permalink`

string

uri

URL link to this resource

`coverImage`

object

`url`

string

uri

Direct URL to this resource

`activityUrn`

string

uri

`threadUrn`

string

uri

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

article:

urn:"6859977638061068288"

title:"Time for Congress to launch America’s clean industrial revolution"

contentHtml:"<p>Right now, I’m heading to the&nbsp;international climate conference in Glasgow, known as COP26, where delegates will talk about how to cut greenhouse gas emissions from roughly 51 billion tons per year to zero by 2050. On my way out the door, I’m hearing news that makes me even more optimistic that the world can accomplish this extraordinarily difficult task: The U.S. is on the verge of making a historic investment in clean technologies through the Build Back Better Act and the Infrastructure Investment and Jobs Act.&nbsp;This package of legislation has many important provisions, from health to education, that we need to make progress on.&nbsp;But because I’m on my way to COP26, I want to write about the climate provisions. </p><p>Technological innovation is the only way the world can get to zero. So many of the processes of daily life currently emit carbon—flying on airplanes, building houses, eating hamburgers—so we need to invent new ways of doing them that are green. Then, after we invent them in the lab, we need to “commercialize” them—that is, make them effective, reliable, and cheap enough that people want to and can afford to buy them.</p><p>If the Congress passes these bills, the United States will be at the vanguard of powering a clean industrial revolution. To realize this version of the future, we need to do things like update the electric grid so it can carry more clean energy to more places, rethink how we create things like liquid fuels, and accelerate the time from lab to market for early-stage climate technologies. When I say accelerate, I mean by a lot. In the past, energy transitions have taken as long as a century. For the sake of a livable future, we need to do it in a decade or two.</p><p>That’s what these bills will do. Earlier this summer, the Department of Energy and Breakthrough Energy Catalyst, a brand-new program led by the network of climate initiatives I support, announced a collaboration to accelerate the adoption of next generation clean technologies. These two bills will supercharge our partnership allowing us to invest billions of dollars in projects across the country, but our partnership is just one piece of the puzzle. The public sector investment in these bills will mobilize not just the resources Breakthrough Energy has committed, but billions of dollars in private capital into U.S. clean energy projects.&nbsp;That translates to jobs across the country while ensuring that the U.S. stays competitive as the global economy decarbonizes.</p><p>As I point out in <a href="https://www.gatesnotes.com/Energy/This-is-how-we-build-a-zero-emissions-economy?WT.mc\_id=20211029000000\_net-zero-economy\_BG-LI\_&amp;WT.tsrc=BGLI" target="\_blank" rel="nofollow noopener">this piece</a> I wrote in the run up to COP26, these types of investments will create three kinds of jobs for communities.&nbsp;First, they mean immediate construction jobs and research jobs.&nbsp;Second, they mean jobs in the long term – when you build a sustainable aviation fuel refinery, or a steel plant powered by clean hydrogen you are building an industrial base in a community for decades.&nbsp;Finally, they create economic opportunities and jobs because the first communities to build these things will end up teaching the rest of the world how to do it.&nbsp;</p><p>Combined, the bills Congress is considering would invest <strong>more than $650 billion into clean energy solutions. This would represent the largest effort to combat the climate crisis in American history, and it’s our best shot to avoid a climate disaster.</strong></p><p>While the legislation is not final, here’s what I’ve seen in both bills that will speed up innovation to reach net-zero emissions before 2050:</p><ul><li><strong>$320 billion in tax credits for clean technologies</strong>, especially clean hydrogen, clean jet fuel, long duration energy storage, carbon capture/direct air capture, transmission, and clean manufacturing. Ten years of tax credits, with “direct pay,” will unlock the capital to build commercial demonstration projects. </li><li><strong>$40 billion in expanded financing authority for the Loan Programs Office and $3.6 billion in funding to reduce costs to applicants, </strong>which will help more clean energy projects and transmission get built at scale. </li><li><strong>$43 billion for research, development, and demonstration (RD&amp;D) programs,</strong> including $9.5 billion to build Hydrogen Hubs, $1 billion to lower the cost of electrolytic hydrogen production, $505 million to energy storage demonstration projects (including long-duration energy technologies), $3.2 billion for the Advanced Reactor Demonstration Program, and $500 million to industrial decarbonization demonstrations.</li><li><strong>$7.5 billion for clean manufacturing grants </strong>for clean industrial technology or retrofits to current facilities and domestic production of low carbon vehicles.</li><li><strong>$9.7 billion for the procurement of low carbon materials, </strong>including a significant increase in the Environmental Product Declaration program that quantifies carbon emissions for products like steel and cement. This includes new funding to some federal agencies for low carbon goods procurement, as well as authority to ensure funding for the purchase of low carbon materials in the wake of a national disaster.</li><li><strong>$14 billion for electric transmission </strong>including Department of Energy grant and loan capacity for new transmission construction and upgrades, support for transmission siting and planning processes, and research and development for advanced transmission and electricity storage and distribution technologies.</li></ul><p>Although the Build Back Better Act will be passed in a partisan way through budget reconciliation, it includes many policies that have received bipartisan support in the past, like clean energy tax credits, that will benefit red and blue states alike. I am encouraged that several Republicans voted with their Democratic colleagues to pass the Infrastructure Investment and Jobs Act through the Senate, and I hope to see some House Republicans join Democrats as well when the House takes a vote on the infrastructure bill.&nbsp;Building the foundation for America’s industrial leadership isn’t a partisan thing. </p><p>I hope Congress passes these bills fast.&nbsp;We can’t wait another moment. </p>"

author:

isInfluencer:true

followerCount:39171897

name:"Bill Gates"

headline:"Chair, Gates Foundation and Founder, Breakthrough Energy"

urn:"urn:li:fsd_profile:ACoAAA8BYqEBCGLg_vT_ca6mMEqkpp9nVffJ3hc"

id:"urn:li:member:251749025"

url:"https://www.linkedin.com/in/williamhgates"

profilePictureURL:"https://media.licdn.com/dms/image/v2/D5603AQF-RYZP55jmXA/profile-displayphoto-shrink\_800\_800/B56ZRi8g.aGsAc-/0/1736826818808?e=1763596800&v=beta&t=YpnxOdxeCDLEqaajH25vBq-EX3aRxmYZx2kns7jsUuM"

publishedAt:1635691724000

state:"PUBLISHED"

permalink:"https://www.linkedin.com/pulse/time-congress-launch-americas-clean-industrial-revolution-bill-gates"

coverImage:

url:"https://media.licdn.com/dms/image/v2/C4D12AQFEcKBY2fCl0g/article-cover\_image-shrink\_720\_1280/article-cover\_image-shrink\_720\_1280/0/1635566387395?e=1763596800&v=beta&t=H1SaFyQ5Dv9QOLJc\_Evfg6pm\_R8vea8HGCamuzp6hCI"

activityUrn:"urn:li:activity:6860588340517838849"

threadUrn:"urn:li:ugcPost:6860588340165541888"

engagements:

totalReactions:7410

commentsCount:652

repostsCount:257

reactions:

\[0\]:

reactionType:"LIKE"

reactionCount:7028

\[1\]:

reactionType:"PRAISE"

reactionCount:136

\[2\]:

reactionType:"APPRECIATION"

reactionCount:114

\[3\]:

reactionType:"EMPATHY"

reactionCount:87

\[4\]:

reactionType:"MAYBE"

reactionCount:32

\[5\]:

reactionType:"INTEREST"

reactionCount:13

comments:

\[0\]:

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

\[1\]:

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

\[2\]:

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

\[3\]:

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

\[4\]:

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

\[5\]:

author:

name:"Mamoune Ndiaye"

headline:"Secrétaire général chez DEM DEM"

urn:"ACoAADVgaxgByDn6NExfNpGc_BSdwcLT1h7bATE"

id:"urn:li:member:895511320"

url:"https://www.linkedin.com/in/mamoune-ndiaye-874aa320b"

profilePictureURL:"https://media.licdn.com/dms/image/v2/D4E35AQFMQQQYbxwCZQ/profile-framedphoto-shrink\_800\_800/profile-framedphoto-shrink\_800\_800/0/1632926851128?e=1762862400&v=beta&t=\_RyvlAbNvgPan8aXgBBJsGcCVod-7mr-POXHQxM0y4g"

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

\[6\]:

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

\[7\]:

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

\[8\]:

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

\[9\]:

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

\[10\]:

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

\[11\]:

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
