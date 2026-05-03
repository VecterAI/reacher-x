# API Documentation - LinkdAPI

## API Documentation

Professional data API for developers

[Getting Started](/docs/intro)[Pricing](/docs/endpoints-cost)

GET

## Certifications

[Try it](/playground?endpoint=%2Fapi%2Fv1%2Fprofile%2Fcertifications&folder=Profile)

1 credit

Get a user’s professional certifications by their URN.

`/api/v1/profile/certifications?urn=ACoAAAHT6VYBz_yVpo-jE-Or8WNKjArXMd-S6KM`

### Query Parameters

`urn`

Required

string

Example:`ACoAAAHT6VYBz_yVpo-jE-Or8WNKjArXMd-S6KM`

### Response Schema

Field

Type

Description

`certifications`

array<object>

Professional certifications

`issuedBy`

string

Boolean flag

`certificationLink`

string

URL link to this resource

`certificationName`

string

`issuedDate`

string

Timestamp

`issuerId`

string

utc-millisec

Boolean flag

`issuerLink`

string

uri

URL link to this resource

`issuedDateParsed`

object

Boolean flag

`year`

integer

`month`

integer

`day`

integer

### Example Response

InteractiveRaw JSONCode

success:true

statusCode:200

message:"Data retrieved successfully"

data:

certifications:

\[0\]:

issuedBy:"Zerodha"

certificationLink:""

certificationName:"Stock Market Basics"

issuedDate:"Issued May 2022"

issuerId:"2160857"

issuerLink:"https://www.linkedin.com/company/2160857/"

issuedDateParsed:

year:2022

month:5

day:1

\[1\]:

issuedBy:"Oracle"

certificationLink:"https://brm-certview.oracle.com/pls/certview/ecertificate?ssn=OC2225604&trackId=OCIAA2021CA&key=7b70040e7a71e8c4c6a1102466642e0ab0787d85"

certificationName:"Oracle Cloud Infrastructure 2021 Certified Solutions Architect"

issuedDate:"Issued Dec 2021"

issuerId:"1028"

issuerLink:"https://www.linkedin.com/company/1028/"

issuedDateParsed:

year:2021

month:12

day:1

\[2\]:

issuedBy:"Oracle"

certificationLink:"https://brm-certview.oracle.com/pls/certview/ecertificate?ssn=OC2225604&trackId=OCIBF2021&key=89a859484e91f556af36324f628c4e3e3a40300d"

certificationName:"Oracle Certified Foundations Associate"

issuedDate:"Issued Sep 2021"

issuerId:"1028"

issuerLink:"https://www.linkedin.com/company/1028/"

issuedDateParsed:

year:2021

month:9

day:1

\[3\]:

issuedBy:"Cisco"

certificationLink:"https://www.credly.com/badges/a58edb6e-7819-4f24-8ff8-168b5a970fe0?source=linked\_in\_profile"

certificationName:"Introduction to Cybersecurity"

issuedDate:"Issued Aug 2021"

issuerId:"1063"

issuerLink:"https://www.linkedin.com/company/1063/"

issuedDateParsed:

year:2021

month:8

day:1

\[4\]:

issuedBy:"Good Agile (www.goodagile.com)"

certificationLink:""

certificationName:"Agile Scrum Master"

issuedDate:""

issuerId:""

issuerLink:""

issuedDateParsed:

year:0

month:0

day:0

\[5\]:

issuedBy:"Microsoft Corporation"

certificationLink:""

certificationName:"Microsoft Certified Professional in C#.Net"

issuedDate:""

issuerId:""

issuerLink:""

issuedDateParsed:

year:0

month:0

day:0

\[6\]:

issuedBy:"National Stock Exhange of India"

certificationLink:""

certificationName:"NCFM (NSE's certification in Financial Markets)"

issuedDate:""

issuerId:""

issuerLink:""

issuedDateParsed:

year:0

month:0

day:0

\[7\]:

issuedBy:"General Electric"

certificationLink:""

certificationName:"Six Sigma Green Belt"

issuedDate:""

issuerId:""

issuerLink:""

issuedDateParsed:

year:0

month:0

day:0
