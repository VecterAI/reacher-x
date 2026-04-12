# API Documentation - LinkdAPI

## API Documentation

Professional data API for developers

[Getting Started](/docs/intro)[Pricing](/docs/endpoints-cost)

GET

## Services

[Try it](/playground?endpoint=%2Fapi%2Fv1%2Fsearch%2Fservices&folder=Search)

1 credit

search services (all filters available)

`/api/v1/search/services?keyword=software&start=0&geoUrn=103644278,90009633&profileLanguage=en,ch&serviceCategory=50321,68&count=25`

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

Example:`103644278,90009633`

`profileLanguage`

string

en for English, ch for Chinese, etc...

Example:`en,ch`

`serviceCategory`

string

services ID

Example:`50321,68`

`count`

integer

Example:`25`

### Response Schema

Field

Type

Description

`services`

array<object>

Services offered by the profile

`urn`

string

Unique internal identifier used for detailed profile queries

`serviceID`

string

utc-millisec

`title`

string

Title of the job, post, or article

`providerName`

string

`providerHeadline`

string

`location`

string

Geographic location information

`providerPhotoURL`

string

uri

URL link to this resource

`serviceURL`

string

uri

URL link to this resource

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

services:

\[0\]:

urn:"ACoAADJ6nsMBJiN73NLvFg56FQ4Aqh-wWH8yTlI"

serviceID:"846896835"

title:"Software Testing"

providerName:"Chirag Mathur"

providerHeadline:"Software Developer || AI Engineer"

location:"Bengaluru"

providerPhotoURL:"https://media.licdn.com/dms/image/v2/D4D03AQHj1y0W8AFXJA/profile-displayphoto-shrink\_100\_100/profile-displayphoto-shrink\_100\_100/0/1690972237896?e=1763596800&v=beta&t=OEIrm1Oc14dWQS2zoZmVxi2aKR5zmQYHk4v1F9643F8"

serviceURL:"https://www.linkedin.com/services/page/681b9733504b336858"

\[1\]:

urn:"ACoAACg6PeoBxaYamjmQV9eqX9zK0l5i0LLUmNw"

serviceID:"674905578"

title:"Software Testing"

providerName:"Abel Alejandro Fleitas Perdomo"

providerHeadline:"Software Engineer"

location:"United States"

providerPhotoURL:"https://media.licdn.com/dms/image/v2/D4E03AQH37XmjoLJe-g/profile-displayphoto-shrink\_100\_100/profile-displayphoto-shrink\_100\_100/0/1665628276419?e=1763596800&v=beta&t=0aBvmITvNfaCa1M\_mljZs6nRf066PexMdDPRWBum69M"

serviceURL:"https://www.linkedin.com/services/page/a80b60316b117078a5"

\[2\]:

urn:"ACoAACLhVgoB-eucAzOTkaK9b1BcJSGAMD6oaNs"

serviceID:"585192970"

title:"Software Testing"

description:"I have more than three years of experience with systems architecture and full-stack web development. I have been responsible for developing two new websites serving more than a million users monthly and a chatbot which is used by more than 20K+ users."

providerName:"Raju Kumar"

providerHeadline:"Software Engineer"

location:"Bangalore Urban"

providerPhotoURL:"https://media.licdn.com/dms/image/v2/D5635AQGXW0U7XhrOLA/profile-framedphoto-shrink\_100\_100/profile-framedphoto-shrink\_100\_100/0/1660002772504?e=1762693200&v=beta&t=JDm9QXkEcwGIc8-qhlFJfuBfGYN5MVWIhvEHqTzOsuc"

serviceURL:"https://www.linkedin.com/services/page/19484433142338a29b"

\[3\]:

urn:"ACoAACTGRa8BwxDptmy27LMY1VIS341pK9zJ-V8"

serviceID:"616973743"

title:"Software Testing"

description:"Experienced software engineer focusing in on Game Development, with hands on experience implementing all stages of software development. A lifelong gamer with a passion for turning imagination into reality. A fast learner who is highly organized, detail oriented, and self-motivated."

providerName:"Michael Gleason"

providerHeadline:"6+ Years Experience in Software Development/Automation | Lifelong Gamer With a Passion for Turning Imagination into Reality | Animal Fanatic and World Traveler"

location:"Denver, CO"

providerPhotoURL:"https://media.licdn.com/dms/image/v2/D5603AQF6gdPBYDgJ5Q/profile-displayphoto-shrink\_100\_100/profile-displayphoto-shrink\_100\_100/0/1690922073508?e=1763596800&v=beta&t=krSgKbrTwpPamYZtPI9kVF5l962ZUHE39aU3A083Xcw"

serviceURL:"https://www.linkedin.com/services/page/714a403244533ba338"

\[4\]:

urn:"ACoAAAv1ld4BWjmQ0f4lIXJzIr--EgqEfZUtk2A"

serviceID:"200644062"

title:"Software Testing"

providerName:"Serhan Sari"

providerHeadline:"Software Engineer"

location:"United States"

providerPhotoURL:"https://media.licdn.com/dms/image/v2/D5603AQGaSkYP0e7tHQ/profile-displayphoto-shrink\_100\_100/profile-displayphoto-shrink\_100\_100/0/1686885227100?e=1763596800&v=beta&t=IH4vakWpRyFucj0iPvxpYboYlduELNRsBQZ9Q\_r0TcQ"

serviceURL:"https://www.linkedin.com/services/page/369174326176748a26"

\[5\]:

urn:"ACoAAEvJRs4BF8vpguL9ptUZp-NuWFZSWiWB3_0"

serviceID:"1271482062"

title:"Software Testing"

providerName:"Imran Aziz"

providerHeadline:"Software Developer / IT Professional"

location:"Bengaluru"

providerPhotoURL:"https://media.licdn.com/dms/image/v2/D4E03AQGLP1ll6Ttz5w/profile-displayphoto-shrink\_100\_100/profile-displayphoto-shrink\_100\_100/0/1722956311513?e=1763596800&v=beta&t=xiDe1dlVPr1PKa114kPUza0ALGjlG4vJwPeUPxZ4x5I"

serviceURL:"https://www.linkedin.com/services/page/3140a3331545031639"

\[6\]:

urn:"ACoAACrVhNwBCYARFsWBuN_dwm35O3UTOsi4tCY"

serviceID:"718636252"

title:"Software Testing"

description:"Software Engineer having 3 years of experience and worked with more than 20 clients on Upwork with a 100% job score and all 5/5 reviews."

providerName:"Arpit J."

providerHeadline:"Senior Software Engineer at Sage | AWS Certified Developer"

location:"Bengaluru"

serviceURL:"https://www.linkedin.com/services/page/8012b6319901ab7a9b"

\[7\]:

urn:"ACoAAAlZTCUBUHWurBwB_Y-YujmlcHJFkAUoixQ"

serviceID:"156847141"

title:"Software Testing"

description:"we offer the services listed below: - BSW/Firmware, AUTOSAR, Embedded SW Development - System/Requirement Engineering - MBD, MATLAB/Simulink - Bootloader - HSM/Cyber Security topics - Verification and Validation - Functional Safety ISO26262 Support"

providerName:"Chandram Yegapagol"

providerHeadline:"Managing Director & CEO, IAST Software Solutions Pvt. Ltd"

location:"Bengaluru"

providerPhotoURL:"https://media.licdn.com/dms/image/v2/D5603AQGDBea1gHYNlg/profile-displayphoto-shrink\_100\_100/profile-displayphoto-shrink\_100\_100/0/1708310189770?e=1763596800&v=beta&t=5RjFyUoZzqxMM9uNmicotM--i1Q2WIkEtFDCLY9qseU"

serviceURL:"https://www.linkedin.com/services/page/194498319573338a02"

\[8\]:

urn:"ACoAADrYSGIBv9QOOp25blKdJNeqqZN6NNrE_fw"

serviceID:"987252834"

title:"Software Testing"

providerName:"Mustafa Rushdi"

providerHeadline:"Software Engineer @Amazon"

location:"Palos Hills, IL"

providerPhotoURL:"https://media.licdn.com/dms/image/v2/D5635AQG0-qYIJljoPA/profile-framedphoto-shrink\_100\_100/profile-framedphoto-shrink\_100\_100/0/1680550501921?e=1762693200&v=beta&t=aDUW3yXoD3sxtjRXx9vGVqoX79JvbgK-hYb2lflcpxg"

serviceURL:"https://www.linkedin.com/services/page/76859131b37ab29678"

\[9\]:

urn:"ACoAACNV7EUBjKQUQJF_Ja3cZgRZbJWWlf10y-g"

serviceID:"592833605"

title:"Software Testing"

description:"Currently working for client name Facebook/meta part of silicon validation project. My job role involves in python automation script development for hardware validation (components like NIC,video accelator) Seeking opportunity in python automation/development project."

providerName:"Mohit Sahoo"

providerHeadline:"Senior software Engineer @Aziro | Linux, Automation, Python"

location:"Bengaluru"

providerPhotoURL:"https://media.licdn.com/dms/image/v2/D5603AQE0-nlFhgIa\_g/profile-displayphoto-shrink\_100\_100/profile-displayphoto-shrink\_100\_100/0/1726004022885?e=1763596800&v=beta&t=\_413luL4UO4zW3R6ezK7ZsYiIzBB2ytN-jgSw8PuUpA"

serviceURL:"https://www.linkedin.com/services/page/540564319165605399"

total:1000

start:0

count:10

hasMore:true
