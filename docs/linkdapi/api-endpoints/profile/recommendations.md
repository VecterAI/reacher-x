# API Documentation - LinkdAPI

## API Documentation

Professional data API for developers

[Getting Started](/docs/intro)[Pricing](/docs/endpoints-cost)

GET

## Recommendations

[Try it](/playground?endpoint=%2Fapi%2Fv1%2Fprofile%2Frecommendations&folder=Profile)

1 credit

Get a user’s given and received recommendations by their URN.

`/api/v1/profile/recommendations?urn=ACoAAAAKXBwBikfbNJww68eYvcu2dqDYJhHbp4g`

### Query Parameters

`urn`

Required

string

Example:`ACoAAAAKXBwBikfbNJww68eYvcu2dqDYJhHbp4g`

### Response Schema

Field

Type

Description

`Recived`

array<object>

`Text`

string

`Caption`

string

`Recommendee`

object

`name`

string

Display name of the entity

`headline`

string

Professional headline or tagline

`urn`

string

Unique internal identifier used for detailed profile queries

`url`

string

uri

Direct URL to this resource

`Given`

array<object>

`Text`

string

`Caption`

string

`Recommendee`

object

`name`

string

Display name of the entity

`headline`

string

Professional headline or tagline

`urn`

string

Unique internal identifier used for detailed profile queries

`url`

string

uri

Direct URL to this resource

`Total`

integer

Total number of results available

`TotalGiven`

integer

`TotalRecived`

integer

### Example Response

InteractiveRaw JSONCode

success:true

statusCode:200

message:"Data retrieved successfully"

errors:null

data:

Recived:

\[0\]:

Text:"I worked with Mansoor for about 3 years. Mansoor has been a great friend & colleague to work with. He was leading a team I was part of. With MS automation experience, he took no time to learn QTP tool & soon became SME. He created QTP framework from scratch. He mentored the team relatively new to automation. Absolutely committed to work, excellent at communication & people management. It was a good learning experience working with him."

Caption:"July 17, 2012, Mansoor was senior to Kuldeep but didn't manage Kuldeep directly"

Recommendee:

name:"Kuldeep Chavan"

headline:"Software Engineer at GE"

urn:"ACoAAAE0Z7IBswMmfsMjtbJHCe1qvsK-36yiOxo"

url:"https://www.linkedin.com/in/kuldeep-chavan-66a9286"

\[1\]:

Text:"Worked with Mansoor in same group over the same functionality.Mansoor is a very had working,excellent team player, and person with very clear thinking who is really good at understanding of requirements and at the same time explaining them to the fellow team mates.Found him to be a very good team player who is ready to help and guide at every front.Expert in Test automation.On the top of it all a very enthusiastic,positive person and a very good human being. Wish him all the very best."

Caption:"April 22, 2011, Aditya worked with Mansoor on the same team"

Recommendee:

name:"Aditya Modi"

headline:"Senior Manager, Delivery at Nagarro"

urn:"ACoAAAXSvssBM2LCu8q3V3nxRBYKXI00PIXuefA"

url:"https://www.linkedin.com/in/adityamodi1983"

\[2\]:

Text:"To whom it may concern, I have worked with Mansoor at GE. In our time working together on test automation code I have found Mansoor to be a good partner in getting things done. We worked at opposite times with him being in Mumbai, India, and myself being in Minden, NV. As such, it has been helpful that Mansoor was easily able to understand requests for functionality via email and deliver good working code by the next day. The work that Mansoor has done, that I am familiar with, was using Quick Test Professional to automate testing of Windows applications. I would say that his experience in this work is expert level. I would recommend him any time for test automation work. Eelke Wiegers"

Caption:"June 2, 2009, Eelke worked with Mansoor on the same team"

Recommendee:

name:"Eelke Wiegers"

headline:"Software Engineer at Disney"

urn:"ACoAAAAseUgBrx-qYr8C_mqAZeY9cdY-PJu5EEE"

url:"https://www.linkedin.com/in/ewiegers"

Given:

\[0\]:

Text:"I know Sarafaraz for more than 3 years now. We both were working in the same Java based project. I find him very detailed oriented. He know how to break down complex problems into manageable pieces. Technically, he is very strong and loves programming. He has created several Java based frameworks which are used by several teams. Always ready to offer guidance and support when needed. Excellent team player. Would love to work with him in future too. "

Caption:"April 22, 2018, Mansoor worked with Sarfaraz on the same team"

Recommendee:

name:"Sarfaraz Ahmed"

headline:"Group CEO | Co-founder | Entrepreneur | Technology Leader | Innovation | Transformation | AI | Building Innovative Solution | Strategic Initiatives | Ex-JPMC Vice President | Ex-Morgan Stanley - Senior Manager|"

urn:"ACoAAAPEHpUBQfGdjOhIECV0uS3lrLTG5W8IvvM"

url:"https://www.linkedin.com/in/sarfaraz007"

\[1\]:

Text:"I and Eelke has worked in the same group at GE. He was located in Minden, US and I was based in Mumbai, India. We both worked on the automation development activities. He is a very nice person with good interpersonal skills and has very strong technical expertise as far as Software Test Automation is concerned. He was able to understand the task that I gave to him during my EOD and was able to deliver it to me by the next day. His understanding of test automation was of an expert level. I can recommend him anytime for testing and test automation related task. It was wonderful working with him. I wish him best of luck for all his future endeavors. Thanks, Mansoor"

Caption:"September 1, 2011, Mansoor worked with Eelke on the same team"

Recommendee:

name:"Eelke Wiegers"

headline:"Software Engineer at Disney"

urn:"ACoAAAAseUgBrx-qYr8C_mqAZeY9cdY-PJu5EEE"

url:"https://www.linkedin.com/in/ewiegers"

\[2\]:

Text:"I and Vishal studied in the same engineering college in mumbai. He is really good person with good interpersonal skills. He was a very hardworking and talented guy with good grasping skills. I wish him best of luck for his career. Thanks, Mansoor"

Caption:"September 1, 2011, Mansoor and Vishal studied together"

Recommendee:

name:"Vishal Bhanage"

headline:"Senior Solution & Data Architect | Development Head | Azure | AWS | Dynamics 365 | Power Platform | DevOps | AI | Copilot | .Net | API | Microservice | Angular JS | React | SQL"

urn:"ACoAAAOii6kBDaMi8uNzEHLsy2_eOYydTsQ6qYE"

url:"https://www.linkedin.com/in/vishalmicrosoftprofessional"

\[3\]:

Text:"I have worked with Aditya at GE Energy in the same project. I found him to be an excellent team player and has good problem solving skills. He has good programming skills and does a good job at analysing the Root Cause of a technical issue and fixing them as well.He picked up new tools pretty quickly and played a signficant role in managing 3 Patni consultants at GE for unit testing and automation work of our project. It was wonderful working with him at GE. Thanks, Mansoor"

Caption:"April 22, 2011, Mansoor worked with Aditya on the same team"

Recommendee:

name:"Aditya Modi"

headline:"Senior Manager, Delivery at Nagarro"

urn:"ACoAAAXSvssBM2LCu8q3V3nxRBYKXI00PIXuefA"

url:"https://www.linkedin.com/in/adityamodi1983"

Total:7

TotalGiven:4

TotalRecived:3
