# API Documentation - LinkdAPI

## API Documentation

Professional data API for developers

[Getting Started](/docs/intro)[Pricing](/docs/endpoints-cost)

GET

## Skills

[Try it](/playground?endpoint=%2Fapi%2Fv1%2Fprofile%2Fskills&folder=Profile)

1 credit

Get a user’s profile skills by their URN.

`/api/v1/profile/skills?urn=ACoAAAHT6VYBz_yVpo-jE-Or8WNKjArXMd-S6KM`

### Query Parameters

`urn`

Required

string

Example:`ACoAAAHT6VYBz_yVpo-jE-Or8WNKjArXMd-S6KM`

### Response Schema

Field

Type

Description

`skills`

array<object>

Professional skills and endorsements

`skillName`

string

Name of the professional skill

`endorsementsLink`

string

uri

URL link to this resource

`textActionTarget`

string

uri

`isPassedLinkedInSkillAssessment`

boolean

Whether a skill assessment was passed

`endorsementsCount`

integer

Number of skill endorsements received

### Example Response

InteractiveRaw JSONCode

success:true

statusCode:200

message:"Data retrieved successfully"

data:

skills:

\[0\]:

skillName:"Mentoring"

endorsementsLink:"https://www.linkedin.com/in/mansoorshaikh/details/skills/urn:li:fsd\_skill:(ACoAAAHT6VYBz\_yVpo-jE-Or8WNKjArXMd-S6KM,1)/endorsers?profileUrn=urn%3Ali%3Afsd\_profile%3AACoAAAHT6VYBz\_yVpo-jE-Or8WNKjArXMd-S6KM&tabIndex=0&modalTabIndex=0&detailScreenTabIndex=1"

textActionTarget:"https://www.linkedin.com/search/results/all/?keywords=Mentoring&origin=PROFILE\_PAGE\_SKILL\_NAVIGATION"

isPassedLinkedInSkillAssessment:false

endorsementsCount:1

\[1\]:

skillName:"Problem Solving"

endorsementsLink:""

textActionTarget:"https://www.linkedin.com/search/results/all/?keywords=Problem+Solving&origin=PROFILE\_PAGE\_SKILL\_NAVIGATION"

isPassedLinkedInSkillAssessment:false

endorsementsCount:0

\[2\]:

skillName:"Leadership"

endorsementsLink:""

textActionTarget:"https://www.linkedin.com/search/results/all/?keywords=Leadership&origin=PROFILE\_PAGE\_SKILL\_NAVIGATION"

isPassedLinkedInSkillAssessment:false

endorsementsCount:0

\[3\]:

skillName:"Strategic Planning"

endorsementsLink:""

textActionTarget:"https://www.linkedin.com/search/results/all/?keywords=Strategic+Planning&origin=PROFILE\_PAGE\_SKILL\_NAVIGATION"

isPassedLinkedInSkillAssessment:false

endorsementsCount:0

\[4\]:

skillName:"Cloud Computing"

endorsementsLink:"https://www.linkedin.com/in/mansoorshaikh/details/skills/urn:li:fsd\_skill:(ACoAAAHT6VYBz\_yVpo-jE-Or8WNKjArXMd-S6KM,22)/endorsers?profileUrn=urn%3Ali%3Afsd\_profile%3AACoAAAHT6VYBz\_yVpo-jE-Or8WNKjArXMd-S6KM&tabIndex=0&modalTabIndex=0&detailScreenTabIndex=1"

textActionTarget:"https://www.linkedin.com/search/results/all/?keywords=Cloud+Computing&origin=PROFILE\_PAGE\_SKILL\_NAVIGATION"

isPassedLinkedInSkillAssessment:false

endorsementsCount:30

\[5\]:

skillName:"DevOps"

endorsementsLink:"https://www.linkedin.com/in/mansoorshaikh/details/skills/urn:li:fsd\_skill:(ACoAAAHT6VYBz\_yVpo-jE-Or8WNKjArXMd-S6KM,18)/endorsers?profileUrn=urn%3Ali%3Afsd\_profile%3AACoAAAHT6VYBz\_yVpo-jE-Or8WNKjArXMd-S6KM&tabIndex=0&modalTabIndex=0&detailScreenTabIndex=1"

textActionTarget:"https://www.linkedin.com/search/results/all/?keywords=DevOps&origin=PROFILE\_PAGE\_SKILL\_NAVIGATION"

isPassedLinkedInSkillAssessment:false

endorsementsCount:21

\[6\]:

skillName:"Agile Methodologies"

endorsementsLink:"https://www.linkedin.com/in/mansoorshaikh/details/skills/urn:li:fsd\_skill:(ACoAAAHT6VYBz\_yVpo-jE-Or8WNKjArXMd-S6KM,1311968710)/endorsers?profileUrn=urn%3Ali%3Afsd\_profile%3AACoAAAHT6VYBz\_yVpo-jE-Or8WNKjArXMd-S6KM&tabIndex=0&modalTabIndex=0&detailScreenTabIndex=1"

textActionTarget:"https://www.linkedin.com/search/results/all/?keywords=Agile+Methodologies&origin=PROFILE\_PAGE\_SKILL\_NAVIGATION"

isPassedLinkedInSkillAssessment:true

endorsementsCount:17

\[7\]:

skillName:"Requirements Analysis"

endorsementsLink:"https://www.linkedin.com/in/mansoorshaikh/details/skills/urn:li:fsd\_skill:(ACoAAAHT6VYBz\_yVpo-jE-Or8WNKjArXMd-S6KM,464508201)/endorsers?profileUrn=urn%3Ali%3Afsd\_profile%3AACoAAAHT6VYBz\_yVpo-jE-Or8WNKjArXMd-S6KM&tabIndex=0&modalTabIndex=0&detailScreenTabIndex=1"

textActionTarget:"https://www.linkedin.com/search/results/all/?keywords=Requirements+Analysis&origin=PROFILE\_PAGE\_SKILL\_NAVIGATION"

isPassedLinkedInSkillAssessment:false

endorsementsCount:9

\[8\]:

skillName:"Software Testing"

endorsementsLink:"https://www.linkedin.com/in/mansoorshaikh/details/skills/urn:li:fsd\_skill:(ACoAAAHT6VYBz\_yVpo-jE-Or8WNKjArXMd-S6KM,4)/endorsers?profileUrn=urn%3Ali%3Afsd\_profile%3AACoAAAHT6VYBz\_yVpo-jE-Or8WNKjArXMd-S6KM&tabIndex=0&modalTabIndex=0&detailScreenTabIndex=1"

textActionTarget:"https://www.linkedin.com/search/results/all/?keywords=Software+Testing&origin=PROFILE\_PAGE\_SKILL\_NAVIGATION"

isPassedLinkedInSkillAssessment:false

endorsementsCount:5

\[9\]:

skillName:"Shell Scripting"

endorsementsLink:""

textActionTarget:"https://www.linkedin.com/search/results/all/?keywords=Shell+Scripting&origin=PROFILE\_PAGE\_SKILL\_NAVIGATION"

isPassedLinkedInSkillAssessment:false

endorsementsCount:0

\[10\]:

skillName:"Data Warehousing"

endorsementsLink:""

textActionTarget:"https://www.linkedin.com/search/results/all/?keywords=Data+Warehousing&origin=PROFILE\_PAGE\_SKILL\_NAVIGATION"

isPassedLinkedInSkillAssessment:false

endorsementsCount:0

\[11\]:

skillName:"Coaching"

endorsementsLink:"https://www.linkedin.com/in/mansoorshaikh/details/skills/urn:li:fsd\_skill:(ACoAAAHT6VYBz\_yVpo-jE-Or8WNKjArXMd-S6KM,3)/endorsers?profileUrn=urn%3Ali%3Afsd\_profile%3AACoAAAHT6VYBz\_yVpo-jE-Or8WNKjArXMd-S6KM&tabIndex=0&modalTabIndex=0&detailScreenTabIndex=1"

textActionTarget:"https://www.linkedin.com/search/results/all/?keywords=Coaching&origin=PROFILE\_PAGE\_SKILL\_NAVIGATION"

isPassedLinkedInSkillAssessment:false

endorsementsCount:1

\[12\]:

skillName:"Groovy"

endorsementsLink:""

textActionTarget:"https://www.linkedin.com/search/results/all/?keywords=Groovy&origin=PROFILE\_PAGE\_SKILL\_NAVIGATION"

isPassedLinkedInSkillAssessment:false

endorsementsCount:0

\[13\]:

skillName:"Microservices"

endorsementsLink:""

textActionTarget:"https://www.linkedin.com/search/results/all/?keywords=Microservices&origin=PROFILE\_PAGE\_SKILL\_NAVIGATION"

isPassedLinkedInSkillAssessment:false

endorsementsCount:0

\[14\]:

skillName:"Cloud Foundry"

endorsementsLink:""

textActionTarget:"https://www.linkedin.com/search/results/all/?keywords=Cloud+Foundry&origin=PROFILE\_PAGE\_SKILL\_NAVIGATION"

isPassedLinkedInSkillAssessment:false

endorsementsCount:0

\[15\]:

skillName:"Test Automation"

endorsementsLink:"https://www.linkedin.com/in/mansoorshaikh/details/skills/urn:li:fsd\_skill:(ACoAAAHT6VYBz\_yVpo-jE-Or8WNKjArXMd-S6KM,23)/endorsers?profileUrn=urn%3Ali%3Afsd\_profile%3AACoAAAHT6VYBz\_yVpo-jE-Or8WNKjArXMd-S6KM&tabIndex=0&modalTabIndex=0&detailScreenTabIndex=1"

textActionTarget:"https://www.linkedin.com/search/results/all/?keywords=Test+Automation&origin=PROFILE\_PAGE\_SKILL\_NAVIGATION"

isPassedLinkedInSkillAssessment:false

endorsementsCount:36

\[16\]:

skillName:"Test Planning"

endorsementsLink:"https://www.linkedin.com/in/mansoorshaikh/details/skills/urn:li:fsd\_skill:(ACoAAAHT6VYBz\_yVpo-jE-Or8WNKjArXMd-S6KM,24)/endorsers?profileUrn=urn%3Ali%3Afsd\_profile%3AACoAAAHT6VYBz\_yVpo-jE-Or8WNKjArXMd-S6KM&tabIndex=0&modalTabIndex=0&detailScreenTabIndex=1"

textActionTarget:"https://www.linkedin.com/search/results/all/?keywords=Test+Planning&origin=PROFILE\_PAGE\_SKILL\_NAVIGATION"

isPassedLinkedInSkillAssessment:false

endorsementsCount:2

\[17\]:

skillName:"Software Quality Assurance"

endorsementsLink:"https://www.linkedin.com/in/mansoorshaikh/details/skills/urn:li:fsd\_skill:(ACoAAAHT6VYBz\_yVpo-jE-Or8WNKjArXMd-S6KM,25)/endorsers?profileUrn=urn%3Ali%3Afsd\_profile%3AACoAAAHT6VYBz\_yVpo-jE-Or8WNKjArXMd-S6KM&tabIndex=0&modalTabIndex=0&detailScreenTabIndex=1"

textActionTarget:"https://www.linkedin.com/search/results/all/?keywords=Software+Quality+Assurance&origin=PROFILE\_PAGE\_SKILL\_NAVIGATION"

isPassedLinkedInSkillAssessment:false

endorsementsCount:7

\[18\]:

skillName:"Selenium WebDriver"

endorsementsLink:"https://www.linkedin.com/in/mansoorshaikh/details/skills/urn:li:fsd\_skill:(ACoAAAHT6VYBz\_yVpo-jE-Or8WNKjArXMd-S6KM,26)/endorsers?profileUrn=urn%3Ali%3Afsd\_profile%3AACoAAAHT6VYBz\_yVpo-jE-Or8WNKjArXMd-S6KM&tabIndex=0&modalTabIndex=0&detailScreenTabIndex=1"

textActionTarget:"https://www.linkedin.com/search/results/all/?keywords=Selenium+WebDriver&origin=PROFILE\_PAGE\_SKILL\_NAVIGATION"

isPassedLinkedInSkillAssessment:false

endorsementsCount:1

\[19\]:

skillName:"Behavior-Driven Development (BDD)"

endorsementsLink:""

textActionTarget:"https://www.linkedin.com/search/results/all/?keywords=Behavior-Driven+Development+%28BDD%29&origin=PROFILE\_PAGE\_SKILL\_NAVIGATION"

isPassedLinkedInSkillAssessment:false

endorsementsCount:0

\[20\]:

skillName:"Continuous Delivery"

endorsementsLink:""

textActionTarget:"https://www.linkedin.com/search/results/all/?keywords=Continuous+Delivery&origin=PROFILE\_PAGE\_SKILL\_NAVIGATION"

isPassedLinkedInSkillAssessment:false

endorsementsCount:0

\[21\]:

skillName:"Manual Testing"

endorsementsLink:"https://www.linkedin.com/in/mansoorshaikh/details/skills/urn:li:fsd\_skill:(ACoAAAHT6VYBz\_yVpo-jE-Or8WNKjArXMd-S6KM,32)/endorsers?profileUrn=urn%3Ali%3Afsd\_profile%3AACoAAAHT6VYBz\_yVpo-jE-Or8WNKjArXMd-S6KM&tabIndex=0&modalTabIndex=0&detailScreenTabIndex=1"

textActionTarget:"https://www.linkedin.com/search/results/all/?keywords=Manual+Testing&origin=PROFILE\_PAGE\_SKILL\_NAVIGATION"

isPassedLinkedInSkillAssessment:false

endorsementsCount:1

\[22\]:

skillName:"Quality Assurance"

endorsementsLink:"https://www.linkedin.com/in/mansoorshaikh/details/skills/urn:li:fsd\_skill:(ACoAAAHT6VYBz\_yVpo-jE-Or8WNKjArXMd-S6KM,33)/endorsers?profileUrn=urn%3Ali%3Afsd\_profile%3AACoAAAHT6VYBz\_yVpo-jE-Or8WNKjArXMd-S6KM&tabIndex=0&modalTabIndex=0&detailScreenTabIndex=1"

textActionTarget:"https://www.linkedin.com/search/results/all/?keywords=Quality+Assurance&origin=PROFILE\_PAGE\_SKILL\_NAVIGATION"

isPassedLinkedInSkillAssessment:false

endorsementsCount:7

\[23\]:

skillName:"Scrum"

endorsementsLink:"https://www.linkedin.com/in/mansoorshaikh/details/skills/urn:li:fsd\_skill:(ACoAAAHT6VYBz\_yVpo-jE-Or8WNKjArXMd-S6KM,34)/endorsers?profileUrn=urn%3Ali%3Afsd\_profile%3AACoAAAHT6VYBz\_yVpo-jE-Or8WNKjArXMd-S6KM&tabIndex=0&modalTabIndex=0&detailScreenTabIndex=1"

textActionTarget:"https://www.linkedin.com/search/results/all/?keywords=Scrum&origin=PROFILE\_PAGE\_SKILL\_NAVIGATION"

isPassedLinkedInSkillAssessment:false

endorsementsCount:18

\[24\]:

skillName:"Java"

endorsementsLink:"https://www.linkedin.com/in/mansoorshaikh/details/skills/urn:li:fsd\_skill:(ACoAAAHT6VYBz\_yVpo-jE-Or8WNKjArXMd-S6KM,1312001480)/endorsers?profileUrn=urn%3Ali%3Afsd\_profile%3AACoAAAHT6VYBz\_yVpo-jE-Or8WNKjArXMd-S6KM&tabIndex=2&modalTabIndex=2&detailScreenTabIndex=0"

textActionTarget:"https://www.linkedin.com/search/results/all/?keywords=Java&origin=PROFILE\_PAGE\_SKILL\_NAVIGATION"

isPassedLinkedInSkillAssessment:true

endorsementsCount:0

\[25\]:

skillName:"QTP"

endorsementsLink:"https://www.linkedin.com/in/mansoorshaikh/details/skills/urn:li:fsd\_skill:(ACoAAAHT6VYBz\_yVpo-jE-Or8WNKjArXMd-S6KM,1312008404)/endorsers?profileUrn=urn%3Ali%3Afsd\_profile%3AACoAAAHT6VYBz\_yVpo-jE-Or8WNKjArXMd-S6KM&tabIndex=0&modalTabIndex=0&detailScreenTabIndex=0"

textActionTarget:"https://www.linkedin.com/search/results/all/?keywords=QTP&origin=PROFILE\_PAGE\_SKILL\_NAVIGATION"

isPassedLinkedInSkillAssessment:false

endorsementsCount:8

\[26\]:

skillName:"Oracle"

endorsementsLink:"https://www.linkedin.com/in/mansoorshaikh/details/skills/urn:li:fsd\_skill:(ACoAAAHT6VYBz\_yVpo-jE-Or8WNKjArXMd-S6KM,1312005298)/endorsers?profileUrn=urn%3Ali%3Afsd\_profile%3AACoAAAHT6VYBz\_yVpo-jE-Or8WNKjArXMd-S6KM&tabIndex=0&modalTabIndex=0&detailScreenTabIndex=0"

textActionTarget:"https://www.linkedin.com/search/results/all/?keywords=Oracle&origin=PROFILE\_PAGE\_SKILL\_NAVIGATION"

isPassedLinkedInSkillAssessment:false

endorsementsCount:13

\[27\]:

skillName:"HP Quality Center"

endorsementsLink:"https://www.linkedin.com/in/mansoorshaikh/details/skills/urn:li:fsd\_skill:(ACoAAAHT6VYBz\_yVpo-jE-Or8WNKjArXMd-S6KM,1311999869)/endorsers?profileUrn=urn%3Ali%3Afsd\_profile%3AACoAAAHT6VYBz\_yVpo-jE-Or8WNKjArXMd-S6KM&tabIndex=0&modalTabIndex=0&detailScreenTabIndex=0"

textActionTarget:"https://www.linkedin.com/search/results/all/?keywords=HP+Quality+Center&origin=PROFILE\_PAGE\_SKILL\_NAVIGATION"

isPassedLinkedInSkillAssessment:false

endorsementsCount:6

\[28\]:

skillName:"Microsoft SQL Server"

endorsementsLink:"https://www.linkedin.com/in/mansoorshaikh/details/skills/urn:li:fsd\_skill:(ACoAAAHT6VYBz\_yVpo-jE-Or8WNKjArXMd-S6KM,1312002950)/endorsers?profileUrn=urn%3Ali%3Afsd\_profile%3AACoAAAHT6VYBz\_yVpo-jE-Or8WNKjArXMd-S6KM&tabIndex=0&modalTabIndex=0&detailScreenTabIndex=0"

textActionTarget:"https://www.linkedin.com/search/results/all/?keywords=Microsoft+SQL+Server&origin=PROFILE\_PAGE\_SKILL\_NAVIGATION"

isPassedLinkedInSkillAssessment:false

endorsementsCount:4

\[29\]:

skillName:"C#"

endorsementsLink:"https://www.linkedin.com/in/mansoorshaikh/details/skills/urn:li:fsd\_skill:(ACoAAAHT6VYBz\_yVpo-jE-Or8WNKjArXMd-S6KM,1311971459)/endorsers?profileUrn=urn%3Ali%3Afsd\_profile%3AACoAAAHT6VYBz\_yVpo-jE-Or8WNKjArXMd-S6KM&tabIndex=0&modalTabIndex=0&detailScreenTabIndex=0"

textActionTarget:"https://www.linkedin.com/search/results/all/?keywords=C%23&origin=PROFILE\_PAGE\_SKILL\_NAVIGATION"

isPassedLinkedInSkillAssessment:false

endorsementsCount:1

\[30\]:

skillName:"HP QTP"

endorsementsLink:"https://www.linkedin.com/in/mansoorshaikh/details/skills/urn:li:fsd\_skill:(ACoAAAHT6VYBz\_yVpo-jE-Or8WNKjArXMd-S6KM,1311973359)/endorsers?profileUrn=urn%3Ali%3Afsd\_profile%3AACoAAAHT6VYBz\_yVpo-jE-Or8WNKjArXMd-S6KM&tabIndex=0&modalTabIndex=0&detailScreenTabIndex=0"

textActionTarget:"https://www.linkedin.com/search/results/all/?keywords=HP+QTP&origin=PROFILE\_PAGE\_SKILL\_NAVIGATION"

isPassedLinkedInSkillAssessment:false

endorsementsCount:1

\[31\]:

skillName:"PL/SQL"

endorsementsLink:"https://www.linkedin.com/in/mansoorshaikh/details/skills/urn:li:fsd\_skill:(ACoAAAHT6VYBz\_yVpo-jE-Or8WNKjArXMd-S6KM,1312006872)/endorsers?profileUrn=urn%3Ali%3Afsd\_profile%3AACoAAAHT6VYBz\_yVpo-jE-Or8WNKjArXMd-S6KM&tabIndex=0&modalTabIndex=0&detailScreenTabIndex=0"

textActionTarget:"https://www.linkedin.com/search/results/all/?keywords=PL%2FSQL&origin=PROFILE\_PAGE\_SKILL\_NAVIGATION"

isPassedLinkedInSkillAssessment:false

endorsementsCount:2

\[32\]:

skillName:"Selenium"

endorsementsLink:"https://www.linkedin.com/in/mansoorshaikh/details/skills/urn:li:fsd\_skill:(ACoAAAHT6VYBz\_yVpo-jE-Or8WNKjArXMd-S6KM,2)/endorsers?profileUrn=urn%3Ali%3Afsd\_profile%3AACoAAAHT6VYBz\_yVpo-jE-Or8WNKjArXMd-S6KM&tabIndex=0&modalTabIndex=0&detailScreenTabIndex=0"

textActionTarget:"https://www.linkedin.com/search/results/all/?keywords=Selenium&origin=PROFILE\_PAGE\_SKILL\_NAVIGATION"

isPassedLinkedInSkillAssessment:false

endorsementsCount:2

\[33\]:

skillName:"UFT"

endorsementsLink:""

textActionTarget:"https://www.linkedin.com/search/results/all/?keywords=UFT&origin=PROFILE\_PAGE\_SKILL\_NAVIGATION"

isPassedLinkedInSkillAssessment:false

endorsementsCount:0

\[34\]:

skillName:"Unix"

endorsementsLink:""

textActionTarget:"https://www.linkedin.com/search/results/all/?keywords=Unix&origin=PROFILE\_PAGE\_SKILL\_NAVIGATION"

isPassedLinkedInSkillAssessment:false

endorsementsCount:0

\[35\]:

skillName:"Relational Databases"

endorsementsLink:""

textActionTarget:"https://www.linkedin.com/search/results/all/?keywords=Relational+Databases&origin=PROFILE\_PAGE\_SKILL\_NAVIGATION"

isPassedLinkedInSkillAssessment:false

endorsementsCount:0

\[36\]:

skillName:"Git"

endorsementsLink:"https://www.linkedin.com/in/mansoorshaikh/details/skills/urn:li:fsd\_skill:(ACoAAAHT6VYBz\_yVpo-jE-Or8WNKjArXMd-S6KM,12)/endorsers?profileUrn=urn%3Ali%3Afsd\_profile%3AACoAAAHT6VYBz\_yVpo-jE-Or8WNKjArXMd-S6KM&tabIndex=0&modalTabIndex=0&detailScreenTabIndex=0"

textActionTarget:"https://www.linkedin.com/search/results/all/?keywords=Git&origin=PROFILE\_PAGE\_SKILL\_NAVIGATION"

isPassedLinkedInSkillAssessment:false

endorsementsCount:2

\[37\]:

skillName:"Spring Boot"

endorsementsLink:""

textActionTarget:"https://www.linkedin.com/search/results/all/?keywords=Spring+Boot&origin=PROFILE\_PAGE\_SKILL\_NAVIGATION"

isPassedLinkedInSkillAssessment:false

endorsementsCount:0

\[38\]:

skillName:"Jenkins"

endorsementsLink:"https://www.linkedin.com/in/mansoorshaikh/details/skills/urn:li:fsd\_skill:(ACoAAAHT6VYBz\_yVpo-jE-Or8WNKjArXMd-S6KM,16)/endorsers?profileUrn=urn%3Ali%3Afsd\_profile%3AACoAAAHT6VYBz\_yVpo-jE-Or8WNKjArXMd-S6KM&tabIndex=0&modalTabIndex=0&detailScreenTabIndex=1"

textActionTarget:"https://www.linkedin.com/search/results/all/?keywords=Jenkins&origin=PROFILE\_PAGE\_SKILL\_NAVIGATION"

isPassedLinkedInSkillAssessment:false

endorsementsCount:2

\[39\]:

skillName:"JIRA"

endorsementsLink:""

textActionTarget:"https://www.linkedin.com/search/results/all/?keywords=JIRA&origin=PROFILE\_PAGE\_SKILL\_NAVIGATION"

isPassedLinkedInSkillAssessment:false

endorsementsCount:0

\[40\]:

skillName:"HP QuickTest Professional (QTP)"

endorsementsLink:""

textActionTarget:"https://www.linkedin.com/search/results/all/?keywords=HP+QuickTest+Professional+%28QTP%29&origin=PROFILE\_PAGE\_SKILL\_NAVIGATION"

isPassedLinkedInSkillAssessment:false

endorsementsCount:0

\[41\]:

skillName:"JavaScript"

endorsementsLink:""

textActionTarget:"https://www.linkedin.com/search/results/all/?keywords=JavaScript&origin=PROFILE\_PAGE\_SKILL\_NAVIGATION"

isPassedLinkedInSkillAssessment:false

endorsementsCount:0

\[42\]:

skillName:"JSON"

endorsementsLink:""

textActionTarget:"https://www.linkedin.com/search/results/all/?keywords=JSON&origin=PROFILE\_PAGE\_SKILL\_NAVIGATION"

isPassedLinkedInSkillAssessment:false

endorsementsCount:0

\[43\]:

skillName:"Maven"

endorsementsLink:""

textActionTarget:"https://www.linkedin.com/search/results/all/?keywords=Maven&origin=PROFILE\_PAGE\_SKILL\_NAVIGATION"

isPassedLinkedInSkillAssessment:false

endorsementsCount:0

\[44\]:

skillName:"Cucumber"

endorsementsLink:""

textActionTarget:"https://www.linkedin.com/search/results/all/?keywords=Cucumber&origin=PROFILE\_PAGE\_SKILL\_NAVIGATION"

isPassedLinkedInSkillAssessment:false

endorsementsCount:0
