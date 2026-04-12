# API Documentation - LinkdAPI

## API Documentation

Professional data API for developers

[Getting Started](/docs/intro)[Pricing](/docs/endpoints-cost)

GET

## People Also Viewed

[Try it](/playground?endpoint=%2Fapi%2Fv1%2Fjobs%2Fjob%2Fpeople-also-viewed&folder=Jobs)

1 credit

Get jobs that people also viewed for a given job.

`/api/v1/jobs/job/people-also-viewed?jobId=4287757824`

### Query Parameters

`jobId`

Required

integer

Example:`4287757824`

### Response Schema

Field

Type

Description

`jobs`

array<object>

List of job listings

`entity_urn`

string

uri

`id`

string

utc-millisec

Unique identifier for this resource

`title`

string

Title of the job, post, or article

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

`location`

string

Geographic location information

`salary_range`

array<string>

`posted_date`

string

Timestamp

`exact_date`

string

date

Timestamp

`url`

string

uri

Direct URL to this resource

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

jobs:

\[0\]:

entity_urn:"urn:li:jobPosting:4290765943"

id:"4290765943"

title:"Front-End Full-Stack Software Engineer"

company:

name:"Wonder Studios"

url:"https://www.linkedin.com/company/wearewonderstudios"

location:"San Francisco, CA"

salary_range:

\[0\]:"$140,000.00"

\[1\]:"$180,000.00"

posted_date:"21 hours ago"

exact_date:"2025-08-28"

url:"https://www.linkedin.com/jobs/view/4290765943"

\[1\]:

entity_urn:"urn:li:jobPosting:4205001975"

id:"4205001975"

title:"Software Engineer"

company:

name:"Middesk"

url:"https://www.linkedin.com/company/middesk"

location:"San Francisco, CA"

salary_range:null

posted_date:"4 months ago"

exact_date:"2025-04-09"

url:"https://www.linkedin.com/jobs/view/4205001975"

\[2\]:

entity_urn:"urn:li:jobPosting:4286238812"

id:"4286238812"

title:"Software Engineer, Core Product"

company:

name:"Notion"

url:"https://www.linkedin.com/company/notionhq"

location:"San Francisco, CA"

salary_range:

\[0\]:"$150,000.00"

\[1\]:"$283,000.00"

posted_date:"2 weeks ago"

exact_date:"2025-08-15"

url:"https://www.linkedin.com/jobs/view/4286238812"

\[3\]:

entity_urn:"urn:li:jobPosting:4289334142"

id:"4289334142"

title:"Software Engineer - Platform"

company:

name:"Plaid"

url:"https://www.linkedin.com/company/plaid-"

location:"San Francisco, CA"

salary_range:

\[0\]:"$163,200.00"

\[1\]:"$223,200.00"

posted_date:"1 week ago"

exact_date:"2025-08-21"

url:"https://www.linkedin.com/jobs/view/4289334142"

\[4\]:

entity_urn:"urn:li:jobPosting:4086910955"

id:"4086910955"

title:"Software Engineer"

company:

name:"Nudge"

url:"https://www.linkedin.com/company/nudge-corp"

location:"San Francisco, CA"

salary_range:

\[0\]:"$140,000.00"

\[1\]:"$280,000.00"

posted_date:"9 months ago"

exact_date:"2024-11-27"

url:"https://www.linkedin.com/jobs/view/4086910955"

\[5\]:

entity_urn:"urn:li:jobPosting:4276814807"

id:"4276814807"

title:"Frontend Engineer | All Levels"

company:

name:"Ramp"

url:"https://www.linkedin.com/company/ramp"

location:"San Francisco, CA"

salary_range:

\[0\]:"$155,000.00"

\[1\]:"$339,500.00"

posted_date:"1 week ago"

exact_date:"2025-08-22"

url:"https://www.linkedin.com/jobs/view/4276814807"

\[6\]:

entity_urn:"urn:li:jobPosting:3625993061"

id:"3625993061"

title:"Software Engineer, Full Stack"

company:

name:"Stable"

url:"https://www.linkedin.com/company/usestable"

location:"San Francisco, CA"

salary_range:

\[0\]:"$120,000.00"

\[1\]:"$200,000.00"

posted_date:"2 years ago"

exact_date:"2023-06-05"

url:"https://www.linkedin.com/jobs/view/3625993061"

\[7\]:

entity_urn:"urn:li:jobPosting:3625989507"

id:"3625989507"

title:"Full Stack Engineer"

company:

name:"Roboflow"

url:"https://www.linkedin.com/company/roboflow-ai"

location:"San Francisco, CA"

salary_range:

\[0\]:"$165,000.00"

\[1\]:"$165,000.00"

posted_date:"2 years ago"

exact_date:"2023-06-05"

url:"https://www.linkedin.com/jobs/view/3625989507"

\[8\]:

entity_urn:"urn:li:jobPosting:4278551514"

id:"4278551514"

title:"Software Engineer, Public API"

company:

name:"Notion"

url:"https://www.linkedin.com/company/notionhq"

location:"San Francisco, CA"

salary_range:

\[0\]:"$190,000.00"

\[1\]:"$250,000.00"

posted_date:"1 week ago"

exact_date:"2025-08-22"

url:"https://www.linkedin.com/jobs/view/4278551514"

\[9\]:

entity_urn:"urn:li:jobPosting:4278552077"

id:"4278552077"

title:"Software Engineer, Datastore"

company:

name:"Notion"

url:"https://www.linkedin.com/company/notionhq"

location:"San Francisco, CA"

salary_range:

\[0\]:"$130,000.00"

\[1\]:"$240,000.00"

posted_date:"1 week ago"

exact_date:"2025-08-22"

url:"https://www.linkedin.com/jobs/view/4278552077"

total:10
