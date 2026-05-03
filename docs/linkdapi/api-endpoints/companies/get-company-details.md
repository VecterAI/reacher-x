# API Documentation - LinkdAPI

## API Documentation

Professional data API for developers

[Getting Started](/docs/intro)[Pricing](/docs/endpoints-cost)

GET

## Get Company Details

[Try it](/playground?endpoint=%2Fapi%2Fv1%2Fcompanies%2Fcompany%2Finfo&folder=Companies)

2 credits

Get company details by ID or name only one is required, not both.

`/api/v1/companies/company/info?id=1441&name=google`

### Query Parameters

`id`

integer

company ID

Example:`1441`

`name`

string

company name

Example:`google`

### Response Schema

Field

Type

Description

`id`

string

utc-millisec

Unique identifier for this resource

`name`

string

Display name of the entity

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

`crunchbaseUrl`

string

uri

Link to Crunchbase profile

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

`fundingData`

object

Venture funding information

`updatedAt`

string

utc-millisec

Last modification timestamp

`numFundingRounds`

integer

Number of funding rounds completed

`lastFundingRound`

object

Details of the most recent funding round

`fundingType`

string

Type of funding (Series A, B, etc.)

`moneyRaised`

object

Amount of capital raised

`amount`

string

utc-millisec

Funding amount raised

`currencyCode`

string

Currency of the funding (e.g. USD)

`numOtherInvestors`

integer

`announcedOn`

object

`year`

integer

`month`

integer

`day`

integer

`fundingRoundCrunchbaseUrl`

string

uri

URL link to this resource

`investorsCrunchbaseUrl`

string

uri

URL link to this resource

`leadInvestors`

any

nullable

`crunchbaseUrl`

string

uri

Link to Crunchbase profile

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

### Example Response

InteractiveRaw JSONCode

success:true

statusCode:200

message:"Data retrieved successfully"

errors:null

data:

id:"1441"

name:"Google"

universalName:"google"

linkedinUrl:"https://www.linkedin.com/company/google/"

description:"A problem isn't truly solved until it's solved for all. Googlers build products that help create opportunities for everyone, whether down the street or across the globe. Bring your insight, imagination and a healthy disregard for the impossible. Bring everything that makes you unique. Together, we can build for everyone. Check out our career opportunities at goo.gle/3DLEokh"

type:"COMPANY"

images:

logo:"https://media.licdn.com/dms/image/v2/C4D0BAQHiNSL4Or29cg/company-logo\_400\_400/company-logo\_400\_400/0/1631311446380?e=1759363200&v=beta&t=iFttuk\_hULNmNrq3KH\_faZVvrfR4A40NWhVD4T\_QuvQ"

cover:"https://media.licdn.com/dms/image/v2/D4E1BAQGppW6ZLvm9Jg/company-background\_400/B4EZge3rcQGUAc-/0/1752864569610/google\_cover?e=1757246400&v=beta&t=yB41H8Sku9IeXxq-iPenPoNt8CUTXl9me9JkDc2W-GU"

isClaimable:false

backgroundCoverImages:

\[0\]:

url:"https://media.licdn.com/dms/image/v2/D4E1BAQGppW6ZLvm9Jg/company-background\_400/B4EZge3rcQGUAc-/0/1752864569610/google\_cover?e=1757246400&v=beta&t=yB41H8Sku9IeXxq-iPenPoNt8CUTXl9me9JkDc2W-GU"

width:400

height:67

\[1\]:

url:"https://media.licdn.com/dms/image/v2/D4E1BAQGppW6ZLvm9Jg/company-background\_200/B4EZge3rcQGUAg-/0/1752864569610/google\_cover?e=1757246400&v=beta&t=sPbW3LytT6PB01LvLlNWhzGHRlS1iYrQjYdH4wWfKTM"

width:200

height:33

\[2\]:

url:"https://media.licdn.com/dms/image/v2/D4E1BAQGppW6ZLvm9Jg/company-background\_10000/B4EZge3rcQGUAY-/0/1752864569610/google\_cover?e=1757246400&v=beta&t=qFQr1GHDcf\_JBSi6KUlpT6KEoTp24vGRtyis0Pp3vEM"

width:1692

height:287

logos:

\[0\]:

url:"https://media.licdn.com/dms/image/v2/C4D0BAQHiNSL4Or29cg/company-logo\_200\_200/company-logo\_200\_200/0/1631311446380?e=1759363200&v=beta&t=lGbuFb5qWVZLEGGoIoOIeOxqIN1jmUR8YjidVVveYnU"

width:200

height:200

\[1\]:

url:"https://media.licdn.com/dms/image/v2/C4D0BAQHiNSL4Or29cg/company-logo\_100\_100/company-logo\_100\_100/0/1631311446380?e=1759363200&v=beta&t=kNH4pfEB\_eDxB3hYl8SPuSaNx\_vRacYgYXL3cS3M4PU"

width:100

height:100

\[2\]:

url:"https://media.licdn.com/dms/image/v2/C4D0BAQHiNSL4Or29cg/company-logo\_400\_400/company-logo\_400\_400/0/1631311446380?e=1759363200&v=beta&t=iFttuk\_hULNmNrq3KH\_faZVvrfR4A40NWhVD4T\_QuvQ"

width:400

height:400

staffCount:315498

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

followerCount:38634459

staffCountRange:"10,001+ employees"

crunchbaseUrl:"https://www.crunchbase.com/organization/google"

topOrganizationListing:

rank:18

listName:"LinkedIn Top Companies"

articleUrl:"https://www.linkedin.com/pulse/linkedin-top-companies-2025-25-best-large-employers-grow-cq7nc/"

text:"This company has been Ranked on LinkedIn Top Companies"

fundingData:

updatedAt:"1754885702"

numFundingRounds:3

lastFundingRound:

fundingType:"Series unknown"

moneyRaised:

amount:"25000000"

currencyCode:"USD"

numOtherInvestors:0

announcedOn:

year:1999

month:6

day:7

fundingRoundCrunchbaseUrl:"https://www.crunchbase.com/funding\_round/google-series-unknown--6c4715f9"

investorsCrunchbaseUrl:"https://www.crunchbase.com/funding\_round/google-series-unknown--6c4715f9"

leadInvestors:null

crunchbaseUrl:"https://www.crunchbase.com/organization/google"

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
