# API Documentation - LinkdAPI

## API Documentation

Professional data API for developers

[Getting Started](/docs/intro)[Pricing](/docs/endpoints-cost)

GET

## Job Details V2

[Try it](/playground?endpoint=%2Fapi%2Fv1%2Fjobs%2Fjob%2Fdetails-v2&folder=Jobs)

1 credit

Get job details by jobId using V2. This endpoint supports both open and closed jobs.

`/api/v1/jobs/job/details-v2?jobId=4335513720`

### Query Parameters

`jobId`

Required

integer

Job ID, all jobs status supported

Example:`4335513720`

### Response Schema

Field

Type

Description

`jobDetails`

object

`id`

string

utc-millisec

Unique identifier for this resource

`title`

string

Title of the job, post, or article

`description`

string

style

Detailed description or summary

`State`

string

`listedAt`

integer

Timestamp

`createdAt`

integer

Creation timestamp

`originalListedAt`

integer

Timestamp

`closedAt`

integer

Timestamp

`expireAt`

integer

Timestamp

`jobFunctions`

array<string>

`companyApplyUrl`

string

uri

URL link to this resource

`repostedJob`

boolean

`contractorJob`

boolean

`role`

object

Role or position within a context

`id`

string

utc-millisec

Unique identifier for this resource

`name`

string

Display name of the entity

`employmentStatus`

string

`industries`

array<object>

`id`

string

utc-millisec

Unique identifier for this resource

`name`

string

Display name of the entity

`company`

object

Company name or details

`name`

string

Company name

`id`

string

utc-millisec

Unique identifier for this resource

`universalName`

string

URL-friendly company identifier

`url`

string

uri

Company page URL

`logo`

string

uri

Logo image URL

`location`

object

Geographic location information

`id`

string

utc-millisec

Unique identifier for this resource

`countryISOCode`

string

`defaultLocalizedName`

string

`abbreviatedLocalizedName`

string

### Example Response

InteractiveRaw JSONCode

success:true

statusCode:200

message:"Data retrieved successfully"

errors:null

data:

jobDetails:

id:"4090994054"

title:"Senior Software Engineer - Go"

description:"What do we do? Paddle offers SaaS companies a completely different approach to their payment infrastructure. Instead of assembling and maintaining a complex stack of payments-related apps and services, we’re a Merchant of Record for our customers. That means we take away 100% of the pain of payment fragmentation. It’s faster, safer, cheaper, and, above all, way better. We’re backed by investors including KKR, FTV Capital, Kindred, Notion, and 83North and serve over 3000 software sellers in 245 territories globally. The role: As a Senior Software Engineer in our Payments and Checkout Group, you’ll be developing features, testing hypotheses and rolling out changes to improve payment acceptance and checkout conversion. Working closely with your team, you will impact how our Payments and Checkout technologies perform for our customers. You’ll get to collaborate with multiple teams, alongside engineers, product managers, and designers. Getting involved in a wide range of areas which will provide you with plenty of opportunities to develop your own skills and ultimately grow your career as a valued member of the engineering team. What you'll do: Be a part of our Payments and Checkout group, working on projects that aim to improve payment acceptance, checkout conversion, global compliance and local acquiring. Using data, you’ll have the opportunity to directly influence the team's success.Contribute high-quality Go code in a large codebase, in both existing and brand new servicesCollaborate on features to a high standard from initial concept and planning, right through to rollout, with other engineers and non-technical colleagues, and with excellent written and verbal communicationLevel-up the team’s engineering practices through mentoring other engineers, and by leading the technical planning of team initiativesHelp to continuously improve the reliability and scalability of Paddle’s high-traffic event-driven systemImprove the team’s software quality by implementing automated tests, and also by having an eye for edge-cases and system designPractise DevOps: you’re responsible for getting your code to production, supporting and monitoring its performance, and helping to keep our AWS infrastructure efficient We'd love to hear from you if you: Have a solid development background with GoHave experience designing and building systems to handle high traffic at scale in a cloud-based environment in AWSAre someone who enjoys collaborating with our technical and non-technical departmentsHave a proactive attitude towards finding ways to improve the code and team processesA strong understanding of the development process - from design through to deployment, maintenance, and what that means for day-to-day developmentAre someone who takes pride in what you buildAre interested in what new tools and techniques you could introduce to us! Everyone is welcome at Paddle At Paddle, we’re committed to removing invisible barriers, both for our customers and within our own teams. We recognise and celebrate that every Paddler is unique and we welcome every individual perspective. As an inclusive employer, we don’t care if, or where, you studied, what you look like or where you’re from. We’re more interested in your craft, curiosity, passion for learning and what you’ll add to our culture. We encourage you to apply even if you don’t match every part of the job ad, especially if you’re part of an underrepresented group. Please let us know if there’s anything we can do to better support you through the application process and in the workplace. We will do everything we can to support any accommodations needed. We’re committed to building a diverse team where everyone feels safe to be their authentic self. Let’s grow together. Why you’ll love working at Paddle We are a diverse, growing group of Paddlers across the globe who pride ourselves on our transparent, collaborative and respectful culture. We live and breathe our values, which are: Paddle For Others Paddle together Paddle simply We offer a full suite of benefits, including attractive salaries, stock options, retirement plans, private healthcare and well-being initiatives. We are a ‘digital-first’ company, which means you can work remotely, from one of our stylish hubs, or even a bit of both! We offer all team members unlimited holidays and enhanced parental leave. We invest in learning and will help you with your personal development via constant exposure to new challenges, an annual learning fund, and regular internal and external training."

State:"CLOSED"

listedAt:1737542467000

createdAt:1733409408000

originalListedAt:1733409408000

closedAt:1738267307000

expireAt:1740947449000

jobFunctions:

\[0\]:"ENG"

\[1\]:"IT"

companyApplyUrl:"https://jobs.ashbyhq.com/paddle/64e57282-634f-4f5e-96b9-0da99ab59853?utm\_source=LinkedIn"

repostedJob:true

contractorJob:false

role:

id:"39"

name:"Senior Software Engineer"

employmentStatus:"Full-time"

industries:

\[0\]:

id:"4"

name:"Software Development"

company:

name:"Paddle"

id:"2695021"

universalName:"paddle"

url:"https://www.linkedin.com/company/paddle/"

logo:"https://media.licdn.com/dms/image/v2/D4E0BAQH14BCfSkjbGA/company-logo\_400\_400/B4EZWP76iEHcAY-/0/1741876603367/paddle\_logo?e=1770249600&v=beta&t=f5KwKgNqBdery31y7hUg6JG7lBKtZcfhP9bJRihdph8"

location:

id:"101165590"

countryISOCode:"GB"

defaultLocalizedName:"United Kingdom"

abbreviatedLocalizedName:"United Kingdom"
