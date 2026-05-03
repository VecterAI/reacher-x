# API Documentation - LinkdAPI

## API Documentation

Professional data API for developers

[Getting Started](/docs/intro)[Pricing](/docs/endpoints-cost)

GET

## All

[Try it](/playground?endpoint=%2Fapi%2Fv1%2Farticles%2Fall&folder=Articles)

1 credit

Get all articles for a user by their URN.

`/api/v1/articles/all?urn=ACoAAA8BYqEBCGLg_vT_ca6mMEqkpp9nVffJ3hc&start=0`

### Query Parameters

`urn`

Required

string

Example:`ACoAAA8BYqEBCGLg_vT_ca6mMEqkpp9nVffJ3hc`

`start`

integer

Example:`0`

### Response Schema

Field

Type

Description

`articles`

array<object>

List of published articles

`urn`

string

utc-millisec

Unique internal identifier used for detailed profile queries

`navigationUrl`

string

uri

URL link to this resource

`title`

string

Title of the job, post, or article

`description`

string

Detailed description or summary

`duration`

string

Time period in this role

`coverImage`

object

`url`

string

uri

Direct URL to this resource

`paging`

object

`count`

integer

Number of results in this page

`start`

integer

Pagination offset index

`total`

integer

Total number of results available

### Example Response

InteractiveRaw JSONCode

success:true

statusCode:200

message:"Data retrieved successfully"

errors:null

data:

articles:

\[0\]:

urn:"6859977638061068288"

navigationUrl:"https://www.linkedin.com/pulse/time-congress-launch-americas-clean-industrial-revolution-bill-gates"

title:"Time for Congress to launch America’s clean industrial revolution"

description:"Right now, I’m heading to the international climate conference in Glasgow, known as COP26, where delegates will talk about how to cut greenhouse gas e"

duration:"4 min read"

coverImage:

url:"https://media.licdn.com/dms/image/v2/C4D12AQFEcKBY2fCl0g/article-cover\_image-shrink\_720\_1280/article-cover\_image-shrink\_720\_1280/0/1635566387395?e=1763596800&v=beta&t=H1SaFyQ5Dv9QOLJc\_Evfg6pm\_R8vea8HGCamuzp6hCI"

\[1\]:

urn:"6717489330295709696"

navigationUrl:"https://www.linkedin.com/pulse/powerful-tool-understanding-clean-energy-climate-change-bill-gates"

title:"A powerful tool for understanding clean energy and climate change"

description:"Over the past several years, I’ve been making the case that we have to eliminate global carbon emissions. To avoid the worst effects of climate change"

duration:"5 min read"

coverImage:

url:"https://media.licdn.com/dms/image/v2/C4D12AQET-m5EVucIhg/article-cover\_image-shrink\_600\_2000/article-cover\_image-shrink\_600\_2000/0/1601574260909?e=1763596800&v=beta&t=a6YDPOEZd6I2GzEmdU-l1Cz\_23n1itL5e2fAN31ZPA0"

\[2\]:

urn:"6699503942818123776"

navigationUrl:"https://www.linkedin.com/pulse/how-help-students-get-college-covid-era-bill-gates"

title:"How to help students get to college in the COVID era"

description:"These three organizations help make sure no one’s dream is denied. There’s one set of questions on the mind of everyone in the education world right n"

duration:"6 min read"

coverImage:

url:"https://media.licdn.com/dms/image/v2/C4D12AQHZ54ir6-GeXQ/article-cover\_image-shrink\_720\_1280/article-cover\_image-shrink\_720\_1280/0/1597286219445?e=1763596800&v=beta&t=tkOFZKg7DK1arRhcPOxP1wigKt0sSqA5Kop2Gp5zDGw"

\[3\]:

urn:"6644281913563500545"

navigationUrl:"https://www.linkedin.com/pulse/focusing-my-time-bill-gates"

title:"Focusing My Time"

description:"I have made the decision to step down from both of the public boards on which I serve – Microsoft and Berkshire Hathaway – to dedicate more time to ph"

duration:"2 min read"

coverImage:

url:"https://media.licdn.com/dms/image/v2/C4E12AQF4tMZ5wZdosg/article-cover\_image-shrink\_600\_2000/article-cover\_image-shrink\_600\_2000/0/1584126474599?e=1763596800&v=beta&t=ng5OjVv\_nhXM5HxG1RcEl4K\_h83l7vtDz\_mEW-KHGbk"

\[4\]:

urn:"6632494715872825344"

navigationUrl:"https://www.linkedin.com/pulse/why-we-swing-fences-bill-gates"

title:"Why we swing for the fences"

description:"Twenty years after starting our foundation, we’re just as optimistic about the power of innovation to drive progress. When we started our foundation 2"

duration:"4 min read"

coverImage:

url:"https://media.licdn.com/dms/image/v2/C4E12AQHEUHiZLeX54A/article-cover\_image-shrink\_720\_1280/article-cover\_image-shrink\_720\_1280/0/1581309964832?e=1763596800&v=beta&t=mo\_a8IBYFxJ82MYKHPBL2fQ0br1Fv-s9E33bi5AY24U"

\[5\]:

urn:"6605194760724508672"

navigationUrl:"https://www.linkedin.com/pulse/manufacturing-opportunity-bill-gates"

title:"Manufacturing opportunity"

description:"This auto parts maker is producing great results for Tennessee students. I put on safety glasses and ear plugs before stepping onto the factory floor."

duration:"3 min read"

coverImage:

url:"https://media.licdn.com/dms/image/v2/C4E12AQFftuPi0UiqWA/article-cover\_image-shrink\_720\_1280/article-cover\_image-shrink\_720\_1280/0/1574801149114?e=1763596800&v=beta&t=TsybXxC70yWDLsWRfmOK46oirOian4ktOaA1viZJ0BM"

\[6\]:

urn:"6604590387300495360"

navigationUrl:"https://www.linkedin.com/pulse/i-love-schools-energy-bill-gates"

title:"I love this school’s energy!"

description:"Fueled by community support, a struggling Tennessee high school is beginning its turnaround. Melinda and I often say that of all the issues our founda"

duration:"5 min read"

coverImage:

url:"https://media.licdn.com/dms/image/v2/C4E12AQFU25SJLAyGKA/article-cover\_image-shrink\_720\_1280/article-cover\_image-shrink\_720\_1280/0/1574657139678?e=1763596800&v=beta&t=eN1szmK0r7ZoMkKZpq8thngVpDauXfkRlK94MO6qyKQ"

\[7\]:

urn:"6597623749284114433"

navigationUrl:"https://www.linkedin.com/pulse/how-you-can-help-fight-alzheimers-bill-gates"

title:"How you can help fight Alzheimer’s"

description:"I’ve been learning about (and funding) work on Alzheimer’s Disease for a few years now. In a wrap-up blog post at the end of last year, I wrote about "

duration:"5 min read"

coverImage:

url:"https://media.licdn.com/dms/image/v2/C5612AQEKcSr\_MqtzZw/article-cover\_image-shrink\_720\_1280/article-cover\_image-shrink\_720\_1280/0/1572996079285?e=1763596800&v=beta&t=EVEUpEjn7lDfCcqviEx\_\_JyUdtjJ1SzUpcuDwIsg1-k"

\[8\]:

urn:"6595031499895029760"

navigationUrl:"https://www.linkedin.com/pulse/buildings-bad-climate-bill-gates"

title:"Buildings are bad for the climate"

description:"Buildings are bad for the climate: here’s what we can do about it Besides the traffic and the weather, we Seattleites love to talk about all the const"

duration:"5 min read"

coverImage:

url:"https://media.licdn.com/dms/image/v2/C4E12AQFdAmb0OF1GPA/article-cover\_image-shrink\_720\_1280/article-cover\_image-shrink\_720\_1280/0/1572378038033?e=1763596800&v=beta&t=gNqud4QD-Ht7wAPWwyf6ygemJBqc3BLmxWCmp1tivLI"

\[9\]:

urn:"6591088608755671040"

navigationUrl:"https://www.linkedin.com/pulse/tuning-up-photosynthesis-feed-world-bill-gates"

title:"Tuning up photosynthesis to feed the world"

description:"At some point in school, you probably learned about photosynthesis—how plants use energy from sunlight to convert carbon dioxide and water into food. "

duration:"4 min read"

coverImage:

url:"https://media.licdn.com/dms/image/v2/C4E12AQHBkzwRWRg6JQ/article-cover\_image-shrink\_720\_1280/article-cover\_image-shrink\_720\_1280/0/1571438010155?e=1763596800&v=beta&t=h5YtBQ9Ptb3AE\_7LRqon5nM0CXqYW0wnSKhr3vqaEkg"

\[10\]:

urn:"6585199996642082817"

navigationUrl:"https://www.linkedin.com/pulse/how-i-cemented-my-friendship-aliko-dangote-bill-gates"

title:"How I cemented my friendship with Aliko Dangote"

description:"Have you ever met someone new and immediately felt like you could talk to them for hours? That happened the first time I met Aliko Dangote. A couple y"

duration:"3 min read"

coverImage:

url:"https://media.licdn.com/dms/image/v2/C4E12AQEXuXfixsfsPQ/article-cover\_image-shrink\_720\_1280/article-cover\_image-shrink\_720\_1280/0/1570034069252?e=1763596800&v=beta&t=B1PZeHI5sE7oUbG3W0EYF21HYdyPV8IYcUGGtFcJQ7s"

\[11\]:

urn:"6575913544989097984"

navigationUrl:"https://www.linkedin.com/pulse/whats-like-live-less-than-2-day-bill-gates"

title:"What’s it like to live on less than $2 a day?"

description:"It’s the lack of shoes that I remember most. It was 1993. Melinda and I were traveling through Kenya, Tanzania, and Zaire (now the Democratic Republic"

duration:"4 min read"

coverImage:

url:"https://media.licdn.com/dms/image/v2/C4E12AQHzfh1pjskpZA/article-cover\_image-shrink\_720\_1280/article-cover\_image-shrink\_720\_1280/0/1567819962628?e=1763596800&v=beta&t=gZA97Jt9YgMus6GmuxcTeeYd7Iq\_Loj8dJoe0Mha8cA"

\[12\]:

urn:"6572191951553130496"

navigationUrl:"https://www.linkedin.com/pulse/heres-question-you-should-ask-every-climate-change-plan-bill-gates"

title:"Here’s a question you should ask about every climate change plan"

description:"I get to learn about lots of different plans for dealing with climate change. It’s part of my job—climate change is the focus of my work with the inve"

duration:"6 min read"

coverImage:

url:"https://media.licdn.com/dms/image/v2/C4E12AQEgeHvALZs2yQ/article-cover\_image-shrink\_720\_1280/article-cover\_image-shrink\_720\_1280/0/1566937271170?e=1763596800&v=beta&t=mblzs-eqkykstnap5Xi3WrWwIOiqzF4XPNgfGe-3z9Y"

\[13\]:

urn:"6567091241631256577"

navigationUrl:"https://www.linkedin.com/pulse/how-bbq-chicken-can-prepare-you-life-after-high-school-bill-gates"

title:"How BBQ chicken can prepare you for life after high school"

description:"I never really learned how to cook. Other than scrambling eggs over a fire during Boy Scout camping trips, it just wasn’t something I was taught growi"

duration:"4 min read"

coverImage:

url:"https://media.licdn.com/dms/image/v2/C4E12AQFjd1N0n1-EdQ/article-cover\_image-shrink\_720\_1280/article-cover\_image-shrink\_720\_1280/0/1565727376782?e=1763596800&v=beta&t=AvEGdfV8yzLUO8ZxHLZjT2fFZh9Z2TeVBKqod\_SWyck"

\[14\]:

urn:"6564211257702965248"

navigationUrl:"https://www.linkedin.com/pulse/hidden-costs-unreliable-electricity-bill-gates"

title:"The hidden costs of unreliable electricity"

description:"Think back to the last time you experienced a power outage. It probably wasn’t a great memory. Maybe it involved spending the evening in the dark with"

duration:"3 min read"

coverImage:

url:"https://media.licdn.com/dms/image/v2/C4E12AQEvwyjDskLgtA/article-cover\_image-shrink\_720\_1280/article-cover\_image-shrink\_720\_1280/0/1565029982281?e=1763596800&v=beta&t=ne3-McZV60Mnj6kJVkXxLxz7INWlmvbWePsppgJFJwg"

\[15\]:

urn:"6559528976828768256"

navigationUrl:"https://www.linkedin.com/pulse/can-romance-improve-your-odds-survival-bill-gates"

title:"Can romance improve your odds of survival?"

description:"Why do I love my wife, Melinda? The sociologist Nicholas Christakis would probably give way more practical answers than I would. He’d argue that our e"

duration:"4 min read"

coverImage:

url:"https://media.licdn.com/dms/image/v2/C5612AQEkpot0ss25eQ/article-cover\_image-shrink\_600\_2000/article-cover\_image-shrink\_600\_2000/0/1563913577192?e=1763596800&v=beta&t=K2Do5URObhv\_vG3C5XlJw3yd\_U5Jde7VOfWWact\_v8E"

\[16\]:

urn:"6557664451976314880"

navigationUrl:"https://www.linkedin.com/pulse/how-obscure-organization-feeding-our-future-bill-gates"

title:"How this obscure organization is feeding our future"

description:"What’s for dinner? It’s a question asked every day in homes around the world. No other organization has done as much to ensure families—especially the"

duration:"4 min read"

coverImage:

url:"https://media.licdn.com/dms/image/v2/C4E12AQFoJ1E0W-jkXg/article-cover\_image-shrink\_720\_1280/article-cover\_image-shrink\_720\_1280/0/1563469092467?e=1763596800&v=beta&t=kMbwSPCCutnHZJN0asACM5ukkGbvbmTeuITgn6DK8aI"

\[17\]:

urn:"6550064968451051521"

navigationUrl:"https://www.linkedin.com/pulse/side-paul-allen-i-wish-more-people-knew-bill-gates"

title:"The side of Paul Allen I wish more people knew about"

description:"Paul Allen was one of the most intellectually curious people I’ve ever known. Ever since we were kids, he seemed to be interested in just about everyt"

duration:"7 min read"

coverImage:

url:"https://media.licdn.com/dms/image/v2/C4E12AQHm85BLkJInrg/article-cover\_image-shrink\_720\_1280/article-cover\_image-shrink\_720\_1280/0/1561662458483?e=1763596800&v=beta&t=dMB4gTwwZ2ZBJopUdIHBi3ptNtTf8WPYQGYXfpbHAcM"

\[18\]:

urn:"6545367123571597312"

navigationUrl:"https://www.linkedin.com/pulse/heres-one-great-way-use-your-tech-skills-bill-gates"

title:"Here’s one great way to use your tech skills"

description:"These days I spend a lot of my time thinking about how technology can help the poorest people in the world improve their lives. It’s been a big focus "

duration:"4 min read"

coverImage:

url:"https://media.licdn.com/dms/image/v2/C5612AQHZ2HDR9FWnRw/article-cover\_image-shrink\_720\_1280/article-cover\_image-shrink\_720\_1280/0/1560877994889?e=1763596800&v=beta&t=YoK\_EGPrc0UoCQJb\_xO0ZyRBhwti9uGBmY3i2eenCoU"

paging:

count:20

start:0

total:19
