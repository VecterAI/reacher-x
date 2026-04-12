# API Documentation - LinkdAPI

## API Documentation

Professional data API for developers

[Getting Started](/docs/intro)[Pricing](/docs/endpoints-cost)

GET

## Get Company Employees Data

[Try it](/playground?endpoint=%2Fapi%2Fv1%2Fcompanies%2Fcompany%2Femployees-data&folder=Companies)

1 credit

Get a company’s employee insights by ID, including current company distribution, locations, schools, job functions, skills, service categories, and fields of study.

`/api/v1/companies/company/employees-data?id=1441`

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

`totalResultCount`

integer

Numeric count

`groups`

array<object>

`title`

string

Title of the job, post, or article

`group`

array<object>

`name`

string

Display name of the entity

`count`

integer

Number of results in this page

`id`

string

utc-millisec

Unique identifier for this resource

### Example Response

InteractiveRaw JSONCode

success:true

statusCode:200

message:"Data retrieved successfully"

errors:null

data:

totalResultCount:178678

groups:

\[0\]:

title:"Current company"

group:

\[0\]:

name:"Self Employed"

count:657344

id:"33200573"

\[1\]:

name:"Amazon"

count:497020

id:"1586"

\[2\]:

name:"Microsoft"

count:213948

id:"1035"

\[3\]:

name:"Google"

count:178678

id:"1441"

\[4\]:

name:"YouTube"

count:130334

id:"16140"

\[5\]:

name:"Amazon Web Services (AWS)"

count:126620

id:"2382910"

\[6\]:

name:"Meta"

count:61974

id:"10667"

\[7\]:

name:"Salesforce"

count:61163

id:"3185"

\[8\]:

name:"LinkedIn"

count:26190

id:"1337"

\[9\]:

name:"Stealth Startup"

count:25532

id:"18583501"

\[10\]:

name:"Forbes"

count:7914

id:"5597"

\[11\]:

name:"Pavilion"

count:6094

id:"27062956"

\[12\]:

name:"World Economic Forum"

count:4773

id:"8193"

\[13\]:

name:"Forbes Technology Council"

count:2002

id:"11075183"

\[14\]:

name:"topmate.io"

count:1861

id:"79703243"

\[1\]:

title:"Locations"

group:

\[0\]:

name:"United States"

count:84086

id:"103644278"

\[1\]:

name:"California, United States"

count:53081

id:"102095887"

\[2\]:

name:"San Francisco Bay Area"

count:47598

id:"90000084"

\[3\]:

name:"India"

count:23109

id:"102713980"

\[4\]:

name:"New York City Metropolitan Area"

count:15710

id:"90000070"

\[5\]:

name:"Karnataka, India"

count:7565

id:"100811329"

\[6\]:

name:"Greater Bengaluru Area"

count:7476

id:"90009633"

\[7\]:

name:"Bengaluru"

count:7174

id:"105214831"

\[8\]:

name:"United Kingdom"

count:6614

id:"101165590"

\[9\]:

name:"England, United Kingdom"

count:6168

id:"102299470"

\[10\]:

name:"Greater Delhi Area"

count:3392

id:"90009626"

\[11\]:

name:"Telangana, India"

count:3191

id:"102767464"

\[12\]:

name:"Greater Hyderabad Area"

count:3130

id:"90009650"

\[13\]:

name:"Hyderabad"

count:3045

id:"105556991"

\[14\]:

name:"Delhi, India"

count:1918

id:"106187582"

\[2\]:

title:"School"

group:

\[0\]:

name:"University of California, Berkeley"

count:4087

id:"2517"

\[1\]:

name:"Stanford University"

count:3713

id:"1792"

\[2\]:

name:"Massachusetts Institute of Technology"

count:1919

id:"1503"

\[3\]:

name:"Harvard University"

count:1234

id:"1646"

\[4\]:

name:"Birla Institute of Technology and Science, Pilani"

count:1165

id:"739903"

\[5\]:

name:"Stanford University Graduate School of Business"

count:1072

id:"1791"

\[6\]:

name:"The Wharton School"

count:1068

id:"5290"

\[7\]:

name:"Harvard Business School"

count:806

id:"4867"

\[8\]:

name:"Indian Institute of Technology, Bombay"

count:763

id:"157266"

\[9\]:

name:"INSEAD"

count:650

id:"5176"

\[10\]:

name:"Delhi University"

count:505

id:"426734"

\[11\]:

name:"Kendriya Vidyalaya"

count:475

id:"15106896"

\[12\]:

name:"Indian School of Business"

count:443

id:"12070"

\[13\]:

name:"Netaji Subhas Institute of Technology"

count:368

id:"394452"

\[14\]:

name:"Indian Institute of Technology (Banaras Hindu University), Varanasi"

count:335

id:"369612"

\[3\]:

title:"Current Function"

group:

\[0\]:

name:"Engineering"

count:79187

id:"8"

\[1\]:

name:"Information Technology"

count:21225

id:"13"

\[2\]:

name:"Business Development"

count:17767

id:"4"

\[3\]:

name:"Sales"

count:16787

id:"25"

\[4\]:

name:"Program and Project Management"

count:13968

id:"20"

\[5\]:

name:"Operations"

count:13491

id:"18"

\[6\]:

name:"Marketing"

count:12769

id:"15"

\[7\]:

name:"Product Management"

count:7595

id:"19"

\[8\]:

name:"Media and Communication"

count:7234

id:"16"

\[9\]:

name:"Arts and Design"

count:6943

id:"3"

\[10\]:

name:"Education"

count:5054

id:"7"

\[11\]:

name:"Research"

count:4991

id:"24"

\[12\]:

name:"Human Resources"

count:4891

id:"12"

\[13\]:

name:"Community and Social Services"

count:3154

id:"5"

\[14\]:

name:"Entrepreneurship"

count:1784

id:"9"

\[4\]:

title:"Skill Explicit"

group:

\[0\]:

name:"Python (Programming Language)"

count:56605

id:"1346"

\[1\]:

name:"Java"

count:53030

id:"147"

\[2\]:

name:"C++"

count:49211

id:"198"

\[3\]:

name:"SQL"

count:40223

id:"483"

\[4\]:

name:"Project Management"

count:39539

id:"2269"

\[5\]:

name:"Leadership"

count:39243

id:"154"

\[6\]:

name:"Microsoft Office"

count:38617

id:"366"

\[7\]:

name:"C (Programming Language)"

count:37227

id:"438"

\[8\]:

name:"JavaScript"

count:34940

id:"218"

\[9\]:

name:"Management"

count:34573

id:"19"

\[10\]:

name:"Machine Learning"

count:23823

id:"3289"

\[11\]:

name:"Algorithms"

count:23500

id:"1070"

\[12\]:

name:"Communication"

count:22687

id:"135"

\[13\]:

name:"Strategy"

count:21853

id:"107"

\[14\]:

name:"Data Structures"

count:12433

id:"4202"

\[5\]:

title:"Service categories"

group:

\[0\]:

name:"Consulting"

count:1837

id:"220"

\[1\]:

name:"Marketing"

count:1502

id:"2461"

\[2\]:

name:"Software Development"

count:1255

id:"602"

\[3\]:

name:"Coaching & Mentoring"

count:1224

id:"50413"

\[4\]:

name:"Operations"

count:1007

id:"63"

\[5\]:

name:"Design"

count:902

id:"3387"

\[6\]:

name:"Writing"

count:722

id:"86"

\[7\]:

name:"Digital Marketing"

count:690

id:"1836"

\[8\]:

name:"Information Technology"

count:650

id:"4725"

\[9\]:

name:"Career Development Coaching"

count:575

id:"44670"

\[10\]:

name:"IT Consulting"

count:448

id:"50342"

\[11\]:

name:"Interview Preparation"

count:374

id:"7951"

\[12\]:

name:"Leadership Development"

count:338

id:"759"

\[13\]:

name:"Public Speaking"

count:308

id:"1101"

\[14\]:

name:"Resume Review"

count:295

id:"10167"

\[6\]:

title:"Field of Study"

group:

\[0\]:

name:"Computer Science"

count:47045

id:"100189"

\[1\]:

name:"Computational Science"

count:41185

id:"100784"

\[2\]:

name:"Computer Engineering"

count:11190

id:"100347"

\[3\]:

name:"Electrical and Electronics Engineering"

count:11027

id:"100351"

\[4\]:

name:"Business Administration and Management, General"

count:10503

id:"101409"

\[5\]:

name:"Marketing"

count:8953

id:"101475"

\[6\]:

name:"Information Technology"

count:7956

id:"100176"

\[7\]:

name:"Economics"

count:7947

id:"100990"

\[8\]:

name:"Computer Engineering Technologies/Technicians"

count:7720

id:"100432"

\[9\]:

name:"Computer Engineering Technology/Technician"

count:7004

id:"100433"

\[10\]:

name:"Mathematics"

count:6740

id:"100693"

\[11\]:

name:"Business/Commerce, General"

count:5315

id:"101407"

\[12\]:

name:"Electrical, Electronics and Communications Engineering"

count:5017

id:"100350"

\[13\]:

name:"Finance, General"

count:4749

id:"101444"

\[14\]:

name:"Physical Sciences"

count:1957

id:"100865"
