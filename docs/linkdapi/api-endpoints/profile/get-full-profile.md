# API Documentation - LinkdAPI

## API Documentation

Professional data API for developers

[Getting Started](/docs/intro)[Pricing](/docs/endpoints-cost)

GET

## Get Full Profile

[Try it](/playground?endpoint=%2Fapi%2Fv1%2Fprofile%2Ffull&folder=Profile)

1 credit

Retrieve the complete profile in a single request (all fields included). Only a URN or a username is required no need to provide both.

`/api/v1/profile/full?username=ryanroslansky&urn=ACoAAAAKXBwBikfbNJww68eYvcu2dqDYJhHbp4g`

### Query Parameters

`username`

string

Example:`ryanroslansky`

`urn`

string

Example:`ACoAAAAKXBwBikfbNJww68eYvcu2dqDYJhHbp4g`

### Response Schema

Field

Type

Description

`id`

integer

Unique identifier for this resource

`urn`

string

Unique internal identifier used for detailed profile queries

`username`

string

Public username visible in profile URLs

`firstName`

string

First name of the professional

`lastName`

string

Last name of the professional

`isCreator`

boolean

Boolean flag

`isPremium`

boolean

Boolean flag

`profilePicture`

string

uri

`profilePictures`

array<object>

`url`

string

uri

Direct URL to this resource

`width`

integer

`height`

integer

`backgroundImage`

array<object>

`width`

integer

`height`

integer

`url`

string

uri

Direct URL to this resource

`summary`

string

Brief summary or excerpt

`headline`

string

Professional headline or tagline

`geo`

object

`country`

string

Country name

`city`

string

City name

`full`

string

`countryCode`

string

ISO country code (e.g. US, GB)

`languages`

array<object>

Languages spoken

`name`

string

Display name of the entity

`proficiency`

string

`educations`

array<any>

`position`

array<object>

`companyId`

integer

Unique company identifier

`companyName`

string

Name of the employer

`companyUsername`

string

`companyURL`

string

uri

URL link to this resource

`companyLogo`

string

uri

URL of the company logo

`companyIndustry`

string

`companyStaffCountRange`

string

`title`

string

Title of the job, post, or article

`multiLocaleTitle`

object

`en_US`

string

`multiLocaleCompanyName`

object

`en_US`

string

`location`

string

Geographic location information

`locationType`

string

`description`

string

Detailed description or summary

`employmentType`

string

`start`

object

Pagination offset index

`year`

integer

`month`

integer

`day`

integer

`end`

object

`year`

integer

`month`

integer

`day`

integer

`fullPositions`

array<object>

`companyId`

integer

Unique company identifier

`companyName`

string

Name of the employer

`companyUsername`

string

`companyURL`

string

uri

URL link to this resource

`companyLogo`

string

uri

URL of the company logo

`companyIndustry`

string

`companyStaffCountRange`

string

`title`

string

Title of the job, post, or article

`multiLocaleTitle`

object

`en_US`

string

`multiLocaleCompanyName`

object

`en_US`

string

`location`

string

Geographic location information

`locationType`

string

`description`

string

Detailed description or summary

`employmentType`

string

`start`

object

Pagination offset index

`year`

integer

`month`

integer

`day`

integer

`end`

object

`year`

integer

`month`

integer

`day`

integer

`skills`

array<object>

Professional skills and endorsements

`name`

string

Display name of the entity

`passedSkillAssessment`

boolean

`courses`

array<any>

`certifications`

array<any>

Professional certifications

`projects`

object

`publications`

array<any>

`volunteering`

array<any>

`supportedLocales`

array<object>

`country`

string

Country name

`language`

string

`multiLocaleFirstName`

object

`en_US`

string

`multiLocaleLastName`

object

`en_US`

string

`multiLocaleHeadline`

object

`en_US`

string

### Example Response

InteractiveRaw JSONCode

success:true

statusCode:200

message:"Data retrieved successfully"

errors:null

data:

id:678940

urn:"ACoAAAAKXBwBikfbNJww68eYvcu2dqDYJhHbp4g"

username:"ryanroslansky"

firstName:"Ryan"

lastName:"Roslansky"

isCreator:true

isPremium:true

profilePicture:"https://media.licdn.com/dms/image/v2/C4D03AQELbnIckyItlw/profile-displayphoto-shrink\_800\_800/profile-displayphoto-shrink\_800\_800/0/1667929254389?e=1764201600&v=beta&t=rItiPBdNliUg-i1Dof\_SB0C\_x9YIQRjHoF5Nhgyfaas"

profilePictures:

\[0\]:

url:"https://media.licdn.com/dms/image/v2/C4D03AQELbnIckyItlw/profile-displayphoto-shrink\_100\_100/profile-displayphoto-shrink\_100\_100/0/1667929254389?e=1764201600&v=beta&t=p3lIz1Vh7qs3zETsVaDeOuJhgwfHwqHURLMCijqMhH0"

width:100

height:100

\[1\]:

url:"https://media.licdn.com/dms/image/v2/C4D03AQELbnIckyItlw/profile-displayphoto-shrink\_200\_200/profile-displayphoto-shrink\_200\_200/0/1667929254389?e=1764201600&v=beta&t=BiE4d3bMEr4bSiljr4weweVRn0UuER6Ewci9qKrqknc"

width:200

height:200

\[2\]:

url:"https://media.licdn.com/dms/image/v2/C4D03AQELbnIckyItlw/profile-displayphoto-shrink\_400\_400/profile-displayphoto-shrink\_400\_400/0/1667929254389?e=1764201600&v=beta&t=k1hf0C8fyvPLhZZZPf0OKqJAWPyy5uuxlNu4ezx02e0"

width:400

height:400

\[3\]:

url:"https://media.licdn.com/dms/image/v2/C4D03AQELbnIckyItlw/profile-displayphoto-shrink\_800\_800/profile-displayphoto-shrink\_800\_800/0/1667929254389?e=1764201600&v=beta&t=rItiPBdNliUg-i1Dof\_SB0C\_x9YIQRjHoF5Nhgyfaas"

width:800

height:800

backgroundImage:

\[0\]:

width:800

height:200

url:"https://media.licdn.com/dms/image/v2/C4D16AQHXtyQ-bg4B2Q/profile-displaybackgroundimage-shrink\_200\_800/profile-displaybackgroundimage-shrink\_200\_800/0/1580864697675?e=1764201600&v=beta&t=j6CSIRk8ijFfhJoeWHi1ltRrZnu7yy65PCjGt3oGmrE"

\[1\]:

width:1280

height:320

url:"https://media.licdn.com/dms/image/v2/C4D16AQHXtyQ-bg4B2Q/profile-displaybackgroundimage-shrink\_350\_1400/profile-displaybackgroundimage-shrink\_350\_1400/0/1580864697728?e=1764201600&v=beta&t=wJxI2G\_pvaG85T\_qF676ZtkQaYMzrmsxVuqAFZTf0s4"

summary:"As CEO of LinkedIn and EVP of Microsoft Office and Copilot, I am passionate about connecting the world’s professionals to make them more productive and successful. In my years with LinkedIn, I've been fortunate to work alongside talented and innovative colleagues, and together we have developed the world's leading professional networking platform. As we look to grow and evolve LinkedIn in the years to come, I'm excited to continue driving our vision of creating economic opportunity for every member of the global workforce."

headline:"CEO at LinkedIn"

geo:

country:"Stati Uniti d'America"

city:"San Francisco"

full:"San Francisco"

countryCode:"us"

languages:

\[0\]:

name:"English"

proficiency:"NATIVE_OR_BILINGUAL"

\[1\]:

name:"Spanish"

proficiency:"FULL_PROFESSIONAL"

educations:

position:

\[0\]:

companyId:1337

companyName:"LinkedIn"

companyUsername:"linkedin"

companyURL:"https://www.linkedin.com/company/linkedin/"

companyLogo:"https://media.licdn.com/dms/image/v2/C560BAQHaVYd13rRz3A/company-logo\_400\_400/company-logo\_400\_400/0/1638831590218/linkedin\_logo?e=1764201600&v=beta&t=Y40pa-7WDwflzo6AdgZI8\_nj\_GZ6CchxmW1\_LR7ad5E"

companyIndustry:"Software"

companyStaffCountRange:"10001 - 0"

title:"Chief Executive Officer"

multiLocaleTitle:

en_US:"Chief Executive Officer"

multiLocaleCompanyName:

en_US:"LinkedIn"

location:"San Francisco Bay Area"

locationType:""

description:""

employmentType:"A tempo pieno"

start:

year:2020

month:6

day:0

end:

year:0

month:0

day:0

\[1\]:

companyId:1337

companyName:"LinkedIn"

companyUsername:"linkedin"

companyURL:"https://www.linkedin.com/company/linkedin/"

companyLogo:"https://media.licdn.com/dms/image/v2/C560BAQHaVYd13rRz3A/company-logo\_400\_400/company-logo\_400\_400/0/1638831590218/linkedin\_logo?e=1764201600&v=beta&t=Y40pa-7WDwflzo6AdgZI8\_nj\_GZ6CchxmW1\_LR7ad5E"

companyIndustry:"Software"

companyStaffCountRange:"10001 - 0"

title:"Chief Product Officer"

multiLocaleTitle:

en_US:"Chief Product Officer"

multiLocaleCompanyName:

en_US:"LinkedIn"

location:"San Francisco Bay Area"

locationType:""

description:""

employmentType:"A tempo pieno"

start:

year:2009

month:5

day:0

end:

year:2020

month:6

day:0

\[2\]:

companyId:1035

companyName:"Microsoft"

companyUsername:"microsoft"

companyURL:"https://www.linkedin.com/company/microsoft/"

companyLogo:"https://media.licdn.com/dms/image/v2/D560BAQH32RJQCl3dDQ/company-logo\_400\_400/B56ZYQ0mrGGoAc-/0/1744038948046/microsoft\_logo?e=1764201600&v=beta&t=qlgOqrs287ZbE45SS\_Jub8V3rOIB5dKMC6jAfRT3Z-k"

companyIndustry:"Software"

companyStaffCountRange:"10001 - 0"

title:"Executive Vice President"

multiLocaleTitle:

en_US:"Executive Vice President"

multiLocaleCompanyName:

en_US:"Microsoft"

location:""

locationType:""

description:""

employmentType:"A tempo pieno"

start:

year:2025

month:6

day:0

end:

year:0

month:0

day:0

\[3\]:

companyId:1666

companyName:"Intuit"

companyUsername:"intuit"

companyURL:"https://www.linkedin.com/company/intuit/"

companyLogo:"https://media.licdn.com/dms/image/v2/C560BAQFTpF8uneqScw/company-logo\_400\_400/company-logo\_400\_400/0/1661446146222/intuit\_logo?e=1764201600&v=beta&t=KylFg2g-k\_dV9bNC7K0L-lxIpseV8s6unOeOJupBWV8"

companyIndustry:"Software"

companyStaffCountRange:"10001 - 0"

title:"Member Board of Directors"

multiLocaleTitle:

en_US:"Member Board of Directors"

multiLocaleCompanyName:

en_US:"Intuit"

location:"United States"

locationType:""

description:""

employmentType:"Part-time"

start:

year:2023

month:5

day:0

end:

year:0

month:0

day:0

\[4\]:

companyId:47009

companyName:"The Paley Center for Media"

companyUsername:"the-paley-center-for-media"

companyURL:"https://www.linkedin.com/company/the-paley-center-for-media/"

companyLogo:"https://media.licdn.com/dms/image/v2/D4E0BAQED1gppBGHWcQ/company-logo\_400\_400/B4EZnkBxszGcAk-/0/1760467295635/the\_paley\_center\_for\_media\_logo?e=1764201600&v=beta&t=WKK5YREyXSGBBv7JCsH-tLmPgJDOsyD5NtuNx7f8G9w"

companyIndustry:"Musei e istituzioni"

companyStaffCountRange:"51 - 200"

title:"Member Board of Trustees"

multiLocaleTitle:

en_US:"Member Board of Trustees"

multiLocaleCompanyName:

en_US:"The Paley Center for Media"

location:"United States"

locationType:""

description:""

employmentType:"Part-time"

start:

year:2023

month:5

day:0

end:

year:0

month:0

day:0

fullPositions:

\[0\]:

companyId:1337

companyName:"LinkedIn"

companyUsername:"linkedin"

companyURL:"https://www.linkedin.com/company/linkedin/"

companyLogo:"https://media.licdn.com/dms/image/v2/C560BAQHaVYd13rRz3A/company-logo\_400\_400/company-logo\_400\_400/0/1638831590218/linkedin\_logo?e=1764201600&v=beta&t=Y40pa-7WDwflzo6AdgZI8\_nj\_GZ6CchxmW1\_LR7ad5E"

companyIndustry:"Software"

companyStaffCountRange:"10001 - 0"

title:"Chief Executive Officer"

multiLocaleTitle:

en_US:"Chief Executive Officer"

multiLocaleCompanyName:

en_US:"LinkedIn"

location:"San Francisco Bay Area"

locationType:""

description:""

employmentType:"A tempo pieno"

start:

year:2020

month:6

day:0

end:

year:0

month:0

day:0

\[1\]:

companyId:1337

companyName:"LinkedIn"

companyUsername:"linkedin"

companyURL:"https://www.linkedin.com/company/linkedin/"

companyLogo:"https://media.licdn.com/dms/image/v2/C560BAQHaVYd13rRz3A/company-logo\_400\_400/company-logo\_400\_400/0/1638831590218/linkedin\_logo?e=1764201600&v=beta&t=Y40pa-7WDwflzo6AdgZI8\_nj\_GZ6CchxmW1\_LR7ad5E"

companyIndustry:"Software"

companyStaffCountRange:"10001 - 0"

title:"Chief Product Officer"

multiLocaleTitle:

en_US:"Chief Product Officer"

multiLocaleCompanyName:

en_US:"LinkedIn"

location:"San Francisco Bay Area"

locationType:""

description:""

employmentType:"A tempo pieno"

start:

year:2009

month:5

day:0

end:

year:2020

month:6

day:0

\[2\]:

companyId:1035

companyName:"Microsoft"

companyUsername:"microsoft"

companyURL:"https://www.linkedin.com/company/microsoft/"

companyLogo:"https://media.licdn.com/dms/image/v2/D560BAQH32RJQCl3dDQ/company-logo\_400\_400/B56ZYQ0mrGGoAc-/0/1744038948046/microsoft\_logo?e=1764201600&v=beta&t=qlgOqrs287ZbE45SS\_Jub8V3rOIB5dKMC6jAfRT3Z-k"

companyIndustry:"Software"

companyStaffCountRange:"10001 - 0"

title:"Executive Vice President"

multiLocaleTitle:

en_US:"Executive Vice President"

multiLocaleCompanyName:

en_US:"Microsoft"

location:""

locationType:""

description:""

employmentType:"A tempo pieno"

start:

year:2025

month:6

day:0

end:

year:0

month:0

day:0

\[3\]:

companyId:1666

companyName:"Intuit"

companyUsername:"intuit"

companyURL:"https://www.linkedin.com/company/intuit/"

companyLogo:"https://media.licdn.com/dms/image/v2/C560BAQFTpF8uneqScw/company-logo\_400\_400/company-logo\_400\_400/0/1661446146222/intuit\_logo?e=1764201600&v=beta&t=KylFg2g-k\_dV9bNC7K0L-lxIpseV8s6unOeOJupBWV8"

companyIndustry:"Software"

companyStaffCountRange:"10001 - 0"

title:"Member Board of Directors"

multiLocaleTitle:

en_US:"Member Board of Directors"

multiLocaleCompanyName:

en_US:"Intuit"

location:"United States"

locationType:""

description:""

employmentType:"Part-time"

start:

year:2023

month:5

day:0

end:

year:0

month:0

day:0

\[4\]:

companyId:47009

companyName:"The Paley Center for Media"

companyUsername:"the-paley-center-for-media"

companyURL:"https://www.linkedin.com/company/the-paley-center-for-media/"

companyLogo:"https://media.licdn.com/dms/image/v2/D4E0BAQED1gppBGHWcQ/company-logo\_400\_400/B4EZnkBxszGcAk-/0/1760467295635/the\_paley\_center\_for\_media\_logo?e=1764201600&v=beta&t=WKK5YREyXSGBBv7JCsH-tLmPgJDOsyD5NtuNx7f8G9w"

companyIndustry:"Musei e istituzioni"

companyStaffCountRange:"51 - 200"

title:"Member Board of Trustees"

multiLocaleTitle:

en_US:"Member Board of Trustees"

multiLocaleCompanyName:

en_US:"The Paley Center for Media"

location:"United States"

locationType:""

description:""

employmentType:"Part-time"

start:

year:2023

month:5

day:0

end:

year:0

month:0

day:0

\[5\]:

companyId:7846

companyName:"GoDaddy"

companyUsername:"godaddy"

companyURL:"https://www.linkedin.com/company/godaddy/"

companyLogo:"https://media.licdn.com/dms/image/v2/C560BAQFBubd4youVzg/company-logo\_400\_400/company-logo\_400\_400/0/1636569873716/godaddy\_logo?e=1764201600&v=beta&t=gPwueM1OhyF7GRcIBjWxUI-cDcEM2fVkwjmStZPC0js"

companyIndustry:"Software"

companyStaffCountRange:"5001 - 10000"

title:"Member Board Of Directors"

multiLocaleTitle:

en_US:"Member Board Of Directors"

multiLocaleCompanyName:

en_US:"GoDaddy"

location:""

locationType:""

description:""

employmentType:"Part-time"

start:

year:2018

month:8

day:0

end:

year:2023

month:1

day:0

\[6\]:

companyId:23488

companyName:"Glam Media"

companyUsername:"mode-media"

companyURL:"https://www.linkedin.com/company/mode-media/"

companyLogo:"https://media.licdn.com/dms/image/v2/C4E0BAQGlxdWh6ORomg/company-logo\_400\_400/company-logo\_400\_400/0/1631307880105?e=1764201600&v=beta&t=Ig2ITY5w\_sQNFVbn3UetGGuv\_\_NcHFFPUWbQ2nYqHKg"

companyIndustry:"Media online"

companyStaffCountRange:"501 - 1000"

title:"SVP Products & Content"

multiLocaleTitle:

en_US:"SVP Products & Content"

multiLocaleCompanyName:

en_US:"Glam Media"

location:""

locationType:""

description:"Responsible for all consumer, advertiser, publisher and developer products across the Glam Media Network. Grew Glam Media from a top 100 global Comscore property to a top 10 in 18 months."

employmentType:""

start:

year:2007

month:5

day:0

end:

year:2009

month:5

day:0

\[7\]:

companyId:0

companyName:"Housing Media"

companyUsername:""

companyURL:""

companyLogo:""

companyIndustry:""

companyStaffCountRange:""

title:"Co-Founder / CEO"

multiLocaleTitle:

en_US:"Co-Founder / CEO"

multiLocaleCompanyName:

en_US:"Housing Media"

location:""

locationType:""

description:"Co-founded and grew one of the first internet real estate & rentals classified directories. Leveraged the internet for finding real estate buyers, selling properties, and bringing efficiency to the home buying process through multiple real estate brokers across CA and FL."

employmentType:""

start:

year:1997

month:1

day:0

end:

year:2007

month:7

day:0

\[8\]:

companyId:1288

companyName:"Yahoo"

companyUsername:"yahoo"

companyURL:"https://www.linkedin.com/company/yahoo/"

companyLogo:"https://media.licdn.com/dms/image/v2/D4E0BAQHZRIvlF1NvZA/company-logo\_400\_400/company-logo\_400\_400/0/1734629033465/yahoo\_logo?e=1764201600&v=beta&t=AHxJv7Tm3gYJwUARYU8\_kyryYY5uaJX4xqd-xABWbhk"

companyIndustry:"Software"

companyStaffCountRange:"5001 - 10000"

title:"General Management & Product Management"

multiLocaleTitle:

en_US:"General Management & Product Management"

multiLocaleCompanyName:

en_US:"Yahoo"

location:""

locationType:""

description:"Various General Management and Global Product Management roles across Commerce, Classifieds, Directory and Search."

employmentType:""

start:

year:1999

month:12

day:0

end:

year:2004

month:6

day:0

skills:

\[0\]:

name:"Microsoft Copilot"

passedSkillAssessment:false

\[1\]:

name:"Product Management"

passedSkillAssessment:false

\[2\]:

name:"Online Advertising"

passedSkillAssessment:false

\[3\]:

name:"Monetization"

passedSkillAssessment:false

\[4\]:

name:"Strategy"

passedSkillAssessment:false

\[5\]:

name:"Social Media"

passedSkillAssessment:false

\[6\]:

name:"Consumer Products"

passedSkillAssessment:false

\[7\]:

name:"SEO"

passedSkillAssessment:false

\[8\]:

name:"Entrepreneurship"

passedSkillAssessment:false

\[9\]:

name:"PPC"

passedSkillAssessment:false

\[10\]:

name:"Real Estate"

passedSkillAssessment:false

\[11\]:

name:"Analytics"

passedSkillAssessment:false

\[12\]:

name:"Usability"

passedSkillAssessment:false

\[13\]:

name:"Digital Strategy"

passedSkillAssessment:false

\[14\]:

name:"Business Operations Management"

passedSkillAssessment:false

\[15\]:

name:"User Experience"

passedSkillAssessment:false

\[16\]:

name:"Start-ups"

passedSkillAssessment:false

\[17\]:

name:"Online Marketing"

passedSkillAssessment:false

\[18\]:

name:"Web Analytics"

passedSkillAssessment:false

\[19\]:

name:"Mobile Marketing"

passedSkillAssessment:false

courses:

certifications:

projects:

publications:

volunteering:

supportedLocales:

\[0\]:

country:"US"

language:"en"

multiLocaleFirstName:

en_US:"Ryan"

multiLocaleLastName:

en_US:"Roslansky"

multiLocaleHeadline:

en_US:"CEO at LinkedIn"
