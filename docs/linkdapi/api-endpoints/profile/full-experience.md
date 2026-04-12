# API Documentation - LinkdAPI

## API Documentation

Professional data API for developers

[Getting Started](/docs/intro)[Pricing](/docs/endpoints-cost)

GET

## Full experience

[Try it](/playground?endpoint=%2Fapi%2Fv1%2Fprofile%2Ffull-experience&folder=Profile)

1 credit

Get the full work experience of a user by their URN.

`/api/v1/profile/full-experience?urn=ACoAAAKmquABM0LC0AnA3zMnfEZv2zSWO-gyUdk`

### Query Parameters

`urn`

Required

string

Example:`ACoAAAKmquABM0LC0AnA3zMnfEZv2zSWO-gyUdk`

### Response Schema

Field

Type

Description

`experience`

array<object>

Work experience or required experience level

`companyName`

string

Name of the employer

`companyId`

string

utc-millisec

Unique company identifier

`companyLink`

string

uri

URL to the company page

`companyLogo`

string

uri

URL of the company logo

`location`

string

Geographic location information

`title`

string

Title of the job, post, or article

`subTitle`

string

`description`

string

Detailed description or summary

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

`present`

boolean

`period`

string

`positions`

array<object>

Current and past positions

`companyName`

string

Name of the employer

`companyId`

string

utc-millisec

Unique company identifier

`companyLink`

string

uri

URL to the company page

`companyLogo`

string

uri

URL of the company logo

`location`

string

Geographic location information

`title`

string

Title of the job, post, or article

`subTitle`

string

`description`

string

Detailed description or summary

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

`present`

boolean

`period`

string

`isMultiPositions`

boolean

Boolean flag

`totalDuration`

string

### Example Response

InteractiveRaw JSONCode

success:true

statusCode:200

message:"Data retrieved successfully"

errors:null

data:

experience:

\[0\]:

companyName:"Esri"

companyId:"5311"

companyLink:"https://www.linkedin.com/company/5311/"

companyLogo:"https://media.licdn.com/dms/image/v2/C560BAQE7SEkY882aSg/company-logo\_200\_200/company-logo\_200\_200/0/1656114632675/esri\_logo?e=1761782400&v=beta&t=QcoWv8mYpfG6Mp9J-8Dw9X2B8hpaAUPBwPA5gBdxAAI"

location:""

title:"Esri"

subTitle:"10 yrs 3 mos"

description:""

duration:"10 yrs 3 mos"

durationParsed:

start:

year:0

month:0

day:0

end:

year:0

month:0

day:0

present:false

period:""

positions:

\[0\]:

companyName:"Esri"

companyId:"5311"

companyLink:"https://www.linkedin.com/company/5311/"

companyLogo:"https://media.licdn.com/dms/image/v2/C560BAQE7SEkY882aSg/company-logo\_200\_200/company-logo\_200\_200/0/1656114632675/esri\_logo?e=1761782400&v=beta&t=QcoWv8mYpfG6Mp9J-8Dw9X2B8hpaAUPBwPA5gBdxAAI"

location:"Redlands, California, United States"

title:"Principal Product Engineer"

subTitle:"Full-time"

description:"I contribute to research, design and testing efforts on to multiple projects in Development at Esri - Services, REST Spec (ArcGIS Enterprise) - Network Management for Utilities (Utility Network) - Database Technology (Geodatabase, Branch Versioning, Attribute Rules) - ArcGIS Scripting Language (Arcade) - Mobile Technology (ArcGIS Runtime) - Software Architecture (Using modern Proxies with ArcGIS)"

duration:"Oct 2019 - Present · 6 yrs"

durationParsed:

start:

year:2019

month:10

day:1

end:

year:0

month:0

day:0

present:true

period:"6 yrs"

\[1\]:

companyName:"Esri"

companyId:"5311"

companyLink:"https://www.linkedin.com/company/5311/"

companyLogo:"https://media.licdn.com/dms/image/v2/C560BAQE7SEkY882aSg/company-logo\_200\_200/company-logo\_200\_200/0/1656114632675/esri\_logo?e=1761782400&v=beta&t=QcoWv8mYpfG6Mp9J-8Dw9X2B8hpaAUPBwPA5gBdxAAI"

location:"Redlands, CA, United States"

title:"Product Owner"

subTitle:""

description:"Utility network, geodatabase, ArcGIS Runtime"

duration:"Jan 2018 - Oct 2019 · 1 yr 10 mos"

durationParsed:

start:

year:2018

month:1

day:1

end:

year:2019

month:10

day:1

present:false

period:"1 yr 10 mos"

\[2\]:

companyName:"Esri"

companyId:"5311"

companyLink:"https://www.linkedin.com/company/5311/"

companyLogo:"https://media.licdn.com/dms/image/v2/C560BAQE7SEkY882aSg/company-logo\_200\_200/company-logo\_200\_200/0/1656114632675/esri\_logo?e=1761782400&v=beta&t=QcoWv8mYpfG6Mp9J-8Dw9X2B8hpaAUPBwPA5gBdxAAI"

location:"Redlands, California, United States"

title:"Product Engineer"

subTitle:"Full-time"

description:"Product Engineer in Software Products Division - Esri"

duration:"Jul 2015 - Jan 2018 · 2 yrs 7 mos"

durationParsed:

start:

year:2015

month:7

day:1

end:

year:2018

month:1

day:1

present:false

period:"2 yrs 7 mos"

isMultiPositions:true

totalDuration:"10 yrs 3 mos"

\[1\]:

companyName:"Electricity and water Authority"

companyId:""

companyLink:"https://www.linkedin.com/search/results/all/?keywords=Electricity+and+water+Authority"

companyLogo:""

location:"Bahrain"

title:"Software Architect"

subTitle:"Electricity and water Authority"

description:"As a Software Architect at EWA, I’m responsible for maintaining and up and running operations so the customers can receive optimum and uninterrupted electricity and water service. EWA keeps upgrading the systems to ensure effective service and to stay up to date with technology."

duration:"May 2012 - Jul 2015 · 3 yrs 3 mos"

durationParsed:

start:

year:2012

month:5

day:1

end:

year:2015

month:7

day:1

present:false

period:"3 yrs 3 mos"

positions:

\[0\]:

companyName:"Microcenter, Esri Distributor in Bahrain"

companyId:""

companyLink:"https://www.linkedin.com/search/results/all/?keywords=Microcenter%2C+Esri+Distributor+in+Bahrain"

companyLogo:""

location:"Bahrain"

title:"Software Architect"

subTitle:"Microcenter, Esri Distributor in Bahrain"

description:""

duration:"Jun 2011 - May 2012 · 1 yr"

durationParsed:

start:

year:2011

month:6

day:1

end:

year:2012

month:5

day:1

present:false

period:"1 yr"

\[2\]:

companyName:"Khatib & Alami CEC"

companyId:"313169"

companyLink:"https://www.linkedin.com/company/313169/"

companyLogo:"https://media.licdn.com/dms/image/v2/C4D0BAQHh7jATR5D0OQ/company-logo\_200\_200/company-logo\_200\_200/0/1631353631656?e=1761782400&v=beta&t=Varm0v\_TKGHDYFxuU\_Kk8za452FBPxh35OuejrwEAck"

location:""

title:"Khatib & Alami CEC"

subTitle:"5 yrs 6 mos"

description:""

duration:"5 yrs 6 mos"

durationParsed:

start:

year:0

month:0

day:0

end:

year:0

month:0

day:0

present:false

period:""

positions:

\[0\]:

companyName:"Khatib & Alami CEC"

companyId:"313169"

companyLink:"https://www.linkedin.com/company/313169/"

companyLogo:"https://media.licdn.com/dms/image/v2/C4D0BAQHh7jATR5D0OQ/company-logo\_200\_200/company-logo\_200\_200/0/1631353631656?e=1761782400&v=beta&t=Varm0v\_TKGHDYFxuU\_Kk8za452FBPxh35OuejrwEAck"

location:"Bahrain"

title:"Technical Lead"

subTitle:"Full-time"

description:""

duration:"Jan 2007 - Jun 2011 · 4 yrs 6 mos"

durationParsed:

start:

year:2007

month:1

day:1

end:

year:2011

month:6

day:1

present:false

period:"4 yrs 6 mos"

\[1\]:

companyName:"Khatib & Alami CEC"

companyId:"313169"

companyLink:"https://www.linkedin.com/company/313169/"

companyLogo:"https://media.licdn.com/dms/image/v2/C4D0BAQHh7jATR5D0OQ/company-logo\_200\_200/company-logo\_200\_200/0/1631353631656?e=1761782400&v=beta&t=Varm0v\_TKGHDYFxuU\_Kk8za452FBPxh35OuejrwEAck"

location:"Bahrain"

title:"GIS Application Developer"

subTitle:""

description:""

duration:"Jan 2006 - Dec 2007 · 2 yrs"

durationParsed:

start:

year:2006

month:1

day:1

end:

year:2007

month:12

day:1

present:false

period:"2 yrs"

isMultiPositions:true

totalDuration:"5 yrs 6 mos"
