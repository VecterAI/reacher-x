# API Documentation - LinkdAPI

## API Documentation

Professional data API for developers

[Getting Started](/docs/intro)[Pricing](/docs/endpoints-cost)

GET

## Search

[Try it](/playground?endpoint=%2Fapi%2Fv1%2Fjobs%2Fsearch&folder=Jobs)

1 credit

\\\[DEPRECATED\\\] Use "Search Jobs V2" instead of this endpoint.

`/api/v1/jobs/search?keyword=nodejs&timePosted=any&start=0`

### Query Parameters

`keyword`

Required

string

The job title, skills, or keywords to search for Examples: software engineer,nodejs developer,data scientist,product manager

Example:`nodejs`

`location`

string

The city, state, or region where you want to find jobs Examples: San+Francisco, New+York+City, London, Remote Format: Use + for spaces: San+Francisco+Bay+Area

`geoId`

integer

LinkedIn's internal geographic identifier (optional) Examples: 103644278,102571732 Note: Usually auto-detected from location

`companyIds`

string

Specific company LinkedIn IDs to filter results (comma-separated) Examples: 2499210,1337,104085107 Format: comma-separated numbers

`jobTypes`

string

jobTypes (comma-separated) The type of employment you're looking for Available Options: full_time - Full-time positions part_time - Part-time positions contract - Contract-based work temporary - Temporary assignments internship - Internship opportunities volunteer - Volunteer positions Example: jobTypes=full_time,contract

`experience`

string

The required experience level for the job Available Options: internship - Student internships entry_level - 0-2 years experience (Junior roles) associate - 2-4 years experience mid_senior - 4-8 years experience (Mid-level to Senior) director - 8+ years experience (Director level and above) Example: experience=entry_level,mid_senior

`regions`

string

Specific region codes for targeted search (optional) Examples: 102571732,103743442

`timePosted`

string

How recently the job was posted Available Options: any - Any time (default) 24h - Past 24 hours 1week - Past week 1month - Past month Example: timePosted=1week

Example:`any`

`salary`

string

salary Minimum salary range you're targeting Available Options: any - Any salary (default) 40k - $40,000+ per year 60k - $60,000+ per year 80k - $80,000+ per year 100k - $100,000+ per year 120k - $120,000+ per year Example: salary=100k

`workArrangement`

string

The work location arrangement Available Options: onsite - Office-based work remote - Fully remote work hybrid - Combination of office and remote Example: workArrangement=remote,hybrid

`start`

integer

\*The starting index for pagination (0-based)\* Default: 0 (first page) Increment by: 25 per page (LinkedIn's default page size) Example: start=25 (second page), start=50 (third page)

Example:`0`

### Response Schema

Field

Type

Description

`jobs`

array<object>

List of job listings

`jobId`

string

utc-millisec

Unique job listing identifier

`title`

string

Title of the job, post, or article

`screenReader`

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

`location`

string

Geographic location information

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

`entityUrn`

string

uri

`benefits`

string

`totalCount`

integer

Total number of results available

`start`

integer

Pagination offset index

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

jobs:

\[0\]:

jobId:"4259594855"

title:"Software Engineer, Backend"

screenReader:"Software Engineer, Backend"

company:

name:"Tinder"

url:"https://www.linkedin.com/company/tinder-incorporated"

imageUrl:"https://media.licdn.com/dms/image/v2/C560BAQGXi3o84QXQnw/company-logo\_100\_100/company-logo\_100\_100/0/1652919833346/tinder\_incorporated\_logo?e=2147483647&v=beta&t=8LEaFsSXxauZwQqF8LfCfmp26NPOvf4Q9WOLk1F8z9I"

location:"Palo Alto, CA"

postedDate:"1 week ago"

exactDate:"2025-08-15"

url:"https://www.linkedin.com/jobs/view/4259594855"

entityUrn:"urn:li:jobPosting:4259594855"

benefits:"Actively Hiring"

\[1\]:

jobId:"4259593912"

title:"Software Engineer, Backend"

screenReader:"Software Engineer, Backend"

company:

name:"Tinder"

url:"https://www.linkedin.com/company/tinder-incorporated"

imageUrl:"https://media.licdn.com/dms/image/v2/C560BAQGXi3o84QXQnw/company-logo\_100\_100/company-logo\_100\_100/0/1652919833346/tinder\_incorporated\_logo?e=2147483647&v=beta&t=8LEaFsSXxauZwQqF8LfCfmp26NPOvf4Q9WOLk1F8z9I"

location:"San Francisco, CA"

postedDate:"1 week ago"

exactDate:"2025-08-15"

url:"https://www.linkedin.com/jobs/view/4259593912"

entityUrn:"urn:li:jobPosting:4259593912"

benefits:"Actively Hiring"

\[2\]:

jobId:"4278391743"

title:"Backend Engineer"

screenReader:"Backend Engineer"

company:

name:"CRED"

url:"https://www.linkedin.com/company/credplatform"

imageUrl:"https://media.licdn.com/dms/image/v2/D560BAQEfTOiG-JsrzQ/company-logo\_100\_100/B56ZezKEWTGoAQ-/0/1751057450870/credplatform\_logo?e=2147483647&v=beta&t=pVcyVAQd6ccayDkyI3M4pPWWO0q5fjBpFU-z-D3ygTQ"

location:"United States"

postedDate:"4 weeks ago"

exactDate:"2025-07-30"

url:"https://www.linkedin.com/jobs/view/4278391743"

entityUrn:"urn:li:jobPosting:4278391743"

\[3\]:

jobId:"4278390789"

title:"Backend Engineer"

screenReader:"Backend Engineer"

company:

name:"CRED"

url:"https://www.linkedin.com/company/credplatform"

imageUrl:"https://media.licdn.com/dms/image/v2/D560BAQEfTOiG-JsrzQ/company-logo\_100\_100/B56ZezKEWTGoAQ-/0/1751057450870/credplatform\_logo?e=2147483647&v=beta&t=pVcyVAQd6ccayDkyI3M4pPWWO0q5fjBpFU-z-D3ygTQ"

location:"United States"

postedDate:"4 weeks ago"

exactDate:"2025-07-30"

url:"https://www.linkedin.com/jobs/view/4278390789"

entityUrn:"urn:li:jobPosting:4278390789"

\[4\]:

jobId:"4290341003"

title:"(New Grad) Software Engineering"

screenReader:"(New Grad) Software Engineering"

company:

name:"Samsara"

url:"https://www.linkedin.com/company/samsara"

imageUrl:"https://media.licdn.com/dms/image/v2/D560BAQGJd8HDfSEaLg/company-logo\_100\_100/company-logo\_100\_100/0/1728335806865/samsara\_logo?e=2147483647&v=beta&t=IlAh3rieKGJxnY\_EYKz16xBvN5ZQxBWiNYzs-xnD3nw"

location:"San Francisco, CA"

postedDate:"19 hours ago"

exactDate:"2025-08-28"

url:"https://www.linkedin.com/jobs/view/4290341003"

entityUrn:"urn:li:jobPosting:4290341003"

benefits:"Actively Hiring"

\[5\]:

jobId:"4265604833"

title:"Software Engineer, Routing - New Grad"

screenReader:"Software Engineer, Routing - New Grad"

company:

name:"Nuro"

url:"https://www.linkedin.com/company/nuro-inc."

imageUrl:"https://media.licdn.com/dms/image/v2/C560BAQHahNycmNp6Gg/company-logo\_100\_100/company-logo\_100\_100/0/1630638403898/nuro\_inc\_logo?e=2147483647&v=beta&t=3FVrqvduIGtnaH7-fVEnLalZbqxzzCLA1ALuQ76cgmc"

location:"Mountain View, CA"

postedDate:"4 days ago"

exactDate:"2025-08-24"

url:"https://www.linkedin.com/jobs/view/4265604833"

entityUrn:"urn:li:jobPosting:4265604833"

benefits:"Actively Hiring"

\[6\]:

jobId:"4285729424"

title:"Software Engineer"

screenReader:"Software Engineer"

company:

name:"HIFI"

url:"https://www.linkedin.com/company/hifibridge"

imageUrl:"https://media.licdn.com/dms/image/v2/D560BAQFBm1I2lwmuwQ/company-logo\_100\_100/B56ZeJodx8GoAg-/0/1750360776149/hifibridge\_logo?e=2147483647&v=beta&t=uX2PRu0JZtE6pg9TuzQkOm6ehoHPnEOCPb9OrHPkEm0"

location:"New York, United States"

postedDate:"2 weeks ago"

exactDate:"2025-08-14"

url:"https://www.linkedin.com/jobs/view/4285729424"

entityUrn:"urn:li:jobPosting:4285729424"

benefits:"Medical insurance +1 benefits"

\[7\]:

jobId:"4292361179"

title:"Junior Software Engineer"

screenReader:"Junior Software Engineer"

company:

name:"Visionist, Inc."

url:"https://www.linkedin.com/company/visionist-inc-"

imageUrl:"https://media.licdn.com/dms/image/v2/C4E0BAQGj6mjHj8a3rA/company-logo\_100\_100/company-logo\_100\_100/0/1674092170797/visionist\_inc\_\_logo?e=2147483647&v=beta&t=AzGn\_p9eupdXW9PlcnFP\_zB3QSQpV7FI2xE568wTg00"

location:"Columbia, MD"

postedDate:"13 hours ago"

exactDate:"2025-08-28"

url:"https://www.linkedin.com/jobs/view/4292361179"

entityUrn:"urn:li:jobPosting:4292361179"

\[8\]:

jobId:"4287757824"

title:"Full-Stack Software Engineer (Jr/Mid level)"

screenReader:"Full-Stack Software Engineer (Jr/Mid level)"

company:

name:"Teambridge"

url:"https://www.linkedin.com/company/team-bridge"

imageUrl:"https://media.licdn.com/dms/image/v2/D560BAQGKBJABsnpMyQ/company-logo\_100\_100/B56ZZen7SyGUAU-/0/1745344247197/team\_bridge\_logo?e=2147483647&v=beta&t=ECNI7VoPpXlp-XipgI\_1YMI3GLYDkpoq0ssvkQoO2UA"

location:"San Francisco, CA"

postedDate:"1 week ago"

exactDate:"2025-08-17"

url:"https://www.linkedin.com/jobs/view/4287757824"

entityUrn:"urn:li:jobPosting:4287757824"

\[9\]:

jobId:"4289739766"

title:"Junior Web Developer (Permanent WFH/Remote setup)"

screenReader:"Junior Web Developer (Permanent WFH/Remote setup)"

company:

name:"Lensa"

url:"https://www.linkedin.com/company/lensa"

imageUrl:"https://media.licdn.com/dms/image/v2/D4D0BAQEkHa-0Aki9XQ/company-logo\_100\_100/B4DZaKylu7GsAQ-/0/1746085240184/lensa\_logo?e=2147483647&v=beta&t=vxuqQreX\_wx1J2lugCeUKuGGZtbGyjhRRFeWyrBMnFQ"

location:"United States"

postedDate:"1 day ago"

exactDate:"2025-08-27"

url:"https://www.linkedin.com/jobs/view/4289739766"

entityUrn:"urn:li:jobPosting:4289739766"

\[10\]:

jobId:"4280235420"

title:"Node.js Backend Developer - United States"

screenReader:"Node.js Backend Developer - United States"

company:

name:"JumpCloud"

url:"https://www.linkedin.com/company/jumpcloud"

imageUrl:"https://media.licdn.com/dms/image/v2/D4D0BAQGQEJvpnyM3Bw/company-logo\_100\_100/company-logo\_100\_100/0/1721926888915/jumpcloud\_logo?e=2147483647&v=beta&t=qym\_7dn1fGW-lo2UTHrDLHaxzEcVS4byZn9qck8K\_V4"

location:"Charlotte, NC"

postedDate:"2 weeks ago"

exactDate:"2025-08-08"

url:"https://www.linkedin.com/jobs/view/4280235420"

entityUrn:"urn:li:jobPosting:4280235420"

\[11\]:

jobId:"4291978301"

title:"Staff Software Engineer, Backend"

screenReader:"Staff Software Engineer, Backend"

company:

name:"Tinder"

url:"https://www.linkedin.com/company/tinder-incorporated"

imageUrl:"https://media.licdn.com/dms/image/v2/C560BAQGXi3o84QXQnw/company-logo\_100\_100/company-logo\_100\_100/0/1652919833346/tinder\_incorporated\_logo?e=2147483647&v=beta&t=8LEaFsSXxauZwQqF8LfCfmp26NPOvf4Q9WOLk1F8z9I"

location:"New York, NY"

postedDate:"19 hours ago"

exactDate:"2025-08-28"

url:"https://www.linkedin.com/jobs/view/4291978301"

entityUrn:"urn:li:jobPosting:4291978301"

benefits:"Actively Hiring"

\[12\]:

jobId:"4262695092"

title:"Software Engineer (New Grad Program)"

screenReader:"Software Engineer (New Grad Program)"

company:

name:"Sigma"

url:"https://www.linkedin.com/company/sigmacomputing"

imageUrl:"https://media.licdn.com/dms/image/v2/D560BAQFF9HTPVWjdbQ/company-logo\_100\_100/company-logo\_100\_100/0/1687535336598/sigmacomputing\_logo?e=2147483647&v=beta&t=am5UOCZalnOzOl7wVpgFhNhAT2ltbbPZO4BfNcit7DY"

location:"New York, NY"

postedDate:"3 days ago"

exactDate:"2025-08-25"

url:"https://www.linkedin.com/jobs/view/4262695092"

entityUrn:"urn:li:jobPosting:4262695092"

benefits:"Actively Hiring"

\[13\]:

jobId:"4280233763"

title:"Node.js Backend Developer - United States"

screenReader:"Node.js Backend Developer - United States"

company:

name:"JumpCloud"

url:"https://www.linkedin.com/company/jumpcloud"

imageUrl:"https://media.licdn.com/dms/image/v2/D4D0BAQGQEJvpnyM3Bw/company-logo\_100\_100/company-logo\_100\_100/0/1721926888915/jumpcloud\_logo?e=2147483647&v=beta&t=qym\_7dn1fGW-lo2UTHrDLHaxzEcVS4byZn9qck8K\_V4"

location:"Atlanta, GA"

postedDate:"2 weeks ago"

exactDate:"2025-08-08"

url:"https://www.linkedin.com/jobs/view/4280233763"

entityUrn:"urn:li:jobPosting:4280233763"

benefits:"Be an early applicant"

\[14\]:

jobId:"4243684882"

title:"Software Engineer - Backend"

screenReader:"Software Engineer - Backend"

company:

name:"Plaid"

url:"https://www.linkedin.com/company/plaid-"

imageUrl:"https://media.licdn.com/dms/image/v2/D4E0BAQET1PssqfCU5g/company-logo\_100\_100/B4EZarmEzJGYAY-/0/1746635608257/plaid\_\_logo?e=2147483647&v=beta&t=fiFr2KJFzSNufIcHLyRdsg9kzJviRTfZilOvCt99Hg0"

location:"New York, NY"

postedDate:"2 weeks ago"

exactDate:"2025-08-10"

url:"https://www.linkedin.com/jobs/view/4243684882"

entityUrn:"urn:li:jobPosting:4243684882"

\[15\]:

jobId:"4279670718"

title:"Backend Engineer"

screenReader:"Backend Engineer"

company:

name:"Stripe"

url:"https://www.linkedin.com/company/stripe"

imageUrl:"https://media.licdn.com/dms/image/v2/D4E0BAQFqiwiSMcKk6A/company-logo\_100\_100/company-logo\_100\_100/0/1724937022726/stripe\_logo?e=2147483647&v=beta&t=izBBwlcagZ\_29QyD8kRFwxdV4\_reYlATZI7uBtin61I"

location:"Buffalo-Niagara Falls Area"

postedDate:"2 days ago"

exactDate:"2025-08-26"

url:"https://www.linkedin.com/jobs/view/4279670718"

entityUrn:"urn:li:jobPosting:4279670718"

benefits:"Actively Hiring"

\[16\]:

jobId:"4292536319"

title:"Software Engineer"

screenReader:"Software Engineer"

company:

name:"Breeze Airways™"

url:"https://www.linkedin.com/company/breeze-airways"

imageUrl:"https://media.licdn.com/dms/image/v2/C4E0BAQGtmZOcRZkNEA/company-logo\_100\_100/company-logo\_100\_100/0/1661879601898/breeze\_airways\_logo?e=2147483647&v=beta&t=6xj50GMEaQm5CdldXmQ5z8vvyMJaClggiJ1seMNNDlc"

location:"Cottonwood Heights, UT"

postedDate:"3 hours ago"

exactDate:"2025-08-28"

url:"https://www.linkedin.com/jobs/view/4292536319"

entityUrn:"urn:li:jobPosting:4292536319"

\[17\]:

jobId:"4291611170"

title:"Node Developer"

screenReader:"Node Developer"

company:

name:"Infobahn Softworld Inc"

url:"https://www.linkedin.com/company/infobahn-softworld-inc"

imageUrl:"https://media.licdn.com/dms/image/v2/C4D0BAQE6\_7G8IWKcrw/company-logo\_100\_100/company-logo\_100\_100/0/1631320957267?e=2147483647&v=beta&t=E54ngbKzwURr7HG-cHgQgSRATB-X5OpyQWXRAfemo0k"

location:"San Francisco Bay Area"

postedDate:"2 days ago"

exactDate:"2025-08-26"

url:"https://www.linkedin.com/jobs/view/4291611170"

entityUrn:"urn:li:jobPosting:4291611170"

benefits:"Actively Hiring"

\[18\]:

jobId:"4280237277"

title:"Node.js Backend Developer - United States"

screenReader:"Node.js Backend Developer - United States"

company:

name:"JumpCloud"

url:"https://www.linkedin.com/company/jumpcloud"

imageUrl:"https://media.licdn.com/dms/image/v2/D4D0BAQGQEJvpnyM3Bw/company-logo\_100\_100/company-logo\_100\_100/0/1721926888915/jumpcloud\_logo?e=2147483647&v=beta&t=qym\_7dn1fGW-lo2UTHrDLHaxzEcVS4byZn9qck8K\_V4"

location:"Austin, TX"

postedDate:"2 weeks ago"

exactDate:"2025-08-08"

url:"https://www.linkedin.com/jobs/view/4280237277"

entityUrn:"urn:li:jobPosting:4280237277"

benefits:"Be an early applicant"

\[19\]:

jobId:"4292523049"

title:"Back End Developer"

screenReader:"Back End Developer"

company:

name:"Sierra Digital Inc"

url:"https://www.linkedin.com/company/sierradigital"

imageUrl:"https://media.licdn.com/dms/image/v2/C510BAQFKPxbHmRIX6Q/company-logo\_100\_100/company-logo\_100\_100/0/1630569994441/sierradigitalinc\_logo?e=2147483647&v=beta&t=viGC0fZ4F9Wp3nUyyNVPpOM-\_9Oy82b1WDptFECxCnI"

location:"United States"

postedDate:"4 hours ago"

exactDate:"2025-08-28"

url:"https://www.linkedin.com/jobs/view/4292523049"

entityUrn:"urn:li:jobPosting:4292523049"

benefits:"Actively Hiring"

\[20\]:

jobId:"4280233764"

title:"Node.js Backend Developer - United States"

screenReader:"Node.js Backend Developer - United States"

company:

name:"JumpCloud"

url:"https://www.linkedin.com/company/jumpcloud"

imageUrl:"https://media.licdn.com/dms/image/v2/D4D0BAQGQEJvpnyM3Bw/company-logo\_100\_100/company-logo\_100\_100/0/1721926888915/jumpcloud\_logo?e=2147483647&v=beta&t=qym\_7dn1fGW-lo2UTHrDLHaxzEcVS4byZn9qck8K\_V4"

location:"Detroit, MI"

postedDate:"2 weeks ago"

exactDate:"2025-08-08"

url:"https://www.linkedin.com/jobs/view/4280233764"

entityUrn:"urn:li:jobPosting:4280233764"

benefits:"Be an early applicant"

\[21\]:

jobId:"4291315356"

title:"Junior Full-Stack Developer - Backend Specialist"

screenReader:"Junior Full-Stack Developer - Backend Specialist"

company:

name:"Hawke Media"

url:"https://www.linkedin.com/company/hawkemedia"

imageUrl:"https://media.licdn.com/dms/image/v2/D560BAQGEzX42NJE4bQ/company-logo\_100\_100/company-logo\_100\_100/0/1666111409555/hawkemedia\_logo?e=2147483647&v=beta&t=p2TTQEPw4Uf7L9UsH-IsID\_kb8o-J9FPls5b44Stsg0"

location:"Santa Monica, CA"

postedDate:"2 days ago"

exactDate:"2025-08-26"

url:"https://www.linkedin.com/jobs/view/4291315356"

entityUrn:"urn:li:jobPosting:4291315356"

benefits:"Actively Hiring"

\[22\]:

jobId:"4280233765"

title:"Node.js Backend Developer - United States"

screenReader:"Node.js Backend Developer - United States"

company:

name:"JumpCloud"

url:"https://www.linkedin.com/company/jumpcloud"

imageUrl:"https://media.licdn.com/dms/image/v2/D4D0BAQGQEJvpnyM3Bw/company-logo\_100\_100/company-logo\_100\_100/0/1721926888915/jumpcloud\_logo?e=2147483647&v=beta&t=qym\_7dn1fGW-lo2UTHrDLHaxzEcVS4byZn9qck8K\_V4"

location:"Denver, CO"

postedDate:"2 weeks ago"

exactDate:"2025-08-08"

url:"https://www.linkedin.com/jobs/view/4280233765"

entityUrn:"urn:li:jobPosting:4280233765"

\[23\]:

jobId:"4289808823"

title:"Node.js Developer"

screenReader:"Node.js Developer"

company:

name:"Expedite Technology Solutions LLC"

url:"https://www.linkedin.com/company/expedite-technology-solutions-llc"

imageUrl:"https://media.licdn.com/dms/image/v2/C4E0BAQGeGMJ9ulTrag/company-logo\_100\_100/company-logo\_100\_100/0/1635179023686?e=2147483647&v=beta&t=YXJo2x4Qm5LUDbVrXJ6g\_HMhESATn6Xv44VSVx6-Dhg"

location:"Foster City, CA"

postedDate:"1 day ago"

exactDate:"2025-08-27"

url:"https://www.linkedin.com/jobs/view/4289808823"

entityUrn:"urn:li:jobPosting:4289808823"

benefits:"Be an early applicant"

\[24\]:

jobId:"4290307598"

title:"Software Engineer"

screenReader:"Software Engineer"

company:

name:"Endgame"

url:"https://www.linkedin.com/company/endgame-ai"

imageUrl:"https://media.licdn.com/dms/image/v2/D560BAQEyJuqidkFhGA/company-logo\_100\_100/B56ZdX.CW8HoAQ-/0/1749527570415/endgame\_ai\_logo?e=2147483647&v=beta&t=eM-L1IGP4hvRUvrMQcczTypltz6BTUt4tYXT4yxi2FM"

location:"New York, NY"

postedDate:"1 day ago"

exactDate:"2025-08-27"

url:"https://www.linkedin.com/jobs/view/4290307598"

entityUrn:"urn:li:jobPosting:4290307598"

\[25\]:

jobId:"4221959281"

title:"Software Engineer, Backend"

screenReader:"Software Engineer, Backend"

company:

name:"Hayden AI"

url:"https://www.linkedin.com/company/haydenaitech"

imageUrl:"https://media.licdn.com/dms/image/v2/D4E0BAQFbIajjHyBeNw/company-logo\_100\_100/company-logo\_100\_100/0/1720554213394/haydenaitech\_logo?e=2147483647&v=beta&t=7YG-JZ9pkOb\_vTk\_EUr6KlCgCi9KKT5573gaOJS6DjA"

location:"San Francisco, CA"

postedDate:"3 months ago"

exactDate:"2025-05-06"

url:"https://www.linkedin.com/jobs/view/4221959281"

entityUrn:"urn:li:jobPosting:4221959281"

benefits:"Actively Hiring"

\[26\]:

jobId:"4279039173"

title:"Remote Backend SWE"

screenReader:"Remote Backend SWE"

company:

name:"Employer.com"

url:"https://www.linkedin.com/company/employer-com"

imageUrl:"https://media.licdn.com/dms/image/v2/D560BAQFZ0Paz8xcEVg/company-logo\_100\_100/company-logo\_100\_100/0/1731567680338/employer\_com\_logo?e=2147483647&v=beta&t=tCfpKnczvaZpfc3\_T-Q69QTsiuPFn5pLz3E-pcRG2vM"

location:"San Francisco, CA"

postedDate:"3 weeks ago"

exactDate:"2025-08-01"

url:"https://www.linkedin.com/jobs/view/4279039173"

entityUrn:"urn:li:jobPosting:4279039173"

benefits:"Be an early applicant"

\[27\]:

jobId:"4237066524"

title:"Software Engineer I"

screenReader:"Software Engineer I"

company:

name:"Twitch"

url:"https://www.linkedin.com/company/twitch-tv"

imageUrl:"https://media.licdn.com/dms/image/v2/D560BAQHbYCvrNGC17g/company-logo\_100\_100/company-logo\_100\_100/0/1695062101897/twitch\_tv\_logo?e=2147483647&v=beta&t=uqZASN7sr7mZBei\_6o-tFrTEho8x-ttcnGLk4zejrSg"

location:"Seattle, WA"

postedDate:"5 days ago"

exactDate:"2025-08-23"

url:"https://www.linkedin.com/jobs/view/4237066524"

entityUrn:"urn:li:jobPosting:4237066524"

\[28\]:

jobId:"4265743683"

title:"(New Grad) Software Engineer"

screenReader:"(New Grad) Software Engineer"

company:

name:"Pylon"

url:"https://www.linkedin.com/company/usepylon"

imageUrl:"https://media.licdn.com/dms/image/v2/D4E0BAQF49w56NFgEtg/company-logo\_100\_100/B4EZjJTBdlGwAc-/0/1755723864237/usepylon\_logo?e=2147483647&v=beta&t=IJYkAlg2guBhfxnbpAa1o\_jX3GYOST0dIsk2YmLRrKI"

location:"San Francisco, CA"

postedDate:"1 month ago"

exactDate:"2025-07-12"

url:"https://www.linkedin.com/jobs/view/4265743683"

entityUrn:"urn:li:jobPosting:4265743683"

\[29\]:

jobId:"4291912456"

title:"Jr. Full Stack Developer"

screenReader:"Jr. Full Stack Developer"

company:

name:"Axle"

url:"https://www.linkedin.com/company/axle-informatics"

imageUrl:"https://media.licdn.com/dms/image/v2/D4D0BAQE-FI47jYQmHQ/company-logo\_100\_100/company-logo\_100\_100/0/1711994499364/axle\_informatics\_logo?e=2147483647&v=beta&t=Yym1Nz1GXUdIm4m0YoTgjCT33jyU77ft7s4-Ppj\_Qh4"

location:"Rockville, MD"

postedDate:"1 day ago"

exactDate:"2025-08-27"

url:"https://www.linkedin.com/jobs/view/4291912456"

entityUrn:"urn:li:jobPosting:4291912456"

benefits:"Actively Hiring"

\[30\]:

jobId:"4290716624"

title:"NodeJS Backend Developer"

screenReader:"NodeJS Backend Developer"

company:

name:"Minisoft Technologies LLC"

url:"https://www.linkedin.com/company/minisoft-tech"

imageUrl:"https://media.licdn.com/dms/image/v2/D560BAQForz-J2VtuZg/company-logo\_100\_100/B56ZfmiosGHUAU-/0/1751919529195/minisoft\_tech\_logo?e=2147483647&v=beta&t=oxUljucYSZv0xDOnn2luQ32UnY968CxTDXYGtagP-qM"

location:"United States"

postedDate:"7 hours ago"

exactDate:"2025-08-28"

url:"https://www.linkedin.com/jobs/view/4290716624"

entityUrn:"urn:li:jobPosting:4290716624"

\[31\]:

jobId:"4283411451"

title:"Backend Engineer"

screenReader:"Backend Engineer"

company:

name:"Meter"

url:"https://www.linkedin.com/company/meter-com"

imageUrl:"https://media.licdn.com/dms/image/v2/D560BAQFVqQxSDyxZRg/company-logo\_100\_100/B56ZfBlETtHoAQ-/0/1751299409959/meter\_com\_logo?e=2147483647&v=beta&t=vtQDiNMWKbGYCxP\_EdDsMcguUfEOilNR7NGi8LdrY2g"

location:"San Francisco, CA"

postedDate:"2 weeks ago"

exactDate:"2025-08-11"

url:"https://www.linkedin.com/jobs/view/4283411451"

entityUrn:"urn:li:jobPosting:4283411451"

\[32\]:

jobId:"4264466268"

title:"Desenvolvedor Full Stack Junior"

screenReader:"Desenvolvedor Full Stack Junior"

company:

name:"NIC.br"

url:"https://www.linkedin.com/company/nic-br"

imageUrl:"https://media.licdn.com/dms/image/v2/C4D0BAQE50psJzfy0RA/company-logo\_100\_100/company-logo\_100\_100/0/1631302246328?e=2147483647&v=beta&t=h2HsADG0rqlvQksB73WJwSSB8o\_PYyHPCAL20lsY73M"

location:"Delaware, United States"

postedDate:"1 month ago"

exactDate:"2025-07-14"

url:"https://www.linkedin.com/jobs/view/4264466268"

entityUrn:"urn:li:jobPosting:4264466268"

\[33\]:

jobId:"4280236333"

title:"Node.js Backend Developer - United States"

screenReader:"Node.js Backend Developer - United States"

company:

name:"JumpCloud"

url:"https://www.linkedin.com/company/jumpcloud"

imageUrl:"https://media.licdn.com/dms/image/v2/D4D0BAQGQEJvpnyM3Bw/company-logo\_100\_100/company-logo\_100\_100/0/1721926888915/jumpcloud\_logo?e=2147483647&v=beta&t=qym\_7dn1fGW-lo2UTHrDLHaxzEcVS4byZn9qck8K\_V4"

location:"St Louis, MO"

postedDate:"2 weeks ago"

exactDate:"2025-08-08"

url:"https://www.linkedin.com/jobs/view/4280236333"

entityUrn:"urn:li:jobPosting:4280236333"

benefits:"Be an early applicant"

\[34\]:

jobId:"4224229547"

title:"Full-Stack Engineer"

screenReader:"Full-Stack Engineer"

company:

name:"Campfire"

url:"https://www.linkedin.com/company/meetcampfire"

imageUrl:"https://media.licdn.com/dms/image/v2/D4E0BAQE471W7qBvdmw/company-logo\_100\_100/company-logo\_100\_100/0/1721682987830/meetcampfire\_logo?e=2147483647&v=beta&t=9hdQpifL2SZTtPb1lfe9IygN4WIixdEHz\_pJKEQSbUg"

location:"San Francisco, CA"

postedDate:"3 months ago"

exactDate:"2025-05-09"

url:"https://www.linkedin.com/jobs/view/4224229547"

entityUrn:"urn:li:jobPosting:4224229547"

benefits:"Actively Hiring"

\[35\]:

jobId:"4287559510"

title:"Software Engineer (Full-Stack)"

screenReader:"Software Engineer (Full-Stack)"

company:

name:"Paces"

url:"https://www.linkedin.com/company/pacesai"

imageUrl:"https://media.licdn.com/dms/image/v2/D4E0BAQEkl2SXf3S0ag/company-logo\_100\_100/company-logo\_100\_100/0/1730398908387/pacesai\_logo?e=2147483647&v=beta&t=MY41KqKcYejKtJU0RLk7s9P4t5CpmS8CRRC2HeRdErQ"

location:"Brooklyn, NY"

postedDate:"1 week ago"

exactDate:"2025-08-18"

url:"https://www.linkedin.com/jobs/view/4287559510"

entityUrn:"urn:li:jobPosting:4287559510"

\[36\]:

jobId:"4290395855"

title:"Founding Fullstack Engineer"

screenReader:"Founding Fullstack Engineer"

company:

name:"Weekday AI (YC W21)"

url:"https://www.linkedin.com/company/weekdayjobs"

imageUrl:"https://media.licdn.com/dms/image/v2/D560BAQFMGKC-EvAWpg/company-logo\_100\_100/company-logo\_100\_100/0/1737539347361/weekdayjobs\_logo?e=2147483647&v=beta&t=ieIgvB8kFgzbxY41wBcAR7jpNOrDOqFB53OKC5vWkuQ"

location:"New York, NY"

postedDate:"11 hours ago"

exactDate:"2025-08-28"

url:"https://www.linkedin.com/jobs/view/4290395855"

entityUrn:"urn:li:jobPosting:4290395855"

\[37\]:

jobId:"4267599054"

title:"Software Developer, Backend"

screenReader:"Software Developer, Backend"

company:

name:"Gruve"

url:"https://www.linkedin.com/company/gruveai"

imageUrl:"https://media.licdn.com/dms/image/v2/D560BAQFujtFVjJTUGg/company-logo\_100\_100/B56ZcY.lD9GsA4-/0/1748470747678/gruveai\_logo?e=2147483647&v=beta&t=0wSLYROTnnAxBSSizD8HHHtLFCfNbHDxUAzzcupX0Ho"

location:"United States"

postedDate:"10 hours ago"

exactDate:"2025-08-28"

url:"https://www.linkedin.com/jobs/view/4267599054"

entityUrn:"urn:li:jobPosting:4267599054"

\[38\]:

jobId:"4290727558"

title:"Full Stack Developer"

screenReader:"Full Stack Developer"

company:

name:"Monster Reservations Group"

url:"https://www.linkedin.com/company/monster-reservations-group"

imageUrl:"https://media.licdn.com/dms/image/v2/D4E0BAQEwd5tVkXVTZg/company-logo\_100\_100/B4EZUprBIrHgAU-/0/1740160903159/monster\_reservations\_group\_logo?e=2147483647&v=beta&t=o7KUu4P28rVkIHVjQd2hy179qlW5XVV-oXuXRaecsYU"

location:"Myrtle Beach, SC"

postedDate:"6 hours ago"

exactDate:"2025-08-28"

url:"https://www.linkedin.com/jobs/view/4290727558"

entityUrn:"urn:li:jobPosting:4290727558"

\[39\]:

jobId:"4291363671"

title:"Software Engineer (entry)"

screenReader:"Software Engineer (entry)"

company:

name:"Jerry"

url:"https://www.linkedin.com/company/jerryinc"

imageUrl:"https://media.licdn.com/dms/image/v2/C560BAQFn2QCrOCDMwg/company-logo\_100\_100/company-logo\_100\_100/0/1630648185818/jerryinc\_logo?e=2147483647&v=beta&t=av36t83Kd04m6aR-OU4KCi1lrpySrASAdTcDVKhzXsY"

location:"San Francisco Bay Area"

postedDate:"1 day ago"

exactDate:"2025-08-26"

url:"https://www.linkedin.com/jobs/view/4291363671"

entityUrn:"urn:li:jobPosting:4291363671"

\[40\]:

jobId:"4278551515"

title:"Software Engineer, Public API"

screenReader:"Software Engineer, Public API"

company:

name:"Notion"

url:"https://www.linkedin.com/company/notionhq"

imageUrl:"https://media.licdn.com/dms/image/v2/D4E0BAQGwvcv\_1tHZ4w/company-logo\_100\_100/B4EZW25gE2GgAQ-/0/1742530282185/notionhq\_logo?e=2147483647&v=beta&t=h\_sgZm5R2TgP9Fpbo95m2wmxnSDoEz06eupofZwpSXs"

location:"New York, NY"

postedDate:"6 days ago"

exactDate:"2025-08-22"

url:"https://www.linkedin.com/jobs/view/4278551515"

entityUrn:"urn:li:jobPosting:4278551515"

benefits:"Actively Hiring"

\[41\]:

jobId:"4240371549"

title:"NodeJS Developer"

screenReader:"NodeJS Developer"

company:

name:"CapB InfoteK"

url:"https://www.linkedin.com/company/capb-infotek"

imageUrl:"https://media.licdn.com/dms/image/v2/C4D0BAQH4pVNWslqq4g/company-logo\_100\_100/company-logo\_100\_100/0/1631314995125?e=2147483647&v=beta&t=XuHC1HLyz6TYT0vbVzoExJilZG7Ny9-uXVkW6vISLA0"

location:"Coral Springs, FL"

postedDate:"3 months ago"

exactDate:"2025-05-29"

url:"https://www.linkedin.com/jobs/view/4240371549"

entityUrn:"urn:li:jobPosting:4240371549"

\[42\]:

jobId:"4277288140"

title:"Backend Engineer"

screenReader:"Backend Engineer"

company:

name:"Ascertain"

url:"https://www.linkedin.com/company/ascertain-ai"

imageUrl:"https://media.licdn.com/dms/image/v2/D4E0BAQFP3BizpMbf3g/company-logo\_100\_100/company-logo\_100\_100/0/1692211752448/ascertain\_ai\_logo?e=2147483647&v=beta&t=DEVCCjWHjZSOjMsiQNoUAh\_vMK5euZdP0JBVd81vN30"

location:"New York, NY"

postedDate:"1 month ago"

exactDate:"2025-07-28"

url:"https://www.linkedin.com/jobs/view/4277288140"

entityUrn:"urn:li:jobPosting:4277288140"

benefits:"Be an early applicant"

\[43\]:

jobId:"4270552628"

title:"\[New Grad\] Software Engineer"

screenReader:"\[New Grad\] Software Engineer"

company:

name:"Atomus"

url:"https://www.linkedin.com/company/atomus"

imageUrl:"https://media.licdn.com/dms/image/v2/D560BAQENwc5zVUdkpQ/company-logo\_100\_100/company-logo\_100\_100/0/1728083074680/atomus\_logo?e=2147483647&v=beta&t=k0pmJK2t8dLW2dVwS3SiLlDi8qcdjUZUYsK6YAd5VK8"

location:"San Francisco, CA"

postedDate:"3 weeks ago"

exactDate:"2025-08-06"

url:"https://www.linkedin.com/jobs/view/4270552628"

entityUrn:"urn:li:jobPosting:4270552628"

benefits:"Medical insurance +3 benefits"

\[44\]:

jobId:"4250579172"

title:"Software Developer – SMA & Muni Trading"

screenReader:"Software Developer – SMA & Muni Trading"

company:

name:"PIMCO"

url:"https://www.linkedin.com/company/pimco"

imageUrl:"https://media.licdn.com/dms/image/v2/D560BAQHa1T60UOIHlA/company-logo\_100\_100/B56ZjCo3iZG4AU-/0/1755612152990?e=2147483647&v=beta&t=2nL0NyTu20RZwQuGuybXSS6FchXBNEg833iWVl31pm8"

location:"San Diego, CA"

postedDate:"1 week ago"

exactDate:"2025-08-20"

url:"https://www.linkedin.com/jobs/view/4250579172"

entityUrn:"urn:li:jobPosting:4250579172"

\[45\]:

jobId:"4278551514"

title:"Software Engineer, Public API"

screenReader:"Software Engineer, Public API"

company:

name:"Notion"

url:"https://www.linkedin.com/company/notionhq"

imageUrl:"https://media.licdn.com/dms/image/v2/D4E0BAQGwvcv\_1tHZ4w/company-logo\_100\_100/B4EZW25gE2GgAQ-/0/1742530282185/notionhq\_logo?e=2147483647&v=beta&t=h\_sgZm5R2TgP9Fpbo95m2wmxnSDoEz06eupofZwpSXs"

location:"San Francisco, CA"

postedDate:"6 days ago"

exactDate:"2025-08-22"

url:"https://www.linkedin.com/jobs/view/4278551514"

entityUrn:"urn:li:jobPosting:4278551514"

benefits:"Actively Hiring"

\[46\]:

jobId:"4279039411"

title:"Software Engineer - Early Career"

screenReader:"Software Engineer - Early Career"

company:

name:"Numeric"

url:"https://www.linkedin.com/company/numeric-io"

imageUrl:"https://media.licdn.com/dms/image/v2/D4E0BAQHu6Sq5-XCPWQ/company-logo\_100\_100/company-logo\_100\_100/0/1716415523093/numeric\_io\_logo?e=2147483647&v=beta&t=au1PYVngYCHU\_8xs-cJbm8gLGzIJIgObka7bfJjJc-E"

location:"New York, NY"

postedDate:"3 weeks ago"

exactDate:"2025-08-01"

url:"https://www.linkedin.com/jobs/view/4279039411"

entityUrn:"urn:li:jobPosting:4279039411"

\[47\]:

jobId:"4290965711"

title:"Full Stack Engineer"

screenReader:"Full Stack Engineer"

company:

name:"Pearpop"

url:"https://www.linkedin.com/company/pearpop"

imageUrl:"https://media.licdn.com/dms/image/v2/C560BAQEuMIOckaO-GA/company-logo\_100\_100/company-logo\_100\_100/0/1658588179114/pearpop\_logo?e=2147483647&v=beta&t=7ilRY3MJqn2sZtScliBTtte8NnyGkbkRHEIrfUUjKSs"

location:"Los Angeles, CA"

postedDate:"2 days ago"

exactDate:"2025-08-25"

url:"https://www.linkedin.com/jobs/view/4290965711"

entityUrn:"urn:li:jobPosting:4290965711"

benefits:"Actively Hiring"

\[48\]:

jobId:"4291922646"

title:"Software Engineer"

screenReader:"Software Engineer"

company:

name:"Quantcast"

url:"https://www.linkedin.com/company/quantcast"

imageUrl:"https://media.licdn.com/dms/image/v2/D4E0BAQHgcT9K-gw5dA/company-logo\_100\_100/company-logo\_100\_100/0/1719255882048/quantcast\_logo?e=2147483647&v=beta&t=B9v1ZGgT\_\_WOvcxJOKDOWzBJJH6fXOc4AEJ8SK-llzM"

location:"San Francisco, CA"

postedDate:"1 day ago"

exactDate:"2025-08-27"

url:"https://www.linkedin.com/jobs/view/4291922646"

entityUrn:"urn:li:jobPosting:4291922646"

\[49\]:

jobId:"4292560235"

title:"Junior Software Developer Intern"

screenReader:"Junior Software Developer Intern"

company:

name:"Prescient Edge"

url:"https://www.linkedin.com/company/prescient-edge-corp"

imageUrl:"https://media.licdn.com/dms/image/v2/C4D0BAQFn2IFEfLe6Ag/company-logo\_100\_100-alternative/company-logo\_100\_100-alternative/0/1630478895767/prescient\_edge\_corp\_logo?e=2147483647&v=beta&t=ov5af8Ah1p4gyejx7udcs89I7OY8bvGrpcz4F4AbySc"

location:"McLean, VA"

postedDate:"1 hour ago"

exactDate:"2025-08-28"

url:"https://www.linkedin.com/jobs/view/4292560235"

entityUrn:"urn:li:jobPosting:4292560235"

benefits:"Actively Hiring"

\[50\]:

jobId:"4291518267"

title:"Full Stack Developer"

screenReader:"Full Stack Developer"

company:

name:"Meyer Distributing"

url:"https://www.linkedin.com/company/meyer-distributing"

imageUrl:"https://media.licdn.com/dms/image/v2/D560BAQEN2278ZxYIlw/company-logo\_100\_100/company-logo\_100\_100/0/1709066816762/meyer\_distributing\_logo?e=2147483647&v=beta&t=gJJh9zWmofxZ0OTmWfWcjRwcIqfcF2J7wzt6UKb1JHs"

location:"Indianapolis, IN"

postedDate:"1 day ago"

exactDate:"2025-08-27"

url:"https://www.linkedin.com/jobs/view/4291518267"

entityUrn:"urn:li:jobPosting:4291518267"

\[51\]:

jobId:"4280237278"

title:"Node.js Backend Developer - United States"

screenReader:"Node.js Backend Developer - United States"

company:

name:"JumpCloud"

url:"https://www.linkedin.com/company/jumpcloud"

imageUrl:"https://media.licdn.com/dms/image/v2/D4D0BAQGQEJvpnyM3Bw/company-logo\_100\_100/company-logo\_100\_100/0/1721926888915/jumpcloud\_logo?e=2147483647&v=beta&t=qym\_7dn1fGW-lo2UTHrDLHaxzEcVS4byZn9qck8K\_V4"

location:"Kansas City, KS"

postedDate:"2 weeks ago"

exactDate:"2025-08-08"

url:"https://www.linkedin.com/jobs/view/4280237278"

entityUrn:"urn:li:jobPosting:4280237278"

benefits:"Be an early applicant"

\[52\]:

jobId:"4287974608"

title:"Junior Software Engineer"

screenReader:"Junior Software Engineer"

company:

name:"DX"

url:"https://www.linkedin.com/company/developer-experience"

imageUrl:"https://media.licdn.com/dms/image/v2/D560BAQEFTkOwVfIECw/company-logo\_100\_100/company-logo\_100\_100/0/1683840698097/developer\_experience\_logo?e=2147483647&v=beta&t=K05KV8wnWCjTsNqCKRmRuJ9-ETTp6KKr4KCVNhlfEx0"

location:"Salt Lake City, UT"

postedDate:"1 week ago"

exactDate:"2025-08-18"

url:"https://www.linkedin.com/jobs/view/4287974608"

entityUrn:"urn:li:jobPosting:4287974608"

benefits:"Medical insurance +5 benefits"

\[53\]:

jobId:"4248346586"

title:"Full-Stack Engineer"

screenReader:"Full-Stack Engineer"

company:

name:"Instinct Science"

url:"https://www.linkedin.com/company/instinct-science"

imageUrl:"https://media.licdn.com/dms/image/v2/D560BAQEJcaazIwL0yg/company-logo\_100\_100/company-logo\_100\_100/0/1706643958077/instinct\_science\_logo?e=2147483647&v=beta&t=mnzsiZKRLjRB\_pXB1jF7ImP9MMbtJusUfHmhjJmuxfc"

location:"Doylestown, PA"

postedDate:"2 months ago"

exactDate:"2025-06-10"

url:"https://www.linkedin.com/jobs/view/4248346586"

entityUrn:"urn:li:jobPosting:4248346586"

\[54\]:

jobId:"4278739224"

title:"Backend Software Engineer, API Client (Node.js and/or Golang)"

screenReader:"Backend Software Engineer, API Client (Node.js and/or Golang)"

company:

name:"Postman"

url:"https://www.linkedin.com/company/postman-platform"

imageUrl:"https://media.licdn.com/dms/image/v2/C560BAQFf8sH83foEVg/company-logo\_100\_100/company-logo\_100\_100/0/1654794308958/postman\_platform\_logo?e=2147483647&v=beta&t=vhUFiD\_84RWtJWzqMFME4YJ9Jgnne9fH6DlCHgLCIEA"

location:"San Francisco, CA"

postedDate:"6 days ago"

exactDate:"2025-08-22"

url:"https://www.linkedin.com/jobs/view/4278739224"

entityUrn:"urn:li:jobPosting:4278739224"

benefits:"Actively Hiring"

\[55\]:

jobId:"4278856383"

title:"Software Engineer"

screenReader:"Software Engineer"

company:

name:"Prelude"

url:"https://www.linkedin.com/company/preludeedc"

imageUrl:"https://media.licdn.com/dms/image/v2/C560BAQFgP3tcl5\_OSw/company-logo\_100\_100/company-logo\_100\_100/0/1674150265230/preludeedc\_logo?e=2147483647&v=beta&t=gXBzIG3LnFkVVf4iSbb6Ufei3iokUx4XQdJvAHxCYVU"

location:"Austin, Texas Metropolitan Area"

postedDate:"3 weeks ago"

exactDate:"2025-08-06"

url:"https://www.linkedin.com/jobs/view/4278856383"

entityUrn:"urn:li:jobPosting:4278856383"

benefits:"Medical insurance +2 benefits"

\[56\]:

jobId:"4290968425"

title:"Full Stack Engineering (New Grad)"

screenReader:"Full Stack Engineering (New Grad)"

company:

name:"Abridge"

url:"https://www.linkedin.com/company/abridgehq"

imageUrl:"https://media.licdn.com/dms/image/v2/D4E0BAQFkOLTK2ftuYg/company-logo\_100\_100/company-logo\_100\_100/0/1721328310775/abridgehq\_logo?e=2147483647&v=beta&t=lO0zxgosNYj-IGabzZdCte2g07utQ2gdWHb2uYPF45c"

location:"San Francisco, CA"

postedDate:"2 days ago"

exactDate:"2025-08-25"

url:"https://www.linkedin.com/jobs/view/4290968425"

entityUrn:"urn:li:jobPosting:4290968425"

benefits:"Actively Hiring"

\[57\]:

jobId:"4279310424"

title:"Backend Engineer"

screenReader:"Backend Engineer"

company:

name:"Weave"

url:"https://www.linkedin.com/company/weavebio"

imageUrl:"https://media.licdn.com/dms/image/v2/C4D0BAQGhftP-XOOFCQ/company-logo\_100\_100/company-logo\_100\_100/0/1667924414386?e=2147483647&v=beta&t=k3R4JUzsdhZOqcjC9Cry70uER\_J0L\_\_vIn6tY0\_VH4A"

location:"San Francisco, CA"

postedDate:"3 weeks ago"

exactDate:"2025-08-03"

url:"https://www.linkedin.com/jobs/view/4279310424"

entityUrn:"urn:li:jobPosting:4279310424"

\[58\]:

jobId:"4226055826"

title:"Full Stack Engineer - Mainapp"

screenReader:"Full Stack Engineer - Mainapp"

company:

name:"Crypto.com"

url:"https://www.linkedin.com/company/cryptocom"

imageUrl:"https://media.licdn.com/dms/image/v2/D560BAQH4i3rbKCnuYg/company-logo\_100\_100/company-logo\_100\_100/0/1735530715083/cryptocom\_logo?e=2147483647&v=beta&t=9LHfk4h3U\_OsFCHIXGAOyPxAXzr-9BD5M70r9oqiOXg"

location:"Chicago, IL"

postedDate:"10 hours ago"

exactDate:"2025-08-28"

url:"https://www.linkedin.com/jobs/view/4226055826"

entityUrn:"urn:li:jobPosting:4226055826"

benefits:"Actively Hiring"

\[59\]:

jobId:"4270346523"

title:"Full Stack Engineer"

screenReader:"Full Stack Engineer"

company:

name:"Vynca"

url:"https://www.linkedin.com/company/vyncacare"

imageUrl:"https://media.licdn.com/dms/image/v2/D560BAQGoihMuJbFuAg/company-logo\_100\_100/B56ZfMsa4cHEAs-/0/1751485886269/vyncacare\_logo?e=2147483647&v=beta&t=38-AU9SfImdf1UtoDwylH2bRgE3x1ipoGaZlaQahm7s"

location:"San Mateo, CA"

postedDate:"1 month ago"

exactDate:"2025-07-26"

url:"https://www.linkedin.com/jobs/view/4270346523"

entityUrn:"urn:li:jobPosting:4270346523"

totalCount:60

start:0

hasMore:true
