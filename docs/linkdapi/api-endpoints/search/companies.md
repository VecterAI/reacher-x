# API Documentation - LinkdAPI

## API Documentation

Professional data API for developers

[Getting Started](/docs/intro)[Pricing](/docs/endpoints-cost)

GET

## Companies

[Try it](/playground?endpoint=%2Fapi%2Fv1%2Fsearch%2Fcompanies&folder=Search)

1 credit

Search companies using all available filters. Results may vary per page because some companies might be filtered out due to incomplete or restricted data.

`/api/v1/search/companies?keyword=software&start=0&geoUrn=103644278,90009633&companySize=1-10,11-50,51-200&hasJobs=true&industry=4,7&count=25`

### Query Parameters

`keyword`

Required

string

Example:`software`

`start`

integer

Example:`0`

`geoUrn`

string

geos ID

Example:`103644278,90009633`

`companySize`

string

company sizes can be one or multiple of " 1-10 or 11-50 or 51-200 or 201-500 or 501-1000 or 1001-5000 or 5001-10,000 or 10,001+"

Example:`1-10,11-50,51-200`

`hasJobs`

boolean

are these companies have Job listings on LinkedIn

Example:`true`

`industry`

string

industries ID

Example:`4,7`

`count`

integer

Example:`25`

### Response Schema

Field

Type

Description

`companies`

array<object>

`urn`

string

color

Unique internal identifier used for detailed profile queries

`url`

string

uri

Direct URL to this resource

`companyID`

string

color

Unique company identifier

`name`

string

Display name of the entity

`summary`

string

Brief summary or excerpt

`location`

string

Geographic location information

`logoURL`

string

uri

URL of the company or entity logo

`industry`

string

`followersCount`

string

Numeric count

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

companies:

\[0\]:

urn:"239644"

url:"https://www.linkedin.com/company/software-solutions-integrated/"

companyID:"239644"

name:"Software Solutions Integrated"

summary:"Software Solutions Integrated (SSI) is a leading provider of integrated business solutions for the agribusiness..."

location:"Shelbyville, IL"

logoURL:"https://media.licdn.com/dms/image/v2/C4E0BAQHeEfP-CAFJoA/company-logo\_100\_100/company-logo\_100\_100/0/1630585078774/software\_solutions\_integrated\_logo?e=1763596800&v=beta&t=0FfpIIo2NhHxxw7BPHazs\_8RjCW53KZ-N872lOMstwE"

industry:"Software Development"

followersCount:"1K"

\[1\]:

urn:"2990696"

url:"https://www.linkedin.com/company/talentrecruit-recruitment-software/"

companyID:"2990696"

name:"TalentRecruit Software Pvt. Ltd."

summary:"AI Powered Talent Acquisition Ecosystem Time to #GoBeyondATS • Specialties: Enterprise Recruitment Software"

location:"Bangalore, Karnataka"

logoURL:"https://media.licdn.com/dms/image/v2/D560BAQHzoMMFlpfc4w/company-logo\_100\_100/B56ZWj4t6QGQAQ-/0/1742211309619/talentrecruit\_recruitment\_software\_logo?e=1763596800&v=beta&t=fjhkgpdSw\_2FZFFgRcjlgSa6Yl6idwK9GOhJb-hTyKs"

industry:"Software Development"

followersCount:"9K"

\[2\]:

urn:"363435"

url:"https://www.linkedin.com/company/dewsoftware/"

companyID:"363435"

name:"Dew Software"

summary:"At Dew Software, we are a leading player in the Digital Transformation space, empowering businesses to thrive..."

location:"Fremont, California"

logoURL:"https://media.licdn.com/dms/image/v2/D4D0BAQHW5By0Jd9QIw/company-logo\_100\_100/company-logo\_100\_100/0/1692201996152/dewsoftware\_logo?e=1763596800&v=beta&t=KmfEB4syfJc9QftXkat2lLqIGLRgM45KkSV1l5CrQQM"

industry:"Software Development"

followersCount:"71K"

\[3\]:

urn:"166035"

url:"https://www.linkedin.com/company/software-solutions/"

companyID:"166035"

name:"Software Solutions"

summary:"Software Solutions is a Sage Software Business Partner. We specialize in helping businesses choose business managment and ERP software that fits their company. Then we see the project through from conception to post live support..."

location:"Glen Allen, VA"

logoURL:"https://media.licdn.com/dms/image/v2/C560BAQHDs1xTnh4mdg/company-logo\_100\_100/company-logo\_100\_100/0/1631336017867?e=1763596800&v=beta&t=RKcUqjexUyMY3uOHpQPCar25bF9vFo47fhxcb8VVJow"

industry:"Software Development"

followersCount:"927"

\[4\]:

urn:"2845695"

url:"https://www.linkedin.com/company/smokeball-legal-software/"

companyID:"2845695"

name:"Smokeball - Legal Software"

summary:"Cloud-based legal practice management software enhanced with AI. ✨ Run your best law firm with Smokeball. 👟"

location:"Chicago, IL"

logoURL:"https://media.licdn.com/dms/image/v2/D560BAQF14DFWQodJvA/company-logo\_100\_100/company-logo\_100\_100/0/1715102654183/smokeball\_legal\_software\_logo?e=1763596800&v=beta&t=eL-FAq0kDcA2adGeLmJ6Oz5sUyDHnAHQxrVw7CqoEGI"

industry:"Software Development"

followersCount:"7K"

\[5\]:

urn:"775604"

url:"https://www.linkedin.com/company/founding-minds/"

companyID:"775604"

name:"Founding Minds Software"

summary:"We are your product development partner for cloud, mobile, web, and enterprise • Specialties: Software Development"

location:"Los Altos, California"

logoURL:"https://media.licdn.com/dms/image/v2/D560BAQH4llYmlDJfOA/company-logo\_100\_100/company-logo\_100\_100/0/1726458650907/founding\_minds\_logo?e=1763596800&v=beta&t=YglvMm7A2Zx2SvZGrbfEFSwJfSfpoBduk2NF8Lg9-Ss"

industry:"Software Development"

followersCount:"5K"

\[6\]:

urn:"24985788"

url:"https://www.linkedin.com/company/andarsoftware/"

companyID:"24985788"

name:"Andar Software"

summary:"Nonprofit CRM to run campaigns, process pledges, manage donor relationships and get insightful business analytics • Specialties: Nonprofit Software"

location:"Mississauga, Ontario"

logoURL:"-alternative/company-logo_100_100-alternative/0/1630594970505/andarsoftware_logo?e=1763596800&v=beta&t=wtnrVem9rU7_0SjYqqQyv3NILqUGlMyQQxsDjbbTcic"

industry:"Software Development"

followersCount:"3K"

\[7\]:

urn:"3788642"

url:"https://www.linkedin.com/company/tritech-software-&-services/"

companyID:"3788642"

name:"TriTech Software & Services"

summary:"Serving the insurance industry since 1995 • Specialties: Municipal Tax Software"

location:"Allen, Texas"

logoURL:"https://media.licdn.com/dms/image/v2/D560BAQHejjty79OZJw/company-logo\_100\_100/company-logo\_100\_100/0/1735679147442/tritech\_software\_\_services\_logo?e=1763596800&v=beta&t=QcLMgwfiTCoQQz04ictpsgSVNIvleAnJgiRWqLuOoxY"

industry:"Software Development"

followersCount:"1K"

\[8\]:

urn:"82558782"

url:"https://www.linkedin.com/company/software-unlimited-corp/"

companyID:"82558782"

name:"Software Unlimited Corp"

summary:"Helping Prosecutors Streamline Case Management with Innovative Software"

location:"Tupelo, MS"

logoURL:"https://media.licdn.com/dms/image/v2/C560BAQHV2DVWvefxHQ/company-logo\_100\_100/company-logo\_100\_100/0/1660573173997?e=1763596800&v=beta&t=41bZXzq558C0-etHOrSN2Wy2FVrGaImNbrkN5pmKeMA"

industry:"Software Development"

followersCount:"67"

\[9\]:

urn:"3488734"

url:"https://www.linkedin.com/company/vintasoftware/"

companyID:"3488734"

name:"Vinta Software"

summary:"...for healthtech and software-driven businesses. We overcome critical delivery obstacles through our expertise in Django, FastAPI..."

location:"San Francisco, California"

logoURL:"https://media.licdn.com/dms/image/v2/D4D0BAQGnbdh0bGJCjw/company-logo\_100\_100/B4DZo2V17JKUAQ-/0/1761848287382/vintasoftware\_logo?e=1763596800&v=beta&t=Sel4jSwcAYvmaIE9ySCPzp3hh1342-Q2VD34Qt8uhTM"

industry:"Software Development"

followersCount:"17K"

total:1000

start:0

count:10

hasMore:true
