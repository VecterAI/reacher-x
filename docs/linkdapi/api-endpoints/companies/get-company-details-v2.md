# API Documentation - LinkdAPI

## API Documentation

Professional data API for developers

[Getting Started](/docs/intro)[Pricing](/docs/endpoints-cost)

GET

## Get Company Details V2

[Try it](/playground?endpoint=%2Fapi%2Fv1%2Fcompanies%2Fcompany%2Finfo-v2&folder=Companies)

1 credit

Get detailed company information by ID. This version provides more data than the standard company details, including fields like "peopleAlsoFollow" and "affiliatedByJobs."

`/api/v1/companies/company/info-v2?id=1441`

### Query Parameters

`id`

Required

integer

company ID

Example:`1441`

### Response Schema

Field

Type

Description

`company`

object

Company name or details

`id`

string

utc-millisec

Unique identifier for this resource

`name`

string

Company name

`universalName`

string

URL-friendly company identifier

`linkedinUrl`

string

uri

Full URL to the profile or company page

`description`

string

Detailed description or summary

`type`

string

Entity type classification

`images`

object

`logo`

string

uri

Company logo URL

`cover`

string

uri

Company cover image URL

`isClaimable`

boolean

Whether the company page can be claimed

`backgroundCoverImages`

array<object>

`url`

string

uri

Direct URL to this resource

`width`

integer

`height`

integer

`logos`

array<object>

`url`

string

uri

Direct URL to this resource

`width`

integer

`height`

integer

`staffCount`

integer

Total number of employees

`headquarter`

object

Company headquarters address

`countryCode`

string

Headquarters country code

`geographicArea`

string

Headquarters state or region

`country`

string

Headquarters country

`city`

string

Headquarters city

`postalCode`

string

utc-millisec

Headquarters postal code

`headquarter`

boolean

Whether this is the primary headquarters

`line1`

string

Street address of headquarters

`locations`

array<object>

`countryCode`

string

ISO country code (e.g. US, GB)

`geographicArea`

string

State, province, or region

`country`

string

Country name

`city`

string

City name

`postalCode`

string

ZIP or postal code

`headquarter`

boolean

Company headquarters address

`line1`

string

Street address

`industriesV2`

array<string>

Industry classifications

`industriesLegacy`

array<string>

Legacy industry categories

`specialities`

array<string>

Areas of expertise or specialization

`website`

string

uri

Official company website URL

`founded`

object

`year`

integer

Year the company was founded

`month`

integer

Month the company was founded

`day`

integer

Day the company was founded

`callToAction`

object

`type`

string

Entity type classification

`displayText`

string

`visible`

boolean

`url`

string

uri

Direct URL to this resource

`followerCount`

integer

Number of followers

`staffCountRange`

string

Employee count range (e.g. 1001-5000)

`topOrganizationListing`

object

`rank`

integer

`listName`

string

`articleUrl`

string

uri

URL link to this resource

`text`

string

`pageVerification`

object

`verified`

boolean

Whether the entity is verified

`lastModifiedAt`

integer

Timestamp

`availabeTabs`

array<object>

`name`

string

Display name of the entity

`tabType`

string

`peopleAlsoFollow`

array<object>

`id`

string

utc-millisec

Unique identifier for this resource

`name`

string

Display name of the entity

`industry`

string

`followerCount`

integer

Number of followers

`Url`

string

uri

Direct URL to this resource

`logos`

array<object>

`url`

string

uri

Direct URL to this resource

`width`

integer

`height`

integer

`affiliatedByJobs`

array<object>

`id`

string

utc-millisec

Unique identifier for this resource

`name`

string

Display name of the entity

`industry`

string

`followerCount`

integer

Number of followers

`Url`

string

uri

Direct URL to this resource

`logos`

array<object>

`url`

string

uri

Direct URL to this resource

`width`

integer

`height`

integer

`affiliatedByEmployees`

array<object>

`id`

string

utc-millisec

Unique identifier for this resource

`name`

string

Display name of the entity

`industry`

string

`followerCount`

integer

Number of followers

`Url`

string

uri

Direct URL to this resource

`logos`

array<object>

`url`

string

uri

Direct URL to this resource

`width`

integer

`height`

integer

`affiliatedByShowcases`

array<object>

`id`

string

utc-millisec

Unique identifier for this resource

`name`

string

Display name of the entity

`industry`

string

`followerCount`

integer

Number of followers

`Url`

string

uri

Direct URL to this resource

`logos`

array<object>

`url`

string

uri

Direct URL to this resource

`width`

integer

`height`

integer

### Example Response

InteractiveRaw JSONCode

success:true

statusCode:200

message:"Data retrieved successfully"

errors:null

data:

company:

id:"1441"

name:"Google"

universalName:"google"

linkedinUrl:"https://www.linkedin.com/company/google/"

description:"A problem isn't truly solved until it's solved for all. Googlers build products that help create opportunities for everyone, whether down the street or across the globe. Bring your insight, imagination and a healthy disregard for the impossible. Bring everything that makes you unique. Together, we can build for everyone. Check out our career opportunities at goo.gle/3DLEokh"

type:"COMPANY"

images:

logo:"https://media.licdn.com/dms/image/v2/D4E0BAQGv3cqOuUMY7g/company-logo\_400\_400/B4EZmhegXHGcAc-/0/1759350753990/google\_logo?e=1770854400&v=beta&t=klcqmC9IZt0JWh4VOaUKvUHgxMJX\_pbnLuAotYC921g"

cover:"https://media.licdn.com/dms/image/v2/D4E1BAQGAn5jeEAjVoA/company-background\_400/B4EZvC.IgyHoAY-/0/1768502626812/google\_cover?e=1769706000&v=beta&t=WQEUnxFfPalAagjpJG3RuHy2bFxWTtt127OkTeORIn0"

isClaimable:false

backgroundCoverImages:

\[0\]:

url:"https://media.licdn.com/dms/image/v2/D4E1BAQGAn5jeEAjVoA/company-background\_400/B4EZvC.IgyHoAY-/0/1768502626812/google\_cover?e=1769706000&v=beta&t=WQEUnxFfPalAagjpJG3RuHy2bFxWTtt127OkTeORIn0"

width:400

height:67

\[1\]:

url:"https://media.licdn.com/dms/image/v2/D4E1BAQGAn5jeEAjVoA/company-background\_200/B4EZvC.IgyHoAc-/0/1768502626812/google\_cover?e=1769706000&v=beta&t=AO36BZVpfbh4XRKQfa5NfpLoXzE3XWCSDPZRFJOqgMY"

width:200

height:33

\[2\]:

url:"https://media.licdn.com/dms/image/v2/D4E1BAQGAn5jeEAjVoA/company-background\_10000/B4EZvC.IgyHoAU-/0/1768502626812/google\_cover?e=1769706000&v=beta&t=lCZ2sY4PpCDSg27uel7ScoEpYmuJdtW0M9zfxQLH14k"

width:1692

height:287

logos:

\[0\]:

url:"https://media.licdn.com/dms/image/v2/D4E0BAQGv3cqOuUMY7g/company-logo\_100\_100/B4EZmhegXHGcAU-/0/1759350753990/google\_logo?e=1770854400&v=beta&t=jPInRVHsgb5Ft3E46aI9dCAL57GSVvxMn\_5NZ4BgRYc"

width:100

height:100

\[1\]:

url:"https://media.licdn.com/dms/image/v2/D4E0BAQGv3cqOuUMY7g/company-logo\_400\_400/B4EZmhegXHGcAc-/0/1759350753990/google\_logo?e=1770854400&v=beta&t=klcqmC9IZt0JWh4VOaUKvUHgxMJX\_pbnLuAotYC921g"

width:400

height:400

\[2\]:

url:"https://media.licdn.com/dms/image/v2/D4E0BAQGv3cqOuUMY7g/company-logo\_200\_200/B4EZmhegXHGcAM-/0/1759350753990/google\_logo?e=1770854400&v=beta&t=R4t5i\_Njv2v5WHufj5k9hcgx38w7dM\_2MOMOKscsK80"

width:200

height:200

staffCount:330875

headquarter:

countryCode:"US"

geographicArea:"CA"

country:"US"

city:"Mountain View"

postalCode:"94043"

headquarter:true

line1:"1600 Amphitheatre Parkway"

locations:

\[0\]:

countryCode:"GB"

geographicArea:"England"

country:"GB"

city:"London"

postalCode:"WC2H 8AG"

headquarter:false

line1:"St Giles High Street"

\[1\]:

countryCode:"IE"

geographicArea:"County Dublin"

country:"IE"

city:"Dublin"

headquarter:false

line1:"Barrow Street"

\[2\]:

countryCode:"CO"

geographicArea:"Bogota, D.C."

country:"CO"

city:"Bogota"

postalCode:"110221"

headquarter:false

line1:"Carrera 11A 94-45"

\[3\]:

countryCode:"SG"

geographicArea:"Singapore"

country:"SG"

city:"Singapore"

postalCode:"118484"

headquarter:false

line1:"3 Pasir Panjang Rd"

\[4\]:

countryCode:"MX"

geographicArea:"CDMX"

country:"MX"

city:"Miguel Hidalgo"

postalCode:"11000"

headquarter:false

line1:"Montes Urales"

\[5\]:

countryCode:"IL"

geographicArea:"Tel Aviv"

country:"IL"

city:"Tel Aviv-Yafo"

postalCode:"67891"

headquarter:false

line1:"Yigal Allon 98"

\[6\]:

countryCode:"CA"

geographicArea:"ON"

country:"CA"

city:"Toronto"

postalCode:"M5H 2G4"

headquarter:false

line1:"111 Richmond St W"

\[7\]:

countryCode:"CA"

geographicArea:"ON"

country:"CA"

city:"Kitchener"

postalCode:"N2H 5G5"

headquarter:false

line1:"51 Breithaupt St"

\[8\]:

countryCode:"CL"

geographicArea:"Santiago Metropolitan"

country:"CL"

city:"Las Condes"

postalCode:"7550000"

headquarter:false

line1:"Avenida Costanera Sur"

\[9\]:

countryCode:"IT"

geographicArea:"Lomb."

country:"IT"

city:"Milan"

postalCode:"20124"

headquarter:false

line1:"Via Federico Confalonieri, 4"

\[10\]:

countryCode:"PH"

geographicArea:"National Capital Region"

country:"PH"

city:"Taguig City"

headquarter:false

line1:"5th Ave"

\[11\]:

countryCode:"AU"

geographicArea:"NSW"

country:"AU"

city:"Sydney"

postalCode:"2009"

headquarter:false

line1:"48 Pirrama Rd"

\[12\]:

countryCode:"AU"

geographicArea:"VIC"

country:"AU"

city:"Melbourne"

postalCode:"3000"

headquarter:false

line1:"90 Collins St"

\[13\]:

countryCode:"CH"

geographicArea:"ZH"

country:"CH"

city:"Zurich"

postalCode:"8002"

headquarter:false

line1:"Brandschenkestrasse 110"

\[14\]:

countryCode:"FR"

geographicArea:"IdF"

country:"FR"

city:"Paris"

postalCode:"75009"

headquarter:false

line1:"8 Rue de Londres"

\[15\]:

countryCode:"AR"

geographicArea:"Buenos Aires Autonomous City"

country:"AR"

city:"Buenos Aires City"

postalCode:"1107"

headquarter:false

line1:"Avenida Alicia Moreau de Justo 350"

\[16\]:

countryCode:"DE"

geographicArea:"HH"

country:"DE"

city:"Hamburg"

postalCode:"20354"

headquarter:false

line1:"ABC-Strasse 19"

\[17\]:

countryCode:"DE"

geographicArea:"BE"

country:"DE"

city:"Berlin"

postalCode:"10117"

headquarter:false

line1:"Unter den Linden 14"

\[18\]:

countryCode:"DE"

geographicArea:"BY"

country:"DE"

city:"Munich"

postalCode:"80636"

headquarter:false

line1:"Erika-Mann-Strasse 33"

\[19\]:

countryCode:"PL"

geographicArea:"MA"

country:"PL"

city:"Warsaw"

postalCode:"00-125"

headquarter:false

line1:"ulica Emilii Plater 53"

\[20\]:

countryCode:"NL"

geographicArea:"North Holland"

country:"NL"

city:"Amsterdam"

postalCode:"1082 MD"

headquarter:false

line1:"Claude Debussylaan 34"

\[21\]:

countryCode:"ES"

geographicArea:"Community of Madrid"

country:"ES"

city:"Madrid"

postalCode:"28046"

headquarter:false

line1:"Plaza Pablo Ruiz Picasso"

\[22\]:

countryCode:"ES"

geographicArea:"Community of Madrid"

country:"ES"

city:"Madrid"

postalCode:"28020"

headquarter:false

line1:"Plaza Pablo Ruiz Picasso"

\[23\]:

countryCode:"US"

geographicArea:"GA"

country:"US"

city:"Atlanta"

postalCode:"30309"

headquarter:false

line1:"10 10th St NE"

\[24\]:

countryCode:"US"

geographicArea:"MA"

country:"US"

city:"Cambridge"

postalCode:"02142"

headquarter:false

line1:"355 Main St"

\[25\]:

countryCode:"US"

geographicArea:"CA"

country:"US"

city:"Mountain View"

postalCode:"94043"

headquarter:true

line1:"1600 Amphitheatre Parkway"

\[26\]:

countryCode:"US"

geographicArea:"CA"

country:"US"

city:"San Bruno"

postalCode:"94066"

headquarter:false

line1:"901 Cherry Ave"

\[27\]:

countryCode:"US"

geographicArea:"CA"

country:"US"

city:"San Francisco"

postalCode:"94105"

headquarter:false

line1:"345 Spear St"

\[28\]:

countryCode:"US"

geographicArea:"TX"

country:"US"

city:"Austin"

postalCode:"78759"

headquarter:false

line1:"9606 N Mopac Expy"

\[29\]:

countryCode:"US"

geographicArea:"CA"

country:"US"

city:"Irvine"

postalCode:"92612"

headquarter:false

line1:"19510 Jamboree Rd"

\[30\]:

countryCode:"US"

geographicArea:"CA"

country:"US"

city:"Los Angeles"

postalCode:"90291"

headquarter:false

line1:"340 Main St"

\[31\]:

countryCode:"US"

geographicArea:"IL"

country:"US"

city:"Chicago"

postalCode:"60607"

headquarter:false

line1:"320 N Morgan St"

\[32\]:

countryCode:"US"

geographicArea:"CO"

country:"US"

city:"Boulder"

postalCode:"80302"

headquarter:false

line1:"2590 Pearl St"

\[33\]:

countryCode:"US"

geographicArea:"TX"

country:"US"

city:"Frisco"

postalCode:"75034"

headquarter:false

line1:"6175 Main St"

\[34\]:

countryCode:"US"

geographicArea:"MI"

country:"US"

city:"Ann Arbor"

postalCode:"48105"

headquarter:false

line1:"2300 Traverwood Dr"

\[35\]:

countryCode:"US"

geographicArea:"DC"

country:"US"

city:"Washington"

postalCode:"20001"

headquarter:false

line1:"25 Massachusetts Ave NW"

\[36\]:

countryCode:"US"

geographicArea:"VA"

country:"US"

city:"Reston"

postalCode:"20190"

headquarter:false

line1:"1875 Explorer St"

\[37\]:

countryCode:"US"

geographicArea:"WA"

country:"US"

city:"Kirkland"

postalCode:"98033"

headquarter:false

line1:"777 6th St S"

\[38\]:

countryCode:"US"

geographicArea:"WA"

country:"US"

city:"Seattle"

postalCode:"98103"

headquarter:false

line1:"601 N 34th St"

\[39\]:

countryCode:"US"

geographicArea:"NY"

country:"US"

city:"New York"

postalCode:"10011"

headquarter:false

line1:"111 8th Ave"

\[40\]:

countryCode:"SE"

geographicArea:"Stockholm County"

country:"SE"

city:"Stockholm"

postalCode:"111 22"

headquarter:false

line1:"Kungsbron 2"

\[41\]:

countryCode:"BR"

geographicArea:"SP"

country:"BR"

city:"Sao Paulo"

postalCode:"04538-133"

headquarter:false

line1:"Avenida Brigadeiro Faria Lima, 3477"

\[42\]:

countryCode:"HK"

geographicArea:"Hong Kong"

country:"HK"

city:"Wan Chai"

headquarter:false

line1:"2 Matheson St"

\[43\]:

countryCode:"IN"

geographicArea:"TS"

country:"IN"

city:"Hyderabad"

postalCode:"500084"

headquarter:false

line1:"13"

\[44\]:

countryCode:"IN"

geographicArea:"Maharashtra"

country:"IN"

city:"Mumbai"

postalCode:"400051"

headquarter:false

line1:"3 Bandra Kurla Complex Road"

\[45\]:

countryCode:"IN"

geographicArea:"Karnataka"

country:"IN"

city:"Bengaluru"

postalCode:"560016"

headquarter:false

line1:"Old Madras Road"

\[46\]:

countryCode:"IN"

geographicArea:"Karnataka"

country:"IN"

city:"Bengaluru"

postalCode:"560016"

headquarter:false

line1:"3 Swamy Vivekananda Road"

\[47\]:

countryCode:"IN"

geographicArea:"HR"

country:"IN"

city:"Gurugram"

postalCode:"122001"

headquarter:false

line1:"15"

industriesV2:

\[0\]:"Software Development"

industriesLegacy:

\[0\]:"Computer Software"

specialities:

\[0\]:"search"

\[1\]:"ads"

\[2\]:"mobile"

\[3\]:"android"

\[4\]:"online video"

\[5\]:"apps"

\[6\]:"machine learning"

\[7\]:"virtual reality"

\[8\]:"cloud"

\[9\]:"hardware"

\[10\]:"artificial intelligence"

\[11\]:"youtube"

\[12\]:"software"

website:"https://goo.gle/3DLEokh"

founded:

year:0

month:0

day:0

callToAction:

type:"VIEW_WEBSITE"

displayText:"Visit website"

visible:true

url:"https://goo.gle/3DLEokh"

followerCount:40388194

staffCountRange:"10,001+ employees"

topOrganizationListing:

rank:18

listName:"LinkedIn Top Companies"

articleUrl:"https://www.linkedin.com/pulse/linkedin-top-companies-2025-25-best-large-employers-grow-cq7nc/"

text:"This company has been Ranked on LinkedIn Top Companies"

pageVerification:

verified:true

lastModifiedAt:1692139093065

availabeTabs:

\[0\]:

name:"Home"

tabType:"HOME"

\[1\]:

name:"About"

tabType:"ABOUT"

\[2\]:

name:"Posts"

tabType:"POSTS"

\[3\]:

name:"Jobs"

tabType:"JOBS"

\[4\]:

name:"Life"

tabType:"LIFE"

\[5\]:

name:"People"

tabType:"PEOPLE"

peopleAlsoFollow:

\[0\]:

id:"104825671"

name:"ChatGPT"

industry:"Technology, Information and Internet"

followerCount:622346

Url:"https://www.linkedin.com/showcase/chatgpt/"

logos:

\[0\]:

url:"https://media.licdn.com/dms/image/v2/D4D0BAQHanColRaBS2w/company-logo\_400\_400/B4DZUaBg.nHkAY-/0/1739898360056/chatgpt\_logo?e=1770854400&v=beta&t=favcdbZUFw4T4BS4xpCYh1-dGZAS7ChVn9isOzWxpAc"

width:400

height:400

\[1\]:

url:"https://media.licdn.com/dms/image/v2/D4D0BAQHanColRaBS2w/company-logo\_200\_200/B4DZUaBg.nHkAI-/0/1739898360056/chatgpt\_logo?e=1770854400&v=beta&t=RmUR26LMytg-mLVJKWTvPoLAFU\_EC5RY1Ay-hiwE5o8"

width:200

height:200

\[2\]:

url:"https://media.licdn.com/dms/image/v2/D4D0BAQHanColRaBS2w/company-logo\_100\_100/B4DZUaBg.nHkAQ-/0/1739898360056/chatgpt\_logo?e=1770854400&v=beta&t=kex0fo-9pUTAWA\_Oq3fkiffu-Qf--scJJ8DGvgsuEWE"

width:100

height:100

\[1\]:

id:"74126343"

name:"Anthropic"

industry:"Research Services"

followerCount:1924701

Url:"https://www.linkedin.com/company/anthropicresearch/"

logos:

\[0\]:

url:"https://media.licdn.com/dms/image/v2/D4E0BAQFMhKgeR7EYAg/company-logo\_200\_200/company-logo\_200\_200/0/1719256413073/anthropicresearch\_logo?e=1770854400&v=beta&t=AkyWCvXSKRhqJjV8e0ryv5sPLZfeeOViZFWtv2agTWQ"

width:200

height:200

\[1\]:

url:"https://media.licdn.com/dms/image/v2/D4E0BAQFMhKgeR7EYAg/company-logo\_100\_100/company-logo\_100\_100/0/1719256989269/anthropicresearch\_logo?e=1770854400&v=beta&t=xm2DYuA1Yeg6LRa8j5MiHN0DibFeurqov7QUOUw89rY"

width:100

height:100

\[2\]:

url:"https://media.licdn.com/dms/image/v2/D4E0BAQFMhKgeR7EYAg/company-logo\_400\_400/company-logo\_400\_400/0/1719256729905/anthropicresearch\_logo?e=1770854400&v=beta&t=q5Y9nB6EHg4kTNluLfAcBLRrWpNgIa5izmFJj01DWtA"

width:400

height:400

\[2\]:

id:"18000077"

name:"NVIDIA AI"

industry:"Computer Hardware Manufacturing"

followerCount:1580777

Url:"https://www.linkedin.com/showcase/nvidia-ai/"

logos:

\[0\]:

url:"https://media.licdn.com/dms/image/v2/D560BAQGe-H392ULJ-Q/company-logo\_200\_200/company-logo\_200\_200/0/1724882065232/nvidia\_ai\_logo?e=1770854400&v=beta&t=76K2q7iuoO49JMXk9nrgkne4j5-xp1t3jrbyXFqBpo8"

width:200

height:200

\[1\]:

url:"https://media.licdn.com/dms/image/v2/D560BAQGe-H392ULJ-Q/company-logo\_100\_100/company-logo\_100\_100/0/1724882065232/nvidia\_ai\_logo?e=1770854400&v=beta&t=VRwguG7XtA3R7Uv0dRGzUNjXke0HOxt6eIA34w94\_8A"

width:100

height:100

\[2\]:

url:"https://media.licdn.com/dms/image/v2/D560BAQGe-H392ULJ-Q/company-logo\_400\_400/company-logo\_400\_400/0/1724882065232/nvidia\_ai\_logo?e=1770854400&v=beta&t=S096uQr-dmgkhrqaepYuTH05lYiWNU3ICeVKxw8CvhA"

width:400

height:400

\[3\]:

id:"106863934"

name:"Claude"

industry:"Technology, Information and Internet"

followerCount:313853

Url:"https://www.linkedin.com/showcase/claude/"

logos:

\[0\]:

url:"https://media.licdn.com/dms/image/v2/D4E0BAQFko-zWIZk\_pw/company-logo\_100\_100/B4EZhiRWKvHgAQ-/0/1753995371543/claude\_logo?e=1770854400&v=beta&t=udj-dhQQ0\_R2YeUBRSiKfPFQhGR99QoH8pZQBmp3tcc"

width:100

height:100

\[1\]:

url:"https://media.licdn.com/dms/image/v2/D4E0BAQFko-zWIZk\_pw/company-logo\_400\_400/B4EZhiRWKvHgAY-/0/1753995371543/claude\_logo?e=1770854400&v=beta&t=Kfi0u9jzmURfO5yd6DFWItv9vJW5XOdcvKetHlNBFLU"

width:400

height:400

\[2\]:

url:"https://media.licdn.com/dms/image/v2/D4E0BAQFko-zWIZk\_pw/company-logo\_200\_200/B4EZhiRWKvHgAI-/0/1753995371543/claude\_logo?e=1770854400&v=beta&t=\_wm8wwIU-VhUz89YqHXPU3\_ecSCneOC32Tcx6GTuVbQ"

width:200

height:200

\[4\]:

id:"96411081"

name:"Microsoft Azure"

industry:"Technology, Information and Internet"

followerCount:871193

Url:"https://www.linkedin.com/showcase/microsoft-azure/"

logos:

\[0\]:

url:"https://media.licdn.com/dms/image/v2/D560BAQGtwKUNwBubxg/company-logo\_200\_200/company-logo\_200\_200/0/1688144190823/microsoft\_azure\_logo?e=1770854400&v=beta&t=GAHc\_CVQvKQBwN4wVxwoKYxyoWj3kV7RyVAgzo8Kbno"

width:200

height:200

\[1\]:

url:"https://media.licdn.com/dms/image/v2/D560BAQGtwKUNwBubxg/company-logo\_100\_100/company-logo\_100\_100/0/1688144190823/microsoft\_azure\_logo?e=1770854400&v=beta&t=qvK5q-z7Qukiuu568G8lGjBziKeQDvc\_bBFr4ITwuBY"

width:100

height:100

\[2\]:

url:"https://media.licdn.com/dms/image/v2/D560BAQGtwKUNwBubxg/company-logo\_400\_400/company-logo\_400\_400/0/1688144190823/microsoft\_azure\_logo?e=1770854400&v=beta&t=M4\_PiZuNs-wKRMbLq3UuLrEupG8KHz\_dTt6AgJ9leYo"

width:400

height:400

\[5\]:

id:"165158"

name:"Netflix"

industry:"Entertainment Providers"

followerCount:11594000

Url:"https://www.linkedin.com/company/netflix/"

logos:

\[0\]:

url:"https://media.licdn.com/dms/image/v2/D4E0BAQGMva5\_E8pUjw/company-logo\_200\_200/company-logo\_200\_200/0/1736276678240/netflix\_logo?e=1770854400&v=beta&t=hgHb1pTQ\_lEL0VG085O91Y17mi2HsIAeJFmukm5VbDE"

width:200

height:200

\[1\]:

url:"https://media.licdn.com/dms/image/v2/D4E0BAQGMva5\_E8pUjw/company-logo\_100\_100/company-logo\_100\_100/0/1736276678240/netflix\_logo?e=1770854400&v=beta&t=8nnLQ3PFVhZVQ\_0RPSs78aha49S4mbYkTb\_bxJy\_zlY"

width:100

height:100

\[2\]:

url:"https://media.licdn.com/dms/image/v2/D4E0BAQGMva5\_E8pUjw/company-logo\_400\_400/company-logo\_400\_400/0/1736276678240/netflix\_logo?e=1770854400&v=beta&t=zWd33L2QTlsak6xGXz6U6qB582epeDxc2nhKNsJxklk"

width:400

height:400

\[6\]:

id:"1035"

name:"Microsoft"

industry:"Software Development"

followerCount:27364705

Url:"https://www.linkedin.com/company/microsoft/"

logos:

\[0\]:

url:"https://media.licdn.com/dms/image/v2/D560BAQH32RJQCl3dDQ/company-logo\_100\_100/B56ZYQ0mrGGoAU-/0/1744038948046/microsoft\_logo?e=1770854400&v=beta&t=Tfdb62\_947QTMb-1fPzFERf2Wj1Rww3GZgYiiDdMYUA"

width:100

height:100

\[1\]:

url:"https://media.licdn.com/dms/image/v2/D560BAQH32RJQCl3dDQ/company-logo\_400\_400/B56ZYQ0mrGGoAc-/0/1744038948046/microsoft\_logo?e=1770854400&v=beta&t=g-dbgSloiBrpOdEUgeq6LF6ibIehhRBGVW11hi1bTJw"

width:400

height:400

\[2\]:

url:"https://media.licdn.com/dms/image/v2/D560BAQH32RJQCl3dDQ/company-logo\_200\_200/B56ZYQ0mrGGoAM-/0/1744038948046/microsoft\_logo?e=1770854400&v=beta&t=GoaLBw3k2gCMLYxmO7dfJRdPu\_YeX308e4inC6shagk"

width:200

height:200

\[7\]:

id:"11193683"

name:"Hugging Face"

industry:"Software Development"

followerCount:1152729

Url:"https://www.linkedin.com/company/huggingface/"

logos:

\[0\]:

url:"https://media.licdn.com/dms/image/v2/C4D0BAQFzIxlpQ0lAdA/company-logo\_200\_200/company-logo\_200\_200/0/1630556211624/huggingface\_logo?e=1770854400&v=beta&t=zvQIfbJhYQ1aVnVL0SQKDxvZ2pRJgxVJqLloYYDy38g"

width:200

height:200

\[1\]:

url:"https://media.licdn.com/dms/image/v2/C4D0BAQFzIxlpQ0lAdA/company-logo\_100\_100/company-logo\_100\_100/0/1630556211624/huggingface\_logo?e=1770854400&v=beta&t=aB90BLE-tyHKmxWXgB0kgkKAvBS1zknA577\_1B77BV0"

width:100

height:100

\[2\]:

url:"https://media.licdn.com/dms/image/v2/C4D0BAQFzIxlpQ0lAdA/company-logo\_400\_400/company-logo\_400\_400/0/1630556211624/huggingface\_logo?e=1770854400&v=beta&t=l5zSuRHAA7OE-MIcVmgEsQnuoDh6J8iiVawkNN8LTZY"

width:400

height:400

\[8\]:

id:"10667"

name:"Meta"

industry:"Software Development"

followerCount:11694313

Url:"https://www.linkedin.com/company/meta/"

logos:

\[0\]:

url:"https://media.licdn.com/dms/image/v2/D560BAQHBmbxCDP0JQQ/company-logo\_400\_400/B56ZlkdQSaI8AY-/0/1758327015620/meta\_logo?e=1770854400&v=beta&t=6Zl0cUtOIoxX8QFqOs6Gmka4pB5nPYJZ8a3z4a4NfYE"

width:400

height:400

\[1\]:

url:"https://media.licdn.com/dms/image/v2/D560BAQHBmbxCDP0JQQ/company-logo\_200\_200/B56ZlkdQSaI8AI-/0/1758327015620/meta\_logo?e=1770854400&v=beta&t=FHWmn\_614phb53u3Lyh0OcqIpEGxjoSe7jxZ1WeXNxc"

width:200

height:200

\[2\]:

url:"https://media.licdn.com/dms/image/v2/D560BAQHBmbxCDP0JQQ/company-logo\_100\_100/B56ZlkdQSaI8AQ-/0/1758327015620/meta\_logo?e=1770854400&v=beta&t=tKfNcU3orNA2rJwQRFWch4sPSSEQodmdfdGPubNl0lU"

width:100

height:100

\[9\]:

id:"1033"

name:"Accenture"

industry:"Business Consulting and Services"

followerCount:14339195

Url:"https://www.linkedin.com/company/accenture/"

logos:

\[0\]:

url:"https://media.licdn.com/dms/image/v2/D4D0BAQEgtOEcxlXMog/company-logo\_200\_200/B4DZfqEQWkHAAQ-/0/1751978673981/accenture\_logo?e=1770854400&v=beta&t=bq1CzgR\_tYmTs08wlvT2r50hOzKHKsZfIpz\_bPkTltk"

width:200

height:200

\[1\]:

url:"https://media.licdn.com/dms/image/v2/D4D0BAQEgtOEcxlXMog/company-logo\_100\_100/B4DZfqEQWkHAAY-/0/1751978673981/accenture\_logo?e=1770854400&v=beta&t=vnGXCcyjxQU29a98lEudv2ARgBauS0vuXAqhC4Nekhc"

width:100

height:100

\[2\]:

url:"https://media.licdn.com/dms/image/v2/D4D0BAQEgtOEcxlXMog/company-logo\_400\_400/B4DZfqEQWkHAAg-/0/1751978673981/accenture\_logo?e=1770854400&v=beta&t=L5zDJe5iR9Z2TzbIZDGPixdk1Vr66NnvqJlU4nOr\_PY"

width:400

height:400

\[10\]:

id:"11130470"

name:"OpenAI"

industry:"Research Services"

followerCount:9767186

Url:"https://www.linkedin.com/company/openai/"

logos:

\[0\]:

url:"https://media.licdn.com/dms/image/v2/D560BAQHpzXbqSyR74A/company-logo\_400\_400/B56ZT8EYB8HsAY-/0/1739395793272/openai\_logo?e=1770854400&v=beta&t=ME0jeybwZ04A90vVGfT4ne5vfx5xggCD1l52zsbOjfs"

width:400

height:400

\[1\]:

url:"https://media.licdn.com/dms/image/v2/D560BAQHpzXbqSyR74A/company-logo\_200\_200/B56ZT8EYB8HsAI-/0/1739395793272/openai\_logo?e=1770854400&v=beta&t=\_Wkr9aqzJY0uJZ7AuZxVx8pXBmuXdtCBYDjxs\_f2wG4"

width:200

height:200

\[2\]:

url:"https://media.licdn.com/dms/image/v2/D560BAQHpzXbqSyR74A/company-logo\_100\_100/B56ZT8EYB8HsAQ-/0/1739395793272/openai\_logo?e=1770854400&v=beta&t=DRjgYgffDhvlQeSxvMqD\_prCuIEar1ROf5Sm6ozc6Ns"

width:100

height:100

\[11\]:

id:"25047749"

name:"National Cyber Security Centre"

industry:"Government Administration"

followerCount:485767

Url:"https://www.linkedin.com/company/national-cyber-security-centre/"

logos:

\[0\]:

url:"https://media.licdn.com/dms/image/v2/D4E0BAQGHLMfNIE-STw/company-logo\_100\_100/B4EZp9q019KYAQ-/0/1763044971136/national\_cyber\_security\_centre\_logo?e=1770854400&v=beta&t=3M8cAg6zGz0tE6YwslpRoahkhF8IbJUC6wbZUdxl5D4"

width:100

height:100

\[1\]:

url:"https://media.licdn.com/dms/image/v2/D4E0BAQGHLMfNIE-STw/company-logo\_400\_400/B4EZp9q019KYAY-/0/1763044971136/national\_cyber\_security\_centre\_logo?e=1770854400&v=beta&t=yNqFyuFw\_SmncoaKB2nPkoTaaCr0\_x8V1fRsaacR2-g"

width:400

height:400

\[2\]:

url:"https://media.licdn.com/dms/image/v2/D4E0BAQGHLMfNIE-STw/company-logo\_200\_200/B4EZp9q019KYAI-/0/1763044971136/national\_cyber\_security\_centre\_logo?e=1770854400&v=beta&t=AkkW\_920EYRRypVeRKuZFvfgYVNoRjxTwrkyYjhPcyM"

width:200

height:200

affiliatedByJobs:

\[0\]:

id:"16140"

name:"YouTube"

industry:"Technology, Information and Internet"

followerCount:2480016

Url:"https://www.linkedin.com/company/youtube/"

logos:

\[0\]:

url:"https://media.licdn.com/dms/image/v2/D4E0BAQGyUKaYgsO3cg/company-logo\_100\_100/B4EZb.zwGgGQAQ-/0/1748031701722/youtube\_logo?e=1770854400&v=beta&t=NGZZY5VDkMJIl9SsJId7pRxnWe2pm9l-nErDKvyoQTA"

width:100

height:100

\[1\]:

url:"https://media.licdn.com/dms/image/v2/D4E0BAQGyUKaYgsO3cg/company-logo\_400\_400/B4EZb.zwGgGQAY-/0/1748031701722/youtube\_logo?e=1770854400&v=beta&t=-myILSbSxTgl6HqjbDKWA\_ozHzRGnfV7XvR4hHZiQYc"

width:400

height:400

\[2\]:

url:"https://media.licdn.com/dms/image/v2/D4E0BAQGyUKaYgsO3cg/company-logo\_200\_200/B4EZb.zwGgGQAI-/0/1748031701722/youtube\_logo?e=1770854400&v=beta&t=r9osU2qkZoNB5kH1hNm0zicvKmPT1-MTtzykTbjpPis"

width:200

height:200

\[1\]:

id:"17876832"

name:"CapitalG"

industry:"Venture Capital and Private Equity Principals"

followerCount:46793

Url:"https://www.linkedin.com/company/capitalg/"

logos:

\[0\]:

url:"https://media.licdn.com/dms/image/v2/C560BAQG\_2ueBNyD9mw/company-logo\_200\_200/company-logo\_200\_200/0/1630652094195/capitalg\_logo?e=1770854400&v=beta&t=I47oLQtjQWkmPuoeHbZJhy1ka0ybcK-PSH8RXX9ZXLI"

width:200

height:200

\[1\]:

url:"https://media.licdn.com/dms/image/v2/C560BAQG\_2ueBNyD9mw/company-logo\_100\_100/company-logo\_100\_100/0/1630652094196/capitalg\_logo?e=1770854400&v=beta&t=w4MDOR1BElQdHHFI-NzZQ0zvfsquudQnXTPQrIixiYM"

width:100

height:100

\[2\]:

url:"https://media.licdn.com/dms/image/v2/C560BAQG\_2ueBNyD9mw/company-logo\_400\_400/company-logo\_400\_400/0/1630652094196/capitalg\_logo?e=1770854400&v=beta&t=P6vp7RCcoFaYTqIOcq7P7l0GKIV7roeutbgt7rJr\_Qw"

width:400

height:400

\[2\]:

id:"89982912"

name:"Mineral.ai"

industry:"Agriculture, Construction, Mining Machinery Manufacturing"

followerCount:9760

Url:"https://www.linkedin.com/company/mineral-ai/"

logos:

\[0\]:

url:"https://media.licdn.com/dms/image/v2/C560BAQE-WH8Szc-oSg/company-logo\_200\_200/company-logo\_200\_200/0/1676059443081/mineral\_ai\_logo?e=1770854400&v=beta&t=15d-goDWGhDoAy08CIeKqPDp9Eo-ojjGqQY1OdnrTUA"

width:200

height:200

\[1\]:

url:"https://media.licdn.com/dms/image/v2/C560BAQE-WH8Szc-oSg/company-logo\_100\_100/company-logo\_100\_100/0/1676059443081/mineral\_ai\_logo?e=1770854400&v=beta&t=EnAug46M0MWZFEPqbAiA06gFTSpodX9CgnE1TzzUtLg"

width:100

height:100

\[2\]:

url:"https://media.licdn.com/dms/image/v2/C560BAQE-WH8Szc-oSg/company-logo\_400\_400/company-logo\_400\_400/0/1676059443081/mineral\_ai\_logo?e=1770854400&v=beta&t=buPgoWwhE7JvMy8M7zbcI5MESLmFkkUCZQw72BDw\_9Y"

width:400

height:400

\[3\]:

id:"791962"

name:"Adometry (acquired by Google)"

industry:"Advertising Services"

followerCount:19728

Url:"https://www.linkedin.com/company/adometry/"

logos:

\[0\]:

url:"https://media.licdn.com/dms/image/v2/C4E0BAQG\_VLbxyJcP8A/company-logo\_200\_200/company-logo\_200\_200/0/1631345813563?e=1770854400&v=beta&t=OXBpeupRsxchHDScyvdtQSRRJ6rtvKLRKCZUluAOz1I"

width:200

height:200

\[1\]:

url:"https://media.licdn.com/dms/image/v2/C4E0BAQG\_VLbxyJcP8A/company-logo\_100\_100/company-logo\_100\_100/0/1631345813563?e=1770854400&v=beta&t=Kd7VDFdhWDRbcGibSBAPboi6268FYwzFDYZhb\_cebHo"

width:100

height:100

\[2\]:

url:"https://media.licdn.com/dms/image/v2/C4E0BAQG\_VLbxyJcP8A/company-logo\_400\_400/company-logo\_400\_400/0/1631345813563?e=1770854400&v=beta&t=BF12heKSOA8vivXtGEA-Tamk\_3r8d7RZgGmUdT9abKA"

width:400

height:400

affiliatedByEmployees:

\[0\]:

id:"16140"

name:"YouTube"

industry:"Technology, Information and Internet"

followerCount:2480016

Url:"https://www.linkedin.com/company/youtube/"

logos:

\[0\]:

url:"https://media.licdn.com/dms/image/v2/D4E0BAQGyUKaYgsO3cg/company-logo\_100\_100/B4EZb.zwGgGQAQ-/0/1748031701722/youtube\_logo?e=1770854400&v=beta&t=NGZZY5VDkMJIl9SsJId7pRxnWe2pm9l-nErDKvyoQTA"

width:100

height:100

\[1\]:

url:"https://media.licdn.com/dms/image/v2/D4E0BAQGyUKaYgsO3cg/company-logo\_400\_400/B4EZb.zwGgGQAY-/0/1748031701722/youtube\_logo?e=1770854400&v=beta&t=-myILSbSxTgl6HqjbDKWA\_ozHzRGnfV7XvR4hHZiQYc"

width:400

height:400

\[2\]:

url:"https://media.licdn.com/dms/image/v2/D4E0BAQGyUKaYgsO3cg/company-logo\_200\_200/B4EZb.zwGgGQAI-/0/1748031701722/youtube\_logo?e=1770854400&v=beta&t=r9osU2qkZoNB5kH1hNm0zicvKmPT1-MTtzykTbjpPis"

width:200

height:200

\[1\]:

id:"17876832"

name:"CapitalG"

industry:"Venture Capital and Private Equity Principals"

followerCount:46793

Url:"https://www.linkedin.com/company/capitalg/"

logos:

\[0\]:

url:"https://media.licdn.com/dms/image/v2/C560BAQG\_2ueBNyD9mw/company-logo\_200\_200/company-logo\_200\_200/0/1630652094195/capitalg\_logo?e=1770854400&v=beta&t=I47oLQtjQWkmPuoeHbZJhy1ka0ybcK-PSH8RXX9ZXLI"

width:200

height:200

\[1\]:

url:"https://media.licdn.com/dms/image/v2/C560BAQG\_2ueBNyD9mw/company-logo\_100\_100/company-logo\_100\_100/0/1630652094196/capitalg\_logo?e=1770854400&v=beta&t=w4MDOR1BElQdHHFI-NzZQ0zvfsquudQnXTPQrIixiYM"

width:100

height:100

\[2\]:

url:"https://media.licdn.com/dms/image/v2/C560BAQG\_2ueBNyD9mw/company-logo\_400\_400/company-logo\_400\_400/0/1630652094196/capitalg\_logo?e=1770854400&v=beta&t=P6vp7RCcoFaYTqIOcq7P7l0GKIV7roeutbgt7rJr\_Qw"

width:400

height:400

\[2\]:

id:"791962"

name:"Adometry (acquired by Google)"

industry:"Advertising Services"

followerCount:19728

Url:"https://www.linkedin.com/company/adometry/"

logos:

\[0\]:

url:"https://media.licdn.com/dms/image/v2/C4E0BAQG\_VLbxyJcP8A/company-logo\_200\_200/company-logo\_200\_200/0/1631345813563?e=1770854400&v=beta&t=OXBpeupRsxchHDScyvdtQSRRJ6rtvKLRKCZUluAOz1I"

width:200

height:200

\[1\]:

url:"https://media.licdn.com/dms/image/v2/C4E0BAQG\_VLbxyJcP8A/company-logo\_100\_100/company-logo\_100\_100/0/1631345813563?e=1770854400&v=beta&t=Kd7VDFdhWDRbcGibSBAPboi6268FYwzFDYZhb\_cebHo"

width:100

height:100

\[2\]:

url:"https://media.licdn.com/dms/image/v2/C4E0BAQG\_VLbxyJcP8A/company-logo\_400\_400/company-logo\_400\_400/0/1631345813563?e=1770854400&v=beta&t=BF12heKSOA8vivXtGEA-Tamk\_3r8d7RZgGmUdT9abKA"

width:400

height:400

affiliatedByShowcases:

\[0\]:

id:"33198155"

name:"Google Marketing Platform"

industry:"Advertising Services"

followerCount:371870

Url:"https://www.linkedin.com/showcase/googlemarketingplatform/"

logos:

\[0\]:

url:"https://media.licdn.com/dms/image/v2/C560BAQGzJC06vcaaeA/company-logo\_200\_200/company-logo\_200\_200/0/1631440027919/googlemarketingplatform\_logo?e=1770854400&v=beta&t=paifPUOvT7EUFhcz5RwsHEvi3oRIlj18HcooQ8AV0pM"

width:200

height:200

\[1\]:

url:"https://media.licdn.com/dms/image/v2/C560BAQGzJC06vcaaeA/company-logo\_100\_100/company-logo\_100\_100/0/1631440027919/googlemarketingplatform\_logo?e=1770854400&v=beta&t=yqk84xxYA2dzRAmpVNdDY5Shtvq\_z2ZM55EQM0dEeX0"

width:100

height:100

\[2\]:

url:"https://media.licdn.com/dms/image/v2/C560BAQGzJC06vcaaeA/company-logo\_400\_400/company-logo\_400\_400/0/1631440027919/googlemarketingplatform\_logo?e=1770854400&v=beta&t=K1A\_\_GK-XrF5DULRc4FcBgb2evkt-Re317Qed5t6y4E"

width:400

height:400

\[1\]:

id:"107776681"

name:"Google for Business India"

industry:"Technology, Information and Internet"

followerCount:5831

Url:"https://www.linkedin.com/showcase/google-for-biz-in/"

logos:

\[0\]:

url:"https://media.licdn.com/dms/image/v2/D560BAQEowDiaLLiC6w/company-logo\_400\_400/B56ZfDRV81GoAY-/0/1751327793258?e=1770854400&v=beta&t=qIaj7UtIv788vVewwOv5-lrcD817eeyz9oKegIYbQ68"

width:400

height:400

\[1\]:

url:"https://media.licdn.com/dms/image/v2/D560BAQEowDiaLLiC6w/company-logo\_200\_200/B56ZfDRV81GoAI-/0/1751327793258?e=1770854400&v=beta&t=j97C0bP2zGVFtzQTBx4xNz7D-Rr\_wo9GbqSe3JlIcR8"

width:200

height:200

\[2\]:

url:"https://media.licdn.com/dms/image/v2/D560BAQEowDiaLLiC6w/company-logo\_100\_100/B56ZfDRV81GoAQ-/0/1751327793258?e=1770854400&v=beta&t=UHHGOqTCxb9GIR1M12QWD6RDukJj3eQBxh070AvdpcA"

width:100

height:100

\[2\]:

id:"18950740"

name:"Android Enterprise"

industry:"Information Technology & Services"

followerCount:33038

Url:"https://www.linkedin.com/showcase/androidenterprise/"

logos:

\[0\]:

url:"https://media.licdn.com/dms/image/v2/D560BAQGCZEOhM7Et2A/company-logo\_200\_200/company-logo\_200\_200/0/1693934124061/androidenterprise\_logo?e=1770854400&v=beta&t=-qdES9wTTIAWf5zBZSfoSDHoa79A6vxGQ4WPOkMjs04"

width:200

height:200

\[1\]:

url:"https://media.licdn.com/dms/image/v2/D560BAQGCZEOhM7Et2A/company-logo\_100\_100/company-logo\_100\_100/0/1693934124061/androidenterprise\_logo?e=1770854400&v=beta&t=mQ2KuYoc1gu9yEKOD1LQHUHuOPaLrqkRagxNkXYj3uU"

width:100

height:100

\[2\]:

url:"https://media.licdn.com/dms/image/v2/D560BAQGCZEOhM7Et2A/company-logo\_400\_400/company-logo\_400\_400/0/1693934124061/androidenterprise\_logo?e=1770854400&v=beta&t=eMPqjASyEomy46DRUzWDyc7ec2b7xqulA10UUSpoO9k"

width:400

height:400

\[3\]:

id:"18221770"

name:"Google Play business community"

industry:"IT Services and IT Consulting"

followerCount:66677

Url:"https://www.linkedin.com/showcase/googleplaybiz/"

logos:

\[0\]:

url:"https://media.licdn.com/dms/image/v2/C560BAQEa9sSivPQ4cg/company-logo\_200\_200/company-logo\_200\_200/0/1658765701208/googleplaybiz\_logo?e=1770854400&v=beta&t=-QbPxEGrD-lkmVKBJuYBHaepIM80jFcdERrAvJb26fM"

width:200

height:200

\[1\]:

url:"https://media.licdn.com/dms/image/v2/C560BAQEa9sSivPQ4cg/company-logo\_100\_100/company-logo\_100\_100/0/1658765701208/googleplaybiz\_logo?e=1770854400&v=beta&t=VX19Bcy27D47OGx2DClZd-5eWPkJhq2nkvVXdr2CldQ"

width:100

height:100

\[2\]:

url:"https://media.licdn.com/dms/image/v2/C560BAQEa9sSivPQ4cg/company-logo\_400\_400/company-logo\_400\_400/0/1658765701208/googleplaybiz\_logo?e=1770854400&v=beta&t=TS\_eni0Q\_1Om8Poy9cuuOmWICvB1g9LjvWxjI4EImak"

width:400

height:400

\[4\]:

id:"11321165"

name:"Google Developer Groups (GDG)"

industry:"Technology, Information and Internet"

followerCount:543818

Url:"https://www.linkedin.com/showcase/google-developer-groups/"

logos:

\[0\]:

url:"https://media.licdn.com/dms/image/v2/C560BAQFUyrWqc079tw/company-logo\_200\_200/company-logo\_200\_200/0/1630570752037/community\_groups\_program\_gdg\_logo?e=1770854400&v=beta&t=-T2HgpfXYaBNEGRFBffkjDd46wxPkttYIXXORzSIYT0"

width:200

height:200

\[1\]:

url:"https://media.licdn.com/dms/image/v2/C560BAQFUyrWqc079tw/company-logo\_100\_100/company-logo\_100\_100/0/1630570752037/community\_groups\_program\_gdg\_logo?e=1770854400&v=beta&t=NH00fIy-K51uglSLrfNWFSYePzQ4sOzSJxHdBE-kZoA"

width:100

height:100

\[2\]:

url:"https://media.licdn.com/dms/image/v2/C560BAQFUyrWqc079tw/company-logo\_400\_400/company-logo\_400\_400/0/1630570752037/community\_groups\_program\_gdg\_logo?e=1770854400&v=beta&t=XRvE\_F\_OE0INri02U-KftkcGemu35ZN1Dm9cbGvziw4"

width:400

height:400

\[5\]:

id:"101031931"

name:"Google Research"

industry:"Technology, Information and Internet"

followerCount:372735

Url:"https://www.linkedin.com/showcase/googleresearch/"

logos:

\[0\]:

url:"https://media.licdn.com/dms/image/v2/D560BAQG5rLrtFi47Nw/company-logo\_200\_200/company-logo\_200\_200/0/1698961278359/googleresearch\_logo?e=1770854400&v=beta&t=fxrOcnnIkzLJ593JxWeakefslPliSqPNOiUNfyrxzm0"

width:200

height:200

\[1\]:

url:"https://media.licdn.com/dms/image/v2/D560BAQG5rLrtFi47Nw/company-logo\_100\_100/company-logo\_100\_100/0/1698961278359/googleresearch\_logo?e=1770854400&v=beta&t=UobsHKe3triWu7EFGswsuC3Mr6S1jc23v2pp2wJdwWk"

width:100

height:100

\[2\]:

url:"https://media.licdn.com/dms/image/v2/D560BAQG5rLrtFi47Nw/company-logo\_400\_400/company-logo\_400\_400/0/1698961278359/googleresearch\_logo?e=1770854400&v=beta&t=uTACryQQlWAXQMFjCcBz4cv5bo76GuvuBemyZ5ETn5k"

width:400

height:400

\[6\]:

id:"71625768"

name:"Android"

industry:"Technology, Information and Internet"

followerCount:52123

Url:"https://www.linkedin.com/showcase/android\_by\_google/"

logos:

\[0\]:

url:"https://media.licdn.com/dms/image/v2/D560BAQH-GrDIhmlBVw/company-logo\_100\_100/B56Zsu4JmpIcAQ-/0/1766018030395/android\_by\_google\_logo?e=1770854400&v=beta&t=VsptyNGDyjkyrz1lbDZqRLRV99S2zpiHZsdiumTTWF8"

width:100

height:100

\[1\]:

url:"https://media.licdn.com/dms/image/v2/D560BAQH-GrDIhmlBVw/company-logo\_400\_400/B56Zsu4JmpIcAY-/0/1766018030395/android\_by\_google\_logo?e=1770854400&v=beta&t=hX1a-PCBetZdNOWX9W0Da45HLTPoEuokgeolBojQaWk"

width:400

height:400

\[2\]:

url:"https://media.licdn.com/dms/image/v2/D560BAQH-GrDIhmlBVw/company-logo\_200\_200/B56Zsu4JmpIcAI-/0/1766018030395/android\_by\_google\_logo?e=1770854400&v=beta&t=KFRXezjWvFWMazuXU9DuqXtB-h9AdC6tu\_8CvlJHxGU"

width:200

height:200

\[7\]:

id:"77163696"

name:"Android Developers"

industry:"Technology, Information and Internet"

followerCount:149125

Url:"https://www.linkedin.com/showcase/androiddev/"

logos:

\[0\]:

url:"https://media.licdn.com/dms/image/v2/D4E0BAQFzY5ND9gQVhA/company-logo\_100\_100/B4EZstvUYaHMAU-/0/1765998938494/androiddev\_logo?e=1770854400&v=beta&t=nHsueGlr31v7Bfi4CFx-GiV8ziHYKtlqV3f-wSPUhC8"

width:100

height:100

\[1\]:

url:"https://media.licdn.com/dms/image/v2/D4E0BAQFzY5ND9gQVhA/company-logo\_400\_400/B4EZstvUYaHMAc-/0/1765998938494/androiddev\_logo?e=1770854400&v=beta&t=gbSGYm\_kQuwokQXyaCDkff4NGLaFtVoQuU60zItFCPg"

width:400

height:400

\[2\]:

url:"https://media.licdn.com/dms/image/v2/D4E0BAQFzY5ND9gQVhA/company-logo\_200\_200/B4EZstvUYaHMAM-/0/1765998938494/androiddev\_logo?e=1770854400&v=beta&t=1FgFOkuUQijwxe-3QwmSmbPkucZjE5Ty7ZmI7TPkcLo"

width:200

height:200

\[8\]:

id:"10124320"

name:"Google Partners"

industry:"Advertising Services"

followerCount:71460

Url:"https://www.linkedin.com/showcase/google-partners/"

logos:

\[0\]:

url:"https://media.licdn.com/dms/image/v2/C4D0BAQGQQRSdCkTbBQ/company-logo\_200\_200/company-logo\_200\_200/0/1631340633685?e=1770854400&v=beta&t=G6dXJWuR4A\_T15VPlzVmC5AJuHm4Tuq0pBG-y2X2UBE"

width:200

height:200

\[1\]:

url:"https://media.licdn.com/dms/image/v2/C4D0BAQGQQRSdCkTbBQ/company-logo\_100\_100/company-logo\_100\_100/0/1631340633685?e=1770854400&v=beta&t=owVayRmav\_lHu0YkGtfq5r4hUA08r9f33sfAenK4pi4"

width:100

height:100

\[2\]:

url:"https://media.licdn.com/dms/image/v2/C4D0BAQGQQRSdCkTbBQ/company-logo\_400\_400/company-logo\_400\_400/0/1631340633685?e=1770854400&v=beta&t=ZqvEOAgKLb9HjngGirgUrwI4wdIVVZcSihywYS-7fg4"

width:400

height:400

\[9\]:

id:"3611194"

name:"Think with Google"

industry:"Advertising Services"

followerCount:953197

Url:"https://www.linkedin.com/showcase/think-with-google/"

logos:

\[0\]:

url:"https://media.licdn.com/dms/image/v2/C4E0BAQG0wixREuYNmA/company-logo\_200\_200/company-logo\_200\_200/0/1661287344336/think\_with\_google\_logo?e=1770854400&v=beta&t=NeJ0W1txL1IRtD7BD8C5crTp-bJG8Tsquj1VJPVyq5Y"

width:200

height:200

\[1\]:

url:"https://media.licdn.com/dms/image/v2/C4E0BAQG0wixREuYNmA/company-logo\_100\_100/company-logo\_100\_100/0/1661287344336/think\_with\_google\_logo?e=1770854400&v=beta&t=jusc-4o\_Kh9d8DsU7os\_ceAPWe\_MzQh3AzQMgfVdep8"

width:100

height:100

\[2\]:

url:"https://media.licdn.com/dms/image/v2/C4E0BAQG0wixREuYNmA/company-logo\_400\_400/company-logo\_400\_400/0/1661287344336/think\_with\_google\_logo?e=1770854400&v=beta&t=9oJM03oMbtm5299I8XTJ6EV9jR3FhVNo5W1bbnPE4QU"

width:400

height:400

\[10\]:

id:"107571353"

name:"Google Learning & Education"

industry:"Technology, Information and Internet"

followerCount:9592

Url:"https://www.linkedin.com/showcase/google-learning-edu/"

logos:

\[0\]:

url:"https://media.licdn.com/dms/image/v2/D560BAQGGnFFZxWR32A/company-logo\_400\_400/B56ZeyJ827G0AY-/0/1751040643547?e=1770854400&v=beta&t=4P8hy34wE2wbR3i3jRQhW976Hymg2SJhF3gbWLQBqwQ"

width:400

height:400

\[1\]:

url:"https://media.licdn.com/dms/image/v2/D560BAQGGnFFZxWR32A/company-logo\_200\_200/B56ZeyJ827G0AI-/0/1751040643547?e=1770854400&v=beta&t=YxRIET3NDnaGCaHfHxJcyyOgTG8cT5mXpeJzvVkXRIY"

width:200

height:200

\[2\]:

url:"https://media.licdn.com/dms/image/v2/D560BAQGGnFFZxWR32A/company-logo\_100\_100/B56ZeyJ827G0AQ-/0/1751040643547?e=1770854400&v=beta&t=YJTOlFq16IYKeLYm8028zSTczU9IWFA0k6HE8bjbhvw"

width:100

height:100

\[11\]:

id:"25013385"

name:"Google for Developers"

industry:"Technology, Information and Internet"

followerCount:3477640

Url:"https://www.linkedin.com/showcase/googledevelopers/"

logos:

\[0\]:

url:"https://media.licdn.com/dms/image/v2/D560BAQHlzyn1IsVxEw/company-logo\_400\_400/B56ZqiUJQ7I0AY-/0/1763659781488/googledevelopers\_logo?e=1770854400&v=beta&t=DRSAcgbqSbNfbnaJq\_6IYB8AQI-o4uJpuFmWuENF9Tw"

width:400

height:400

\[1\]:

url:"https://media.licdn.com/dms/image/v2/D560BAQHlzyn1IsVxEw/company-logo\_200\_200/B56ZqiUJQ7I0AI-/0/1763659781488/googledevelopers\_logo?e=1770854400&v=beta&t=UnwfTfCLKWGWqt0pMkZkqwQsE9UGM6inbD2m6YLrVow"

width:200

height:200

\[2\]:

url:"https://media.licdn.com/dms/image/v2/D560BAQHlzyn1IsVxEw/company-logo\_100\_100/B56ZqiUJQ7I0AQ-/0/1763659781488/googledevelopers\_logo?e=1770854400&v=beta&t=\_wTTIAhn7Ci5c5nTASTybUyBhdaHt6CBgZJd-9Vyip4"

width:100

height:100

\[12\]:

id:"15859534"

name:"Google Cloud Partners"

industry:"Internet Publishing"

followerCount:135224

Url:"https://www.linkedin.com/showcase/google-cloud-partners/"

logos:

\[0\]:

url:"https://media.licdn.com/dms/image/v2/C560BAQHgiaAqw0cAZQ/company-logo\_200\_200/company-logo\_200\_200/0/1630603869371/google\_cloud\_partners\_logo?e=1770854400&v=beta&t=mITrFacb5B4LuMAu8W4sEB5FBZSu\_gKERajAeme4wCQ"

width:200

height:200

\[1\]:

url:"https://media.licdn.com/dms/image/v2/C560BAQHgiaAqw0cAZQ/company-logo\_100\_100/company-logo\_100\_100/0/1630603869371/google\_cloud\_partners\_logo?e=1770854400&v=beta&t=dkT9TdCsWXtul020PRgjNFG77QhkpojOODb41rBRpzw"

width:100

height:100

\[2\]:

url:"https://media.licdn.com/dms/image/v2/C560BAQHgiaAqw0cAZQ/company-logo\_400\_400/company-logo\_400\_400/0/1630603869371/google\_cloud\_partners\_logo?e=1770854400&v=beta&t=FBtTYIjXHe4prAbQNKFjl2HMcK5a82gvlMBmrPN-lYU"

width:400

height:400

\[13\]:

id:"92586569"

name:"Google Public Policy"

industry:"Technology, Information and Internet"

followerCount:23779

Url:"https://www.linkedin.com/showcase/google-public-policy/"

logos:

\[0\]:

url:"https://media.licdn.com/dms/image/v2/D4E0BAQHJo0OA8b8URg/company-logo\_400\_400/B4EZm\_zW3mHMAY-/0/1759859535943/google\_public\_policy\_logo?e=1770854400&v=beta&t=R2MZcvVJR22h08sa5UG5sOmWOVDpVWumCA\_TQhsOwr4"

width:400

height:400

\[1\]:

url:"https://media.licdn.com/dms/image/v2/D4E0BAQHJo0OA8b8URg/company-logo\_200\_200/B4EZm\_zW3mHMAI-/0/1759859535943/google\_public\_policy\_logo?e=1770854400&v=beta&t=sfuLd2b9QuR1gizX1ivdZ4Kmt6SSPdyFG2sg2iQHGsc"

width:200

height:200

\[2\]:

url:"https://media.licdn.com/dms/image/v2/D4E0BAQHJo0OA8b8URg/company-logo\_100\_100/B4EZm\_zW3mHMAQ-/0/1759859535943/google\_public\_policy\_logo?e=1770854400&v=beta&t=s6puaG0pTBvWPLYF04UU9j6QPu0I-wbIZFILa-s0Q3E"

width:100

height:100

\[14\]:

id:"29015212"

name:"Grow with Google"

industry:"E-learning"

followerCount:187119

Url:"https://www.linkedin.com/showcase/grow-with-google/"

logos:

\[0\]:

url:"https://media.licdn.com/dms/image/v2/C560BAQFFo-CL-y-UYA/company-logo\_200\_200/company-logo\_200\_200/0/1631404101430/grow\_with\_google\_logo?e=1770854400&v=beta&t=FQsi2U1R6DLuNRDKAmtr4xMOiP4qVC\_9x67KteOLL1Y"

width:200

height:200

\[1\]:

url:"https://media.licdn.com/dms/image/v2/C560BAQFFo-CL-y-UYA/company-logo\_100\_100/company-logo\_100\_100/0/1631404101430/grow\_with\_google\_logo?e=1770854400&v=beta&t=Jn67nJMyBjc4DnuB2pCtikvvBoiBr0ZztktekTalKl8"

width:100

height:100

\[2\]:

url:"https://media.licdn.com/dms/image/v2/C560BAQFFo-CL-y-UYA/company-logo\_400\_400/company-logo\_400\_400/0/1631404101430/grow\_with\_google\_logo?e=1770854400&v=beta&t=XzuFhQguzmLCqrssibzg5h9bV-ZP9ILX8QdusMH3tvk"

width:400

height:400

\[15\]:

id:"6644131"

name:"re:Work with Google"

industry:"Human Resources Services"

followerCount:75788

Url:"https://www.linkedin.com/showcase/rework-with-google/"

logos:

\[0\]:

url:"https://media.licdn.com/dms/image/v2/C4D0BAQGk9X0v8TL6xw/company-logo\_200\_200/company-logo\_200\_200/0/1631331138435?e=1770854400&v=beta&t=pVaDr-VfIDQDguhaX5T3BG10WP6KGpC\_mRELozFZO7w"

width:200

height:200

\[1\]:

url:"https://media.licdn.com/dms/image/v2/C4D0BAQGk9X0v8TL6xw/company-logo\_100\_100/company-logo\_100\_100/0/1631331138435?e=1770854400&v=beta&t=k08vpK9V6IxuMTUt0Tg9Sa1HF6yGI8VPUwF8JHy7low"

width:100

height:100

\[2\]:

url:"https://media.licdn.com/dms/image/v2/C4D0BAQGk9X0v8TL6xw/company-logo\_400\_400/company-logo\_400\_400/0/1631331138435?e=1770854400&v=beta&t=w4xDAYaGXTY0qO07hpfcPAfX22O\_FKQjUd9KELajKys"

width:400

height:400

\[16\]:

id:"8629486"

name:"Google for Health"

industry:"Technology, Information and Internet"

followerCount:117724

Url:"https://www.linkedin.com/showcase/google-for-health/"

logos:

\[0\]:

url:"https://media.licdn.com/dms/image/v2/D560BAQGzx2yxxDgESA/company-logo\_100\_100/B56Zdal\_.OHoAY-/0/1749571600513/google\_health\_logo?e=1770854400&v=beta&t=b-m7FwD04NEpoKjDxchcZTTgUPD29yOmslWj-S7VpHc"

width:100

height:100

\[1\]:

url:"https://media.licdn.com/dms/image/v2/D560BAQGzx2yxxDgESA/company-logo\_400\_400/B56Zdal\_.OHoAg-/0/1749571600513/google\_health\_logo?e=1770854400&v=beta&t=mgrZQA502UwUiWLt-aYckrBP6qQdl8DS8ZXU-JXAiWU"

width:400

height:400

\[2\]:

url:"https://media.licdn.com/dms/image/v2/D560BAQGzx2yxxDgESA/company-logo\_200\_200/B56Zdal\_.OHoAQ-/0/1749571600513/google\_health\_logo?e=1770854400&v=beta&t=tzTbTWb6SWTIX2nqGlVowVQjBji3X9JcHq-CAMBU5To"

width:200

height:200

\[17\]:

id:"109835959"

name:"Google Antigravity"

industry:"Software Development"

followerCount:9522

Url:"https://www.linkedin.com/showcase/google-antigravity/"

logos:

\[0\]:

url:"https://media.licdn.com/dms/image/v2/D560BAQG5wmEaqHfmDg/company-logo\_200\_200/B56ZqUSJh0I4AM-/0/1763424377586/google\_antigravity\_logo?e=1770854400&v=beta&t=hC7JMeup70qWC9GE6Q41owSVznqK7Ie3G-4h4a4F\_Gc"

width:200

height:200

\[1\]:

url:"https://media.licdn.com/dms/image/v2/D560BAQG5wmEaqHfmDg/company-logo\_400\_400/B56ZqUSJh0I4Ac-/0/1763424377586/google\_antigravity\_logo?e=1770854400&v=beta&t=9DsGnNYN0v6Fi-uDNa-4WGJNU9I29dz3Ca2VKZLfgrY"

width:400

height:400

\[2\]:

url:"https://media.licdn.com/dms/image/v2/D560BAQG5wmEaqHfmDg/company-logo\_100\_100/B56ZqUSJh0I4AU-/0/1763424377586/google\_antigravity\_logo?e=1770854400&v=beta&t=tqvxPLiiK\_oGvVmXxjfTUBw3YnJYDaRWkIsDePLeXlE"

width:100

height:100

\[18\]:

id:"66345263"

name:"Google Nest Pro"

industry:"Technology, Information and Internet"

followerCount:18777

Url:"https://www.linkedin.com/showcase/google-nest/"

logos:

\[0\]:

url:"https://media.licdn.com/dms/image/v2/C560BAQH\_OmH7hYAD2A/company-logo\_200\_200/company-logo\_200\_200/0/1676486274466/google\_nest\_logo?e=1770854400&v=beta&t=vsytYC\_wNWjnIxRNPj7dT3FDEaBhZ8fJpCINblXp\_TY"

width:200

height:200

\[1\]:

url:"https://media.licdn.com/dms/image/v2/C560BAQH\_OmH7hYAD2A/company-logo\_100\_100/company-logo\_100\_100/0/1676486274466/google\_nest\_logo?e=1770854400&v=beta&t=6WOOMUEnwYKmkHsPgZf9O\_sMCAhBvXKaPaQ41Go7Ybg"

width:100

height:100

\[2\]:

url:"https://media.licdn.com/dms/image/v2/C560BAQH\_OmH7hYAD2A/company-logo\_400\_400/company-logo\_400\_400/0/1676486274466/google\_nest\_logo?e=1770854400&v=beta&t=zmRdW67X29-Qf8DT4TwZWtJmawAW\_kg8GvsNGAgrDVE"

width:400

height:400

\[19\]:

id:"18925599"

name:"Google User Experience Research"

industry:"Technology, Information and Internet"

followerCount:31406

Url:"https://www.linkedin.com/showcase/google-user-research./"

logos:

\[0\]:

url:"https://media.licdn.com/dms/image/v2/C4E0BAQH06LdMOtQq\_w/company-logo\_200\_200/company-logo\_200\_200/0/1630591519443/google\_user\_research\_logo?e=1770854400&v=beta&t=zZVM\_1\_tik7gVT7ajoW0nxc7hEiQPFOr77qx6PgMMSA"

width:200

height:200

\[1\]:

url:"https://media.licdn.com/dms/image/v2/C4E0BAQH06LdMOtQq\_w/company-logo\_100\_100/company-logo\_100\_100/0/1630591519444/google\_user\_research\_logo?e=1770854400&v=beta&t=hG\_R6tTzAh4kJirF3dCw2RT4Vx1q9jocwwipffqxZlg"

width:100

height:100

\[2\]:

url:"https://media.licdn.com/dms/image/v2/C4E0BAQH06LdMOtQq\_w/company-logo\_400\_400/company-logo\_400\_400/0/1630591519444/google\_user\_research\_logo?e=1770854400&v=beta&t=sML3Fjk0OPrhD9BhJWfJAWt5C2P148RLP45faSRj4UY"

width:400

height:400

\[20\]:

id:"12997578"

name:"Google News Initiative"

industry:"Online Audio and Video Media"

followerCount:66885

Url:"https://www.linkedin.com/showcase/google-news-initiative/"

logos:

\[0\]:

url:"https://media.licdn.com/dms/image/v2/C4D0BAQENwPk8U5nwXQ/company-logo\_200\_200/company-logo\_200\_200/0/1648217189857/google\_news\_initiative\_logo?e=1770854400&v=beta&t=0umgbU\_z2Dbpb4ylJmyW8gtR2T1JYVHmcM8BAn1D4ic"

width:200

height:200

\[1\]:

url:"https://media.licdn.com/dms/image/v2/C4D0BAQENwPk8U5nwXQ/company-logo\_100\_100/company-logo\_100\_100/0/1648217189857/google\_news\_initiative\_logo?e=1770854400&v=beta&t=Dpu0-vbk4wNH6Rmkx4q4ZZ7pO7BXWY4sfg\_77SX0gd4"

width:100

height:100

\[2\]:

url:"https://media.licdn.com/dms/image/v2/C4D0BAQENwPk8U5nwXQ/company-logo\_400\_400/company-logo\_400\_400/0/1648217189857/google\_news\_initiative\_logo?e=1770854400&v=beta&t=wkItg2EAs5GSDGMdwYV4Z5ZvVFuktYoVCls7mDpUfEg"

width:400

height:400

\[21\]:

id:"106703041"

name:"Google Italia"

industry:"Technology, Information and Internet"

followerCount:3933

Url:"https://www.linkedin.com/showcase/google-italia/"

logos:

\[0\]:

url:"https://media.licdn.com/dms/image/v2/D560BAQGVPp0STu44BQ/company-logo\_400\_400/B56ZY1UVlJGUAY-/0/1744651246595?e=1770854400&v=beta&t=S8kPMku378boDGzCNruhZpkwPtzypNHZSLwdRPSvFMc"

width:400

height:400

\[1\]:

url:"https://media.licdn.com/dms/image/v2/D560BAQGVPp0STu44BQ/company-logo\_200\_200/B56ZY1UVlJGUAI-/0/1744651246595?e=1770854400&v=beta&t=fIYPSIJLyMst3WRDEybEYFH96Ju3-pB2wFcKIfqTFFo"

width:200

height:200

\[2\]:

url:"https://media.licdn.com/dms/image/v2/D560BAQGVPp0STu44BQ/company-logo\_100\_100/B56ZY1UVlJGUAQ-/0/1744651246595?e=1770854400&v=beta&t=iXX5tWncYyn6HrYuZgnLF1wQLWchyZJ4DQjHaQ6hpYQ"

width:100

height:100

\[22\]:

id:"27109944"

name:"Google Developers North America"

industry:"Technology, Information and Internet"

followerCount:19283

Url:"https://www.linkedin.com/showcase/google-developers-north-america/"

logos:

\[0\]:

url:"https://media.licdn.com/dms/image/v2/D4E0BAQFoGWWSOfPdVQ/company-logo\_200\_200/company-logo\_200\_200/0/1709662277991/google\_developers\_north\_america\_logo?e=1770854400&v=beta&t=grTdwqt\_pKxLGCSUjvkMBmHKshs4mm\_hMf3ExGPNLew"

width:200

height:200

\[1\]:

url:"https://media.licdn.com/dms/image/v2/D4E0BAQFoGWWSOfPdVQ/company-logo\_100\_100/company-logo\_100\_100/0/1709662277992/google\_developers\_north\_america\_logo?e=1770854400&v=beta&t=S8LDfwoqWrYkpoBtZZUcl1nm0xJowwEbt7DP14vxOWw"

width:100

height:100

\[2\]:

url:"https://media.licdn.com/dms/image/v2/D4E0BAQFoGWWSOfPdVQ/company-logo\_400\_400/company-logo\_400\_400/0/1709662277992/google\_developers\_north\_america\_logo?e=1770854400&v=beta&t=Pdb36xo00c0yyO8Rzqt3Rwbzn28-Azwd-wxYbEua6vU"

width:400

height:400

\[23\]:

id:"103755306"

name:"Google Search Liaison"

industry:"Technology, Information and Internet"

followerCount:17705

Url:"https://www.linkedin.com/showcase/google-search-liaison/"

logos:

\[0\]:

url:"https://media.licdn.com/dms/image/v2/D560BAQGi1gBNONsUFA/company-logo\_200\_200/company-logo\_200\_200/0/1721154916593?e=1770854400&v=beta&t=92N-PIgJnDsPifnkYlemB8ASpMA77zKPnh9s4VlYols"

width:200

height:200

\[1\]:

url:"https://media.licdn.com/dms/image/v2/D560BAQGi1gBNONsUFA/company-logo\_100\_100/company-logo\_100\_100/0/1721154916593?e=1770854400&v=beta&t=fQLfX9DnHxY8O17YKAkECu4Ek3FSA7yl4wHcx3T0iEo"

width:100

height:100

\[2\]:

url:"https://media.licdn.com/dms/image/v2/D560BAQGi1gBNONsUFA/company-logo\_400\_400/company-logo\_400\_400/0/1721154916593?e=1770854400&v=beta&t=2xCfXAZn2f8KPmH0opbZ\_Rg6ak-eYuNGjrpg8QSyx8M"

width:400

height:400

\[24\]:

id:"6599465"

name:"Google Small Business"

industry:"Internet Publishing"

followerCount:126587

Url:"https://www.linkedin.com/showcase/google-small-business/"

logos:

\[0\]:

url:"https://media.licdn.com/dms/image/v2/D4E0BAQExZlDfYW-QcA/company-logo\_400\_400/B4EZoxogtOIMAY-/0/1761769295173/google\_small\_business\_logo?e=1770854400&v=beta&t=yPs5lUo53qwksv5W72Yv\_x\_Z7LesYx2SYhCAHjjCA9k"

width:400

height:400

\[1\]:

url:"https://media.licdn.com/dms/image/v2/D4E0BAQExZlDfYW-QcA/company-logo\_200\_200/B4EZoxogtOIMAI-/0/1761769295173/google\_small\_business\_logo?e=1770854400&v=beta&t=rFcswL0MhfdvcbEtMim2ClE1hmSn9H7qbhx9V-3wi2o"

width:200

height:200

\[2\]:

url:"https://media.licdn.com/dms/image/v2/D4E0BAQExZlDfYW-QcA/company-logo\_100\_100/B4EZoxogtOIMAQ-/0/1761769295173/google\_small\_business\_logo?e=1770854400&v=beta&t=aQtCeS5pevwBXEJwx49DXUa7jOZ\_2ZnmC27tsfHt2pw"

width:100

height:100

\[25\]:

id:"2868133"

name:"Firebase"

industry:"Software Development"

followerCount:58520

Url:"https://www.linkedin.com/showcase/firebase/"

logos:

\[0\]:

url:"https://media.licdn.com/dms/image/v2/D560BAQH\_5kvrJUkLuw/company-logo\_200\_200/company-logo\_200\_200/0/1729106317821/firebase\_logo?e=1770854400&v=beta&t=FoKOqjAxAOFWziS81OK8uvEURbRCO21QvESqOvboqqU"

width:200

height:200

\[1\]:

url:"https://media.licdn.com/dms/image/v2/D560BAQH\_5kvrJUkLuw/company-logo\_100\_100/company-logo\_100\_100/0/1729106317821/firebase\_logo?e=1770854400&v=beta&t=4UATnwl55VcKjPdTbodlHVaTOib2e5MkcitBDiolbcI"

width:100

height:100

\[2\]:

url:"https://media.licdn.com/dms/image/v2/D560BAQH\_5kvrJUkLuw/company-logo\_400\_400/company-logo\_400\_400/0/1729106317821/firebase\_logo?e=1770854400&v=beta&t=mIwX5jhGMkRmv5r8hXkoK8EVh\_Z5eRvVvBUpKywDfvk"

width:400

height:400

\[26\]:

id:"74357847"

name:"Google Chrome"

industry:"Technology, Information and Internet"

followerCount:27021

Url:"https://www.linkedin.com/showcase/google-chrome/"

logos:

\[0\]:

url:"https://media.licdn.com/dms/image/v2/C560BAQHpUJ\_qDlImBQ/company-logo\_200\_200/company-logo\_200\_200/0/1649349588413/google\_chrome\_logo?e=1770854400&v=beta&t=0cCVJeoVwDm118329s5ScAOSMnQXoCIghEFYHpYNDpU"

width:200

height:200

\[1\]:

url:"https://media.licdn.com/dms/image/v2/C560BAQHpUJ\_qDlImBQ/company-logo\_100\_100/company-logo\_100\_100/0/1649349588413/google\_chrome\_logo?e=1770854400&v=beta&t=sLS8wyyWlZuE1zlxtWp0gOCAK5vMrLahwOSkGknruIg"

width:100

height:100

\[2\]:

url:"https://media.licdn.com/dms/image/v2/C560BAQHpUJ\_qDlImBQ/company-logo\_400\_400/company-logo\_400\_400/0/1649349588413/google\_chrome\_logo?e=1770854400&v=beta&t=\_VRqdopQkvwh-BR\_QwloX2qxtThQXIoM5twKCyszrlk"

width:400

height:400

\[27\]:

id:"3668753"

name:"Google Workspace"

industry:"Software Development"

followerCount:669006

Url:"https://www.linkedin.com/showcase/googleworkspace/"

logos:

\[0\]:

url:"https://media.licdn.com/dms/image/v2/C4D0BAQHuLzhR-WUSMg/company-logo\_200\_200/company-logo\_200\_200/0/1630573711840/googleworkspace\_logo?e=1770854400&v=beta&t=06ZQXlpjA0jR3di-PYwm4oRnWnedr\_tD5uwXvvcDArI"

width:200

height:200

\[1\]:

url:"https://media.licdn.com/dms/image/v2/C4D0BAQHuLzhR-WUSMg/company-logo\_100\_100/company-logo\_100\_100/0/1630573711840/googleworkspace\_logo?e=1770854400&v=beta&t=ynUrS-jaszLUMp\_yWk0Rg1VOndB9g5tdE6y81KsOBP8"

width:100

height:100

\[2\]:

url:"https://media.licdn.com/dms/image/v2/C4D0BAQHuLzhR-WUSMg/company-logo\_400\_400/company-logo\_400\_400/0/1630573711840/googleworkspace\_logo?e=1770854400&v=beta&t=D8eERISPlaXt3yY5UVomTEJMzgAplbjtfzT2QNIe5Uw"

width:400

height:400

\[28\]:

id:"105292422"

name:"Google AI for Developers"

industry:"Technology, Information and Internet"

followerCount:84309

Url:"https://www.linkedin.com/showcase/googleaidevs/"

logos:

\[0\]:

url:"https://media.licdn.com/dms/image/v2/D560BAQGd2bTlJsilLg/company-logo\_200\_200/company-logo\_200\_200/0/1733522182114/googleaidevs\_logo?e=1770854400&v=beta&t=fjLtx8VBQBO1cUZUF3xU1qqYveyf5KzjAHwVyj7V5ec"

width:200

height:200

\[1\]:

url:"https://media.licdn.com/dms/image/v2/D560BAQGd2bTlJsilLg/company-logo\_100\_100/company-logo\_100\_100/0/1733522182114/googleaidevs\_logo?e=1770854400&v=beta&t=r7YzsSToiwy3zeQfJfRtkhrtkfwWjVgxHCaYqA28qws"

width:100

height:100

\[2\]:

url:"https://media.licdn.com/dms/image/v2/D560BAQGd2bTlJsilLg/company-logo\_400\_400/company-logo\_400\_400/0/1733522182114/googleaidevs\_logo?e=1770854400&v=beta&t=xBuOruyPeTmU8Asam0CWizTnOVp3MVLYjjfCkz6ScQM"

width:400

height:400

\[29\]:

id:"18557142"

name:"Google Pay Developers"

industry:"Technology, Information and Internet"

followerCount:45622

Url:"https://www.linkedin.com/showcase/google-pay/"

logos:

\[0\]:

url:"https://media.licdn.com/dms/image/v2/C560BAQFWCk66BYhwMw/company-logo\_200\_200/company-logo\_200\_200/0/1631432403639?e=1770854400&v=beta&t=NAEsA4cn-3ytxgVyHcKYmBuLC4a9MQBq1d5sq-Ha7jk"

width:200

height:200

\[1\]:

url:"https://media.licdn.com/dms/image/v2/C560BAQFWCk66BYhwMw/company-logo\_100\_100/company-logo\_100\_100/0/1631432403639?e=1770854400&v=beta&t=n9OlC2Ssv6A0fxNZCVLw8Xrx7ddjbjWN4fBMvwbaiKo"

width:100

height:100

\[2\]:

url:"https://media.licdn.com/dms/image/v2/C560BAQFWCk66BYhwMw/company-logo\_400\_400/company-logo\_400\_400/0/1631432403639?e=1770854400&v=beta&t=GH\_9q3-12BDtQUIIBFgrzs4C-30AQW12y8i0hC5jHoE"

width:400

height:400

\[30\]:

id:"105576160"

name:"Google for Publishers"

industry:"Technology, Information and Internet"

followerCount:299568

Url:"https://www.linkedin.com/showcase/google-for-publishers/"

logos:

\[0\]:

url:"https://media.licdn.com/dms/image/v2/D4E0BAQHglGPtwCI4pg/company-logo\_200\_200/company-logo\_200\_200/0/1736888029474/google\_for\_publishers\_logo?e=1770854400&v=beta&t=sDlcTDPkzvndMx2u5oCC7Wi5w62xy9dfOy8AuDAa2C0"

width:200

height:200

\[1\]:

url:"https://media.licdn.com/dms/image/v2/D4E0BAQHglGPtwCI4pg/company-logo\_100\_100/company-logo\_100\_100/0/1736888029474/google\_for\_publishers\_logo?e=1770854400&v=beta&t=L3\_LY-Pqa-ZPM4p-mm7AqIiUjUCL2NhX2dTXHrAUuUg"

width:100

height:100

\[2\]:

url:"https://media.licdn.com/dms/image/v2/D4E0BAQHglGPtwCI4pg/company-logo\_400\_400/company-logo\_400\_400/0/1736888029474/google\_for\_publishers\_logo?e=1770854400&v=beta&t=a19pL48y9LnuIgJvsqdNFudUzlEFY9\_K-0cWrCBg-JY"

width:400

height:400

\[31\]:

id:"102720926"

name:"Google Search Central"

industry:"Technology, Information and Internet"

followerCount:119477

Url:"https://www.linkedin.com/showcase/googlesearchcentral/"

logos:

\[0\]:

url:"https://media.licdn.com/dms/image/v2/D560BAQHU22ISGMrPuw/company-logo\_200\_200/company-logo\_200\_200/0/1715877453021?e=1770854400&v=beta&t=642GBgFd1xUh6GXmU9zih8f6kTN1xAota5XaYsJeyqQ"

width:200

height:200

\[1\]:

url:"https://media.licdn.com/dms/image/v2/D560BAQHU22ISGMrPuw/company-logo\_100\_100/company-logo\_100\_100/0/1715877453021?e=1770854400&v=beta&t=KKQpPS5y3xhS4rv6YsEf1GQKb8ZXacKGx-b0qJqyJBE"

width:100

height:100

\[2\]:

url:"https://media.licdn.com/dms/image/v2/D560BAQHU22ISGMrPuw/company-logo\_400\_400/company-logo\_400\_400/0/1715877453021?e=1770854400&v=beta&t=NnO68P4Aigz2MC3Lr1UOU4L9okBGdseBMuUw-U8vVqI"

width:400

height:400

\[32\]:

id:"106770356"

name:"Google Arabia"

industry:"Technology, Information and Internet"

followerCount:6382

Url:"https://www.linkedin.com/showcase/google-arabia/"

logos:

\[0\]:

url:"https://media.licdn.com/dms/image/v2/D560BAQGOSUhJSXXzrg/company-logo\_400\_400/B56ZahP6wxGoAY-/0/1746462027700?e=1770854400&v=beta&t=\_UiZzWVg9Lo5MnO6cZEmTsEh41OOQqurPwm-TryTPL4"

width:400

height:400

\[1\]:

url:"https://media.licdn.com/dms/image/v2/D560BAQGOSUhJSXXzrg/company-logo\_200\_200/B56ZahP6wxGoAI-/0/1746462027700?e=1770854400&v=beta&t=5Tdm7eafte0J9nAZQDVaBqz3piioYF2UfJwDa\_gXnhA"

width:200

height:200

\[2\]:

url:"https://media.licdn.com/dms/image/v2/D560BAQGOSUhJSXXzrg/company-logo\_100\_100/B56ZahP6wxGoAQ-/0/1746462027700?e=1770854400&v=beta&t=CgafP-ARjeVJLJVtToiKgsopdVbVXXFD5zT87DJTK3s"

width:100

height:100

\[33\]:

id:"82288531"

name:"TensorFlow"

industry:"Technology, Information and Internet"

followerCount:111482

Url:"https://www.linkedin.com/showcase/tensorflowdev/"

logos:

\[0\]:

url:"https://media.licdn.com/dms/image/v2/C560BAQFt0fJxtxk-lg/company-logo\_200\_200/company-logo\_200\_200/0/1668110169199/tensorflowdev\_logo?e=1770854400&v=beta&t=-hdavyLskoq78Ua4UFl3QaUZrdpN28k6Rni15x1-wls"

width:200

height:200

\[1\]:

url:"https://media.licdn.com/dms/image/v2/C560BAQFt0fJxtxk-lg/company-logo\_100\_100/company-logo\_100\_100/0/1668110169199/tensorflowdev\_logo?e=1770854400&v=beta&t=qmLiScZpqPvYIOCovYOm8ZzO09TKVySo09YwXKEwvQU"

width:100

height:100

\[2\]:

url:"https://media.licdn.com/dms/image/v2/C560BAQFt0fJxtxk-lg/company-logo\_400\_400/company-logo\_400\_400/0/1668110169199/tensorflowdev\_logo?e=1770854400&v=beta&t=r674Va5mp\_AmidTt1xSCHw9sf2tMq4fkySB3ujuAVmY"

width:400

height:400

\[34\]:

id:"66341749"

name:"ChromeOS & Chrome Enterprise"

industry:"IT Services and IT Consulting"

followerCount:120853

Url:"https://www.linkedin.com/showcase/chrome-enterprise/"

logos:

\[0\]:

url:"https://media.licdn.com/dms/image/v2/C560BAQHzYXxutuas9A/company-logo\_200\_200/company-logo\_200\_200/0/1675144820382/chrome\_enterprise\_logo?e=1770854400&v=beta&t=YkQV0rrWNYRcVXKwg2XbtOoNKee\_kSV9E8V9XwtW0p8"

width:200

height:200

\[1\]:

url:"https://media.licdn.com/dms/image/v2/C560BAQHzYXxutuas9A/company-logo\_100\_100/company-logo\_100\_100/0/1675144820383/chrome\_enterprise\_logo?e=1770854400&v=beta&t=b5EpOWbN\_c6qk4Ww4HRarXBuWqAtzHok6s4Zcl8jOBQ"

width:100

height:100

\[2\]:

url:"https://media.licdn.com/dms/image/v2/C560BAQHzYXxutuas9A/company-logo\_400\_400/company-logo\_400\_400/0/1675144820383/chrome\_enterprise\_logo?e=1770854400&v=beta&t=SucQTngqAuE82ODA1ubZoIBjFugMLgp651QMnOTtjYs"

width:400

height:400

\[35\]:

id:"105044144"

name:"Google Public Sector"

industry:"Software Development"

followerCount:17804

Url:"https://www.linkedin.com/showcase/google-public-sector/"

logos:

\[0\]:

url:"https://media.licdn.com/dms/image/v2/D4E0BAQG3Vi-sS2P76g/company-logo\_400\_400/B4EZexk72yHIAk-/0/1751030939471/google\_public\_sector\_logo?e=1770854400&v=beta&t=dh4wOyaHTdG90evs4IZv6BEEavaWc9P790c4IHMEYWQ"

width:400

height:400

\[1\]:

url:"https://media.licdn.com/dms/image/v2/D4E0BAQG3Vi-sS2P76g/company-logo\_200\_200/B4EZexk72yHIAU-/0/1751030939471/google\_public\_sector\_logo?e=1770854400&v=beta&t=PwHiodMGQ0BaK1wyfdq3ziAi2HBwJvVukminDY-hrt4"

width:200

height:200

\[2\]:

url:"https://media.licdn.com/dms/image/v2/D4E0BAQG3Vi-sS2P76g/company-logo\_100\_100/B4EZexk72yHIAc-/0/1751030939471/google\_public\_sector\_logo?e=1770854400&v=beta&t=7zSkCFoUkVkU15pWbTfrjhSijDxAuJMdoxIqK6CIWkA"

width:100

height:100

\[36\]:

id:"82288532"

name:"Firebase"

industry:""

followerCount:3286

Url:"https://www.linkedin.com/showcase/firebase-hold/"

\[37\]:

id:"9416052"

name:"Google Ads"

industry:"Advertising Services"

followerCount:898114

Url:"https://www.linkedin.com/showcase/google-ads-/"

logos:

\[0\]:

url:"https://media.licdn.com/dms/image/v2/C560BAQH9F59ob8d3QQ/company-logo\_200\_200/company-logo\_200\_200/0/1631424821422/google\_ads\_\_logo?e=1770854400&v=beta&t=mH9pnvd0010OCe2wsFOhDVobKc5x2Od5cvurq3Bn830"

width:200

height:200

\[1\]:

url:"https://media.licdn.com/dms/image/v2/C560BAQH9F59ob8d3QQ/company-logo\_100\_100/company-logo\_100\_100/0/1631424821422/google\_ads\_\_logo?e=1770854400&v=beta&t=9m7AoskPHcZ3jd303wlCW725vWBddVJiBmhe-zLxC5s"

width:100

height:100

\[2\]:

url:"https://media.licdn.com/dms/image/v2/C560BAQH9F59ob8d3QQ/company-logo\_400\_400/company-logo\_400\_400/0/1631424821422/google\_ads\_\_logo?e=1770854400&v=beta&t=tDdd8GtFQ\_3tCj5QchdGf3ClWGCp6XZJTW8QL2fJx2A"

width:400

height:400

\[38\]:

id:"99371798"

name:"Chrome for Developers"

industry:"Technology, Information and Internet"

followerCount:45177

Url:"https://www.linkedin.com/showcase/chrome-for-developers/"

logos:

\[0\]:

url:"https://media.licdn.com/dms/image/v2/D560BAQFAkDPGM\_aNUQ/company-logo\_200\_200/company-logo\_200\_200/0/1706292924372?e=1770854400&v=beta&t=ktaBRvfalW\_5-xEjB64E1L\_-F\_tHV7IgjMO7erG1gzc"

width:200

height:200

\[1\]:

url:"https://media.licdn.com/dms/image/v2/D560BAQFAkDPGM\_aNUQ/company-logo\_100\_100/company-logo\_100\_100/0/1706292924372?e=1770854400&v=beta&t=4pRZeWTIJftyvp2t8UbcBRWNh1nF4FUA3pGlZUilj5s"

width:100

height:100

\[2\]:

url:"https://media.licdn.com/dms/image/v2/D560BAQFAkDPGM\_aNUQ/company-logo\_400\_400/company-logo\_400\_400/0/1706292924372?e=1770854400&v=beta&t=pGR-JioC2NJPjrhufJcP2Rhg8-dTI7Na7YZitVJZjtc"

width:400

height:400

\[39\]:

id:"10476436"

name:"Google Analytics"

industry:"Technology, Information and Internet"

followerCount:568599

Url:"https://www.linkedin.com/showcase/google-analytics/"

logos:

\[0\]:

url:"https://media.licdn.com/dms/image/v2/C560BAQHDx1a8WwtGpQ/company-logo\_200\_200/company-logo\_200\_200/0/1631433614727/google\_analytics\_logo?e=1770854400&v=beta&t=YkHTqqF8tdtZHgC2xoVDAwEca3Bf4\_CzloE1iV-jXMM"

width:200

height:200

\[1\]:

url:"https://media.licdn.com/dms/image/v2/C560BAQHDx1a8WwtGpQ/company-logo\_100\_100/company-logo\_100\_100/0/1631433614727/google\_analytics\_logo?e=1770854400&v=beta&t=mUHNLRMkFThR6t850zdp-hv5C3MZEj-kVnTl6HDQf-8"

width:100

height:100

\[2\]:

url:"https://media.licdn.com/dms/image/v2/C560BAQHDx1a8WwtGpQ/company-logo\_400\_400/company-logo\_400\_400/0/1631433614727/google\_analytics\_logo?e=1770854400&v=beta&t=AhPeQozu6vKbMTeKZ4Uz7Bn2p-4hDmE0ZeAb4at8XnM"

width:400

height:400

\[40\]:

id:"3648281"

name:"Google Cloud"

industry:"Software Development"

followerCount:3129148

Url:"https://www.linkedin.com/showcase/google-cloud/"

logos:

\[0\]:

url:"https://media.licdn.com/dms/image/v2/C560BAQFIFLR7jxm2lg/company-logo\_200\_200/company-logo\_200\_200/0/1630644546845/google\_cloud\_logo?e=1770854400&v=beta&t=I3sHFSdRT66PlSlUWRk-eapWAMf9ieoyh5mcnct4\_7o"

width:200

height:200

\[1\]:

url:"https://media.licdn.com/dms/image/v2/C560BAQFIFLR7jxm2lg/company-logo\_100\_100/company-logo\_100\_100/0/1630644546845/google\_cloud\_logo?e=1770854400&v=beta&t=UvXGuyshDnBQ2Aj7644h2w5xZB0fCu9\_kaWKcUzltXo"

width:100

height:100

\[2\]:

url:"https://media.licdn.com/dms/image/v2/C560BAQFIFLR7jxm2lg/company-logo\_400\_400/company-logo\_400\_400/0/1630644546845/google\_cloud\_logo?e=1770854400&v=beta&t=QJc5izV-2Uj56UuVzqlujb4eWSRbqAAx-7SvA9EIOxs"

width:400

height:400

\[41\]:

id:"82286774"

name:"Flutter"

industry:""

followerCount:4131

Url:"https://www.linkedin.com/showcase/flutterdev-hold/"

\[42\]:

id:"102840132"

name:"Google Maps Platform"

industry:"Technology, Information and Internet"

followerCount:17458

Url:"https://www.linkedin.com/showcase/googlemapsplatform/"

logos:

\[0\]:

url:"https://media.licdn.com/dms/image/v2/D4D0BAQHExZWymL9ytg/company-logo\_200\_200/company-logo\_200\_200/0/1710450776300/gmapsplatform\_logo?e=1770854400&v=beta&t=sKtS1LU-in0h-PQs4PqlXcOF44DmcpXzqJO5l274EYw"

width:200

height:200

\[1\]:

url:"https://media.licdn.com/dms/image/v2/D4D0BAQHExZWymL9ytg/company-logo\_100\_100/company-logo\_100\_100/0/1710450776300/gmapsplatform\_logo?e=1770854400&v=beta&t=Tnixog-hSsbVCZ7t7NQubAAW3oYM6fKoTftQgCP07xc"

width:100

height:100

\[2\]:

url:"https://media.licdn.com/dms/image/v2/D4D0BAQHExZWymL9ytg/company-logo\_400\_400/company-logo\_400\_400/0/1710450776300/gmapsplatform\_logo?e=1770854400&v=beta&t=DHMSR7r4z93Q31nqCU39LEPWHjCcLb5lTsZG7Zs5lxs"

width:400

height:400

\[43\]:

id:"82540973"

name:"Flutter Dev"

industry:"Technology, Information and Internet"

followerCount:103561

Url:"https://www.linkedin.com/showcase/flutterdevofficial/"

logos:

\[0\]:

url:"https://media.licdn.com/dms/image/v2/C560BAQF1lnr4bvrLKQ/company-logo\_200\_200/company-logo\_200\_200/0/1660157151780/flutterdevofficial\_logo?e=1770854400&v=beta&t=8mnwBglOKQXHkJxKESnGNknFgYTtYMR6wiAcsifXZ4I"

width:200

height:200

\[1\]:

url:"https://media.licdn.com/dms/image/v2/C560BAQF1lnr4bvrLKQ/company-logo\_100\_100/company-logo\_100\_100/0/1660157151780/flutterdevofficial\_logo?e=1770854400&v=beta&t=pLU\_-z3MTJAPTPS8JF45J2\_YvacD7T2zKXVvXDgkS1s"

width:100

height:100

\[2\]:

url:"https://media.licdn.com/dms/image/v2/C560BAQF1lnr4bvrLKQ/company-logo\_400\_400/company-logo\_400\_400/0/1660157151780/flutterdevofficial\_logo?e=1770854400&v=beta&t=9WDUavN8z8YhzemWLmymtPw6VzCSTfTCLlm3HNYU0sg"

width:400

height:400
