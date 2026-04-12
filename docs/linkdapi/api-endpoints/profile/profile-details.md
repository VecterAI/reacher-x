# API Documentation - LinkdAPI

## API Documentation

Professional data API for developers

[Getting Started](/docs/intro)[Pricing](/docs/endpoints-cost)

GET

## Profile details

[Try it](/playground?endpoint=%2Fapi%2Fv1%2Fprofile%2Fdetails&folder=Profile)

1 credit

Get profile details information by URN

`/api/v1/profile/details?urn=ACoAAAHT6VYBz_yVpo-jE-Or8WNKjArXMd-S6KM`

### Query Parameters

`urn`

Required

string

Example:`ACoAAAHT6VYBz_yVpo-jE-Or8WNKjArXMd-S6KM`

### Response Schema

Field

Type

Description

`about`

string

Profile summary or bio section

`featuredPosts`

array<object>

`postLink`

string

uri

URL link to this resource

`postText`

string

`positions`

array<object>

Current and past positions

`jobTitle`

string

Position title held

`company`

string

Company name or details

`location`

string

Geographic location information

`duration`

string

Time period in this role

`companyLink`

string

uri

URL to the company page

`companyId`

string

utc-millisec

Unique company identifier

`jobDescription`

string

Description of the role

`education`

array<object>

Educational background

`duration`

string

Time period in this role

`durationParsed`

object

Structured start/end dates

`start`

object

Start date of the period

`year`

integer

`month`

integer

`day`

integer

`end`

object

End date of the period

`year`

integer

`month`

integer

`day`

integer

`university`

string

Name of the educational institution

`universityLink`

string

uri

URL to the institution page

`degree`

string

Degree or qualification earned

`description`

any

nullable

Detailed description or summary

`subDescription`

any

nullable

`languages`

object

Languages spoken

`languages`

array<object>

Languages spoken

`Language`

string

`Level`

string

`deepLink`

string

uri

URL link to this resource

### Example Response

InteractiveRaw JSONCode

success:true

statusCode:200

message:"Data retrieved successfully"

data:

about:". Experience of 19+ years in Software Quality Assurance and Test Automation . Currently working as an Global Automation Lead for 5 projects within Client Reporting group in Securities Services Team within Corporate and Investment Banking Technology (CIB Tech) division. . Rich experience in creating testing and automation strategy. . Hands on experience of working with Java, Selenium, Cucumber, Testng, Maven, Rest Assured. . Hands on experience of creating API Test Automation Framework using Java, Testng, Maven Rest Assured. . Hands on experience of creating BDD Test Automation For Web Application. . Hands on experience of working with API Testing related tools - Postman, SOAP UI, Chrome Dev Tools, Modify Header Plugin, Fiddler. . Hands on experience of defect and test management using HP ALM, JIRA. . Hands on experience on Manual testing - Functional UI, End to End and Regression testing. . Rich experience of working in Agile Methodologies - Scrum and Kanban both. . Hands on experience on implementing Mutation Testing using PIT tool. . Hands on experience in database management systems like Oracle, MySQL, SQL Server, IBM DB2 . Hands on experience of source code version control systems like GIT, Subversion. . Hands on experience of CI / CD pipeline using Jenkins . Hands on experience of performance testing of Web application using jMeter and Blazemeter. . Hands on experience on Kafka and distributed system testing . Rich experience of working in Cloud Computing - Private Cloud . Good knowledge on Cloud providers - Oracle Cloud, AWS . Oracle Cloud Certified. Current Organization - JP Morgan Chase & Co. Previous Organization - GE, Microsoft and Tech Mahindra."

featuredPosts:

\[0\]:

postLink:"https://www.linkedin.com/feed/update/urn:li:activity:7244940347900874753?updateEntityUrn=urn%3Ali%3Afs\_feedUpdate%3A%28V2%2Curn%3Ali%3Aactivity%3A7244940347900874753%29"

postText:"Regular recurring reminder If you are into software testing, automation or software engineering, I will accept your connection request. No need to write lengthy customized connection request message. It does not matter to me if you are an MD or a fresher or a student. As long as you are here to discuss above domains, you are welcome to send me connection request. If you are not into above domains, please unfollow me, else my posts will bore you to the core. Letting you know this beforehand. #testing #automation #softwareengineering"

\[1\]:

postLink:"https://www.linkedin.com/feed/update/urn:li:activity:6986605591880196096?updateEntityUrn=urn%3Ali%3Afs\_feedUpdate%3A%28V2%2Curn%3Ali%3Aactivity%3A6986605591880196096%29"

postText:"Nice to see many of you have similar interests as mine. I am from test automation background. Doing that throughout my career spanning 19 years as of now. This field is always changing and dynamic. Always something new to learn each day. You are only limited by your thinking. Been a developer first few years of my career. Didn't like it. Simply because as application developer you tend to work on same module for long. As automation developer you get to work on many different modules as well as application. Nowadays there is lot in development as well, thanks to cloud burst, I might move to development again in future. No immediate plans as of now. I work on Java and related technologies. I don't think that I will ever move out of this language. Simply because there is lot to learn in this space and this language and related ecosystem has lot to offer. I have worked in service industry ( Tech Mahindra Ltd), product company ( GE and Microsoft) as well as banking ( JP Morgan Chase). I have a good understanding of how these different industries work. All are different. I am glad you follow me. I too follow many of you. Linkedin seem to have finally understood what I prefer in my feeds. Note: I am NOT looking for a job change.Happy with my current firm for 14+ years now."

positions:

\[0\]:

jobTitle:"Vice President - Software Engineering"

company:"JPMorganChase · Full-time"

location:"Mumbai, Maharashtra, India"

duration:"Apr 2010 - Present · 14 yrs 10 mos"

companyLink:"https://www.linkedin.com/company/1068/"

companyId:"1068"

jobDescription:""

\[1\]:

jobTitle:"Advanced Software Engineer"

company:"GE"

location:""

duration:"Jul 2007 - Apr 2010 · 2 yrs 10 mos"

companyLink:"https://www.linkedin.com/company/1015/"

companyId:"1015"

jobDescription:"1. Managing the QA Team. 2. Automating test cases using QTP. 3. Getting team upto speed in Automation by conducting automation tool trainings. 4. Participate in Product Evaluation and Software Benchmarking."

\[2\]:

jobTitle:"Technical Associate"

company:"Tech Mahindra"

location:""

duration:"Apr 2005 - Jun 2007 · 2 yrs 3 mos"

companyLink:"https://www.linkedin.com/company/3067/"

companyId:"3067"

jobDescription:"Worked on Testing Project called HMC (Hosted Messaging and Collaboration)"

\[3\]:

jobTitle:"Software Development Engineer in Test (SDET)"

company:"Microsoft"

location:""

duration:"Nov 2005 - Feb 2007 · 1 yr 4 mos"

companyLink:"https://www.linkedin.com/company/1035/"

companyId:"1035"

jobDescription:"Worked on Client Side at Microsoft IDC on RFID Project for Automation using MAUI (Microsoft Automation Of User Interface). During this time, I was a permanent employee of Tech Mahindra Ltd. Received a token of appreciation from my manager at Microsoft for meeting the automation deadlines. Actively involved in 4 CTP releases of BizTalk RFID. Logged over 300 bugs in a short period of time."

education:

\[0\]:

duration:"2000 - 2004"

durationParsed:

start:

year:2000

month:1

day:1

end:

year:2004

month:1

day:1

university:"University of Mumbai"

universityLink:"https://www.linkedin.com/company/15093732/"

degree:"BE Computers, Computer Engineering"

description:null

subDescription:null

\[1\]:

duration:"2012 - 2014"

durationParsed:

start:

year:2012

month:1

day:1

end:

year:2014

month:1

day:1

university:"Sikkim Manipal University Distance Education"

universityLink:"https://www.linkedin.com/search/results/all/?keywords=Sikkim+Manipal+University+Distance+Education"

degree:"Master of Business Administration (MBA), Accounting and Finance"

description:null

subDescription:null

languages:

languages:

\[0\]:

Language:"English"

Level:"Full professional proficiency"

\[1\]:

Language:"Hindi"

Level:"Full professional proficiency"

deepLink:"https://www.linkedin.com/in/mansoorshaikh/details/languages?profileUrn=urn%3Ali%3Afsd\_profile%3AACoAAAHT6VYBz\_yVpo-jE-Or8WNKjArXMd-S6KM"
