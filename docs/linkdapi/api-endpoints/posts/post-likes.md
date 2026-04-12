# API Documentation - LinkdAPI

## API Documentation

Professional data API for developers

[Getting Started](/docs/intro)[Pricing](/docs/endpoints-cost)

GET

## Post's likes

[Try it](/playground?endpoint=%2Fapi%2Fv1%2Fposts%2Flikes&folder=Posts)

1 credit

Get all people who reacted to a post by its URN.

`/api/v1/posts/likes?urn=7259185939057438720&start=0`

### Query Parameters

`urn`

Required

integer

Example:`7259185939057438720`

`start`

integer

Example:`0`

### Response Schema

Field

Type

Description

`currentPage`

integer

`likes`

array<object>

`actor`

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

`id`

string

utc-millisec

Unique identifier for this resource

`url`

string

uri

Direct URL to this resource

`profilePictureURL`

string

uri

URL of the profile photo

`reactionType`

string

`pages`

integer

`totalLikes`

integer

### Example Response

InteractiveRaw JSONCode

success:true

statusCode:200

message:"Data retrieved successfully"

errors:null

data:

currentPage:1

likes:

\[0\]:

actor:

name:"Siddhartha Pande"

headline:"."

urn:"ACoAAAF-u6EB9gSgNLWi6MuWxAxahDO3bf1DLKw"

id:"25082785"

url:"https://www.linkedin.com/in/ACoAAAF-u6EB9gSgNLWi6MuWxAxahDO3bf1DLKw"

profilePictureURL:"https://media.licdn.com/dms/image/v2/C5103AQGz3SqDcvmplg/profile-displayphoto-shrink\_800\_800/profile-displayphoto-shrink\_800\_800/0/1584374124006?e=1743033600&v=beta&t=Wjb8QhRaKvMoDYng-97BDca2cR-gRXO6c0R5qwycKUQ"

reactionType:"LIKE"

\[1\]:

actor:

name:"Rajiv Jha"

headline:"Sr Manager at Tektronix India (P) Limited/Ex Cisco Systems"

urn:"ACoAAACk-LEBRRKV7GXNPiAeC-UmNnVSomLSxfA"

id:"10811569"

url:"https://www.linkedin.com/in/ACoAAACk-LEBRRKV7GXNPiAeC-UmNnVSomLSxfA"

profilePictureURL:"https://media.licdn.com/dms/image/v2/C4E03AQF0SVCmn63ZzQ/profile-displayphoto-shrink\_400\_400/profile-displayphoto-shrink\_400\_400/0/1516318818498?e=1743033600&v=beta&t=kCQ1C9Ikr0Msk89yMcFCDVbu1gxb1oM7TxVpaLbdjpE"

reactionType:"LIKE"

\[2\]:

actor:

name:"Sanjeev Tripurari"

headline:"Co-Founder BintyByte Technologies"

urn:"ACoAAAEdvgcBzkNGW5-m8sKOsHmmUG9rR-TPisc"

id:"18726407"

url:"https://www.linkedin.com/in/ACoAAAEdvgcBzkNGW5-m8sKOsHmmUG9rR-TPisc"

profilePictureURL:"https://media.licdn.com/dms/image/v2/C4E03AQFiT7zS\_QOceg/profile-displayphoto-shrink\_400\_400/profile-displayphoto-shrink\_400\_400/0/1517679276634?e=1743033600&v=beta&t=MPJWxCaSiTM4J5vVMdK7wNkzmHXwMWTCeO6K7s8\_SXU"

reactionType:"LIKE"

\[3\]:

actor:

name:"Balu Kappala"

headline:"Attended SV College of Engineering"

urn:"ACoAAFMxbOkBHPcLwj4rSAK6xgZLeNyNNXoEdCQ"

id:"1395748073"

url:"https://www.linkedin.com/in/ACoAAFMxbOkBHPcLwj4rSAK6xgZLeNyNNXoEdCQ"

profilePictureURL:"https://media.licdn.com/dms/image/v2/D4D03AQGvqA\_rbPOIGw/profile-displayphoto-shrink\_100\_100/profile-displayphoto-shrink\_100\_100/0/1727242645014?e=1743033600&v=beta&t=I94p2b5G9BVcxGdi\_NMWUX8eGh2NZZxeNg-PINluw5c"

reactionType:"LIKE"

\[4\]:

actor:

name:"Rahul Kumar"

headline:"100xDevs coz 10x ain't Enough | CSE @ VIT Bhopal '26 🎓 | DSA in C++ | Web Dev Enthusiast 💻"

urn:"ACoAADTM3lABMWuRnO6Gs2XZuUbzX2vki0ViUnQ"

id:"885841488"

url:"https://www.linkedin.com/in/ACoAADTM3lABMWuRnO6Gs2XZuUbzX2vki0ViUnQ"

profilePictureURL:"https://media.licdn.com/dms/image/v2/D4D03AQGwM01oAjuxPg/profile-displayphoto-shrink\_800\_800/profile-displayphoto-shrink\_800\_800/0/1730047876347?e=1743033600&v=beta&t=5E0XNvOEKiw365eBLp-SLW-BhGpaqCfEDpdL-C56hng"

reactionType:"LIKE"

\[5\]:

actor:

name:"BRAJRAJ MISHRA"

headline:"CSD @MITS-DU'26 || DSA Enthusiast || Full Stack || React.js || Node.js || Express.js || MongoDB || IOT || c++ || python || AI/ML Enthusiast 📱 🤖 President of Innovation and DIY club@MITS DU"

urn:"ACoAAD8EINwBX0iVy01TRYvaZ5XqzGOsTW4pNFA"

id:"1057235164"

url:"https://www.linkedin.com/in/ACoAAD8EINwBX0iVy01TRYvaZ5XqzGOsTW4pNFA"

profilePictureURL:"https://media.licdn.com/dms/image/v2/D4D03AQFLc2F-jmO0Ow/profile-displayphoto-shrink\_800\_800/B4DZP38DKqGkAg-/0/1735031536736?e=1743033600&v=beta&t=Cy\_7yyuUTX0r3J1NZA8qslRVzevIOLnqya\_72bqHuew"

reactionType:"LIKE"

\[6\]:

actor:

name:"Arun Philip"

headline:"Staff Technical Program Manager at Walmart"

urn:"ACoAAAhXTDYBAgCt90enxneRLMRAD9qZe-hZqgs"

id:"139938870"

url:"https://www.linkedin.com/in/ACoAAAhXTDYBAgCt90enxneRLMRAD9qZe-hZqgs"

profilePictureURL:"https://media.licdn.com/dms/image/v2/C5603AQGXIdsjor8Sdw/profile-displayphoto-shrink\_400\_400/profile-displayphoto-shrink\_400\_400/0/1516858489426?e=1743033600&v=beta&t=SkLxuTMVMPI\_rwFjzKePStQQZcLfRqypwqR3Un6UGzg"

reactionType:"LIKE"

\[7\]:

actor:

name:"Vivek Sharma"

headline:"C/C++ || DSA || MERN-Stack Developer"

urn:"ACoAADeGlHIBIfqER9vBrmFgl9OJZx4RYhddO94"

id:"931566706"

url:"https://www.linkedin.com/in/ACoAADeGlHIBIfqER9vBrmFgl9OJZx4RYhddO94"

profilePictureURL:"https://media.licdn.com/dms/image/v2/D5635AQFqdG5E27M9bQ/profile-framedphoto-shrink\_800\_800/profile-framedphoto-shrink\_800\_800/0/1724261352136?e=1738054800&v=beta&t=iyjCsuCyfuARwcJ5DBuNIDhaapOkUH8mYVKNLNyTPTA"

reactionType:"LIKE"

\[8\]:

actor:

name:"Vikram Dutta"

headline:"Manager at Technicolor"

urn:"ACoAAAJPf80BMUCRRubnFo237tH1Nkjz7gv6i2U"

id:"38764493"

url:"https://www.linkedin.com/in/ACoAAAJPf80BMUCRRubnFo237tH1Nkjz7gv6i2U"

profilePictureURL:""

reactionType:"LIKE"

\[9\]:

actor:

name:"Kavitha Siddegowda PMP®"

headline:"Lead Technical Project Manager at Synamedia | Entrepreneurial | Creative | Customer Success | Software Delivery | Design Thinking | RYS - 200 Yoga Certified | Mindfulness Advocate"

urn:"ACoAAAGVuqkBiD9fcE0eRQLeeb339xFf5gYCOsw"

id:"26589865"

url:"https://www.linkedin.com/in/ACoAAAGVuqkBiD9fcE0eRQLeeb339xFf5gYCOsw"

profilePictureURL:""

reactionType:"LIKE"

pages:4

totalLikes:36
