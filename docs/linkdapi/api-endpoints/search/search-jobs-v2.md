# API Documentation - LinkdAPI

## API Documentation

Professional data API for developers

[Getting Started](/docs/intro)[Pricing](/docs/endpoints-cost)

GET

## Search Jobs V2

[Try it](/playground?endpoint=%2Fapi%2Fv1%2Fsearch%2Fjobs&folder=Search)

2 credits

Search jobs using all available filters (V2). This is the most reliable and accurate version.

`/api/v1/search/jobs?start=0&companies=1441,1337&easyApply=true&count=25`

### Query Parameters

`keyword`

string

Search keyword

`start`

integer

Pagination offset for results (default: 0) incr by ${count}

Example:`0`

`sortBy`

string

Sort results by: "relevance" (default) or "date_posted"

`datePosted`

string

Filter jobs posted within: "24h", "1week", or "1month"

`experience`

string

Required experience level (comma-separated): internship, entry_level, associate, mid_senior, director, executive

`jobTypes`

string

Employment type (comma-separated): full_time, part_time, contract, temporary, internship, volunteer, other

`workplaceTypes`

string

Work arrangement (comma-separated): onsite, remote, hybrid

`salary`

string

Minimum annual salary threshold: 20k, 30k, 40k, 50k, 60k, 70k, 80k, 90k, 100k

`companies`

string

Filter by company IDs (comma-separated, e.g., 1441,1337)

Example:`1441,1337`

`industries`

string

Filter by industry IDs (comma-separated)

`locations`

string

LinkedIn's internal geographic identifier (optional) Examples: 103644278,102571732

`functions`

string

Filter by job function codes (comma-separated, e.g., "it,sales,eng")

`titles`

string

Filter by job title IDs (comma-separated)

`Benefits`

string

Filter by benefits offered (comma-separated): medical_ins, dental_ins, vision_ins, 401k, pension, paid_maternity, paid_paternity, commuter, student_loan, tuition, disability_ins

`commitments`

string

Filter by company values (comma-separated): dei, environmental, work_life, social_impact, career_growth

`easyApply`

boolean

Show only LinkedIn Easy Apply jobs (true/false)

Example:`true`

`verifiedJob`

boolean

Show only verified job postings (true/false)

`under10Applicants`

boolean

Show jobs with fewer than 10 applicants (true/false)

`fairChance`

boolean

Show jobs from employers who consider applicants with criminal records (true/false)

`count`

integer

Example:`25`

### Response Schema

Field

Type

Description

`jobs`

array<object>

List of job listings

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

`companyName`

string

Name of the employer

`companyLogo`

string

uri

URL of the company logo

`location`

string

Geographic location information

`listedAt`

integer

Timestamp

`isPromoted`

boolean

Boolean flag

`isEasyApply`

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

id:"4386925432"

url:"https://www.linkedin.com/jobs/view/4386925432"

title:"Data Entry Clerk (Virtual Work)"

companyName:"Houston Graduate School of Theology"

companyLogo:"https://media.licdn.com/dms/image/v2/C4D0BAQGjJyYM3s9Njg/company-logo\_400\_400/company-logo\_400\_400/0/1630483466513/houston\_graduate\_school\_of\_theology\_logo?e=1775088000&v=beta&t=uTAjimx95yhTVRQz3h9vB1iryUl29WrE\_mlQk1NoFVU"

location:"United States (Remote)"

listedAt:1773765000000

isPromoted:false

isEasyApply:false

\[1\]:

id:"4385939324"

url:"https://www.linkedin.com/jobs/view/4385939324"

title:"General Labour"

companyName:"Pivotal Temporary Staffing"

companyLogo:"https://media.licdn.com/dms/image/v2/D560BAQG-ob4AwdJFxw/company-logo\_400\_400/B56Zbu28jJG4AY-/0/1747764103879/pivotal\_temporary\_staffing\_logo?e=1775088000&v=beta&t=SNaINpsHu3wsVR74AabU7y7KVcPxtex-ovuZcYBCgZQ"

location:"Richmond Hill, ON (On-site)"

listedAt:1773764280000

isPromoted:false

isEasyApply:true

insightText:"Company review time is typically 1 week"

\[2\]:

id:"4386917572"

url:"https://www.linkedin.com/jobs/view/4386917572"

title:"Remote Live Chat Specialist"

companyName:"SysCom, Co"

companyLogo:"https://media.licdn.com/dms/image/v2/C4D0BAQEKS-52y3fPzg/company-logo\_400\_400/company-logo\_400\_400/0/1631333343734?e=1775088000&v=beta&t=S-eWBsKp\_H7xRfETxg86Zgy758izCl2UjfEEpbbjCdk"

location:"United States (Remote)"

listedAt:1773765015000

isPromoted:false

isEasyApply:false

\[3\]:

id:"4385929754"

url:"https://www.linkedin.com/jobs/view/4385929754"

title:"Associate Program Manager Job  "

companyName:"Elm Company"

companyLogo:"https://media.licdn.com/dms/image/v2/D4D0BAQHY-WqwzWXrew/company-logo\_400\_400/company-logo\_400\_400/0/1736050175521/elm\_logo?e=1775088000&v=beta&t=1NgAnCpT0xD0YfTh2Y-7Kzx03eb8iMSaScpPZw1IC-c"

location:"Riyadh, Riyadh, Saudi Arabia (On-site)"

listedAt:1773763088000

isPromoted:false

isEasyApply:false

\[4\]:

id:"4384492473"

url:"https://www.linkedin.com/jobs/view/4384492473"

title:"Remote Customer Service"

companyName:"HK Kommunal"

companyLogo:"https://media.licdn.com/dms/image/v2/C4E0BAQGA3SHe5K3FDg/company-logo\_400\_400/company-logo\_400\_400/0/1630608391826/hk\_kommunal\_logo?e=1775088000&v=beta&t=cXhC6DRvtHp4ZVXI64TTcRkc6UtMvfafU8Cuy8BYfzc"

location:"United Arab Emirates (Remote)"

listedAt:1773764197000

isPromoted:false

isEasyApply:true

\[5\]:

id:"4386732860"

url:"https://www.linkedin.com/jobs/view/4386732860"

title:"Atención al Cliente"

companyName:"Palma Aquarium"

companyLogo:"https://media.licdn.com/dms/image/v2/C4D0BAQHKCTzIOkLYAg/company-logo\_400\_400/company-logo\_400\_400/0/1630576142725/palma\_aquarium\_logo?e=1775088000&v=beta&t=W\_jvqRwS7U\_dEFO6YWERrM7Icnr\_48PhCK0mTI4Y6UY"

location:"Palma, Balearic Islands, Spain (On-site)"

listedAt:1773764522000

isPromoted:true

isEasyApply:true

\[6\]:

id:"4385257433"

url:"https://www.linkedin.com/jobs/view/4385257433"

title:"Customer Success Executive"

companyName:"Peko"

companyLogo:"https://media.licdn.com/dms/image/v2/D4D0BAQHPi7IhtuRYIA/company-logo\_400\_400/company-logo\_400\_400/0/1731341724136/pekoit\_logo?e=1775088000&v=beta&t=xgwBbBPOwb7yXJwqkVoz8fVBneyeIxaa4ZsjX5yk6kA"

location:"India (Remote)"

listedAt:1773764901000

isPromoted:false

isEasyApply:true

\[7\]:

id:"4385812281"

url:"https://www.linkedin.com/jobs/view/4385812281"

title:"Recruiter - Sourcer  "

companyName:"Steadily Insurance Company"

companyLogo:"https://media.licdn.com/dms/image/v2/D560BAQFRxAnRJOgJEw/company-logo\_400\_400/company-logo\_400\_400/0/1734646438168/steadily\_logo?e=1775088000&v=beta&t=1gdGcZVUwumM\_j3pWOUtbBIjVb66wxMmTxBhLQiT6o0"

location:"Overland Park, KS"

listedAt:1773762753000

isPromoted:false

isEasyApply:false

\[8\]:

id:"4386908979"

url:"https://www.linkedin.com/jobs/view/4386908979"

title:"Project Administrator"

companyName:"Lime Dishy"

companyLogo:"https://media.licdn.com/dms/image/v2/D4E0BAQHn3JYnJevC1A/company-logo\_400\_400/B4EZzNA.xRIMAY-/0/1772966112696/bleekifylimited\_logo?e=1775088000&v=beta&t=jh-akA5OtXh1RVXjgwug2eUyORUEJ9rOztFA-NGtqxM"

location:"United Kingdom (Remote)"

listedAt:1773764970000

isPromoted:false

isEasyApply:true

\[9\]:

id:"4384496286"

url:"https://www.linkedin.com/jobs/view/4384496286"

title:"Influencer Talent Manager  "

companyName:"Grail Talent"

companyLogo:"https://media.licdn.com/dms/image/v2/C4D0BAQEzwKlelrclcg/company-logo\_400\_400/company-logo\_400\_400/0/1655397266054/grail\_talent\_logo?e=1775088000&v=beta&t=dvPFVoG77NIs44MXb0Ap6GcNMjprEHxsy6gdwXn3U48"

location:"Ottawa, ON (Remote)"

listedAt:1773763269000

isPromoted:false

isEasyApply:false

\[10\]:

id:"4384481958"

url:"https://www.linkedin.com/jobs/view/4384481958"

title:"Event Coordinator - Paderborn (Working Student/Freelancer Part-Time)"

companyName:"Fever"

companyLogo:"https://media.licdn.com/dms/image/v2/C4D0BAQGZ34Z5Azy0Qw/company-logo\_400\_400/company-logo\_400\_400/0/1630556337246/fever\_inc\_logo?e=1775088000&v=beta&t=9IpgL4EIZhMuLkwjs8\_gpQTjLt-FLZ8Bu66jc1296ns"

location:"Paderborn, North Rhine-Westphalia, Germany (On-site)"

listedAt:1773763362000

isPromoted:true

isEasyApply:false

\[11\]:

id:"4386907809"

url:"https://www.linkedin.com/jobs/view/4386907809"

title:"Human Resources Intern"

companyName:"City of Plymouth"

companyLogo:"https://media.licdn.com/dms/image/v2/C4E0BAQFJOm60aHz0NQ/company-logo\_400\_400/company-logo\_400\_400/0/1630580618274/city\_of\_plymouth\_logo?e=1775088000&v=beta&t=lDyNvypY5OFuN6R0qW0T2PJmWrnSpFtupsOfnc0oLjs"

location:"Plymouth, MN (On-site)"

listedAt:1773763453000

isPromoted:false

isEasyApply:false

\[12\]:

id:"4385935567"

url:"https://www.linkedin.com/jobs/view/4385935567"

title:"Freelance Social Media Manager (Remote)"

companyName:"PrimeRishta.com"

companyLogo:"https://media.licdn.com/dms/image/v2/D560BAQHECDe8lzimcA/company-logo\_400\_400/company-logo\_400\_400/0/1727857127259/prime\_rishta\_logo?e=1775088000&v=beta&t=5o7sMt10MFWXwbYYcBZKBRNHvDnK94XJRRQfYCcgMB4"

location:"India (Remote)"

listedAt:1773764519000

isPromoted:false

isEasyApply:true

insightText:"Company review time is typically 1 week"

\[13\]:

id:"4386925364"

url:"https://www.linkedin.com/jobs/view/4386925364"

title:"Recepcionista en H10 Croma Málaga"

companyName:"H10 Hotels"

companyLogo:"https://media.licdn.com/dms/image/v2/D4D0BAQFFVC7qAwPPFw/company-logo\_400\_400/B4DZXcKa4VHwAY-/0/1743155474339/h10\_hotels\_logo?e=1775088000&v=beta&t=NPnqNgucl4GWDa\_VLaPo798p8hMt27Tl8EquhtEyIJo"

location:"Málaga, Andalusia, Spain (On-site)"

listedAt:1773764433000

isPromoted:false

isEasyApply:false

\[14\]:

id:"4386919351"

url:"https://www.linkedin.com/jobs/view/4386919351"

title:"Team Leader Nike (Responsable d’équipe) – H / F CDI  "

companyName:"Nike"

companyLogo:"https://media.licdn.com/dms/image/v2/D560BAQHJk7IdfuV1Dw/company-logo\_400\_400/company-logo\_400\_400/0/1732131503851/nike\_logo?e=1775088000&v=beta&t=6DYmNFnh8H8n2kDAunN-XTE4eMMe1zw3ZrJlrddieiU"

location:"Mulhouse, Grand Est, France (On-site)"

listedAt:1773763650000

isPromoted:true

isEasyApply:false

\[15\]:

id:"4386911251"

url:"https://www.linkedin.com/jobs/view/4386911251"

title:"Customer Happiness Hero (Remote)  "

companyName:"Lensa"

companyLogo:"https://media.licdn.com/dms/image/v2/D4D0BAQEkHa-0Aki9XQ/company-logo\_400\_400/B4DZaKylu7GsAY-/0/1746085240184/lensa\_logo?e=1775088000&v=beta&t=FiLz0zZLSHJlWEL05YsQ0C04LiPINgtD-6ZTSMt8UAg"

location:"Detroit, MI (Remote)"

listedAt:1773764889000

isPromoted:false

isEasyApply:false

\[16\]:

id:"4384487668"

url:"https://www.linkedin.com/jobs/view/4384487668"

title:"Store Associate (Mobile)  "

companyName:"Landmark Group"

companyLogo:"https://media.licdn.com/dms/image/v2/D4D0BAQFCZ8godwrqiQ/company-logo\_400\_400/company-logo\_400\_400/0/1736320079855/landmark\_group\_logo?e=1775088000&v=beta&t=JasRhl3YZJ7EQ5qvQ4D7jV9jtaWiea3tNBptlnZfxnY"

location:"Dubai, United Arab Emirates (On-site)"

listedAt:1773762849000

isPromoted:false

isEasyApply:true

\[17\]:

id:"4386092404"

url:"https://www.linkedin.com/jobs/view/4386092404"

title:"신세계명동DF SC 채용  "

companyName:"SWAROVSKI"

companyLogo:"https://media.licdn.com/dms/image/v2/D4D0BAQHKf63-nVw74w/company-logo\_400\_400/B4DZz7ca.zIkAY-/0/1773745058119/swarovski\_logo?e=1775088000&v=beta&t=W7oqohYSzkgakwJEqOhXlvMUSpZSrR2fZRY-udBUmb8"

location:"Seoul Incheon Metropolitan Area"

listedAt:1773763328000

isPromoted:false

isEasyApply:false

\[18\]:

id:"4386913864"

url:"https://www.linkedin.com/jobs/view/4386913864"

title:"Recruitment Coordinator  "

companyName:"Korn Ferry"

companyLogo:"https://media.licdn.com/dms/image/v2/D560BAQHruq7Wq8U5Mw/company-logo\_400\_400/B56ZUpzb1UGoAY-/0/1740163104457/kornferry\_logo?e=1775088000&v=beta&t=RgnGAfpoNlRl4dKLfZ0Bld3CDtk0SXrON7lB460eOoE"

location:"United States (Remote)"

listedAt:1773764631000

isPromoted:false

isEasyApply:false

\[19\]:

id:"4385929740"

url:"https://www.linkedin.com/jobs/view/4385929740"

title:"First at FENDI Internship Program - Human Resources UK  "

companyName:"Fendi"

companyLogo:"https://media.licdn.com/dms/image/v2/D4D0BAQFFvhXhBhLJRQ/company-logo\_400\_400/B4DZx\_crCgJYAY-/0/1771664749368/fendi\_logo?e=1775088000&v=beta&t=1lmmTcPp5w-i1Cwu6kP1Y7avawFxL6fJ42PkWt5LfKo"

location:"London, England, United Kingdom"

listedAt:1773762987000

isPromoted:false

isEasyApply:false

\[20\]:

id:"4385942230"

url:"https://www.linkedin.com/jobs/view/4385942230"

title:"Human Resource Coordinator"

companyName:"Summit Talent Solutions Inc.com"

location:"Canada (Remote)"

listedAt:1773763764000

isPromoted:false

isEasyApply:true

\[21\]:

id:"4384490712"

url:"https://www.linkedin.com/jobs/view/4384490712"

title:"Office Administrative Assistant  "

companyName:"AMH"

companyLogo:"https://media.licdn.com/dms/image/v2/D560BAQGkPaBXVTao1A/company-logo\_400\_400/company-logo\_400\_400/0/1696443954125/amhliving\_logo?e=1775088000&v=beta&t=ZbWpJ4emdeXLkkS5BVk4DtGeZMch0vDnpUxafM16JnU"

location:"Los Angeles County, CA (Remote)"

listedAt:1773765178000

isPromoted:false

isEasyApply:true

\[22\]:

id:"4386911861"

url:"https://www.linkedin.com/jobs/view/4386911861"

title:"Asistente Atracción e Integración de Talento  "

companyName:"Banco BHD"

companyLogo:"https://media.licdn.com/dms/image/v2/C560BAQGaOfXR66waAQ/company-logo\_400\_400/company-logo\_400\_400/0/1656644930947/bancobhd\_logo?e=1775088000&v=beta&t=UlpehdBwIKtKS3Yif2iOHnPQ34Hwipz0n8E3X2bX558"

location:"Santiago, Dominican Republic (On-site)"

listedAt:1773764080000

isPromoted:false

isEasyApply:false

\[23\]:

id:"4384702235"

url:"https://www.linkedin.com/jobs/view/4384702235"

title:"Asistente de Reclutamiento y Selección IT"

companyName:"Empresa Confidencial"

companyLogo:"https://media.licdn.com/dms/image/v2/D4D0BAQE5LKe2moMnHg/company-logo\_400\_400/company-logo\_400\_400/0/1736630274411/empresa\_confidencial\_logo?e=1775088000&v=beta&t=0F4-QqqoeCQUg2kUJD6n9pgbdxCwiF1jQ0QveEYoCyo"

location:"Lima, Peru (Remote)"

listedAt:1773764644000

isPromoted:false

isEasyApply:false

\[24\]:

id:"4385946040"

url:"https://www.linkedin.com/jobs/view/4385946040"

title:"Relationship Manager  "

companyName:"Axis Bank"

companyLogo:"https://media.licdn.com/dms/image/v2/C510BAQGLnroiQh32ng/company-logo\_400\_400/company-logo\_400\_400/0/1630567599182/axis\_bank\_logo?e=1775088000&v=beta&t=XYaAfIUrL6YivL5Q8Q0yqFIAJsz5CZAy1A1ftK0mvnU"

location:"Lucknow, Uttar Pradesh, India (On-site)"

listedAt:1773762598000

isPromoted:false

isEasyApply:true

total:25
