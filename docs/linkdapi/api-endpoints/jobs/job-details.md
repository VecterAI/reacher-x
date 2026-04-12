# API Documentation - LinkdAPI

## API Documentation

Professional data API for developers

[Getting Started](/docs/intro)[Pricing](/docs/endpoints-cost)

GET

## Job Details

[Try it](/playground?endpoint=%2Fapi%2Fv1%2Fjobs%2Fjob%2Fdetails&folder=Jobs)

1 credit

\\\[DEPRECATED\\\] Use "Job Details V2" instead of this endpoint to get job details by jobId.

`/api/v1/jobs/job/details?jobId=4287757824`

### Query Parameters

`jobId`

Required

integer

Job ID, NOTE that the job status must be open and actively hiring. Jobs that are no longer accepting applications are NOT supported

Example:`4287757824`

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

`url`

string

uri

Direct URL to this resource

`title`

string

Title of the job, post, or article

`location`

string

Geographic location information

`postedTime`

string

`description`

string

style

Detailed description or summary

`seniorityLevel`

string

`employmentType`

string

`jobFunction`

string

`industries`

string

`applicants`

string

`company`

object

Company name or details

`name`

string

Company name

`url`

string

uri

Company page URL

`imageUrl`

string

uri

Company logo URL

### Example Response

InteractiveRaw JSONCode

success:true

statusCode:200

message:"Data retrieved successfully"

errors:null

data:

jobDetails:

id:"4287757824"

url:"https://www.linkedin.com/jobs/view/4287757824"

title:"Full-Stack Software Engineer (Jr/Mid level)"

location:"San Francisco, CA"

postedTime:"1 week ago"

description:"About Teambridge:More than 60% of workers in the US (and 70% of workers in the world) are paid hourly, and the businesses that employ them each have their own unique processes and workflows when it comes to managing their workforce. Unfortunately, the workforce management tools that have historically been available to them are some combination of rigid, outdated, or not built for an on-the-go workforce.Teambridge is the world’s first flexible workforce management platform–it’s fully composable and built mobile-first, making it easy for companies to mold Teambridge to the unique shape of their business. Teambridge is powered by modular, no-code blocks that can be combined to automate any task or process that comes with managing a large workforce, such as hiring and onboarding, or time tracking and scheduling.With a $28M Series B raised in 2024, Teambridge is funded by General Catalyst, Mayfield and industry leading angel investors as we build flexible, efficient, and intuitive solutions for complex workforce challenges. Based in San Francisco, Teambridge is committed to redefining the industries we partner with.About the candidate:We’re looking for a Junior to Mid-Level Full Stack Software Engineer who’s eager to learn, contribute, and grow with a collaborative and fast-paced team. You’ll play a meaningful role in building core features across the stack, and have the opportunity to expand your skills while making a real impact. If you're curious, proactive, and excited about solving real-world problems through technology, we’d love to meet you.Responsibilities:Build and launch integrations with partners and third-party service providers to drive user activation and enhance the value and reach of Teambridge. Collaborate with senior engineers to deliver end-to-end features across the frontend and backend. Work closely with product, design, and sales to understand user needs and translate them into functional, impactful solutions. Write clean, maintainable, and scalable code that aligns with best practices and long-term product goals. Participate in code reviews to learn from teammates and contribute to high-quality, reliable software. Contribute to technical design discussions with mentorship and guidance from more experienced engineers. Proactively share ideas to improve development workflows, product experience, and team collaboration. Qualifications:A degree in Computer Science or a related field, or equivalent hands-on experience. 1–4 years of experience building web applications (backend, frontend, or both). Exposure to backend languages like Java, Go, Python, or Node.js. Familiarity with frontend frameworks (ideally React and TypeScript). A collaborative mindset and an eagerness to learn from and support teammates. A user-centered approach to development and a willingness to iterate and improve. Our TechReact, TypescriptKotlin, MicronautPostgreSQL, RedisAWS suite, hosted with ECSGithub/Slack/Linear for collaborationCompensation Range: $120K - $180K Show more Show less"

seniorityLevel:"Entry level"

employmentType:"Full-time"

jobFunction:"Engineering and Information Technology"

industries:"Software Development"

applicants:"Over 200 applicants"

company:

name:"Teambridge"

url:"https://www.linkedin.com/company/team-bridge"

imageUrl:"https://media.licdn.com/dms/image/v2/D560BAQGKBJABsnpMyQ/company-logo\_100\_100/B56ZZen7SyGUAU-/0/1745344247197/team\_bridge\_logo?e=2147483647&v=beta&t=ECNI7VoPpXlp-XipgI\_1YMI3GLYDkpoq0ssvkQoO2UA"
