# API Documentation - LinkdAPI

## API Documentation

Professional data API for developers

[Getting Started](/docs/intro)[Pricing](/docs/endpoints-cost)

GET

## Schools

[Try it](/playground?endpoint=%2Fapi%2Fv1%2Fsearch%2Fschools&folder=Search)

1 credit

search schools (all filters available)

`/api/v1/search/schools?keyword=london&start=0&count=25`

### Query Parameters

`keyword`

Required

string

Example:`london`

`start`

integer

Example:`0`

`count`

integer

Example:`25`

### Response Schema

Field

Type

Description

`schools`

array<object>

`urn`

string

utc-millisec

Unique internal identifier used for detailed profile queries

`schoolID`

string

utc-millisec

`name`

string

Display name of the entity

`location`

string

Geographic location information

`logoURL`

string

uri

URL of the company or entity logo

`followersCount`

integer

Numeric count

`schoolURL`

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

schools:

\[0\]:

urn:"9433099"

schoolID:"9433099"

name:"Software Development Academy"

location:"Gdynia, pomorskie"

logoURL:"https://media.licdn.com/dms/image/v2/C4E0BAQGGpw91fxmZVA/company-logo\_100\_100/company-logo\_100\_100/0/1631192827596/software\_development\_academy\_logo?e=1763596800&v=beta&t=AfdaGFk9K\_5KI7zlTIEljwVd71JL8R39SsPAXVKOb68"

followersCount:8

schoolURL:"https://www.linkedin.com/company/software-development-academy/"

\[1\]:

urn:"11456170"

schoolID:"11456170"

name:"Ingeniería de Software UDLA"

location:"Quito, Pichincha"

description:"La carrera con mayor crecimiento y proyección mundial ¡Ven a crear el futuro!"

logoURL:"https://media.licdn.com/dms/image/v2/C4E0BAQGb-RpryLoF6g/company-logo\_100\_100/company-logo\_100\_100/0/1630630146684/udlaingsoftware\_logo?e=1763596800&v=beta&t=ycVCrzl7yh1Q\_eHnyemqdd3mHw5ONAa0Mg5Ld5BPGh4"

followersCount:99

schoolURL:"https://www.linkedin.com/company/udlaingsoftware/"

\[2\]:

urn:"18508477"

schoolID:"18508477"

name:"Software Development University of Utah- School of Computing"

location:"Salt Lake City, Utah"

description:"16-month masters program that does not require computer science background and opens doors to new job possibilities."

logoURL:"https://media.licdn.com/dms/image/v2/C4E0BAQGljVyUv1HSCQ/company-logo\_100\_100/company-logo\_100\_100/0/1630563118306/university\_of\_utah\_master\_of\_software\_development\_logo?e=1763596800&v=beta&t=9NFy33HbJavBRmborDcDUNCTNDCqufVsqXbCbN5SaKY"

followersCount:177

schoolURL:"https://www.linkedin.com/company/utahmsd/"

\[3\]:

urn:"3805597"

schoolID:"3805597"

name:"Turing School of Software & Design"

location:"Denver, CO"

description:"We turn great people into outstanding software developers."

logoURL:"https://media.licdn.com/dms/image/v2/C4E0BAQET8fJiAvWTDA/company-logo\_100\_100/company-logo\_100\_100/0/1631347074531?e=1763596800&v=beta&t=IZRZXBjD79ubAwxog9XOgXDU6VV\_s2\_e4KSpMxuQlBM"

followersCount:2

schoolURL:"https://www.linkedin.com/company/turingschool/"

\[4\]:

urn:"27022068"

schoolID:"27022068"

name:"Software Institute (USI)"

location:"Lugano, Ticino"

description:"A center of excellence committed to the teaching, the research and the development of software"

logoURL:"https://media.licdn.com/dms/image/v2/C4E0BAQEnOEfw\_reEVw/company-logo\_100\_100/company-logo\_100\_100/0/1630590990992/usisoftware\_logo?e=1763596800&v=beta&t=SeLkxqqju\_sBSjSoUmNhC1mhIt3EN55H7fV-bx0ji20"

followersCount:48

schoolURL:"https://www.linkedin.com/company/usisoftware/"

\[5\]:

urn:"2977683"

schoolID:"2977683"

name:"MakerSquare - School of Software Engineering"

location:"Austin, tx"

logoURL:"https://media.licdn.com/dms/image/v2/C510BAQHMkIH5IZot0g/company-logo\_100\_100/company-logo\_100\_100/0/1631354168980?e=1763596800&v=beta&t=838PIz8RTKY68PpOkhFQJTEGzB8Ccu\_mz-kAX5MDLRQ"

followersCount:346

schoolURL:"https://www.linkedin.com/company/makersquare/"

\[6\]:

urn:"81841832"

schoolID:"81841832"

name:"Software Village"

location:"Baku, Xetai"

logoURL:"https://media.licdn.com/dms/image/v2/C4D0BAQEgMelseYAx2w/company-logo\_100\_100/company-logo\_100\_100/0/1653485265786?e=1763596800&v=beta&t=dzTIyskqIok4HCdAetiYq1wvJdfkaw3HP9evjLEbLXc"

followersCount:5

schoolURL:"https://www.linkedin.com/company/software-village/"

\[7\]:

urn:"106329689"

schoolID:"106329689"

name:"Software Development Academy"

location:""

logoURL:"https://media.licdn.com/dms/image/v2/D4D0BAQGvBLz1Ey2k1g/company-logo\_100\_100/company-logo\_100\_100/0/1738680484106?e=1763596800&v=beta&t=9cOSBqOcS8cg98V1mC7TCyI4r9WWyKywvYF-AYFI0V0"

followersCount:19

schoolURL:"https://www.linkedin.com/company/software-development-academy-puga-1/"

\[8\]:

urn:"6407917"

schoolID:"6407917"

name:"Nashville Software School"

location:"Nashville, Tennessee"

description:"Discover your new career through hands-on, project-based, and team-based learning. Hiring? Meet our junior-level talent."

logoURL:"https://media.licdn.com/dms/image/v2/C4E0BAQFWNmb1o5Bxkg/company-logo\_100\_100/company-logo\_100\_100/0/1630604334801/nashville\_software\_school\_logo?e=1763596800&v=beta&t=Z\_7LUco6oV6kOZ5\_aTiky8B8QBIlTSDrQun8Ms4O1d8"

followersCount:2

schoolURL:"https://www.linkedin.com/company/nashville-software-school/"

\[9\]:

urn:"3529173"

schoolID:"3529173"

name:"Software University (SoftUni)"

location:"Sofia, BG"

description:"Learn programming and start a tech job"

logoURL:"https://media.licdn.com/dms/image/v2/C4D0BAQEApCWzd7I27g/company-logo\_100\_100/company-logo\_100\_100/0/1631349197715?e=1763596800&v=beta&t=l3mD6SLP2W2ZOzFRE1YVautTxq3j\_c06jditit7wCIM"

followersCount:15

schoolURL:"https://www.linkedin.com/company/software-university-softuni/"

total:1000

start:0

count:10

hasMore:true
