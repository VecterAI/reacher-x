# Get User's Extended Twitter Bio - API Reference | SocialAPI

# Get User's Extended Twitter Bio - API Reference

Returns an object with user’s extended bio with all text and formatting details, or an empty object if the extended bio is missing

GET https://api.socialapi.me/twitter/user/{username}/extended-bio

### Headers

Authorization string required

Authorization Bearer header containing your SocialAPI key

Example: Bearer YOUR_API_KEY

### Path Parameters

username string required

Username of the target user profile without @.

Example: elonmusk

## Example Responses

- [200](#tab-panel-233)
- [402](#tab-panel-234)
- [404](#tab-panel-235)
- [500](#tab-panel-236)

```
{  "blocks": [    {      "text": "I took my 𝕏 (Twitter) account from 0 to 5.5 million impressions in less than 3 months and over 11 million impressions in 5 months using a combination of memes and satirical posts.",      "type": "unstyled",      "inlineStyleRanges": [],      "entityRanges": [],      "depth": 0,      "key": "8v159"    },    {      "text": "",      "type": "unstyled",      "inlineStyleRanges": [],      "entityRanges": [],      "depth": 0,      "key": "8mclg"    },    {      "text": "I've written LinkedIn posts that even the most die-hard LinkedIn fans allowed themselves to chuckle.  ",      "type": "unstyled",      "inlineStyleRanges": [],      "entityRanges": [],      "depth": 0,      "key": "3v6g0"    },    {      "text": "",      "type": "unstyled",      "inlineStyleRanges": [],      "entityRanges": [],      "depth": 0,      "key": "don1i"    },    {      "text": "I'm not your typical \"big 4 consultant.\" ",      "type": "unstyled",      "inlineStyleRanges": [],      "entityRanges": [],      "depth": 0,      "key": "4geb7"    },    {      "text": "",      "type": "unstyled",      "inlineStyleRanges": [],      "entityRanges": [],      "depth": 0,      "key": "ffhgq"    },    {      "text": "I provide real, actionable content that resonates with tech audiences.  Let's connect and make your company go viral.  ",      "type": "unstyled",      "inlineStyleRanges": [],      "entityRanges": [],      "depth": 0,      "key": "4i903"    },    {      "text": "",      "type": "unstyled",      "inlineStyleRanges": [],      "entityRanges": [],      "depth": 0,      "key": "cb6ec"    },    {      "text": "To talk memes, feel free to schedule a call with me here https:\/\/tidycal.com\/heshie.",      "type": "unstyled",      "inlineStyleRanges": [],      "entityRanges": [],      "depth": 0,      "key": "376f5"    },    {      "text": "",      "type": "unstyled",      "inlineStyleRanges": [],      "entityRanges": [],      "depth": 0,      "key": "1hujo"    },    {      "text": "My day job:",      "type": "unstyled",      "inlineStyleRanges": [],      "entityRanges": [],      "depth": 0,      "key": "1mks2"    },    {      "text": "",      "type": "unstyled",      "inlineStyleRanges": [],      "entityRanges": [],      "depth": 0,      "key": "2e8vu"    },    {      "text": "I'm currently a Technical Lead at Morgan and Morgan PA (America's largest personal injury law firm), where I guide the development of client web experiences (client and web portal). I manage a team of six software developers, and my duties include hiring, managing the product roadmap, and overseeing infrastructure.",      "type": "unstyled",      "inlineStyleRanges": [],      "entityRanges": [],      "depth": 0,      "key": "fbh01"    },    {      "text": "",      "type": "unstyled",      "inlineStyleRanges": [],      "entityRanges": [],      "depth": 0,      "key": "ed52k"    },    {      "text": "A giant law firm may sound boring, but think about it this way: How do you make sense of millions of calls, documents, and terabytes of client data? It takes thousands of people to run such an operation, and there are huge opportunities for automation, optimization, and adding AI to create a great web experience for a law firm of our size.  ",      "type": "unstyled",      "inlineStyleRanges": [],      "entityRanges": [],      "depth": 0,      "key": "646l1"    },    {      "text": "",      "type": "unstyled",      "inlineStyleRanges": [],      "entityRanges": [],      "depth": 0,      "key": "3cicm"    },    {      "text": "My background includes a role as a founding engineer at Capable Health, where I helped create a scalable API and infrastructure for their modern healthcare backend, including e-commerce and payment integrations. ",      "type": "unstyled",      "inlineStyleRanges": [],      "entityRanges": [],      "depth": 0,      "key": "b7vtj"    },    {      "text": "",      "type": "unstyled",      "inlineStyleRanges": [],      "entityRanges": [],      "depth": 0,      "key": "e2k4u"    },    {      "text": "Prior to that, I worked at Sitepod—a CRM and back office solution built for the construction industry—where I contributed to their inventory, job site planning, and analytics tool. ",      "type": "unstyled",      "inlineStyleRanges": [],      "entityRanges": [],      "depth": 0,      "key": "3vrge"    },    {      "text": "",      "type": "unstyled",      "inlineStyleRanges": [],      "entityRanges": [],      "depth": 0,      "key": "7ks09"    },    {      "text": "I also worked at Adar Medical Uniforms, where I developed logistics software that incorporated ERP (SAP B1) and consumer-facing tools, including a packaging robot integration that increased our warehouse employee capacity sevenfold.  ",      "type": "unstyled",      "inlineStyleRanges": [],      "entityRanges": [],      "depth": 0,      "key": "6nnd4"    },    {      "text": "",      "type": "unstyled",      "inlineStyleRanges": [],      "entityRanges": [],      "depth": 0,      "key": "7g7u3"    },    {      "text": "I'm an alumnus of the Flatiron School's software engineering program.  I grew up in Brooklyn, New York.",      "type": "unstyled",      "inlineStyleRanges": [],      "entityRanges": [],      "depth": 0,      "key": "4mqjm"    },    {      "text": "",      "type": "unstyled",      "inlineStyleRanges": [],      "entityRanges": [],      "depth": 0,      "key": "8916v"    },    {      "text": "I discovered my passion for technology and tinkering at the age of nine by taking apart computers. I became interested in coding at age 14 when I began exploring the developer tab in Excel. I then taught myself programming using a \"Visual Basic for Dummies\" book.",      "type": "unstyled",      "inlineStyleRanges": [],      "entityRanges": [],      "depth": 0,      "key": "6f2e3"    },    {      "text": "",      "type": "unstyled",      "inlineStyleRanges": [],      "entityRanges": [],      "depth": 0,      "key": "f7f9k"    },    {      "text": "",      "type": "unstyled",      "inlineStyleRanges": [],      "entityRanges": [],      "depth": 0,      "key": "ap1vf"    },    {      "text": "",      "type": "unstyled",      "inlineStyleRanges": [],      "entityRanges": [],      "depth": 0,      "key": "93dfb"    },    {      "text": "",      "type": "unstyled",      "inlineStyleRanges": [],      "entityRanges": [],      "depth": 0,      "key": "d8ve2"    },    {      "text": "",      "type": "unstyled",      "inlineStyleRanges": [],      "entityRanges": [],      "depth": 0,      "key": "fkups"    },    {      "text": "",      "type": "unstyled",      "inlineStyleRanges": [],      "entityRanges": [],      "depth": 0,      "key": "fjhsb"    }  ],  "entityMap": []}
```

```
{    "status": "error",    "message": "Insufficient balance"}
```

```
{    "status": "error",    "message": "User not found"}
```

```
{    "status": "error",    "message": "Failed to fetch data from Twitter"}
```

## Response Codes

- **200 OK** - request succeeded
- **402 Payment Required** - not enough credits to perform this request
- **404 Not Found** - requested user not found
- **422 Unprocessable Content** - validation failed (e.g. one of the required parameters was not provided)
- **500 Internal Error** - API internal error, typically means that SocialAPI failed to obtain the requested information and you should try again later
