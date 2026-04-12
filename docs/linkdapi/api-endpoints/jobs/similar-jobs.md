# API Documentation - LinkdAPI

## API Documentation

Professional data API for developers

[Getting Started](/docs/intro)[Pricing](/docs/endpoints-cost)

GET

## Similar Jobs

[Try it](/playground?endpoint=%2Fapi%2Fv1%2Fjobs%2Fjob%2Fsimilar&folder=Jobs)

1 credit

Get jobs similar to a given job by its ID.

`/api/v1/jobs/job/similar?jobId=4287757824`

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

`entityUrn`

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

`imageUrl`

string

uri

Company logo URL

`location`

string

Geographic location information

`salaryRange`

array<string>

`postedDate`

string

Date the job was posted

`exactDate`

string

date

Timestamp

`url`

string

uri

Direct URL to this resource

`isNew`

boolean

Boolean flag

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

entityUrn:"urn:li:jobPosting:4259593912"

id:"4259593912"

title:"Software Engineer, Backend"

company:

name:"Tinder"

url:"https://www.linkedin.com/company/tinder-incorporated"

imageUrl:"https://media.licdn.com/dms/image/v2/C560BAQGXi3o84QXQnw/company-logo\_100\_100/company-logo\_100\_100/0/1652919833346/tinder\_incorporated\_logo?e=2147483647&v=beta&t=8LEaFsSXxauZwQqF8LfCfmp26NPOvf4Q9WOLk1F8z9I"

location:"San Francisco, CA"

salaryRange:

\[0\]:"$160,000.00"

\[1\]:"$180,000.00"

postedDate:"2 weeks ago"

exactDate:"2025-08-15"

url:"https://www.linkedin.com/jobs/view/4259593912"

isNew:false

\[1\]:

entityUrn:"urn:li:jobPosting:4287980146"

id:"4287980146"

title:"Software Engineer, Infrastructure, Early Career"

company:

name:"Notion"

url:"https://www.linkedin.com/company/notionhq"

imageUrl:"https://media.licdn.com/dms/image/v2/D4E0BAQGwvcv\_1tHZ4w/company-logo\_100\_100/B4EZW25gE2GgAQ-/0/1742530282185/notionhq\_logo?e=2147483647&v=beta&t=h\_sgZm5R2TgP9Fpbo95m2wmxnSDoEz06eupofZwpSXs"

location:"San Francisco, CA"

salaryRange:

\[0\]:"$126,000.00"

\[1\]:"$170,000.00"

postedDate:"1 week ago"

exactDate:"2025-08-19"

url:"https://www.linkedin.com/jobs/view/4287980146"

isNew:false

\[2\]:

entityUrn:"urn:li:jobPosting:4292858066"

id:"4292858066"

title:"Software Engineer I - Platforms"

company:

name:"Uber"

url:"https://www.linkedin.com/company/uber-com"

imageUrl:"https://media.licdn.com/dms/image/v2/C4D0BAQFiYnR1Mbtxdg/company-logo\_100\_100/company-logo\_100\_100/0/1630552741617/uber\_com\_logo?e=2147483647&v=beta&t=eLjukYsixVQJyGQQ7asxFiNOUNa3RVdnAMESgTWs\_AQ"

location:"San Francisco, CA"

salaryRange:

\[0\]:"$150,000.00"

\[1\]:"$158,000.00"

postedDate:"12 hours ago"

exactDate:"2025-08-29"

url:"https://www.linkedin.com/jobs/view/4292858066"

isNew:true

\[3\]:

entityUrn:"urn:li:jobPosting:4276061985"

id:"4276061985"

title:"Software Engineer, Growth"

company:

name:"Notion"

url:"https://www.linkedin.com/company/notionhq"

imageUrl:"https://media.licdn.com/dms/image/v2/D4E0BAQGwvcv\_1tHZ4w/company-logo\_100\_100/B4EZW25gE2GgAQ-/0/1742530282185/notionhq\_logo?e=2147483647&v=beta&t=h\_sgZm5R2TgP9Fpbo95m2wmxnSDoEz06eupofZwpSXs"

location:"San Francisco, CA"

salaryRange:

\[0\]:"$130,000.00"

\[1\]:"$238,000.00"

postedDate:"1 week ago"

exactDate:"2025-08-17"

url:"https://www.linkedin.com/jobs/view/4276061985"

isNew:false

\[4\]:

entityUrn:"urn:li:jobPosting:4211191410"

id:"4211191410"

title:"Fullstack Engineer"

company:

name:"Sprig"

url:"https://www.linkedin.com/company/sprig-official"

imageUrl:"https://media.licdn.com/dms/image/v2/D4E0BAQEV3PkKBN4ffA/company-logo\_100\_100/B4EZd66Pz7GcAQ-/0/1750113779477/sprig\_official\_logo?e=2147483647&v=beta&t=z-dvDTpQFwIAQkYC677TUCoC2miVEj9c7JfgP9UIVyE"

location:"San Francisco, CA"

salaryRange:

\[0\]:"$150,000.00"

\[1\]:"$230,000.00"

postedDate:"4 months ago"

exactDate:"2025-04-18"

url:"https://www.linkedin.com/jobs/view/4211191410"

isNew:false

\[5\]:

entityUrn:"urn:li:jobPosting:4287207142"

id:"4287207142"

title:"Software Engineer, Search Platform"

company:

name:"Notion"

url:"https://www.linkedin.com/company/notionhq"

imageUrl:"https://media.licdn.com/dms/image/v2/D4E0BAQGwvcv\_1tHZ4w/company-logo\_100\_100/B4EZW25gE2GgAQ-/0/1742530282185/notionhq\_logo?e=2147483647&v=beta&t=h\_sgZm5R2TgP9Fpbo95m2wmxnSDoEz06eupofZwpSXs"

location:"San Francisco, CA"

salaryRange:

\[0\]:"$180,000.00"

\[1\]:"$280,000.00"

postedDate:"1 week ago"

exactDate:"2025-08-16"

url:"https://www.linkedin.com/jobs/view/4287207142"

isNew:false

\[6\]:

entityUrn:"urn:li:jobPosting:4068296788"

id:"4068296788"

title:"Software Engineer - Backend"

company:

name:"Ever"

url:"https://www.linkedin.com/company/evercars"

imageUrl:"https://media.licdn.com/dms/image/v2/D560BAQGuonVm1LXJAQ/company-logo\_100\_100/company-logo\_100\_100/0/1690537659647/evercars\_logo?e=2147483647&v=beta&t=pMCSDGrAqSRRgqpTFKu6dwwA1G61PobD7Pm9fjugqD4"

location:"San Francisco, CA"

salaryRange:null

postedDate:"9 months ago"

exactDate:"2024-11-04"

url:"https://www.linkedin.com/jobs/view/4068296788"

isNew:false

\[7\]:

entityUrn:"urn:li:jobPosting:4276096791"

id:"4276096791"

title:"Software Engineer, Developer Experience"

company:

name:"Notion"

url:"https://www.linkedin.com/company/notionhq"

imageUrl:"https://media.licdn.com/dms/image/v2/D4E0BAQGwvcv\_1tHZ4w/company-logo\_100\_100/B4EZW25gE2GgAQ-/0/1742530282185/notionhq\_logo?e=2147483647&v=beta&t=h\_sgZm5R2TgP9Fpbo95m2wmxnSDoEz06eupofZwpSXs"

location:"San Francisco, CA"

salaryRange:

\[0\]:"$150,000.00"

\[1\]:"$250,000.00"

postedDate:"1 week ago"

exactDate:"2025-08-18"

url:"https://www.linkedin.com/jobs/view/4276096791"

isNew:false

\[8\]:

entityUrn:"urn:li:jobPosting:3958003857"

id:"3958003857"

title:"Software Engineer - Frontend"

company:

name:"Ever"

url:"https://www.linkedin.com/company/evercars"

imageUrl:"https://media.licdn.com/dms/image/v2/D560BAQGuonVm1LXJAQ/company-logo\_100\_100/company-logo\_100\_100/0/1690537659647/evercars\_logo?e=2147483647&v=beta&t=pMCSDGrAqSRRgqpTFKu6dwwA1G61PobD7Pm9fjugqD4"

location:"San Francisco, CA"

salaryRange:null

postedDate:"1 year ago"

exactDate:"2024-06-24"

url:"https://www.linkedin.com/jobs/view/3958003857"

isNew:false

\[9\]:

entityUrn:"urn:li:jobPosting:3958006298"

id:"3958006298"

title:"Software Engineer - Fullstack"

company:

name:"Ever"

url:"https://www.linkedin.com/company/evercars"

imageUrl:"https://media.licdn.com/dms/image/v2/D560BAQGuonVm1LXJAQ/company-logo\_100\_100/company-logo\_100\_100/0/1690537659647/evercars\_logo?e=2147483647&v=beta&t=pMCSDGrAqSRRgqpTFKu6dwwA1G61PobD7Pm9fjugqD4"

location:"San Francisco, CA"

salaryRange:null

postedDate:"1 year ago"

exactDate:"2024-06-24"

url:"https://www.linkedin.com/jobs/view/3958006298"

isNew:false

\[10\]:

entityUrn:"urn:li:jobPosting:4282336464"

id:"4282336464"

title:"Software Engineer Intern (Summer 2026)"

company:

name:"Notion"

url:"https://www.linkedin.com/company/notionhq"

imageUrl:"https://media.licdn.com/dms/image/v2/D4E0BAQGwvcv\_1tHZ4w/company-logo\_100\_100/B4EZW25gE2GgAQ-/0/1742530282185/notionhq\_logo?e=2147483647&v=beta&t=h\_sgZm5R2TgP9Fpbo95m2wmxnSDoEz06eupofZwpSXs"

location:"San Francisco, CA"

salaryRange:

\[0\]:"$57.00"

\[1\]:"$61.00"

postedDate:"2 weeks ago"

exactDate:"2025-08-09"

url:"https://www.linkedin.com/jobs/view/4282336464"

isNew:false

\[11\]:

entityUrn:"urn:li:jobPosting:4273291820"

id:"4273291820"

title:"Software Development Engineer I - Frontend & Mobile"

company:

name:"Twitch"

url:"https://www.linkedin.com/company/twitch-tv"

imageUrl:"https://media.licdn.com/dms/image/v2/D560BAQHbYCvrNGC17g/company-logo\_100\_100/company-logo\_100\_100/0/1695062101897/twitch\_tv\_logo?e=2147483647&v=beta&t=uqZASN7sr7mZBei\_6o-tFrTEho8x-ttcnGLk4zejrSg"

location:"San Francisco, CA"

salaryRange:

\[0\]:"$99,500.00"

\[1\]:"$200,000.00"

postedDate:"1 week ago"

exactDate:"2025-08-19"

url:"https://www.linkedin.com/jobs/view/4273291820"

isNew:false

\[12\]:

entityUrn:"urn:li:jobPosting:4292439566"

id:"4292439566"

title:"Frontend Engineer I"

company:

name:"Twitch"

url:"https://www.linkedin.com/company/twitch-tv"

imageUrl:"https://media.licdn.com/dms/image/v2/D560BAQHbYCvrNGC17g/company-logo\_100\_100/company-logo\_100\_100/0/1695062101897/twitch\_tv\_logo?e=2147483647&v=beta&t=uqZASN7sr7mZBei\_6o-tFrTEho8x-ttcnGLk4zejrSg"

location:"San Francisco, CA"

salaryRange:

\[0\]:"$99,500.00"

\[1\]:"$200,000.00"

postedDate:"20 hours ago"

exactDate:"2025-08-28"

url:"https://www.linkedin.com/jobs/view/4292439566"

isNew:true

\[13\]:

entityUrn:"urn:li:jobPosting:4282340038"

id:"4282340038"

title:"Software Engineer Intern (Winter 2026)"

company:

name:"Notion"

url:"https://www.linkedin.com/company/notionhq"

imageUrl:"https://media.licdn.com/dms/image/v2/D4E0BAQGwvcv\_1tHZ4w/company-logo\_100\_100/B4EZW25gE2GgAQ-/0/1742530282185/notionhq\_logo?e=2147483647&v=beta&t=h\_sgZm5R2TgP9Fpbo95m2wmxnSDoEz06eupofZwpSXs"

location:"San Francisco, CA"

salaryRange:

\[0\]:"$57.00"

\[1\]:"$61.00"

postedDate:"2 weeks ago"

exactDate:"2025-08-09"

url:"https://www.linkedin.com/jobs/view/4282340038"

isNew:false

\[14\]:

entityUrn:"urn:li:jobPosting:4221959281"

id:"4221959281"

title:"Software Engineer, Backend"

company:

name:"Hayden AI"

url:"https://www.linkedin.com/company/haydenaitech"

imageUrl:"https://media.licdn.com/dms/image/v2/D4E0BAQFknmV8RUI1JA/company-logo\_100\_100/B4EZj2nJ3yGwAU-/0/1756484116242/haydenaitech\_logo?e=2147483647&v=beta&t=Hb-lRUnvSYCH37Gdpc74M1DfZRhMOaBkx\_wOYpidoCU"

location:"San Francisco, CA"

salaryRange:

\[0\]:"$150,000.00"

\[1\]:"$176,000.00"

postedDate:"3 months ago"

exactDate:"2025-05-06"

url:"https://www.linkedin.com/jobs/view/4221959281"

isNew:false

\[15\]:

entityUrn:"urn:li:jobPosting:4245703653"

id:"4245703653"

title:"Software Engineer - Backend"

company:

name:"Julius AI"

url:"https://www.linkedin.com/company/julius-ai"

imageUrl:"https://media.licdn.com/dms/image/v2/D560BAQG3jmRkbGLHyg/company-logo\_100\_100/company-logo\_100\_100/0/1724221502224/julius\_ai\_logo?e=2147483647&v=beta&t=v4AXdTni9gfcA01eSFP8OCLg25sFMw6vBh9QnEh4-Nc"

location:"San Francisco, CA"

salaryRange:

\[0\]:"$160,000.00"

\[1\]:"$200,000.00"

postedDate:"2 months ago"

exactDate:"2025-06-05"

url:"https://www.linkedin.com/jobs/view/4245703653"

isNew:false

\[16\]:

entityUrn:"urn:li:jobPosting:4068287701"

id:"4068287701"

title:"Software Engineer, Full-Stack"

company:

name:"Loop"

url:"https://www.linkedin.com/company/loop-payments"

imageUrl:"https://media.licdn.com/dms/image/v2/C560BAQFMxjhLWzYatw/company-logo\_100\_100/company-logo\_100\_100/0/1646940828291?e=2147483647&v=beta&t=inbOgHRQYCBTSTSYn7ecUOWqUhFBX8EjCcYpKi30iu4"

location:"San Francisco, CA"

salaryRange:

\[0\]:"$120,000.00"

\[1\]:"$190,000.00"

postedDate:"9 months ago"

exactDate:"2024-11-04"

url:"https://www.linkedin.com/jobs/view/4068287701"

isNew:false

\[17\]:

entityUrn:"urn:li:jobPosting:4265743683"

id:"4265743683"

title:"(New Grad) Software Engineer"

company:

name:"Pylon"

url:"https://www.linkedin.com/company/usepylon"

imageUrl:"https://media.licdn.com/dms/image/v2/D4E0BAQF49w56NFgEtg/company-logo\_100\_100/B4EZjJTBdlGwAc-/0/1755723864237/usepylon\_logo?e=2147483647&v=beta&t=IJYkAlg2guBhfxnbpAa1o\_jX3GYOST0dIsk2YmLRrKI"

location:"San Francisco, CA"

salaryRange:null

postedDate:"1 month ago"

exactDate:"2025-07-12"

url:"https://www.linkedin.com/jobs/view/4265743683"

isNew:false

\[18\]:

entityUrn:"urn:li:jobPosting:4282337394"

id:"4282337394"

title:"Software Engineer, AI Intern (Summer 2026)"

company:

name:"Notion"

url:"https://www.linkedin.com/company/notionhq"

imageUrl:"https://media.licdn.com/dms/image/v2/D4E0BAQGwvcv\_1tHZ4w/company-logo\_100\_100/B4EZW25gE2GgAQ-/0/1742530282185/notionhq\_logo?e=2147483647&v=beta&t=h\_sgZm5R2TgP9Fpbo95m2wmxnSDoEz06eupofZwpSXs"

location:"San Francisco, CA"

salaryRange:

\[0\]:"$57.00"

\[1\]:"$61.00"

postedDate:"2 weeks ago"

exactDate:"2025-08-09"

url:"https://www.linkedin.com/jobs/view/4282337394"

isNew:false

\[19\]:

entityUrn:"urn:li:jobPosting:4291358893"

id:"4291358893"

title:"Software Engineer (entry)"

company:

name:"Jerry"

url:"https://www.linkedin.com/company/jerryinc"

imageUrl:"https://media.licdn.com/dms/image/v2/C560BAQFn2QCrOCDMwg/company-logo\_100\_100/company-logo\_100\_100/0/1630648185818/jerryinc\_logo?e=2147483647&v=beta&t=av36t83Kd04m6aR-OU4KCi1lrpySrASAdTcDVKhzXsY"

location:"San Francisco County, CA"

salaryRange:null

postedDate:"2 days ago"

exactDate:"2025-08-26"

url:"https://www.linkedin.com/jobs/view/4291358893"

isNew:false

\[20\]:

entityUrn:"urn:li:jobPosting:4204412244"

id:"4204412244"

title:"Software Engineer - Backend"

company:

name:"Plaid"

url:"https://www.linkedin.com/company/plaid-"

imageUrl:"https://media.licdn.com/dms/image/v2/D4E0BAQET1PssqfCU5g/company-logo\_100\_100/B4EZarmEzJGYAY-/0/1746635608257/plaid\_\_logo?e=2147483647&v=beta&t=fiFr2KJFzSNufIcHLyRdsg9kzJviRTfZilOvCt99Hg0"

location:"San Francisco, CA"

salaryRange:

\[0\]:"$163,200.00"

\[1\]:"$223,200.00"

postedDate:"2 weeks ago"

exactDate:"2025-08-15"

url:"https://www.linkedin.com/jobs/view/4204412244"

isNew:false

\[21\]:

entityUrn:"urn:li:jobPosting:4252028280"

id:"4252028280"

title:"Software Engineer, New Grad (2025)"

company:

name:"Sentry"

url:"https://www.linkedin.com/company/getsentry"

imageUrl:"https://media.licdn.com/dms/image/v2/D560BAQHRWAVa50doBw/company-logo\_100\_100/company-logo\_100\_100/0/1699367798268/getsentry\_logo?e=2147483647&v=beta&t=YIc\_PMWaokvtDSXQkuvmtHCs7MSmxU9oosKRYWq2t1c"

location:"San Francisco, CA"

salaryRange:

\[0\]:"$130,000.00"

\[1\]:"$140,000.00"

postedDate:"1 week ago"

exactDate:"2025-08-21"

url:"https://www.linkedin.com/jobs/view/4252028280"

isNew:false

\[22\]:

entityUrn:"urn:li:jobPosting:4291366113"

id:"4291366113"

title:"Software Engineer (entry)"

company:

name:"Jerry"

url:"https://www.linkedin.com/company/jerryinc"

imageUrl:"https://media.licdn.com/dms/image/v2/C560BAQFn2QCrOCDMwg/company-logo\_100\_100/company-logo\_100\_100/0/1630648185818/jerryinc\_logo?e=2147483647&v=beta&t=av36t83Kd04m6aR-OU4KCi1lrpySrASAdTcDVKhzXsY"

location:"San Francisco, CA"

salaryRange:null

postedDate:"2 days ago"

exactDate:"2025-08-26"

url:"https://www.linkedin.com/jobs/view/4291366113"

isNew:false

\[23\]:

entityUrn:"urn:li:jobPosting:4247500091"

id:"4247500091"

title:"Software Engineer - Early Career"

company:

name:"Numeric"

url:"https://www.linkedin.com/company/numeric-io"

imageUrl:"https://media.licdn.com/dms/image/v2/D4E0BAQHu6Sq5-XCPWQ/company-logo\_100\_100/company-logo\_100\_100/0/1716415523093/numeric\_io\_logo?e=2147483647&v=beta&t=au1PYVngYCHU\_8xs-cJbm8gLGzIJIgObka7bfJjJc-E"

location:"San Francisco, CA"

salaryRange:

\[0\]:"$125,000.00"

\[1\]:"$175,000.00"

postedDate:"2 months ago"

exactDate:"2025-06-09"

url:"https://www.linkedin.com/jobs/view/4247500091"

isNew:false

\[24\]:

entityUrn:"urn:li:jobPosting:4282340040"

id:"4282340040"

title:"Software Engineer, AI Intern (Winter 2026)"

company:

name:"Notion"

url:"https://www.linkedin.com/company/notionhq"

imageUrl:"https://media.licdn.com/dms/image/v2/D4E0BAQGwvcv\_1tHZ4w/company-logo\_100\_100/B4EZW25gE2GgAQ-/0/1742530282185/notionhq\_logo?e=2147483647&v=beta&t=h\_sgZm5R2TgP9Fpbo95m2wmxnSDoEz06eupofZwpSXs"

location:"San Francisco, CA"

salaryRange:

\[0\]:"$57.00"

\[1\]:"$61.00"

postedDate:"2 weeks ago"

exactDate:"2025-08-09"

url:"https://www.linkedin.com/jobs/view/4282340040"

isNew:false

\[25\]:

entityUrn:"urn:li:jobPosting:4098166100"

id:"4098166100"

title:"Software Engineer, Frontend (All Levels)"

company:

name:"Zip"

url:"https://www.linkedin.com/company/theziphq"

imageUrl:"https://media.licdn.com/dms/image/v2/D560BAQE06hKRt1Z\_1A/company-logo\_100\_100/B56Zfl1YOMHoAQ-/0/1751907665148/theziphq\_logo?e=2147483647&v=beta&t=aY\_k9ksXCWkgxlk7Zs8i1q7ipQEPHlXgWJO6JPMQwMw"

location:"San Francisco, CA"

salaryRange:

\[0\]:"$150,000.00"

\[1\]:"$220,000.00"

postedDate:"6 days ago"

exactDate:"2025-08-23"

url:"https://www.linkedin.com/jobs/view/4098166100"

isNew:false

\[26\]:

entityUrn:"urn:li:jobPosting:4290341003"

id:"4290341003"

title:"(New Grad) Software Engineering"

company:

name:"Samsara"

url:"https://www.linkedin.com/company/samsara"

imageUrl:"https://media.licdn.com/dms/image/v2/D560BAQGJd8HDfSEaLg/company-logo\_100\_100/company-logo\_100\_100/0/1728335806865/samsara\_logo?e=2147483647&v=beta&t=IlAh3rieKGJxnY\_EYKz16xBvN5ZQxBWiNYzs-xnD3nw"

location:"San Francisco, CA"

salaryRange:null

postedDate:"1 day ago"

exactDate:"2025-08-28"

url:"https://www.linkedin.com/jobs/view/4290341003"

isNew:false

total:27
