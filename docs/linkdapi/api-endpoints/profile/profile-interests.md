# API Documentation - LinkdAPI

## API Documentation

Professional data API for developers

[Getting Started](/docs/intro)[Pricing](/docs/endpoints-cost)

GET

## Profile interests

[Try it](/playground?endpoint=%2Fapi%2Fv1%2Fprofile%2Finterests&folder=Profile)

1 credit

Get a user’s interests by their URN.

`/api/v1/profile/interests?urn=ACoAAAAKXBwBikfbNJww68eYvcu2dqDYJhHbp4g`

### Query Parameters

`urn`

Required

string

profile URN

Example:`ACoAAAAKXBwBikfbNJww68eYvcu2dqDYJhHbp4g`

### Response Schema

Field

Type

Description

`interests`

object

Professional interests and followed entities

`topVoices`

array<object>

`urn`

string

Unique internal identifier used for detailed profile queries

`firstName`

string

First name of the professional

`lastName`

string

Last name of the professional

`fullName`

string

Complete display name

`publicIdentifier`

string

Public username visible in profile URLs

`profilePictureURL`

string

uri

URL of the profile photo

`creator`

boolean

Whether the profile has creator mode enabled

`followerCount`

integer

Number of followers

`companies`

array<object>

`urn`

string

utc-millisec

Unique internal identifier used for detailed profile queries

`name`

string

Display name of the entity

`url`

string

uri

Direct URL to this resource

`logoURL`

string

uri

URL of the company or entity logo

`followerCount`

integer

Number of followers

`groups`

array<object>

`urn`

string

utc-millisec

Unique internal identifier used for detailed profile queries

`name`

string

Display name of the entity

`logoURL`

string

uri

URL of the company or entity logo

`newsletter`

array<object>

`urn`

string

utc-millisec

Unique internal identifier used for detailed profile queries

`title`

string

Title of the job, post, or article

`description`

string

Detailed description or summary

`logoURL`

string

uri

URL of the company or entity logo

`authorName`

string

`authorProfile`

string

uri

`authorUrn`

string

`frequency`

string

`newsletterURL`

string

uri

URL link to this resource

`school`

array<object>

`urn`

string

utc-millisec

Unique internal identifier used for detailed profile queries

`name`

string

Display name of the entity

`logoURL`

string

uri

URL of the company or entity logo

`followerCount`

integer

Number of followers

`schoolURL`

string

uri

URL link to this resource

`companyURL`

string

uri

URL link to this resource

### Example Response

InteractiveRaw JSONCode

success:true

statusCode:200

message:"Data retrieved successfully"

errors:null

data:

interests:

topVoices:

\[0\]:

urn:"ACoAAA6cWdYBftPaRBLlH5Dt4bhikW4dkgudOko"

firstName:"David"

lastName:"Kostin"

fullName:"David Kostin"

publicIdentifier:"david-kostin-3321146a"

profilePictureURL:"https://media.licdn.com/dms/image/v2/D4D03AQENkh7ebbOmdw/profile-displayphoto-shrink\_800\_800/profile-displayphoto-shrink\_800\_800/0/1665589609582?e=1761782400&v=beta&t=KCr68fMigvS8mjZ9KLPuk\_Wj0J-b6N6kTcyoeCw-Emc"

creator:true

followerCount:65348

\[1\]:

urn:"ACoAAAz-FacByv6gAdpe99uUPm014hDm7GmLlgM"

firstName:"Mark"

lastName:"Mobius"

fullName:"Mark Mobius"

publicIdentifier:"markmobius"

profilePictureURL:"https://media.licdn.com/dms/image/v2/C5603AQEjKiWowc1imw/profile-displayphoto-shrink\_200\_200/profile-displayphoto-shrink\_200\_200/0/1517374184576?e=1761782400&v=beta&t=SGGhV1vYlwygbogWoGZp4hhGS5pdzFchroAtmXMcsoY"

creator:true

followerCount:455901

\[2\]:

urn:"ACoAAABS7N8BHFdEL6zV6HwqeQyDrrIiyjF-2OY"

firstName:"Glenn"

lastName:"Kelman"

fullName:"Glenn Kelman"

publicIdentifier:"glennkelman"

profilePictureURL:"https://media.licdn.com/dms/image/v2/C5103AQG6\_Ry7F65aHQ/profile-displayphoto-shrink\_400\_400/profile-displayphoto-shrink\_400\_400/0/1516348462842?e=1761782400&v=beta&t=aWXbsTJREAVUGEtvPtZLuaBqmH5XlCjsO25wnbDlRAc"

creator:true

followerCount:207460

\[3\]:

urn:"ACoAAAFUu6sBhlQbcvAS0GdcPE344dA3vwutzVM"

firstName:"Jeff"

lastName:"Weiner"

fullName:"Jeff Weiner"

publicIdentifier:"jeffweiner08"

profilePictureURL:"https://media.licdn.com/dms/image/v2/C4D03AQFM3Y2r-OEStw/profile-displayphoto-shrink\_400\_400/profile-displayphoto-shrink\_400\_400/0/1515623804984?e=1761782400&v=beta&t=CF0aWMMnT4z\_WSgR8E9JwkU4WquB8OiAYzASCWZg0ao"

creator:true

followerCount:10399059

\[4\]:

urn:"ACoAADjn70gBqV2yrxBbEIRnZNNuSQumbIB6bl0"

firstName:"Héctor"

lastName:"Herrera"

fullName:"Héctor Herrera"

publicIdentifier:"hectorherreralopez"

profilePictureURL:"https://media.licdn.com/dms/image/v2/C4E03AQH69-NTAu3LjA/profile-displayphoto-shrink\_800\_800/profile-displayphoto-shrink\_800\_800/0/1639604683615?e=1761782400&v=beta&t=GgvVJMh8ojdOrcv3p0jIrxvUjDLzQQKO8apfDWI8Vvs"

creator:true

followerCount:10640

\[5\]:

urn:"ACoAAEn4fgoBq7P8wLgR_zmfSCm_tPIHGcbleWw"

firstName:"Tharman "

lastName:"Shanmugaratnam"

fullName:"Tharman Shanmugaratnam"

publicIdentifier:"tharman-shanmugaratnam"

profilePictureURL:"https://media.licdn.com/dms/image/v2/D5603AQEAf3ySJ9KcFw/profile-displayphoto-shrink\_800\_800/profile-displayphoto-shrink\_800\_800/0/1703985725418?e=1761782400&v=beta&t=4FRi2GPpOOfRWgcVnRkvT5t1mGY48zVNQZq9Oq2jSGQ"

creator:true

followerCount:208777

\[6\]:

urn:"ACoAADMMfvIBK9r0p5vPkBsknLICWmNzoRWeOeg"

firstName:"Kareem"

lastName:"Abdul-Jabbar"

fullName:"Kareem Abdul-Jabbar"

publicIdentifier:"kareem-abdul-jabbar"

profilePictureURL:"https://media.licdn.com/dms/image/v2/D5603AQEClfxbVTMrHA/profile-displayphoto-shrink\_800\_800/profile-displayphoto-shrink\_800\_800/0/1698254290930?e=1761782400&v=beta&t=VM3magIBv5tf4hnHAyI3VCUGAFfRtQbkuHjN\_LLQYpI"

creator:true

followerCount:153888

\[7\]:

urn:"ACoAADJPQh0BurPajL5qSMLBddNKrIMCCUF9WEs"

firstName:"Everette"

lastName:"Taylor"

fullName:"Everette Taylor"

publicIdentifier:"everette"

profilePictureURL:"https://media.licdn.com/dms/image/v2/D4E03AQHJZywRSTgaBg/profile-displayphoto-shrink\_800\_800/B4EZQbz1vQGwAc-/0/1735633363076?e=1761782400&v=beta&t=hqIY0YOMJF1EMevWbWts5Cl7lyOfs3SD-Yn2ttQtEBo"

creator:true

followerCount:50814

\[8\]:

urn:"ACoAAAA6iRMBaolUyvRZOF1IDpmNtRPh98F54l8"

firstName:"Neil"

lastName:"Patel"

fullName:"Neil Patel"

publicIdentifier:"neilkpatel"

profilePictureURL:"https://media.licdn.com/dms/image/v2/C5103AQFihp1Vzz6oCQ/profile-displayphoto-shrink\_800\_800/profile-displayphoto-shrink\_800\_800/0/1516255378392?e=1761782400&v=beta&t=9Y5nUyM4AOlgh0alGrPZyIUvJZXCwpQ61K2om2T4zyg"

creator:true

followerCount:771246

\[9\]:

urn:"ACoAAAylSRIBXNFRGjmGfTQsZZL04N8Sf_IyVao"

firstName:"Mark"

lastName:"Cuban"

fullName:"Mark Cuban"

publicIdentifier:"mark-cuban-06a0755b"

profilePictureURL:"https://media.licdn.com/dms/image/v2/D5603AQH9b4ZbzNR0zg/profile-displayphoto-shrink\_800\_800/profile-displayphoto-shrink\_800\_800/0/1681567357400?e=1761782400&v=beta&t=fjPeiDlIWV7WC31ChWmz6ka3CnoGeWilPWGjwzNxc5c"

creator:true

followerCount:8157021

\[10\]:

urn:"ACoAAAFcx5IBGAqhdlXRKBFwyocjwrxbGqlxnzQ"

firstName:"Rupa"

lastName:"Wong MD"

fullName:"Rupa Wong MD"

publicIdentifier:"drrupawong"

profilePictureURL:"https://media.licdn.com/dms/image/v2/C5603AQFPrKsI66JNoQ/profile-displayphoto-shrink\_400\_400/profile-displayphoto-shrink\_400\_400/0/1516330556407?e=1761782400&v=beta&t=l\_jtNXncvsSuFLlBAMjVki0pGbyF6CmzVSHYVkxP32I"

creator:true

followerCount:3822

\[11\]:

urn:"ACoAADZjPmoBC4cPUUfY-lZweACWaJoOZCdqFT8"

firstName:"Robert "

lastName:"Downey Jr. "

fullName:"Robert Downey Jr. "

publicIdentifier:"robert-downey-jr-ab6703215"

profilePictureURL:"https://media.licdn.com/dms/image/v2/C5603AQHCH4-ilSuHrg/profile-displayphoto-shrink\_800\_800/profile-displayphoto-shrink\_800\_800/0/1624304092686?e=1761782400&v=beta&t=I56jIvvzGlN4mHcKts-MLGXOJXHQFYys9J\_gqD\_WNZ4"

creator:true

followerCount:663431

\[12\]:

urn:"ACoAAAIjtdcB7YmIEeIAm311rmLvvt4MmQqZugI"

firstName:"Adam"

lastName:"Bryant"

fullName:"Adam Bryant"

publicIdentifier:"adambryantleadership"

profilePictureURL:"https://media.licdn.com/dms/image/v2/C4D03AQG0d-HBFq2e4w/profile-displayphoto-shrink\_800\_800/profile-displayphoto-shrink\_800\_800/0/1533137376682?e=1761782400&v=beta&t=58LJztEWyklVU8kVdS0FxPC-stJaQ0tZNfwVB034vew"

creator:true

followerCount:170937

\[13\]:

urn:"ACoAAAC42vQBjTGum5sSTbrccZR6VVeWNqN84po"

firstName:"Peter"

lastName:"Yang"

fullName:"Peter Yang"

publicIdentifier:"petergyang"

profilePictureURL:"https://media.licdn.com/dms/image/v2/D5603AQFZD9oJt0W0Og/profile-displayphoto-shrink\_800\_800/profile-displayphoto-shrink\_800\_800/0/1676926852209?e=1761782400&v=beta&t=vTbqbGi6qlKW6dJrudp7-i6vBdR0h0epYzphrFDhpv4"

creator:true

followerCount:136046

\[14\]:

urn:"ACoAAAdjM0MBpXMsSRpJ0BXdio1uTGOUCQnJm54"

firstName:"Betty"

lastName:"L."

fullName:"Betty L."

publicIdentifier:"bettywliu"

profilePictureURL:"https://media.licdn.com/dms/image/v2/D4E03AQF-JizgoJJ65w/profile-displayphoto-shrink\_800\_800/profile-displayphoto-shrink\_800\_800/0/1681108600113?e=1761782400&v=beta&t=s2PqARQ6k1sAhDR7AtV9rMwLraycUWgZwQ4Ag7tQyi0"

creator:true

followerCount:697857

\[15\]:

urn:"ACoAACiOcWcBVREZA-uK6mg3IlgCE5sS2ILhdZs"

firstName:"Dan"

lastName:"Harris"

fullName:"Dan Harris"

publicIdentifier:"dan-harris-91ba5716b"

profilePictureURL:"https://media.licdn.com/dms/image/v2/D4E03AQH3HLh4n3GUdQ/profile-displayphoto-shrink\_800\_800/profile-displayphoto-shrink\_800\_800/0/1725910840109?e=1761782400&v=beta&t=\_ER1CWy4h2eaWJyPSyMYBbrT9chL-k6Gv6b0RF1DEh4"

creator:true

followerCount:23002

\[16\]:

urn:"ACoAAA094vkB2YFNd39ZOjclF23js6t3VBvhObE"

firstName:"Dara"

lastName:"Khosrowshahi"

fullName:"Dara Khosrowshahi"

publicIdentifier:"dara-khosrowshahi-70949862"

profilePictureURL:"https://media.licdn.com/dms/image/v2/D5603AQHIncr1VmohYw/profile-displayphoto-shrink\_800\_800/profile-displayphoto-shrink\_800\_800/0/1673547835729?e=1761782400&v=beta&t=sXnUVLcOKU3hCFGXgucugbJvv-HNwGqq\_LVjdQYF5t8"

creator:false

followerCount:376121

\[17\]:

urn:"ACoAACwMwvsBkuHIY-4RWhVitAwI3XznSklKQtY"

firstName:"Phil"

lastName:"Rosen"

fullName:"Phil Rosen"

publicIdentifier:"philrosen"

profilePictureURL:"https://media.licdn.com/dms/image/v2/C5603AQHEbSMKv3SN8w/profile-displayphoto-shrink\_800\_800/profile-displayphoto-shrink\_800\_800/0/1645740959085?e=1761782400&v=beta&t=mPTCPr2TofW1nfBKNZHwXROyYkivD\_qYhG5ogsSkYMM"

creator:true

followerCount:39726

\[18\]:

urn:"ACoAAAF7DzQB1VoEHXKzSxII3nSgdi27Zrh5d5k"

firstName:"Jim"

lastName:"Rowan"

fullName:"Jim Rowan"

publicIdentifier:"jim-rowan1"

profilePictureURL:"https://media.licdn.com/dms/image/v2/C4E03AQFs9y030AAoYQ/profile-displayphoto-shrink\_800\_800/profile-displayphoto-shrink\_800\_800/0/1629211261582?e=1761782400&v=beta&t=rLNPxLmRDf8ML5bNfAxBhDImg67T1bi8hwh5ND2tUAM"

creator:true

followerCount:26123

\[19\]:

urn:"ACoAAC6Afp8BG1UgRMngvimZEGua_jE15LFwy9I"

firstName:"Chris"

lastName:"Kempczinski"

fullName:"Chris Kempczinski"

publicIdentifier:"chriskempczinski"

profilePictureURL:"https://media.licdn.com/dms/image/v2/C5603AQEtIhev65R0Sg/profile-displayphoto-shrink\_800\_800/profile-displayphoto-shrink\_800\_800/0/1614874746452?e=1761782400&v=beta&t=4-G9cuZaDsafdsDcmGBlgRlzpA38sbGBy\_SvEcWul6A"

creator:true

followerCount:153956

\[20\]:

urn:"ACoAAAAtR9cBFVXIhd9ehKSS9JDHMrxQeFCN-4Q"

firstName:"Ryan"

lastName:"Holmes"

fullName:"Ryan Holmes"

publicIdentifier:"rholmes"

profilePictureURL:"https://media.licdn.com/dms/image/v2/C5603AQGCG770nGh6tw/profile-displayphoto-shrink\_800\_800/profile-displayphoto-shrink\_800\_800/0/1642094195856?e=1761782400&v=beta&t=gyDJ4kXmkvXFvYBfP0qS2uvBztrUkEdToNiXQ7e4720"

creator:true

followerCount:1652618

\[21\]:

urn:"ACoAAAAAGLwBRaHyOBGIPJ5_GS8oh3q-4jYUqdw"

firstName:"Brad"

lastName:"Feld"

fullName:"Brad Feld"

publicIdentifier:"bfeld"

profilePictureURL:"https://media.licdn.com/dms/image/v2/C4D03AQFEmWzjfcpGKw/profile-displayphoto-shrink\_800\_800/profile-displayphoto-shrink\_800\_800/0/1663083302599?e=1761782400&v=beta&t=--Inyac\_iEebNGWFCsERo0gPR09H1Q9yB6Uwa1cNsYg"

creator:true

followerCount:335930

\[22\]:

urn:"ACoAAArRUqwBpi9paj3rHuNqahE1EjqEgFqAm3w"

firstName:"Sahil"

lastName:"Bloom"

fullName:"Sahil Bloom"

publicIdentifier:"sahilbloom"

profilePictureURL:"https://media.licdn.com/dms/image/v2/D4E03AQFdgn2OU81oKQ/profile-displayphoto-shrink\_800\_800/profile-displayphoto-shrink\_800\_800/0/1667155655120?e=1761782400&v=beta&t=payvi7\_SRz0olxRdUMV1vI1okLKHwWKv\_HiDhmtASNY"

creator:true

followerCount:665305

\[23\]:

urn:"ACoAAAAJXoIBX96-mb5Teejr20v1aE8GH0vUhIw"

firstName:"Alistair"

lastName:"Cox"

fullName:"Alistair Cox"

publicIdentifier:"alistair--cox"

profilePictureURL:"https://media.licdn.com/dms/image/v2/D4E03AQEEZjqSS63YTg/profile-displayphoto-shrink\_800\_800/profile-displayphoto-shrink\_800\_800/0/1671018205044?e=1761782400&v=beta&t=RHab-xGrJz\_qJNHfgBPKfdchGG3UgrMtj\_QC2h1\_Xwo"

creator:true

followerCount:215133

\[24\]:

urn:"ACoAADAm41YBuzIKPIublsOOXtV3kLlVkt1OEsQ"

firstName:"Guy"

lastName:"Raz"

fullName:"Guy Raz"

publicIdentifier:"guyrazpodcasts"

profilePictureURL:"https://media.licdn.com/dms/image/v2/C4D03AQHzHhR\_6KAR3w/profile-displayphoto-shrink\_800\_800/profile-displayphoto-shrink\_800\_800/0/1589230910353?e=1761782400&v=beta&t=V3owXKdAv1s-eOFvWslylG1Qxaaq7Lrv0wG-RZBgHTo"

creator:true

followerCount:46870

\[25\]:

urn:"ACoAAAI4Aw4BS3TllsKr6E15v4CDckxNKmfQpTY"

firstName:"Maynard"

lastName:"Webb"

fullName:"Maynard Webb"

publicIdentifier:"maynardwebb"

profilePictureURL:"https://media.licdn.com/dms/image/v2/C5603AQEuPOk2NvPQYw/profile-displayphoto-shrink\_400\_400/profile-displayphoto-shrink\_400\_400/0/1517725564624?e=1761782400&v=beta&t=FU9WxDkHcJFKoNz9BslEyCE4k16ThGDkK2QeSwJx7oY"

creator:true

followerCount:334344

\[26\]:

urn:"ACoAAFdRfQMBk2prGwlN0q8b4OfOUR8dYDQO7BA"

firstName:"Evan"

lastName:"Spiegel"

fullName:"Evan Spiegel"

publicIdentifier:"evan-spiegel-8ab74034a"

profilePictureURL:"https://media.licdn.com/dms/image/v2/D4E03AQHIaPlxqxIYAw/profile-displayphoto-shrink\_800\_800/B4EZTMbVdjG0Ag-/0/1738596505778?e=1761782400&v=beta&t=sn5\_j1zv8N6BR8Qj1I-qXXKXmwPiTU8UNIbWU2kRQpo"

creator:false

followerCount:21250

\[27\]:

urn:"ACoAAABmytwBr1HCeIKVlu54vaB1n5fmvyI5dUY"

firstName:"Dan"

lastName:"Schulman"

fullName:"Dan Schulman"

publicIdentifier:"dan-schulman"

profilePictureURL:"https://media.licdn.com/dms/image/v2/C4E03AQF4ufQG5nd\_4w/profile-displayphoto-shrink\_800\_800/profile-displayphoto-shrink\_800\_800/0/1562089601720?e=1761782400&v=beta&t=f-T2gxp8mto3g2VCLiRa\_Gsn47i20jH8FE-Zj3FtOvQ"

creator:true

followerCount:239495

\[28\]:

urn:"ACoAABJAeL0B_vfWDo6buzL2mUK1gfON3nmLoUc"

firstName:"Saanya"

lastName:"Ojha"

fullName:"Saanya Ojha"

publicIdentifier:"saanyaojha"

profilePictureURL:"https://media.licdn.com/dms/image/v2/D4D03AQEwtpI9VKsOLg/profile-displayphoto-shrink\_800\_800/B4DZbsapwJG0Ag-/0/1747723132964?e=1761782400&v=beta&t=zQ\_k4TCBhZ5kd4EnDLTMY9xijtcMzWEZkQWAsG87OXI"

creator:true

followerCount:63652

\[29\]:

urn:"ACoAAADPQl0BtrTpOVQXX6pNEGzt1-gdmR8RISU"

firstName:"Robert M."

lastName:"Bakish"

fullName:"Robert M. Bakish"

publicIdentifier:"bobbakish"

profilePictureURL:"https://media.licdn.com/dms/image/v2/C5603AQHLJqmHD58k5w/profile-displayphoto-shrink\_800\_800/profile-displayphoto-shrink\_800\_800/0/1657229929414?e=1761782400&v=beta&t=l3JNL6FATmAcHtLIvtf6Q3jnzcZalMwQIHrVyfrn3E8"

creator:true

followerCount:113144

\[30\]:

urn:"ACoAAADVRkkBiztC8DcGVpLexq3jxfVrAf8WSx8"

firstName:"Mike"

lastName:"Roman"

fullName:"Mike Roman"

publicIdentifier:"mike-roman-7758204"

profilePictureURL:"https://media.licdn.com/dms/image/v2/C4E03AQG3qEAL3B-Akg/profile-displayphoto-shrink\_800\_800/profile-displayphoto-shrink\_800\_800/0/1548179263078?e=1761782400&v=beta&t=CvXwoafMtDYNlT2xI6OYUoTaoLSLULaPUf27XFjG8eU"

creator:true

followerCount:58657

\[31\]:

urn:"ACoAAABjX2YBz96UyVIrPOydWJBDuuQa6gTu3O0"

firstName:"Sridhar"

lastName:"Ramaswamy"

fullName:"Sridhar Ramaswamy"

publicIdentifier:"sridhar-ramaswamy"

profilePictureURL:"https://media.licdn.com/dms/image/v2/C4E03AQH-f\_8ntBTMzQ/profile-displayphoto-shrink\_800\_800/profile-displayphoto-shrink\_800\_800/0/1547158038035?e=1761782400&v=beta&t=drLVE7pS4J9Xi6GOubRVwrbDKysNYio4D\_DJoKGCn40"

creator:true

followerCount:220717

\[32\]:

urn:"ACoAAAAg6_IBg1U6JFyF-a5pajsACu9FQhnuvmU"

firstName:"Eric"

lastName:"Ries"

fullName:"Eric Ries"

publicIdentifier:"eries"

profilePictureURL:"https://media.licdn.com/dms/image/v2/C4D03AQFc6Csl2Ck6aw/profile-displayphoto-shrink\_400\_400/profile-displayphoto-shrink\_400\_400/0/1516258553044?e=1761782400&v=beta&t=wFFWjgjWwlSxsCuESJl-33jjEZQ-6BwDVDmOOzdz9bg"

creator:true

followerCount:569911

\[33\]:

urn:"ACoAAAAc5NIBh7HOkftDWyqLXQ51kfoScHHDAA8"

firstName:"Michael"

lastName:"Skok"

fullName:"Michael Skok"

publicIdentifier:"mjskok"

profilePictureURL:"https://media.licdn.com/dms/image/v2/C5603AQES\_\_VrhzLHsA/profile-displayphoto-shrink\_800\_800/profile-displayphoto-shrink\_800\_800/0/1649171970578?e=1761782400&v=beta&t=DxhWG5VuXvizBU07DqtJa9mDEDWG\_wrgnPbmZOjt\_do"

creator:true

followerCount:146955

\[34\]:

urn:"ACoAAADhxLEBDEX-SllIpXPg1Cw0nTpWbhHYqpk"

firstName:"Greg"

lastName:"Snapper "

fullName:"Greg Snapper "

publicIdentifier:"gregsnapper"

profilePictureURL:"https://media.licdn.com/dms/image/v2/D5603AQEgNc8hqIyHtg/profile-displayphoto-crop\_800\_800/B56Zjl1QhLG4AM-/0/1756202601591?e=1761782400&v=beta&t=j\_8XwTIiJmXDjT4p5Zo3wvxKptJD5tlbLDQlfjHtGQg"

creator:false

followerCount:0

\[35\]:

urn:"ACoAAAAABScBAEvCh0F-BvN4jh3s8pdED\_\_Insk"

firstName:"Max"

lastName:"Levchin"

fullName:"Max Levchin"

publicIdentifier:"maxlevchin"

profilePictureURL:"https://media.licdn.com/dms/image/v2/C4E03AQFlmLGSxfTBlg/profile-displayphoto-shrink\_800\_800/profile-displayphoto-shrink\_800\_800/0/1516155448539?e=1761782400&v=beta&t=El5DD1hT-vGtgXwWChe-wgJ59xMrCNZNCTsEj\_BRPD0"

creator:true

followerCount:129065

\[36\]:

urn:"ACoAAAWyy8QBvBvjycoyoyGgyIuUJVeeLF8_OIU"

firstName:"Caroline"

lastName:"Hyde"

fullName:"Caroline Hyde"

publicIdentifier:"caroline-hyde-floyd"

profilePictureURL:"https://media.licdn.com/dms/image/v2/D4E03AQEeM13v1rDmTQ/profile-displayphoto-shrink\_800\_800/profile-displayphoto-shrink\_800\_800/0/1683294254633?e=1761782400&v=beta&t=PqsGouxpCfNjTegPZ133PQhJlF70oZmsckAkZgELDxE"

creator:true

followerCount:44330

\[37\]:

urn:"ACoAAAA8MrEBYlNTGX7rVy4Hg3Ab91xvpx8ez3s"

firstName:"Robert"

lastName:"Herjavec"

fullName:"Robert Herjavec"

publicIdentifier:"robertherjavec"

profilePictureURL:"https://media.licdn.com/dms/image/v2/D5603AQFiRlNTrlxlQg/profile-displayphoto-shrink\_800\_800/profile-displayphoto-shrink\_800\_800/0/1725409070713?e=1761782400&v=beta&t=O2PF6BnL-COINPMKmpqVPDNyrM72mOoJiShaq49bFAQ"

creator:true

followerCount:2315051

\[38\]:

urn:"ACoAAA07vXUBgJKZH5S8Z3sMFDhHtqHW5h0dNrk"

firstName:"Timm"

lastName:"Chiusano"

fullName:"Timm Chiusano"

publicIdentifier:"complexbusinessproblemsolver"

profilePictureURL:"https://media.licdn.com/dms/image/v2/D4E03AQHE4vKLGWWenw/profile-displayphoto-shrink\_800\_800/B4EZQ.eHRbHEAc-/0/1736214869898?e=1761782400&v=beta&t=dcynIU\_ni6mdqG25mBkXhqgbGG\_haGMb\_F5Us3ZJnvc"

creator:true

followerCount:62280

\[39\]:

urn:"ACoAAABhexABw5_iaCRSRhrVsMAqlWbBxiVEvGY"

firstName:"John"

lastName:"C Abell"

fullName:"John C Abell"

publicIdentifier:"johncabell"

profilePictureURL:"https://media.licdn.com/dms/image/v2/D4E03AQFzR5iNHqrDKw/profile-displayphoto-shrink\_800\_800/B4EZWVGyYUH0Ag-/0/1741963339808?e=1761782400&v=beta&t=IW1MZgkBPSZj3p1ovTNuFjiMG32BVIA1U\_Kzp6Sc4XI"

creator:false

followerCount:0

\[40\]:

urn:"ACoAAAOhLwoB4zRvZq5Z25MNDfz0RK6w5arh3HI"

firstName:"Lucy P."

lastName:"Marcus"

fullName:"Lucy P. Marcus"

publicIdentifier:"lucypmarcus"

profilePictureURL:"https://media.licdn.com/dms/image/v2/C4D03AQHh7LoPsm7yKQ/profile-displayphoto-shrink\_400\_400/profile-displayphoto-shrink\_400\_400/0/1516783849890?e=1761782400&v=beta&t=D9PCwY7LDMkcuehkoHaHTl77tiuK0qN4MscsJcZD63s"

creator:true

followerCount:1035025

\[41\]:

urn:"ACoAAAAAXkgB5vBNAfvVluTB_sKWPZycEC4rVN0"

firstName:"Jonathan"

lastName:"Becher"

fullName:"Jonathan Becher"

publicIdentifier:"jbecher"

profilePictureURL:"https://media.licdn.com/dms/image/v2/C4E03AQH684B3Fex7Aw/profile-displayphoto-shrink\_800\_800/profile-displayphoto-shrink\_800\_800/0/1516158333258?e=1761782400&v=beta&t=UgjIsnUCdp8mAFslAKG6\_PjxjPGzCnOpaxdxQNuy\_Pc"

creator:true

followerCount:791658

\[42\]:

urn:"ACoAAAuMh6ABe5yrIF2I6gDHnZ3Fpixhetg9Rfg"

firstName:"Alex"

lastName:"Lieberman"

fullName:"Alex Lieberman"

publicIdentifier:"alex-lieberman"

profilePictureURL:"https://media.licdn.com/dms/image/v2/D4E03AQGY8Brd\_5DQLw/profile-displayphoto-shrink\_800\_800/B4EZZog321HMAk-/0/1745510170445?e=1761782400&v=beta&t=3f32XtyJKN-wiomkN4xNN4kYVtGfNOY9qnXAc992938"

creator:true

followerCount:189508

\[43\]:

urn:"ACoAAAANvcMB7mNdnp54zMV-ASqkOZoV7A-lQRo"

firstName:"Jon"

lastName:"Steinberg"

fullName:"Jon Steinberg"

publicIdentifier:"jonsteinberg"

profilePictureURL:"https://media.licdn.com/dms/image/v2/D4E03AQFRHkeSC7Q6Cg/profile-displayphoto-crop\_800\_800/B4EZfrbHDkHYAM-/0/1752001442499?e=1761782400&v=beta&t=fwr6unn0qe3gv8IANC9Y6bYdJZCfkzk5sKXbZHDMg2I"

creator:true

followerCount:1774599

\[44\]:

urn:"ACoAADib0tEByzvgsS0kMMiPk4liOa1qZs3Q4pE"

firstName:"Ryan"

lastName:"Reynolds"

fullName:"Ryan Reynolds"

publicIdentifier:"vancityreynolds"

profilePictureURL:"https://media.licdn.com/dms/image/v2/C5603AQGOBfXsKX8U5Q/profile-displayphoto-shrink\_800\_800/profile-displayphoto-shrink\_800\_800/0/1636498355197?e=1761782400&v=beta&t=DF5VG5rJdC02JYCAoy3G6AXigX0r2be9K\_uyRMBqRIE"

creator:true

followerCount:3668638

\[45\]:

urn:"ACoAAB-kxvABo1R6qNdFmbEv2VzlACGCdghNEqw"

firstName:"Indra"

lastName:"Nooyi"

fullName:"Indra Nooyi"

publicIdentifier:"indranooyi"

profilePictureURL:"https://media.licdn.com/dms/image/v2/C4D03AQFx9CQdGZRXFQ/profile-displayphoto-shrink\_800\_800/profile-displayphoto-shrink\_800\_800/0/1629838559689?e=1761782400&v=beta&t=N0cPWZCriyn\_SExiUcoqCiu8URB\_F\_AP7VHJe21-Fj0"

creator:true

followerCount:1562060

\[46\]:

urn:"ACoAAAClcO0B4vYgVsu9ZRDG8RLV2uYlKfbrHXc"

firstName:"Tim"

lastName:"Brown"

fullName:"Tim Brown"

publicIdentifier:"timbrownatlindkedin"

profilePictureURL:"https://media.licdn.com/dms/image/v2/C4E03AQF0-HJh-sNAdw/profile-displayphoto-shrink\_800\_800/profile-displayphoto-shrink\_800\_800/0/1516319396449?e=1761782400&v=beta&t=Q1nzAf6MgLlxCW3gztWIF88XqD1RRFUZLnLh\_yZgp7I"

creator:true

followerCount:1405071

\[47\]:

urn:"ACoAAC90ps8BKftkD9J1cW1EOL-OBKmH4uWQmbs"

firstName:"Selena"

lastName:"Gomez"

fullName:"Selena Gomez"

publicIdentifier:"selena-gomez-a3b7781a2"

profilePictureURL:"https://media.licdn.com/dms/image/v2/C5603AQGWDpuApxoqJQ/profile-displayphoto-shrink\_400\_400/profile-displayphoto-shrink\_400\_400/0/1599069252088?e=1761782400&v=beta&t=jwcDpN4GLtXMcx4-TbfsYr5kVQEO07fqGkWud7AV4QA"

creator:false

followerCount:106252

\[48\]:

urn:"ACoAAAAT1NsBDiqHun0dRClmV4VO3_wj2LlIq1g"

firstName:"Todd"

lastName:"Sears"

fullName:"Todd Sears"

publicIdentifier:"toddgsears"

profilePictureURL:"https://media.licdn.com/dms/image/v2/D4E03AQG-mRfgn4VkCw/profile-displayphoto-shrink\_800\_800/profile-displayphoto-shrink\_800\_800/0/1692645533327?e=1761782400&v=beta&t=donPVeqYz6a7t6knzKIaMfN7TFkoYzeHTiI4\_Svb4fg"

creator:true

followerCount:17555

\[49\]:

urn:"ACoAAAKkn_gBdU1rnZ3g8Ud9mkkpvy0AEbU-Q6M"

firstName:"Mark"

lastName:"Haner"

fullName:"Mark Haner"

publicIdentifier:"markhaner"

profilePictureURL:"https://media.licdn.com/dms/image/v2/D5603AQGwDJdCTfOdtQ/profile-displayphoto-shrink\_800\_800/profile-displayphoto-shrink\_800\_800/0/1665577868123?e=1761782400&v=beta&t=w5KDykAw4BNzcGluA9v0-E88S7j-5pyR\_mWXR-H7NgE"

creator:false

followerCount:0

\[50\]:

urn:"ACoAAAUW3t4B4VQMkt5iEeajBbmZRu3MiWHoCuM"

firstName:"Judith"

lastName:"Sherven, PhD"

fullName:"Judith Sherven, PhD"

publicIdentifier:"judithsherven"

profilePictureURL:"https://media.licdn.com/dms/image/v2/D5603AQGUOGC5avlF8A/profile-displayphoto-shrink\_400\_400/profile-displayphoto-shrink\_400\_400/0/1727740014077?e=1761782400&v=beta&t=GgKwDKctmt8e1mjzpHt6Yz8pcp5Y7ivpZ9KexV1NmSI"

creator:true

followerCount:587297

\[51\]:

urn:"ACoAAABakEsBFpt_KkhAsm9Uz5Zs39eCgG_4r2c"

firstName:"Diego"

lastName:"Rodriguez"

fullName:"Diego Rodriguez"

publicIdentifier:"diegorodriguez"

profilePictureURL:"https://media.licdn.com/dms/image/v2/C5603AQEsyq\_OfGmFeg/profile-displayphoto-shrink\_800\_800/profile-displayphoto-shrink\_800\_800/0/1602985774801?e=1761782400&v=beta&t=xLU9Oaby0PnsHwP8xfq65OeY3PSufkq9W7QphxG0nYE"

creator:true

followerCount:391010

\[52\]:

urn:"ACoAAAwp1RMBxG26M3Qkhm4klqLNr1bIplo6GhY"

firstName:"Richard"

lastName:"Branson"

fullName:"Richard Branson"

publicIdentifier:"rbranson"

profilePictureURL:"https://media.licdn.com/dms/image/v2/C4D03AQHh6\_Wth5f3rQ/profile-displayphoto-shrink\_800\_800/profile-displayphoto-shrink\_800\_800/0/1625181963183?e=1761782400&v=beta&t=D4lwUaMFXh8-qJ0qKQwi3yf1PAufkNN\_3wf3ZYQWRHE"

creator:true

followerCount:18682196

\[53\]:

urn:"ACoAAAC0xTcBBXymJYxHQOzRvu0GjgkLzf5UIs0"

firstName:"Joel"

lastName:"Peterson"

fullName:"Joel Peterson"

publicIdentifier:"joelpetersongsb"

profilePictureURL:"https://media.licdn.com/dms/image/v2/C4E03AQE6aQoFqbDB5Q/profile-displayphoto-shrink\_800\_800/profile-displayphoto-shrink\_800\_800/0/1565969134822?e=1761782400&v=beta&t=ziJ1FaBI7rnd88GH0z\_7v71gWx1aRaFw5TIeuycVNqk"

creator:true

followerCount:399893

\[54\]:

urn:"ACoAAAta6dYBBXJOOLLXB_o_ZRXHWf1y8EmZAr4"

firstName:"Abhishek"

lastName:"Patil"

fullName:"Abhishek Patil"

publicIdentifier:"abhishpatil"

profilePictureURL:"https://media.licdn.com/dms/image/v2/D5603AQHSGO1r2f-35g/profile-displayphoto-shrink\_800\_800/profile-displayphoto-shrink\_800\_800/0/1730944496121?e=1761782400&v=beta&t=T4z9WGVfXaNNyi-GweuVw67oICMfArcNh0svMHCqnAY"

creator:true

followerCount:115605

\[55\]:

urn:"ACoAAAMfg-wBY-zTAHZ4XtSmeQsvl3PR6mLjHDM"

firstName:"Claire"

lastName:"Diaz-Ortiz"

fullName:"Claire Diaz-Ortiz"

publicIdentifier:"clairediazortiz"

profilePictureURL:"https://media.licdn.com/dms/image/v2/D4D03AQGZ4ehKsBoZoQ/profile-displayphoto-shrink\_800\_800/profile-displayphoto-shrink\_800\_800/0/1700513879058?e=1761782400&v=beta&t=2MjxsoSGh4o11WJgzKZYunkhTv8m0A\_Us7y5srLZEG8"

creator:true

followerCount:490929

\[56\]:

urn:"ACoAAAABTNYBc0IbBTeUIQ2TOoKEQYUPpJfsc80"

firstName:"Dennis R."

lastName:"Mortensen"

fullName:"Dennis R. Mortensen"

publicIdentifier:"dennismortensen"

profilePictureURL:"https://media.licdn.com/dms/image/v2/C4E03AQGRIXJuvAbvQg/profile-displayphoto-shrink\_800\_800/profile-displayphoto-shrink\_800\_800/0/1516166238928?e=1761782400&v=beta&t=ZMkFThaoMDumVBFIMNNJwRn-302fEdblJzYfg6SlNQI"

creator:true

followerCount:488514

\[57\]:

urn:"ACoAABTrYN0B3aZjZg2jYZ93-1jRLsJSlUNyojA"

firstName:"Jonathan"

lastName:"Javier💡"

fullName:"Jonathan Javier💡"

publicIdentifier:"jonathan-wonsulting"

profilePictureURL:"https://media.licdn.com/dms/image/v2/D4E03AQFklBbp6e-3Qg/profile-displayphoto-shrink\_800\_800/profile-displayphoto-shrink\_800\_800/0/1705651672265?e=1761782400&v=beta&t=LtLf3cEA9gA0jyhv9ttICvHHwygCsMcmgKfu0bkOKyo"

creator:true

followerCount:425020

\[58\]:

urn:"ACoAACBFCnYBR35BQeyD6-SevWDH0riip0DhAKc"

firstName:"Doug"

lastName:"McMillon"

fullName:"Doug McMillon"

publicIdentifier:"dougmcmillon"

profilePictureURL:"https://media.licdn.com/dms/image/v2/C5603AQGhIOURv9P-lw/profile-displayphoto-shrink\_800\_800/profile-displayphoto-shrink\_800\_800/0/1659462364092?e=1761782400&v=beta&t=LZfj9Ji5kphBh044cH9-LJsl20Kdzi8xFXcuqr1oJhU"

creator:true

followerCount:1152050

\[59\]:

urn:"ACoAAA2XI4wB3y-4q7mXFoTmmkOXmiPhv_sRlI8"

firstName:"Anita"

lastName:"Elberse"

fullName:"Anita Elberse"

publicIdentifier:"anitaelberse"

profilePictureURL:"https://media.licdn.com/dms/image/v2/C5603AQGoIsaBXDeLwg/profile-displayphoto-shrink\_800\_800/profile-displayphoto-shrink\_800\_800/0/1517592612113?e=1761782400&v=beta&t=EcVTfltuvIBn75KKOMLVxN12yOy6zANdSpUpluh-k6I"

creator:true

followerCount:385568

\[60\]:

urn:"ACoAAAgDeQsBOjf1PW9WshszVGXT5gMsD6kYufU"

firstName:"Ross"

lastName:"Pomerantz"

fullName:"Ross Pomerantz"

publicIdentifier:"corporatebro"

profilePictureURL:"https://media.licdn.com/dms/image/v2/D4D03AQH\_dcLGzP-wzQ/profile-displayphoto-shrink\_400\_400/B4DZQ9lFJwGgAk-/0/1736199918599?e=1761782400&v=beta&t=Isecq93lYYRvqAEmHIIOG0BAr9NvZZCjbtz0DdodqNY"

creator:true

followerCount:162109

\[61\]:

urn:"ACoAAFgv46sBp8pysioX1lHcelIuu8ELCA_pzIU"

firstName:"Rafael"

lastName:"Nadal "

fullName:"Rafael Nadal "

publicIdentifier:"rafanadal"

profilePictureURL:"https://media.licdn.com/dms/image/v2/D4E03AQF0KzdcrT8WkQ/profile-displayphoto-shrink\_800\_800/B4EZVMR5wsHMAc-/0/1740741516860?e=1761782400&v=beta&t=\_VepKQgX\_W5oxPcYlJ1243GzdiI6OlvS6BMQfK8z53c"

creator:false

followerCount:107398

\[62\]:

urn:"ACoAAAACfu4BK4gtAYUTnUSLcCLlk26dJ5dwids"

firstName:"Michael"

lastName:"Feldstein 🫶 🇨🇦 🇲🇽"

fullName:"Michael Feldstein 🫶 🇨🇦 🇲🇽"

publicIdentifier:"mfeldstein"

profilePictureURL:"https://media.licdn.com/dms/image/v2/D5603AQGJhe2Byq42aQ/profile-displayphoto-shrink\_800\_800/profile-displayphoto-shrink\_800\_800/0/1689002529512?e=1761782400&v=beta&t=yKGVz3YQSThsFrhCnw8AkDXk0kItiJbVdLqUjtGzY8U"

creator:true

followerCount:7514

\[63\]:

urn:"ACoAAAAEIZIBtsS7\_-P3J9vu22wdp8euEKBhntg"

firstName:"Julia"

lastName:"Boorstin"

fullName:"Julia Boorstin"

publicIdentifier:"juliaboorstin"

profilePictureURL:"https://media.licdn.com/dms/image/v2/C5603AQF2Nf9e54BlxA/profile-displayphoto-shrink\_800\_800/profile-displayphoto-shrink\_800\_800/0/1663258952475?e=1761782400&v=beta&t=rQIVizCikfBUU8E\_f3Ks0Robc2zbJ2OjJMTLqRDMRCo"

creator:true

followerCount:152290

\[64\]:

urn:"ACoAAAc-\_yEBDbEZ0yk-N5U15AyZ8dwveDX9VKo"

firstName:"Steven"

lastName:"Bartlett"

fullName:"Steven Bartlett"

publicIdentifier:"stevenbartlett-123"

profilePictureURL:"https://media.licdn.com/dms/image/v2/D4E03AQFKGYisXugzSw/profile-displayphoto-shrink\_800\_800/B4EZcNBfDQHYAc-/0/1748270183031?e=1761782400&v=beta&t=EkES8PWQE5UHDXos3E3gIWwVjA4fQvFTlyEsWPo6Gas"

creator:true

followerCount:2953456

\[65\]:

urn:"ACoAAAH_9jAB04YubzgUMvK_G_caysII71fXgeY"

firstName:"Neil"

lastName:"Weinberg"

fullName:"Neil Weinberg"

publicIdentifier:"neilweinberg"

profilePictureURL:"https://media.licdn.com/dms/image/v2/C4E03AQH2v\_W93qsd\_A/profile-displayphoto-shrink\_400\_400/profile-displayphoto-shrink\_400\_400/0/1516357542440?e=1761782400&v=beta&t=oa5UKSAhqZ4Qwouj2psXDzAE4rKLr-Mhd3HX0\_cZaEE"

creator:true

followerCount:131310

\[66\]:

urn:"ACoAAASA67IBp134-6fngeSbT7_SyurQKnyqtWo"

firstName:"Sol"

lastName:"Trujillo"

fullName:"Sol Trujillo"

publicIdentifier:"soltrujillo"

profilePictureURL:"https://media.licdn.com/dms/image/v2/C5603AQG0jnw0ce1JVg/profile-displayphoto-shrink\_800\_800/profile-displayphoto-shrink\_800\_800/0/1610054888716?e=1761782400&v=beta&t=EDNsVmDB0XKxLoIRWhnGIZaorFQRassGkYl4pqXfJ6w"

creator:true

followerCount:8826

\[67\]:

urn:"ACoAABE9HH8BsvYrxj-dZxQzyqcPqmq7eVN4IP4"

firstName:"Ray"

lastName:"Dalio"

fullName:"Ray Dalio"

publicIdentifier:"raydalio"

profilePictureURL:"https://media.licdn.com/dms/image/v2/C5603AQEaAcHgvsm0UA/profile-displayphoto-shrink\_400\_400/profile-displayphoto-shrink\_400\_400/0/1623860377413?e=1761782400&v=beta&t=zgq9Nmwba1kM3iDCk\_VJ-nzk5ot\_1fb-\_gXTXgNrmq0"

creator:true

followerCount:2774132

\[68\]:

urn:"ACoAAAA76B4BOIO_14Lbhye3Sx-PwZiV_Y-7P58"

firstName:"Roy"

lastName:"Jakobs"

fullName:"Roy Jakobs"

publicIdentifier:"royjakobs"

profilePictureURL:"https://media.licdn.com/dms/image/v2/D4E03AQE5a1TyFrz67A/profile-displayphoto-shrink\_800\_800/profile-displayphoto-shrink\_800\_800/0/1665781692792?e=1761782400&v=beta&t=I7qVO\_Qmw5CaOy5SyyweUf9rZvSZeNkR\_CXSMHJE5RU"

creator:true

followerCount:67952

\[69\]:

urn:"ACoAAAEkwwAB9KEc2TrQgOLEQ-vzRyZeCDyc6DQ"

firstName:"Satya"

lastName:"Nadella"

fullName:"Satya Nadella"

publicIdentifier:"satyanadella"

profilePictureURL:"https://media.licdn.com/dms/image/v2/C5603AQHHUuOSlRVA1w/profile-displayphoto-shrink\_800\_800/profile-displayphoto-shrink\_800\_800/0/1579726625483?e=1761782400&v=beta&t=EuNsJWVHJDWr\_vNwWSNNC47t4YayWWsimiiLxfXUXmo"

creator:true

followerCount:11600388

\[70\]:

urn:"ACoAAACgAVMBb8w4dbaqCMriT5tTYE0H4M_oFKE"

firstName:"Gary"

lastName:"Vaynerchuk"

fullName:"Gary Vaynerchuk"

publicIdentifier:"garyvaynerchuk"

profilePictureURL:"https://media.licdn.com/dms/image/v2/D4E03AQFAvHbFTXirbw/profile-displayphoto-shrink\_800\_800/profile-displayphoto-shrink\_800\_800/0/1718257337092?e=1761782400&v=beta&t=Tj6w6MJdM8aCczVkv8fiAzGxi9MhWYq066dcfibCNjE"

creator:false

followerCount:0

\[71\]:

urn:"ACoAADnl1jgBdlHVvRibBu9Fm0M77z4oYsyVQ0k"

firstName:"Jimmy"

lastName:"Donaldson"

fullName:"Jimmy Donaldson"

publicIdentifier:"mr-beast"

profilePictureURL:"https://media.licdn.com/dms/image/v2/D5603AQGQ-C6lKKb3pQ/profile-displayphoto-crop\_800\_800/B56Zl0Y1.RHUAI-/0/1758594294085?e=1761782400&v=beta&t=mFxnrFynTrmO1x9TwWzaXddw1\_vsakK3lR04vc966xc"

creator:true

followerCount:366715

\[72\]:

urn:"ACoAAACfefIBFX76kKvF_0uYzIQxuxbD1CQm8_k"

firstName:"Brian"

lastName:"Wong"

fullName:"Brian Wong"

publicIdentifier:"wongbrian"

profilePictureURL:"https://media.licdn.com/dms/image/v2/D5603AQEr\_PP6n1zMEQ/profile-displayphoto-shrink\_800\_800/B56ZOQIU6cGoAc-/0/1733289922718?e=1761782400&v=beta&t=T3lFh-kQvT7eA\_ZkwZWo68Gp9HMl8XvitoWiELzuW8k"

creator:true

followerCount:670753

\[73\]:

urn:"ACoAAAAoIS4BO_kCIr4574BuUqiHs-kNa_HbPuE"

firstName:"Andrew Ross"

lastName:"Sorkin"

fullName:"Andrew Ross Sorkin"

publicIdentifier:"andrew-ross-sorkin-b52a69"

profilePictureURL:"https://media.licdn.com/dms/image/v2/C4D03AQGOH27ejzRKCQ/profile-displayphoto-shrink\_800\_800/profile-displayphoto-shrink\_800\_800/0/1516268671442?e=1761782400&v=beta&t=htJbllZZWrscoKcbQzDbrrOTVpSbDIl7PzuhJsnhMMc"

creator:true

followerCount:99527

\[74\]:

urn:"ACoAAACTSiYB8oyC83rsjGL1gyQNh0kElssFxsM"

firstName:"Sriram"

lastName:"Krishnan"

fullName:"Sriram Krishnan"

publicIdentifier:"sriramkrishnan01"

profilePictureURL:"https://media.licdn.com/dms/image/v2/C5603AQGOb0XegvzrOA/profile-displayphoto-shrink\_800\_800/profile-displayphoto-shrink\_800\_800/0/1552606158502?e=1761782400&v=beta&t=6Mdlh62hUfeim30l-MP6pOnwnkQa4IKNaKO1Y2FOoEg"

creator:true

followerCount:52860

\[75\]:

urn:"ACoAAAl7WvwBRoQZ2FAAvQR8_VO_v6T1jNJvW6k"

firstName:"Neil"

lastName:"Barofsky"

fullName:"Neil Barofsky"

publicIdentifier:"neilbarofsky"

profilePictureURL:"https://media.licdn.com/dms/image/v2/C5603AQEPifezDpeJsQ/profile-displayphoto-shrink\_400\_400/profile-displayphoto-shrink\_400\_400/0/1517397674852?e=1761782400&v=beta&t=gKQQrzsIetG5EUdLeVgevkdRlg\_AUGYP8gMtCcTmfaM"

creator:true

followerCount:189043

\[76\]:

urn:"ACoAAAABFs8BMkIjilIjPzHIIUpVJ3bwzM7_wvY"

firstName:"Baratunde"

lastName:"Thurston"

fullName:"Baratunde Thurston"

publicIdentifier:"baratunde"

profilePictureURL:"https://media.licdn.com/dms/image/v2/D5603AQHnjAg1Dw2Lrg/profile-displayphoto-shrink\_800\_800/profile-displayphoto-shrink\_800\_800/0/1726798216589?e=1761782400&v=beta&t=cxklU2IwjLFQEXZd54XMpHuWw8CUtrtQUrTo4lAw0eg"

creator:true

followerCount:21164

\[77\]:

urn:"ACoAAAAAQKkB5uxB9qsbzuCdWvDdtTKQ6qwujxE"

firstName:"Tim"

lastName:"O'Reilly"

fullName:"Tim O'Reilly"

publicIdentifier:"timo3"

profilePictureURL:"https://media.licdn.com/dms/image/v2/C4E03AQGKQgAwBVe94Q/profile-displayphoto-shrink\_400\_400/profile-displayphoto-shrink\_400\_400/0/1516157437359?e=1761782400&v=beta&t=m1x9WzLz7o1HVf4-NjdkHeNNblsapYd8zm4J3SgCXvI"

creator:true

followerCount:684140

\[78\]:

urn:"ACoAADyKu74BZkzFQX8PVJLy7KvwBj5afQu5ZVg"

firstName:"Alex"

lastName:"Pall"

fullName:"Alex Pall"

publicIdentifier:"alex-pall-9921b7244"

profilePictureURL:"https://media.licdn.com/dms/image/v2/D5603AQFX6g7aKCDX7A/profile-displayphoto-shrink\_800\_800/profile-displayphoto-shrink\_800\_800/0/1680699623370?e=1761782400&v=beta&t=esuPYKvixULeLum2utbQsr0Le5IaiqiXU3OqpU1Klkc"

creator:true

followerCount:57607

\[79\]:

urn:"ACoAABuMHQEBRgK6mHooSpeM-qXlvbEV4hs5f0c"

firstName:"Andrew"

lastName:"Huberman"

fullName:"Andrew Huberman"

publicIdentifier:"andrew-huberman"

profilePictureURL:"https://media.licdn.com/dms/image/v2/C5603AQH5MzxKYhfquw/profile-displayphoto-shrink\_800\_800/profile-displayphoto-shrink\_800\_800/0/1611446851771?e=1761782400&v=beta&t=gWC5a8Xze0BxBMKRcnz6kzz6hjYBYjRkr8smWbFwOZI"

creator:true

followerCount:1896167

\[80\]:

urn:"ACoAAAAjEJkBSFKMqKxMy9EOjw0DdxohG4Sor7w"

firstName:"Spencer"

lastName:"Rascoff"

fullName:"Spencer Rascoff"

publicIdentifier:"spencerrascoff"

profilePictureURL:"https://media.licdn.com/dms/image/v2/C5603AQHCziUau0w0bw/profile-displayphoto-shrink\_800\_800/profile-displayphoto-shrink\_800\_800/0/1601528387954?e=1761782400&v=beta&t=Vi3BbRvVMIEfNFXIam9UxYGFYbGGRwP-gCXy-Pms4HU"

creator:true

followerCount:516570

\[81\]:

urn:"ACoAAA3DtkUBSlvuywdy_HJto8MM8ZtU-1e3F4Y"

firstName:"Jeff"

lastName:"Immelt"

fullName:"Jeff Immelt"

publicIdentifier:"jeffimmelt"

profilePictureURL:"https://media.licdn.com/dms/image/v2/C5603AQHrqRduphMBtg/profile-displayphoto-shrink\_800\_800/profile-displayphoto-shrink\_800\_800/0/1610395407026?e=1761782400&v=beta&t=Fc6OWtR3nWAAXdgP2F4emAOiZBLYQudZ0kqtLiF9nbc"

creator:true

followerCount:564414

\[82\]:

urn:"ACoAAAf8QMsBp6l-pSq5cJdbkFOIHzNlq4YU8G0"

firstName:"Eric"

lastName:"Sim"

fullName:"Eric Sim"

publicIdentifier:"simeric"

profilePictureURL:"https://media.licdn.com/dms/image/v2/D5603AQG6bcSoLgFWbQ/profile-displayphoto-crop\_800\_800/B56ZlGtMLkI0AI-/0/1757827875995?e=1761782400&v=beta&t=bXhPeirUGo5ijtWQ0bJf9Pe1umNbZtnJYdch1CDnM94"

creator:true

followerCount:2789071

\[83\]:

urn:"ACoAAB-0K_oBLxYi2OMyAL_mFlfDX8MdZ70Sboo"

firstName:"Ana"

lastName:"Botín "

fullName:"Ana Botín "

publicIdentifier:"anabotin"

profilePictureURL:"https://media.licdn.com/dms/image/v2/C4D03AQFgUbelMja1vw/profile-displayphoto-shrink\_800\_800/profile-displayphoto-shrink\_800\_800/0/1518110950073?e=1761782400&v=beta&t=rGOkB3ySTpIyPYz\_QLOWZMsYNWMInNqZLSXmqpuSHKQ"

creator:true

followerCount:511040

\[84\]:

urn:"ACoAAAR5O7AB5DueUpwePmSA0jmP92PFv1W1gSI"

firstName:"Deepak"

lastName:"Chopra MD (official)"

fullName:"Deepak Chopra MD (official)"

publicIdentifier:"deepakchopra"

profilePictureURL:"https://media.licdn.com/dms/image/v2/D5603AQEKKyca2tVC0A/profile-displayphoto-crop\_800\_800/B56ZgtDGK4HkAI-/0/1753102444836?e=1761782400&v=beta&t=2JH7EbG9FbzIz-EfqYZIC\_3U0UFEHnfKRuKUf6qPlZU"

creator:true

followerCount:5590934

\[85\]:

urn:"ACoAAAAAHIIB-o5z84EThqNtosibTGbRrGjUURg"

firstName:"Hunter"

lastName:"Walk"

fullName:"Hunter Walk"

publicIdentifier:"hunterwalk"

profilePictureURL:"https://media.licdn.com/dms/image/v2/D5603AQGA2inUETdvnA/profile-displayphoto-shrink\_800\_800/profile-displayphoto-shrink\_800\_800/0/1673672352797?e=1761782400&v=beta&t=g1kJ7QmeKYgkrEx9iAnc0ppTp7k\_HnbZNXe4uFHlcT4"

creator:true

followerCount:876644

\[86\]:

urn:"ACoAAADYYhQBtIJToV2PD6bQC0OpsgGFMYEt_dg"

firstName:"Ben"

lastName:"Gilbert"

fullName:"Ben Gilbert"

publicIdentifier:"benjamingilbert"

profilePictureURL:"https://media.licdn.com/dms/image/v2/D5603AQFtODVTQQKSAQ/profile-displayphoto-shrink\_800\_800/profile-displayphoto-shrink\_800\_800/0/1701719488034?e=1761782400&v=beta&t=IPhpZ2MyPpSOoySzKkTYTaashPr3V9agJ1f4f6aFAe8"

creator:true

followerCount:52164

\[87\]:

urn:"ACoAAAAbtCIBbLFn0xrth7PAPRK58ZaSwXuDTtE"

firstName:"Aaron"

lastName:"Allen"

fullName:"Aaron Allen"

publicIdentifier:"aarondallen"

profilePictureURL:"https://media.licdn.com/dms/image/v2/C4E03AQFZ\_AdAGknXGQ/profile-displayphoto-shrink\_800\_800/profile-displayphoto-shrink\_800\_800/0/1563136900872?e=1761782400&v=beta&t=CEj4HgT\_Di2PvkW3NR0okMbz247f0uBOnZIWfsShi5s"

creator:true

followerCount:275974

\[88\]:

urn:"ACoAAABNBvcBIjzTC3EUltOum_FFUINfc84eBjw"

firstName:"Jose"

lastName:"Ferreira"

fullName:"Jose Ferreira"

publicIdentifier:"joseferreira"

profilePictureURL:"https://media.licdn.com/dms/image/v2/D4E03AQGxsOwlBjAXtg/profile-displayphoto-shrink\_400\_400/profile-displayphoto-shrink\_400\_400/0/1693927063987?e=1761782400&v=beta&t=YGiOE3HMfCvLGru0e3cA5o8sNxgVXngVfRBrhlET5MM"

creator:true

followerCount:135625

\[89\]:

urn:"ACoAABhysQkB6TS2qe8LWN2wJJgScTie1vI8roo"

firstName:"Capt. Sully"

lastName:"Sullenberger"

fullName:"Capt. Sully Sullenberger"

publicIdentifier:"sullysullenberger"

profilePictureURL:"https://media.licdn.com/dms/image/v2/D5603AQEb1vpZkGxQ4Q/profile-displayphoto-shrink\_800\_800/profile-displayphoto-shrink\_800\_800/0/1667419698226?e=1761782400&v=beta&t=GePHK37NMg9NdQJaG4Ii1RNMLdAXnt2RLbLSsIY4NDA"

creator:true

followerCount:358932

\[90\]:

urn:"ACoAABedvXYBxRJyjdl39zwmOHoIzn2phkyS7P0"

firstName:"Mohammad"

lastName:"Al Gergawi"

fullName:"Mohammad Al Gergawi"

publicIdentifier:"mohammedalgergawi"

profilePictureURL:"https://media.licdn.com/dms/image/v2/C5603AQG1K7xd1iWWeQ/profile-displayphoto-shrink\_400\_400/profile-displayphoto-shrink\_400\_400/0/1517537900785?e=1761782400&v=beta&t=D\_gRhQqsoF2GC\_A4X9oSH\_VNYMholTiD7td6hjnpkhM"

creator:false

followerCount:222831

\[91\]:

urn:"ACoAAAMg8V8BKDaO-Ymv6oZEdF3rbISEntgB9C4"

firstName:"Shaili"

lastName:"Chopra"

fullName:"Shaili Chopra"

publicIdentifier:"shailichopra"

profilePictureURL:"https://media.licdn.com/dms/image/v2/D5603AQFVMdvpC8KigA/profile-displayphoto-shrink\_800\_800/B56ZbnNBCHGsAc-/0/1747635672195?e=1761782400&v=beta&t=Y6wbDqmQqGII3Bp7MYANmZc5NMF3NGJX\_CuElvX81pI"

creator:true

followerCount:16840

\[92\]:

urn:"ACoAAAITKL4B5dyhNTXLdGTE-0Vq4LnTZjHanpU"

firstName:"Clem"

lastName:"Delangue 🤗"

fullName:"Clem Delangue 🤗"

publicIdentifier:"clementdelangue"

profilePictureURL:"https://media.licdn.com/dms/image/v2/C4D03AQHB49jGc59tLw/profile-displayphoto-shrink\_800\_800/profile-displayphoto-shrink\_800\_800/0/1639655041698?e=1761782400&v=beta&t=mTOHpMfoDFY3R5bITixRz5H5krxYWb9eNZnLd\_Bd-IY"

creator:true

followerCount:278154

\[93\]:

urn:"ACoAAADjyKsBQuuGgJnPW8fEsLjlTpegxiVcfwk"

firstName:"Chip"

lastName:"Bergh"

fullName:"Chip Bergh"

publicIdentifier:"chipbergh"

profilePictureURL:"https://media.licdn.com/dms/image/v2/C4E03AQEB-t6hSS0GYg/profile-displayphoto-shrink\_400\_400/profile-displayphoto-shrink\_400\_400/0/1517722713154?e=1761782400&v=beta&t=bEgWMA302Rems4RGViSGzdQ8e4rlsRLXNcBDy1bNkkc"

creator:true

followerCount:254160

\[94\]:

urn:"ACoAAAUddYgBuR9PGxjdmdCcUPl3n-hFVothh9Q"

firstName:"Jim"

lastName:"Sniechowski, PhD"

fullName:"Jim Sniechowski, PhD"

publicIdentifier:"jimsniechowski"

profilePictureURL:"https://media.licdn.com/dms/image/v2/C4D03AQHLQtcNQjsiZw/profile-displayphoto-shrink\_800\_800/profile-displayphoto-shrink\_800\_800/0/1517234746656?e=1761782400&v=beta&t=rzJUlYbPwEk1ZcSaocBdTOBd7P9g9wH7vKLf8bqHi0I"

creator:true

followerCount:164840

\[95\]:

urn:"ACoAADnkvAoB69W0y_4ToD3SzIANnL3LlXg6hTE"

firstName:"Natalie"

lastName:"(Corporate Natalie)"

fullName:"Natalie (Corporate Natalie)"

publicIdentifier:"natalie-corporate-natalie-0b634a231"

profilePictureURL:"https://media.licdn.com/dms/image/v2/D5603AQGQwiiWPYE3AQ/profile-displayphoto-shrink\_800\_800/B56ZRbyAjuHoAc-/0/1736706624262?e=1761782400&v=beta&t=1Xa-quVV2tlJL6OGcRTqWLTGYgRmHx-NnM42x7\_8yeM"

creator:true

followerCount:216266

\[96\]:

urn:"ACoAAEJAUQEBouU2110ZLhX9BGLPGGP61Wuqsv8"

firstName:"Snoop "

lastName:"Dogg"

fullName:"Snoop Dogg"

publicIdentifier:"snoopdogg"

profilePictureURL:"https://media.licdn.com/dms/image/v2/D5603AQHN1f-W4ZsjWQ/profile-displayphoto-shrink\_800\_800/B56ZRfsMmSH0Ag-/0/1736772209353?e=1761782400&v=beta&t=RlHuYeYTWmBOYlEFM3Ig4cB\_wpMiQ1IXBq8hUKILAAY"

creator:true

followerCount:638727

\[97\]:

urn:"ACoAAAg3tdkBEgzQ-aktuDTNoMtil6oa1qKzNjc"

firstName:"Daniel"

lastName:"Ek"

fullName:"Daniel Ek"

publicIdentifier:"daniel-ek-1b52093a"

profilePictureURL:"https://media.licdn.com/dms/image/v2/C4D03AQEFQRJmIjn3Dg/profile-displayphoto-shrink\_800\_800/profile-displayphoto-shrink\_800\_800/0/1518714142536?e=1761782400&v=beta&t=gJf-nW2eDwLtYDdQ2yG4qkHRAPw2fqq\_o5\_jj8O0rQs"

creator:true

followerCount:205002

\[98\]:

urn:"ACoAAAESNnYBRYZdCGapx1lDFr6rYJQVICbjAKc"

firstName:"John A."

lastName:"Byrne"

fullName:"John A. Byrne"

publicIdentifier:"johnabyrne"

profilePictureURL:"https://media.licdn.com/dms/image/v2/C4D03AQFvFnzCeOwDEQ/profile-displayphoto-shrink\_800\_800/profile-displayphoto-shrink\_800\_800/0/1528566267360?e=1761782400&v=beta&t=pJHNZWQjSgYbjEmqLUfTju3YgCq8aSN-dolduYKIS3k"

creator:true

followerCount:688490

\[99\]:

urn:"ACoAAAKXsdABMUNfdYaKncs26A2_S3I4W9dID70"

firstName:"Mary"

lastName:"Barra"

fullName:"Mary Barra"

publicIdentifier:"mary-barra"

profilePictureURL:"https://media.licdn.com/dms/image/v2/D5603AQFNy7nvRz3AAA/profile-displayphoto-shrink\_800\_800/B56ZSTmJCnGsAc-/0/1737643037521?e=1761782400&v=beta&t=RG8Kylo5hMWpi7T4un6Znw4qFGe1rOTBixvXlMyopcg"

creator:true

followerCount:1452385

\[100\]:

urn:"ACoAAAFAMg4BA7qywHBKci\_\_6L9JouQbov2lqVM"

firstName:"LeVar"

lastName:"Burton"

fullName:"LeVar Burton"

publicIdentifier:"levarburton"

profilePictureURL:"https://media.licdn.com/dms/image/v2/D5603AQFRmAtqAfzKfw/profile-displayphoto-shrink\_800\_800/B56ZXK8bkuGcAg-/0/1742866594718?e=1761782400&v=beta&t=\_iVS92hmbk9-yQSUFwC0\_HX0C2I-72\_i8V\_\_migRXAM"

creator:true

followerCount:925103

\[101\]:

urn:"ACoAAAAAPwEB4ddZ-a_r4ceBpSuhc5nLtH37gi4"

firstName:"Marc"

lastName:"Benioff"

fullName:"Marc Benioff"

publicIdentifier:"marcbenioff"

profilePictureURL:"https://media.licdn.com/dms/image/v2/D5603AQHnSx2OOgzsSA/profile-displayphoto-shrink\_800\_800/profile-displayphoto-shrink\_800\_800/0/1730225996800?e=1761782400&v=beta&t=cqvAoyDDkEdi3M9sX3lRuByjFRn7IWMnRq6aQis5Sjs"

creator:false

followerCount:198020

\[102\]:

urn:"ACoAAAPlFEUBGFgILYuMe3B4ul8L1pns82n76RA"

firstName:"James"

lastName:"Creech"

fullName:"James Creech"

publicIdentifier:"jlcreech"

profilePictureURL:"https://media.licdn.com/dms/image/v2/D4E03AQHmQPoPXMRPgw/profile-displayphoto-shrink\_800\_800/profile-displayphoto-shrink\_800\_800/0/1664429878680?e=1761782400&v=beta&t=SkXgD7alzSQ1S8RLkgBB9LgVc68veVzgDNhACkddwX4"

creator:true

followerCount:30376

\[103\]:

urn:"ACoAAACQhmgBP0GR7K7Skg74Y46ONZY5geUbja4"

firstName:"Andy"

lastName:"Dunn"

fullName:"Andy Dunn"

publicIdentifier:"andyrdunn"

profilePictureURL:"https://media.licdn.com/dms/image/v2/C5603AQGeOoaVK4yMhQ/profile-displayphoto-shrink\_800\_800/profile-displayphoto-shrink\_800\_800/0/1655566204999?e=1761782400&v=beta&t=iksbzjanjNXEuMc7x3LGrOFSM1sUr7vDIg5M6genq-s"

creator:true

followerCount:41526

\[104\]:

urn:"ACoAAABYfZcBymOzU7SafpzGprHXXQZQO3XRa_Y"

firstName:"Ilya"

lastName:"Pozin"

fullName:"Ilya Pozin"

publicIdentifier:"ipozin"

profilePictureURL:"https://media.licdn.com/dms/image/v2/D5603AQEKsZwX5x\_\_bQ/profile-displayphoto-shrink\_800\_800/profile-displayphoto-shrink\_800\_800/0/1689591901244?e=1761782400&v=beta&t=e2zfbl-isb2RVX48H74Tv2oZTvvsEJdPSG8DMBP8N-Q"

creator:true

followerCount:795884

\[105\]:

urn:"ACoAABayK0kBBoE8WtuBgPp1lIz5nNzjsFK5OwY"

firstName:"Yuanqing"

lastName:"Yang"

fullName:"Yuanqing Yang"

publicIdentifier:"yuanqinglenovo"

profilePictureURL:"https://media.licdn.com/dms/image/v2/C5603AQGJ6ELYSiWMeA/profile-displayphoto-shrink\_400\_400/profile-displayphoto-shrink\_400\_400/0/1526008586744?e=1761782400&v=beta&t=6wUT9CGYraNM7G0K\_irCZ7\_9nrjgjSGNedLCcDz-dG0"

creator:true

followerCount:291387

\[106\]:

urn:"ACoAAAAD8SsBK2q9RZlfcoVlodqTKjPodIL0v_U"

firstName:"Jules"

lastName:"Polonetsky"

fullName:"Jules Polonetsky"

publicIdentifier:"julespolonetsky"

profilePictureURL:"https://media.licdn.com/dms/image/v2/D4E03AQFSxC7sHDn84A/profile-displayphoto-shrink\_800\_800/B4EZS0RLSHHcAc-/0/1738191191532?e=1761782400&v=beta&t=01hBzLu5WvTACnjUWZcHQKolOrARgLthpWwnV4kleFY"

creator:true

followerCount:388350

\[107\]:

urn:"ACoAAAAe090BQuHwR1RQSk2Xf3QODxQtgQ0r1Ww"

firstName:"Kunal"

lastName:"Bahl"

fullName:"Kunal Bahl"

publicIdentifier:"kunalbahl"

profilePictureURL:"https://media.licdn.com/dms/image/v2/D5603AQGxPlvpTr28QA/profile-displayphoto-shrink\_800\_800/profile-displayphoto-shrink\_800\_800/0/1708016890335?e=1761782400&v=beta&t=l\_bYpQKr4UnCC\_k8Wo-dXHjk4fW4tKx4GCV1n3m-eZ4"

creator:true

followerCount:881887

\[108\]:

urn:"ACoAAAFJDSQBt8r9uXY5YTSHghpT0s-3fuvYmfg"

firstName:"Rita J."

lastName:"King"

fullName:"Rita J. King"

publicIdentifier:"ritajking"

profilePictureURL:"https://media.licdn.com/dms/image/v2/D5603AQHxW-GpsaQd7Q/profile-displayphoto-shrink\_800\_800/B56ZZR065nHsAc-/0/1745129551355?e=1761782400&v=beta&t=0LKcz2t4y-HNm2qI-28m63heZkxyUOiTYgxj360sEdE"

creator:true

followerCount:577727

\[109\]:

urn:"ACoAAAA1bO8BbcMzKoGaf7jow6b3M86ifsWtiVY"

firstName:"Jeff"

lastName:"Jones"

fullName:"Jeff Jones"

publicIdentifier:"jjonesii"

profilePictureURL:"https://media.licdn.com/dms/image/v2/D5603AQF7-NPv-sRUXQ/profile-displayphoto-shrink\_800\_800/B56ZNe9pOJGgAc-/0/1732465039946?e=1761782400&v=beta&t=yyMRcjJ-s\_hv\_YKZvGTym0UV2JrTpw8jVt9LdO1czQ0"

creator:true

followerCount:157801

\[110\]:

urn:"ACoAAAw4D5sB4ZMefUY22SQECAv5kgQQKM4Cwh4"

firstName:"Stephen"

lastName:"Curry"

fullName:"Stephen Curry"

publicIdentifier:"stephencurry30"

profilePictureURL:"https://media.licdn.com/dms/image/v2/C5603AQFB4ebeyLpzgw/profile-displayphoto-shrink\_800\_800/profile-displayphoto-shrink\_800\_800/0/1568784020966?e=1761782400&v=beta&t=MhP\_r7JaRfWGi\_cE5JCeLIgpIn2uNQLdlLJTfNGjtyY"

creator:true

followerCount:542227

\[111\]:

urn:"ACoAAAA60_cBLDJX9LzxGGl_y-JHuiI2iWyReIo"

firstName:"Aaron"

lastName:"Levie"

fullName:"Aaron Levie"

publicIdentifier:"boxaaron"

profilePictureURL:"https://media.licdn.com/dms/image/v2/C5603AQFIzAABLLfSqQ/profile-displayphoto-shrink\_400\_400/profile-displayphoto-shrink\_400\_400/0/1521701872691?e=1761782400&v=beta&t=GWjt2Wl0Zqmzn9JKvWMimQkO3LRFmegahLvhf1Guetw"

creator:false

followerCount:91346

\[112\]:

urn:"ACoAAA7nVsoB6-nVBU_tRi4jS-pahP_O4mM15XI"

firstName:"Liz"

lastName:"Claman"

fullName:"Liz Claman"

publicIdentifier:"lizclaman"

profilePictureURL:"https://media.licdn.com/dms/image/v2/C5603AQFAUZEjhVuKJg/profile-displayphoto-shrink\_200\_200/profile-displayphoto-shrink\_200\_200/0/1517483014616?e=1761782400&v=beta&t=CWEjFHIm\_jvAVuhKtZyjKPQ2kPKzC5Boa6XxBSK5\_fs"

creator:false

followerCount:87166

\[113\]:

urn:"ACoAAAF0QlEB41rmm-NHtE9EhKZD5wEH2Ao_4eI"

firstName:"Jane"

lastName:"Fraser"

fullName:"Jane Fraser"

publicIdentifier:"jane-fraser-3292068"

profilePictureURL:"https://media.licdn.com/dms/image/v2/D4E03AQEDwsfw5-HWJg/profile-displayphoto-crop\_800\_800/B4EZhCEDHaHgAI-/0/1753455015185?e=1761782400&v=beta&t=OkWtnO4W0Q9OH4C5z10Q4ApiNXFvchcGeqvfQ70jyB4"

creator:true

followerCount:397355

\[114\]:

urn:"ACoAAAA-LWUBWvoYu3LhTCyylEAp3v_ruqfh9ms"

firstName:"Scott"

lastName:"Belsky"

fullName:"Scott Belsky"

publicIdentifier:"scottbelsky"

profilePictureURL:"https://media.licdn.com/dms/image/v2/D4E03AQERXgLVc38kzg/profile-displayphoto-shrink\_800\_800/profile-displayphoto-shrink\_800\_800/0/1673029866417?e=1761782400&v=beta&t=QGgwx4sUGVydfSoYTSwJv0HnP5QiB8LGFvE2LU5cKHI"

creator:true

followerCount:215112

\[115\]:

urn:"ACoAAARl4EIB5OomB7aW_76fvnqhmVcyJ8gMjg4"

firstName:"Bob"

lastName:"Moritz"

fullName:"Bob Moritz"

publicIdentifier:"robertemoritz"

profilePictureURL:"https://media.licdn.com/dms/image/v2/C4D03AQGMjdfvmHi5BA/profile-displayphoto-shrink\_400\_400/profile-displayphoto-shrink\_400\_400/0/1516903465246?e=1761782400&v=beta&t=uL2tZKV3vQnHv1LPzKg6XOkgvDwS7NRGmRvLM68IyjY"

creator:true

followerCount:355469

\[116\]:

urn:"ACoAAEwcXoEBzGK5wSNLhtqUAwT6urxoK0kqpz4"

firstName:"Ashley"

lastName:"Graham"

fullName:"Ashley Graham"

publicIdentifier:"ashley-graham-8a97822b7"

profilePictureURL:"https://media.licdn.com/dms/image/v2/D4D03AQFzJdEUcAYg2Q/profile-displayphoto-shrink\_800\_800/profile-displayphoto-shrink\_800\_800/0/1718286612578?e=1761782400&v=beta&t=fd5QToLVtUh38b3TngFQikEwk4KfbZbofgyGut4nF7I"

creator:false

followerCount:2986

\[117\]:

urn:"ACoAAAQglKkB6T3kzNMNB3hWpxGVWJbLYXNBM_I"

firstName:"Adam"

lastName:"Grant"

fullName:"Adam Grant"

publicIdentifier:"adammgrant"

profilePictureURL:"https://media.licdn.com/dms/image/v2/C4E03AQFGdrbBw3FYhA/profile-displayphoto-shrink\_800\_800/profile-displayphoto-shrink\_800\_800/0/1629123595757?e=1761782400&v=beta&t=Yg\_MtdmnCO8xS3VWOg\_V2IaIQ1zcJRfTx\_mX7c71K4U"

creator:true

followerCount:5554221

\[118\]:

urn:"ACoAAAABQdkBmr14ZzzcORymddjyXabHSIh2gFM"

firstName:"Eric S."

lastName:"Yuan"

fullName:"Eric S. Yuan"

publicIdentifier:"ericsyuan"

profilePictureURL:"https://media.licdn.com/dms/image/v2/D5603AQGNJcc-bCEvJA/profile-displayphoto-shrink\_800\_800/profile-displayphoto-shrink\_800\_800/0/1692899470721?e=1761782400&v=beta&t=2Q2MV3qfr6CwzbAg1tCuAcSvWQpOLXB9nS1kkwGxHKY"

creator:true

followerCount:91022

\[119\]:

urn:"ACoAAAFqmHMBRvI7O6GyhdtaXPyuHZSa4aQUEnw"

firstName:"Brad"

lastName:"Smith"

fullName:"Brad Smith"

publicIdentifier:"bradsmi"

profilePictureURL:"https://media.licdn.com/dms/image/v2/C5603AQGnYfaUI8S0zQ/profile-displayphoto-shrink\_400\_400/profile-displayphoto-shrink\_400\_400/0/1516342848914?e=1761782400&v=beta&t=sUn27ZOFDv58roaEf537l9F20HHZIUdFXLmKo806pX4"

creator:true

followerCount:353780

\[120\]:

urn:"ACoAAARyDZEBIVETZcNjOW84VHribYXra_LDmXE"

firstName:"Kevin"

lastName:"Parry"

fullName:"Kevin Parry"

publicIdentifier:"kevinbparry"

profilePictureURL:"https://media.licdn.com/dms/image/v2/C4D03AQFZEDO-dbb1Hw/profile-displayphoto-shrink\_800\_800/profile-displayphoto-shrink\_800\_800/0/1647004810734?e=1761782400&v=beta&t=UDJC3O\_gSISZvJQVogNViYxBDwy0t6Pa6268i62\_w3Y"

creator:true

followerCount:131724

\[121\]:

urn:"ACoAAAEPVgwBVSHn9Zdw12nL5N453WDm5kWqVZY"

firstName:"Sean"

lastName:"Tresvant"

fullName:"Sean Tresvant"

publicIdentifier:"sean-tresvant-810b565"

profilePictureURL:"https://media.licdn.com/dms/image/v2/D5603AQEPL5t-H80reQ/profile-displayphoto-shrink\_800\_800/profile-displayphoto-shrink\_800\_800/0/1726860612005?e=1761782400&v=beta&t=d0ajjrya7K9aUvDaj80q0kTgs4PbZE1\_NhGEIS0QqjA"

creator:false

followerCount:24930

\[122\]:

urn:"ACoAAAEcd8gB4ZoC-nk1q9F0Y4ZxeiTDxI8bjb0"

firstName:"Christopher M."

lastName:"Schroeder"

fullName:"Christopher M. Schroeder"

publicIdentifier:"schroederchrism"

profilePictureURL:"https://media.licdn.com/dms/image/v2/D4E03AQGaFFC-vr8M4Q/profile-displayphoto-shrink\_800\_800/B4EZdROfnbHgAc-/0/1749414456682?e=1761782400&v=beta&t=KjKecLASrwnNOnsnRNg4nPRNAVYb4GRtNaFcbSo1eIY"

creator:true

followerCount:783987

\[123\]:

urn:"ACoAAAPpJ44B3E-jsuFQl0f4_yOTiwAvM86bV1k"

firstName:"Anthony"

lastName:"Day✌🏽"

fullName:"Anthony Day✌🏽"

publicIdentifier:"anthonyjjday"

profilePictureURL:"https://media.licdn.com/dms/image/v2/D4E03AQGAlrf7H0\_5aQ/profile-displayphoto-crop\_800\_800/B4EZd.SAWYHcAM-/0/1750170343463?e=1761782400&v=beta&t=Msxu007dfwyWSxHI1RlVEYefzHHq3p9Z2qlz2sbN0II"

creator:true

followerCount:116272

\[124\]:

urn:"ACoAAAAAZKABcGLHr1Xi8TnxwJhmiGPgewpxF-c"

firstName:"Michael"

lastName:"Moritz"

fullName:"Michael Moritz"

publicIdentifier:"michaelmoritz"

profilePictureURL:"https://media.licdn.com/dms/image/v2/C4E03AQEElf8XI\_61\_Q/profile-displayphoto-shrink\_400\_400/profile-displayphoto-shrink\_400\_400/0/1516158533780?e=1761782400&v=beta&t=s3HM2dH8eeQS0yDHogyBtPROPqbwUA32ikL1uAG32pE"

creator:true

followerCount:574657

\[125\]:

urn:"ACoAACks6T8BloGipoqIc0bqXVskD8MTGF8gsM8"

firstName:"Tejas"

lastName:"Hullur"

fullName:"Tejas Hullur"

publicIdentifier:"tejashullur"

profilePictureURL:"https://media.licdn.com/dms/image/v2/D4E03AQH\_c8CgBmvzDQ/profile-displayphoto-shrink\_800\_800/profile-displayphoto-shrink\_800\_800/0/1693415511544?e=1761782400&v=beta&t=Fxzr6WVaxLV\_JvqinJwii6N4rSqKRl8oK8b\_\_DNilus"

creator:true

followerCount:11047

\[126\]:

urn:"ACoAAApPMQsBNsIVEUUE1ofRsCd1fRJ27cF9hwI"

firstName:"Caroline A."

lastName:"Wanga"

fullName:"Caroline A. Wanga"

publicIdentifier:"wangawoman"

profilePictureURL:"https://media.licdn.com/dms/image/v2/D4E03AQHBa8JaxKHExQ/profile-displayphoto-crop\_800\_800/B4EZjjl.IAGwAU-/0/1756165039301?e=1761782400&v=beta&t=m1CjIHju-kd6AH7S6B9moUugHjPQ3OhnjiWS3jHC9Gk"

creator:true

followerCount:95887

\[127\]:

urn:"ACoAAAXndSQBe4GCICiUpwCPxvJGp4faGmE4C10"

firstName:"Kelvin"

lastName:"B."

fullName:"Kelvin B."

publicIdentifier:"kb2smu"

profilePictureURL:"https://media.licdn.com/dms/image/v2/D5603AQE3IW0r4Abn2A/profile-displayphoto-shrink\_800\_800/profile-displayphoto-shrink\_800\_800/0/1668977641315?e=1761782400&v=beta&t=Kjw\_0u-4gUYESN1XqlObEti1LTHlBDQPVBj3f9SDimc"

creator:true

followerCount:23366

\[128\]:

urn:"ACoAAAIMgsABOFx7ta79OHsbNbjtxCSk4XG-GN0"

firstName:"John"

lastName:"Maeda"

fullName:"John Maeda"

publicIdentifier:"johnmaeda"

profilePictureURL:"https://media.licdn.com/dms/image/v2/D5603AQGfQRPxo8VLIw/profile-displayphoto-shrink\_800\_800/profile-displayphoto-shrink\_800\_800/0/1694989489092?e=1761782400&v=beta&t=by8v2anZoQZV1lnoApn3iGeX0mI0GoVUKyS9M9ZN0J4"

creator:true

followerCount:468940

\[129\]:

urn:"ACoAAAFRSa0BpGeJj0TC-WnyRla63LSGA6Ple3E"

firstName:"Daron K."

lastName:"Roberts, J.D."

fullName:"Daron K. Roberts, J.D."

publicIdentifier:"daronkroberts"

profilePictureURL:"https://media.licdn.com/dms/image/v2/D4E03AQExgLzikUN7Ng/profile-displayphoto-shrink\_800\_800/profile-displayphoto-shrink\_800\_800/0/1724154763460?e=1761782400&v=beta&t=HCEQbNTosFngEONoOq6JTSValjr5bCT8WL2LhRjUjok"

creator:true

followerCount:66676

\[130\]:

urn:"ACoAAAFgF0YBELiNInVhCQaUrtiPIgTA7EsP4SY"

firstName:"John Hope"

lastName:"Bryant"

fullName:"John Hope Bryant"

publicIdentifier:"johnhopebryant"

profilePictureURL:"https://media.licdn.com/dms/image/v2/D4E03AQF7bZPdIWxixA/profile-displayphoto-shrink\_800\_800/B4EZdHuPVZHsAc-/0/1749254994229?e=1761782400&v=beta&t=gRyk00QX\_5q2ll22hjmJo0CFnOdhQl-QtGDn-8GF6l0"

creator:true

followerCount:423545

\[131\]:

urn:"ACoAAAACe5QBtE24H3BNxmLp2wdTQJa5roe3fDo"

firstName:"Jeffrey"

lastName:"Walker"

fullName:"Jeffrey Walker"

publicIdentifier:"jeffreywalkerinfo"

profilePictureURL:"https://media.licdn.com/dms/image/v2/C4E03AQF878dCLbvoGg/profile-displayphoto-shrink\_800\_800/profile-displayphoto-shrink\_800\_800/0/1516176249736?e=1761782400&v=beta&t=tJVDsJCr7Km5MgYoaL-bxmhnz4-k0BfRM46jpdsj0YM"

creator:true

followerCount:102752

\[132\]:

urn:"ACoAAADCHL0BFrabMtEhQ1qQD-YuKWx5FljCDmc"

firstName:"Alex"

lastName:"Kantrowitz"

fullName:"Alex Kantrowitz"

publicIdentifier:"alexkantrowitz"

profilePictureURL:"https://media.licdn.com/dms/image/v2/C5603AQH\_TOzh\_tidpg/profile-displayphoto-shrink\_800\_800/profile-displayphoto-shrink\_800\_800/0/1583114264572?e=1761782400&v=beta&t=lOvkcsLJDvwTtmsUU-bvpl1yzTZ4KJQKusc\_5z\_O7C8"

creator:true

followerCount:41182

\[133\]:

urn:"ACoAACBTnw4BTcRBvRe8kfPg6ESVir4wtqQW3LQ"

firstName:"Anant"

lastName:"Maheshwari"

fullName:"Anant Maheshwari"

publicIdentifier:"maheshwarianant"

profilePictureURL:"https://media.licdn.com/dms/image/v2/D4D03AQHYWdEzrml5vA/profile-displayphoto-shrink\_800\_800/profile-displayphoto-shrink\_800\_800/0/1702879908627?e=1761782400&v=beta&t=lJRMpdyj-pTSPemSj54khqAIl\_zf\_ruULaIA2vZhT1s"

creator:true

followerCount:67554

\[134\]:

urn:"ACoAAAC0y5YB1d3L356Yaf3g3Tb5PR4O7scFb5o"

firstName:"Adam"

lastName:"Selipsky"

fullName:"Adam Selipsky"

publicIdentifier:"adamselipsky"

profilePictureURL:"https://media.licdn.com/dms/image/v2/D5603AQGZJ-njdtv\_-g/profile-displayphoto-shrink\_800\_800/profile-displayphoto-shrink\_800\_800/0/1719507065641?e=1761782400&v=beta&t=8-AZ8CBHc707yDuaFCcQK4eZ-QqGI2rnx0-fXvBszyg"

creator:true

followerCount:269500

\[135\]:

urn:"ACoAAA2CDF8BlyDd8jHcvIujtyUS6YDtx6EOzJ4"

firstName:"Justin"

lastName:"Trudeau"

fullName:"Justin Trudeau"

publicIdentifier:"justintrudeau"

profilePictureURL:"https://media.licdn.com/dms/image/v2/C4E03AQGD-PJnXZmU8g/profile-displayphoto-shrink\_800\_800/profile-displayphoto-shrink\_800\_800/0/1629053585597?e=1761782400&v=beta&t=v7J4bQXp2IivxbqA5-cKxYaPxmLpun\_bIoiYMDPvqbs"

creator:false

followerCount:5508933

\[136\]:

urn:"ACoAAAC6QkIBdqrI_r-fP51RcZCf3U51U50ID7c"

firstName:"Sue"

lastName:"Siegel"

fullName:"Sue Siegel"

publicIdentifier:"sue-siegel"

profilePictureURL:"https://media.licdn.com/dms/image/v2/D5603AQH6qTWdQ6hf9g/profile-displayphoto-shrink\_800\_800/B56ZUg.agRGoAc-/0/1740014987614?e=1761782400&v=beta&t=ZvktgEwWgSTPKEazZ5oXdj78XyC9RYkbMHqDR3-YKv8"

creator:false

followerCount:167794

\[137\]:

urn:"ACoAABYHRckBHfSiDzhk3NRHTNbncUGybiRN7Js"

firstName:"Holly"

lastName:"Branson"

fullName:"Holly Branson"

publicIdentifier:"holly-branson"

profilePictureURL:"https://media.licdn.com/dms/image/v2/C4D03AQGawfRGM9RfhA/profile-displayphoto-shrink\_800\_800/profile-displayphoto-shrink\_800\_800/0/1580563642081?e=1761782400&v=beta&t=B9N9jJBPrkWj9iIx2l9zUjsFFsAjTxE8noT12eg3wEQ"

creator:true

followerCount:288588

\[138\]:

urn:"ACoAAAekNPUBwZH5b0VQE0yjvdc6nB-VYT7Fp5s"

firstName:"Walt"

lastName:"Bettinger"

fullName:"Walt Bettinger"

publicIdentifier:"waltbettinger"

profilePictureURL:"https://media.licdn.com/dms/image/v2/D4E03AQFC9b8kdKswOw/profile-displayphoto-shrink\_800\_800/profile-displayphoto-shrink\_800\_800/0/1723996176137?e=1761782400&v=beta&t=XA6C73ejzrrgfVR8jmX\_9Nk8iw8d7NSdCZHy4rFYzho"

creator:true

followerCount:204387

\[139\]:

urn:"ACoAAA7jgP0BAeORWVQbV3DjuZUiEDrGO_a6wV4"

firstName:"Padmasree"

lastName:"Warrior"

fullName:"Padmasree Warrior"

publicIdentifier:"padmasree-warrior-9917a26b"

profilePictureURL:"https://media.licdn.com/dms/image/v2/C5603AQG6X9VVJbDq8A/profile-displayphoto-shrink\_800\_800/profile-displayphoto-shrink\_800\_800/0/1548022109732?e=1761782400&v=beta&t=pxxLKNqCGIsVrSWgtlJGWc6OP5\_6292MMXXWh0zpw8A"

creator:true

followerCount:426075

\[140\]:

urn:"ACoAAADO7psB5cjUeiYhuS6S2Fi0pGnZpCAPsVE"

firstName:"Phil"

lastName:"Baumann"

fullName:"Phil Baumann"

publicIdentifier:"philbaumann"

profilePictureURL:"https://media.licdn.com/dms/image/v2/C4D03AQGz9deJexaTSQ/profile-displayphoto-shrink\_800\_800/profile-displayphoto-shrink\_800\_800/0/1615857943164?e=1761782400&v=beta&t=dnV0SVr86XuwLpmxi8rWwCywwExZCRNXy5CJxBPqAKk"

creator:true

followerCount:97468

\[141\]:

urn:"ACoAAA21ZpoBBM9eRio4mOGD0LKKpjRgDqXwg7k"

firstName:"John"

lastName:"Taft"

fullName:"John Taft"

publicIdentifier:"johngtaft"

profilePictureURL:"https://media.licdn.com/dms/image/v2/C5603AQEq\_xMce93xig/profile-displayphoto-shrink\_400\_400/profile-displayphoto-shrink\_400\_400/0/1517611801032?e=1761782400&v=beta&t=JZo4jPkrCPeL9cHjnzxM4cQyrrhlf6VeikNj6LbiYEU"

creator:true

followerCount:139843

\[142\]:

urn:"ACoAAABUB1wBfL6FPFuaJo1TtwjTY_mfS-A7VTI"

firstName:"Nicolas"

lastName:"Bordas"

fullName:"Nicolas Bordas"

publicIdentifier:"nicolasbordas"

profilePictureURL:"https://media.licdn.com/dms/image/v2/D5603AQEaU8XHThKseg/profile-displayphoto-shrink\_800\_800/profile-displayphoto-shrink\_800\_800/0/1696601768271?e=1761782400&v=beta&t=1JRJ\_Hl3C7otZmnMN012nzXyF8V44fN\_jU\_pnBLS-Q4"

creator:true

followerCount:226107

\[143\]:

urn:"ACoAABkaWZ0Bwm9zQSFBj2hCHLYVUvx4jeRA9CY"

firstName:"Jessica"

lastName:"Alba"

fullName:"Jessica Alba"

publicIdentifier:"jessica-alba"

profilePictureURL:"https://media.licdn.com/dms/image/v2/C5603AQHRZHb3ONfjgg/profile-displayphoto-shrink\_800\_800/profile-displayphoto-shrink\_800\_800/0/1629317857965?e=1761782400&v=beta&t=RaMCgD0DeZkTv4\_rSWz8wW\_UU9ynCP1JDT8gTNwdnN0"

creator:true

followerCount:1752709

\[144\]:

urn:"ACoAABomnXwBP1qpgBuYk7gg5NklEC2q0sLcxB4"

firstName:"Katie"

lastName:"Couric"

fullName:"Katie Couric"

publicIdentifier:"katiecouric"

profilePictureURL:"https://media.licdn.com/dms/image/v2/D4E03AQFCNvW4wex3Lw/profile-displayphoto-shrink\_800\_800/profile-displayphoto-shrink\_800\_800/0/1707158724401?e=1761782400&v=beta&t=KGgQVIyHFfkZ4mmQxw3XoLcGZt5D0oAfuPOzaiv3A-M"

creator:true

followerCount:644465

\[145\]:

urn:"ACoAAABZZSMBqi1xp8AIp57zWxb-dVDhJKGePeQ"

firstName:"James"

lastName:"Altucher"

fullName:"James Altucher"

publicIdentifier:"jamesaltucher"

profilePictureURL:"https://media.licdn.com/dms/image/v2/C4D03AQHcZjk1rg0PRw/profile-displayphoto-shrink\_800\_800/profile-displayphoto-shrink\_800\_800/0/1548269838014?e=1761782400&v=beta&t=lSC1UwYH8ybC-BDQwugYJNrmFcFzIzEmNVsGNJG1uyw"

creator:true

followerCount:1166047

\[146\]:

urn:"ACoAAAwcWG4Bky_JZID2EMKKwQDe45swVo7UWWE"

firstName:"James (Jim)"

lastName:"Citrin"

fullName:"James (Jim) Citrin"

publicIdentifier:"james-jim-citrin-57a06758"

profilePictureURL:"https://media.licdn.com/dms/image/v2/C4D03AQHHn0G3fR8pJQ/profile-displayphoto-shrink\_800\_800/profile-displayphoto-shrink\_800\_800/0/1581965694480?e=1761782400&v=beta&t=-vEUJe2I\_SIoC-a0C3Zlyowwn8kzq4J8iFYrXuzGVpg"

creator:true

followerCount:937223

\[147\]:

urn:"ACoAAAAUPCsByjo5pxb3QP-ZETmGWaGl_2Os0JI"

firstName:"Fadi"

lastName:"Ghandour"

fullName:"Fadi Ghandour"

publicIdentifier:"fadi-ghandour-52353b"

profilePictureURL:"https://media.licdn.com/dms/image/v2/D4D03AQHxCDdhBjdj6Q/profile-displayphoto-shrink\_800\_800/profile-displayphoto-shrink\_800\_800/0/1721220983165?e=1761782400&v=beta&t=yW-dJOxpfeQ\_VEBpLtWaZSnRBt5aaITZMU71h-4fHyM"

creator:true

followerCount:723678

\[148\]:

urn:"ACoAAABNVj0BFGHyshoTwNkq9n1HNf36II_Czn0"

firstName:"Dorie"

lastName:"Clark"

fullName:"Dorie Clark"

publicIdentifier:"doriec"

profilePictureURL:"https://media.licdn.com/dms/image/v2/C5103AQF4W2lVcVBxTA/profile-displayphoto-shrink\_400\_400/profile-displayphoto-shrink\_400\_400/0/1516326560107?e=1761782400&v=beta&t=rVJSCaaBBWciWompqAcD4N6\_XJ17RTDvRx3MdNZg7A4"

creator:true

followerCount:369264

\[149\]:

urn:"ACoAAClRyoIBI02_VhQ3U0vXWl7cc-iEsgA8iBk"

firstName:"Jennifer"

lastName:"Lopez"

fullName:"Jennifer Lopez"

publicIdentifier:"thejlo"

profilePictureURL:"https://media.licdn.com/dms/image/v2/C4D03AQHAQDTVGt710Q/profile-displayphoto-shrink\_800\_800/profile-displayphoto-shrink\_800\_800/0/1590075552667?e=1761782400&v=beta&t=ngFa3IXQWOv\_ZVtPLoHPCnWoWieNOGCz0W07Bsvw75w"

creator:true

followerCount:429394

\[150\]:

urn:"ACoAAAACAAcBVexPqZ1rx-Rai3VQO9iU7FjPRDU"

firstName:"Josh"

lastName:"Bersin"

fullName:"Josh Bersin"

publicIdentifier:"bersin"

profilePictureURL:"https://media.licdn.com/dms/image/v2/D5603AQFmn\_t8yK5veA/profile-displayphoto-shrink\_800\_800/profile-displayphoto-shrink\_800\_800/0/1697557754253?e=1761782400&v=beta&t=u0YCbOEEOgg5IyNRfgWixUjhnRWYPNfh5I2XNo154C8"

creator:true

followerCount:956687

\[151\]:

urn:"ACoAAAAXPtkB9TGjuEsfcXgmxz-mvVw1XzE2sBc"

firstName:"Mohak"

lastName:"Shroff"

fullName:"Mohak Shroff"

publicIdentifier:"mohakshroff"

profilePictureURL:"https://media.licdn.com/dms/image/v2/D5603AQEbxUUNCBdEyg/profile-displayphoto-crop\_800\_800/B56ZhXOG0CH0AU-/0/1753809972767?e=1761782400&v=beta&t=cWOjCHKutO1JkRrM9OX3Qvytt5sP0wv\_hrMK\_05Pfio"

creator:false

followerCount:0

\[152\]:

urn:"ACoAAAGI2QsBpHnmRCzehjNYa2ToYaR0jJx-Gk4"

firstName:"Ron"

lastName:"Shaich"

fullName:"Ron Shaich"

publicIdentifier:"ronshaich"

profilePictureURL:"https://media.licdn.com/dms/image/v2/D4E03AQFREJmz9s9CrA/profile-displayphoto-shrink\_800\_800/profile-displayphoto-shrink\_800\_800/0/1688069257146?e=1761782400&v=beta&t=M9BuGXNkSl0mJruiXIsqaSLGHFDZ1nh-pWNItjnT4JE"

creator:true

followerCount:240975

\[153\]:

urn:"ACoAAABEkP0Bop3I1UvNwpW6A8p9o7rqSjSYvk8"

firstName:"Dr. Hsien-Hsien"

lastName:"Lei"

fullName:"Dr. Hsien-Hsien Lei"

publicIdentifier:"hsienlei"

profilePictureURL:"https://media.licdn.com/dms/image/v2/D5603AQFJq9N-q\_6eCQ/profile-displayphoto-shrink\_800\_800/profile-displayphoto-shrink\_800\_800/0/1723128175272?e=1761782400&v=beta&t=4XzfSTukQcXo-oTBHb111NgR5OIx5bNz4IEBi5f\_U9Y"

creator:true

followerCount:17335

\[154\]:

urn:"ACoAAAACowsB9mPZMzHSJRzM2hFpn9S1Ns6lU6Y"

firstName:"Nancy"

lastName:"Duarte"

fullName:"Nancy Duarte"

publicIdentifier:"nancyduarte"

profilePictureURL:"https://media.licdn.com/dms/image/v2/C4E03AQHmQY7-wtPmSw/profile-displayphoto-shrink\_800\_800/profile-displayphoto-shrink\_800\_800/0/1564458172790?e=1761782400&v=beta&t=kq6MkA3wBegCIU935SqA9MBDi0EPuLEhhY7bffRls5c"

creator:true

followerCount:214320

\[155\]:

urn:"ACoAAAAD5_wBRMQ5lHrDzxGomqjRzjZcbBGGwfU"

firstName:"Lynda"

lastName:"Weinman"

fullName:"Lynda Weinman"

publicIdentifier:"lyndaweinman"

profilePictureURL:"https://media.licdn.com/dms/image/v2/C4E03AQHlx1Hm\_pdJTA/profile-displayphoto-shrink\_800\_800/profile-displayphoto-shrink\_800\_800/0/1516188017863?e=1761782400&v=beta&t=UxITr9nyhnXmAM7xe3mr1JYc1QbGf7ZutPG9JZpzcxU"

creator:true

followerCount:99560

\[156\]:

urn:"ACoAAAUDxAYB6OFIFBpNhV-afIni1v4jBVx2ejg"

firstName:"Nikhil"

lastName:"Kamath"

fullName:"Nikhil Kamath"

publicIdentifier:"nikhilkamathcio"

profilePictureURL:"https://media.licdn.com/dms/image/v2/D5603AQH7ELRLBZNGow/profile-displayphoto-shrink\_800\_800/B56ZVp0aAKGsAc-/0/1741237101042?e=1761782400&v=beta&t=LGeQJ4XvM0lF7iw07kJMgwZktwszlPKoUUKornsXDRM"

creator:true

followerCount:1368898

\[157\]:

urn:"ACoAABAkIqcBTdNVYPXdjiIPOUV8rT5j4TTieko"

firstName:"Larry"

lastName:"Fink"

fullName:"Larry Fink"

publicIdentifier:"laurencefink"

profilePictureURL:"https://media.licdn.com/dms/image/v2/D4D03AQExq\_f6lVhuxg/profile-displayphoto-shrink\_800\_800/B4DZYXCzSyGwAg-/0/1744143334504?e=1761782400&v=beta&t=1yoJ8qdqEJGjXYSwb8C-ksBYdCG\_yy5Qi4k3zTa0pls"

creator:true

followerCount:1202421

\[158\]:

urn:"ACoAAE6FVtYBAW4bP82g1IhIHxzu_1J010WU3CQ"

firstName:"Sundar "

lastName:"Pichai "

fullName:"Sundar Pichai "

publicIdentifier:"sundarpichai"

profilePictureURL:"https://media.licdn.com/dms/image/v2/D4E03AQFrmDuWUxQoMg/profile-displayphoto-shrink\_800\_800/profile-displayphoto-shrink\_800\_800/0/1715645354620?e=1761782400&v=beta&t=1n80DHz1YAKnnpHXrbzfov0jhY7py\_oA6tCR3o5\_INo"

creator:false

followerCount:2094191

\[159\]:

urn:"ACoAAAExb3oBvEbyXu5LzgcGj6bwqeCFXUtvEA8"

firstName:"Jeff"

lastName:"Haden"

fullName:"Jeff Haden"

publicIdentifier:"hadenjeff"

profilePictureURL:"https://media.licdn.com/dms/image/v2/C4E03AQE7hLtddj353Q/profile-displayphoto-shrink\_800\_800/profile-displayphoto-shrink\_800\_800/0/1517701266546?e=1761782400&v=beta&t=oAY7ui-aeZUyVJUiJewcHAzW-Q99BBKuCzfetmP2Qvo"

creator:true

followerCount:1001422

\[160\]:

urn:"ACoAACpOUIkBXeJEQv1ROyEsSL4jyN0_iauDDOQ"

firstName:"Robert"

lastName:"Griffin III"

fullName:"Robert Griffin III"

publicIdentifier:"rgthree"

profilePictureURL:"https://media.licdn.com/dms/image/v2/D5603AQHnft4SWfv4Vw/profile-displayphoto-crop\_800\_800/B56ZfsEHH9IAAI-/0/1752012192111?e=1761782400&v=beta&t=DmD5ITjVLbPo5TEA6zneG9tUf2eD-14jx1v1j9zw4p8"

creator:true

followerCount:275099

\[161\]:

urn:"ACoAAAAGW4gBv7bRB1TmDXnXwehTA41M4M5qDcU"

firstName:"Kai-Fu"

lastName:"Lee"

fullName:"Kai-Fu Lee"

publicIdentifier:"kaifulee"

profilePictureURL:"https://media.licdn.com/dms/image/v2/C5103AQGTMzZtRLM8mQ/profile-displayphoto-shrink\_800\_800/profile-displayphoto-shrink\_800\_800/0/1539756652349?e=1761782400&v=beta&t=jdlnrpRYogKBYI8pjzRofvtqJLEgNInjn9lNWTzxrtY"

creator:true

followerCount:883498

\[162\]:

urn:"ACoAAAIyOWgBJsNreh6KLFZOVSCMwzs7KdlzLNQ"

firstName:"Malcolm"

lastName:"Turnbull"

fullName:"Malcolm Turnbull"

publicIdentifier:"malcolmturnbull"

profilePictureURL:"https://media.licdn.com/dms/image/v2/D5603AQEUWMzlDRjqjg/profile-displayphoto-shrink\_800\_800/profile-displayphoto-shrink\_800\_800/0/1697030113616?e=1761782400&v=beta&t=w1favQZEwkDNv5dp6S\_GR86GfaUh-JyM6YugKXPgLHU"

creator:true

followerCount:227298

\[163\]:

urn:"ACoAAAuu0qcBWYrfMX5VQ9pnN\_-Uf6BfneOaszs"

firstName:"Jo Ann"

lastName:"Jenkins"

fullName:"Jo Ann Jenkins"

publicIdentifier:"joannjenkins"

profilePictureURL:"https://media.licdn.com/dms/image/v2/C4D03AQEeDFZKRAAGhQ/profile-displayphoto-shrink\_800\_800/profile-displayphoto-shrink\_800\_800/0/1590676520565?e=1761782400&v=beta&t=l5qEtEmmrOsZUSDbyHyOH8uxR\_NYkQCDQ-EzmgWRy9U"

creator:true

followerCount:141935

\[164\]:

urn:"ACoAABs_W_0Brpe8LeZ8x2HdzU8XJgBTlh8\_-gg"

firstName:"Saira"

lastName:"Malik"

fullName:"Saira Malik"

publicIdentifier:"saira-malik-b65116109"

profilePictureURL:"https://media.licdn.com/dms/image/v2/D5603AQEq\_L9qFBlTKw/profile-displayphoto-shrink\_800\_800/profile-displayphoto-shrink\_800\_800/0/1680543115289?e=1761782400&v=beta&t=Za27b7eMltBYz7MvFALn69LoxjIt-ml8vCI6t\_xnKmU"

creator:true

followerCount:74609

\[165\]:

urn:"ACoAAB6aagcBP888CPp-vRvGl2oV2NrOWxkcc3M"

firstName:"Jeffrey"

lastName:"Katzenberg"

fullName:"Jeffrey Katzenberg"

publicIdentifier:"jeffrey-katzenberg-4b3b47123"

profilePictureURL:"https://media.licdn.com/dms/image/v2/C5603AQFa-JY93GzySg/profile-displayphoto-shrink\_800\_800/profile-displayphoto-shrink\_800\_800/0/1648764131899?e=1761782400&v=beta&t=kUMSGAv3XVtqd1fRzdNFxyAapgfbhNxtorUa1w3rM-I"

creator:true

followerCount:33348

\[166\]:

urn:"ACoAAAfwaUEB0ONThv46gMexVDy66mZm1C1azn0"

firstName:"Donna"

lastName:"Orender"

fullName:"Donna Orender"

publicIdentifier:"donnaorender"

profilePictureURL:"https://media.licdn.com/dms/image/v2/C4E03AQH-2ijgSyxU9w/profile-displayphoto-shrink\_800\_800/profile-displayphoto-shrink\_800\_800/0/1527188205765?e=1761782400&v=beta&t=WJjIsiVMlraabtQJA35VYo\_miMGDfXQQDo\_5\_8K2ZzQ"

creator:true

followerCount:10882

\[167\]:

urn:"ACoAAAEIqbQBlvOgUS0mIN8jT-SlpNuzX9AaDLE"

firstName:"Michael"

lastName:"Gervais"

fullName:"Michael Gervais"

publicIdentifier:"drmichaelgervais"

profilePictureURL:"https://media.licdn.com/dms/image/v2/D5603AQH1OzuTvoKqdw/profile-displayphoto-crop\_800\_800/B56ZfG5LqdHEAQ-/0/1751388568602?e=1761782400&v=beta&t=0jolwTKib-KKhJRJ7ef05JL2hU0kqvNs0b\_2zHJ96Zc"

creator:true

followerCount:76524

\[168\]:

urn:"ACoAAD1I64MBhTfVwtFOtPSqFW631dm3aHsME2A"

firstName:"Ash"

lastName:"Barty"

fullName:"Ash Barty"

publicIdentifier:"ash-barty"

profilePictureURL:"https://media.licdn.com/dms/image/v2/D4E03AQEvRlbsEmkYLA/profile-displayphoto-shrink\_800\_800/profile-displayphoto-shrink\_800\_800/0/1729509757173?e=1761782400&v=beta&t=Emcf4Qg1SXrhVV\_wf4EGmX2uI6zYtuLYHomx\_Q54j\_U"

creator:true

followerCount:110169

\[169\]:

urn:"ACoAAACfvEkBLQ1odvPdNDbrbBctE1kulGddsSI"

firstName:"Kristina"

lastName:"Hooper"

fullName:"Kristina Hooper"

publicIdentifier:"kristina-hooper-"

profilePictureURL:"https://media.licdn.com/dms/image/v2/D5603AQEGGqR-nOOZWQ/profile-displayphoto-shrink\_800\_800/profile-displayphoto-shrink\_800\_800/0/1689966579907?e=1761782400&v=beta&t=q63HAEOu8-Be8WdAyOebnRtvp54A3FiXb8i4wmYLfqQ"

creator:true

followerCount:157987

\[170\]:

urn:"ACoAAABFrWYBPWjH8YnQ_WntqnKmxCqlHh6jT6s"

firstName:"Carrie"

lastName:"Schwab-Pomerantz"

fullName:"Carrie Schwab-Pomerantz"

publicIdentifier:"carrieschwabpomerantz"

profilePictureURL:"https://media.licdn.com/dms/image/v2/D5603AQHrSsdjyI1BVw/profile-displayphoto-shrink\_800\_800/profile-displayphoto-shrink\_800\_800/0/1691527434631?e=1761782400&v=beta&t=sEhGj\_FZiHnv6qYuFQ5nld-LsQGm5cjF6kLLEvwec0E"

creator:true

followerCount:474458

\[171\]:

urn:"ACoAABRP0tMB_XPhseWJi7qHlfQFroVXgnkvImk"

firstName:"Somi"

lastName:"Arian"

fullName:"Somi Arian"

publicIdentifier:"somiarian"

profilePictureURL:"https://media.licdn.com/dms/image/v2/D5603AQF5wuYhMSH8EA/profile-displayphoto-crop\_800\_800/B56Zl2NFrCKMAI-/0/1758624767501?e=1761782400&v=beta&t=iEDxvlGoX17M0HOnhmcBQsHPFHO2-\_NbUIUC13Dak\_k"

creator:true

followerCount:86144

\[172\]:

urn:"ACoAAAAGVOsB1cVPoExB1V4KcRPRc5ZCDAIVAo4"

firstName:"Jocelyn"

lastName:"Mangan"

fullName:"Jocelyn Mangan"

publicIdentifier:"jocelynmangan"

profilePictureURL:"https://media.licdn.com/dms/image/v2/D5603AQGoy3g\_JTXR6A/profile-displayphoto-shrink\_800\_800/profile-displayphoto-shrink\_800\_800/0/1704480444171?e=1761782400&v=beta&t=992xE0CMZJxjE4IZCpAz\_JHYroXqgeMt5VE2ElUE9bk"

creator:false

followerCount:0

\[173\]:

urn:"ACoAABsD8gcBBL_FDx_mt6odFK54YAtaTNlb0Mk"

firstName:"Oprah"

lastName:"Winfrey"

fullName:"Oprah Winfrey"

publicIdentifier:"owinfrey"

profilePictureURL:"https://media.licdn.com/dms/image/v2/C5603AQFIGlMnMVBkMA/profile-displayphoto-shrink\_800\_800/profile-displayphoto-shrink\_800\_800/0/1517400053659?e=1761782400&v=beta&t=edKbTI9Bsyv5IFblx1hka-SnBQFqW\_nVCEo7hsARk\_k"

creator:false

followerCount:1329976

\[174\]:

urn:"ACoAAAFOIEABvorcKWuzqc2UEq2NqEIdbrlgMNc"

firstName:"Antonio"

lastName:"Grasso"

fullName:"Antonio Grasso"

publicIdentifier:"antgrasso"

profilePictureURL:"https://media.licdn.com/dms/image/v2/D4D03AQECWa\_Oi6US6A/profile-displayphoto-shrink\_800\_800/profile-displayphoto-shrink\_800\_800/0/1698399399307?e=1761782400&v=beta&t=yrgq-lme9mNqQ8lf8Ns8xgqh-0z6W4n\_\_u0xw1im4O0"

creator:true

followerCount:38670

\[175\]:

urn:"ACoAACrtVekBaM0WZR_a-ep1GRLOIBof8ZfS6vs"

firstName:"Sara"

lastName:"Blakely"

fullName:"Sara Blakely"

publicIdentifier:"sarablakely27"

profilePictureURL:"https://media.licdn.com/dms/image/v2/D5603AQFdkVX2hASUIg/profile-displayphoto-shrink\_800\_800/profile-displayphoto-shrink\_800\_800/0/1724156376228?e=1761782400&v=beta&t=X7qZ2FcwzQyf2FajEMXIKyJpsalh7f6CbSDPWn2N8Fw"

creator:true

followerCount:2313885

\[176\]:

urn:"ACoAAAFKYrUBRG416O57WxLFVw8Syh6o9Wz8jGQ"

firstName:"Andrew"

lastName:"MacAskill"

fullName:"Andrew MacAskill"

publicIdentifier:"jobsearchcoach"

profilePictureURL:"https://media.licdn.com/dms/image/v2/D4E03AQGRkGL3PbMMaQ/profile-displayphoto-shrink\_800\_800/profile-displayphoto-shrink\_800\_800/0/1708706084462?e=1761782400&v=beta&t=CGQBK0T3JqqzGM6szgRjM44LZ0atH96ohMNShumUQCg"

creator:true

followerCount:111729

\[177\]:

urn:"ACoAAACGC_8BWsHWisrF8Ay7NWxtRCVV2mLBRWU"

firstName:"Anneliese"

lastName:"Olson"

fullName:"Anneliese Olson"

publicIdentifier:"annelieseolson"

profilePictureURL:"https://media.licdn.com/dms/image/v2/C5603AQGx-GcR5W-pEQ/profile-displayphoto-shrink\_800\_800/profile-displayphoto-shrink\_800\_800/0/1644172340666?e=1761782400&v=beta&t=ilxvCVspp1xLjfXWArp-DbF2AWU23pNNwg46\_O0faaE"

creator:false

followerCount:0

\[178\]:

urn:"ACoAAAF1JqABieLGKVZ1LHvuyc5720GBNOdABdc"

firstName:"Laszlo"

lastName:"Bock"

fullName:"Laszlo Bock"

publicIdentifier:"laszlobock"

profilePictureURL:"https://media.licdn.com/dms/image/v2/D5603AQHokZJlpZ6USg/profile-displayphoto-shrink\_800\_800/B56ZPwdMnzGQAc-/0/1734906007002?e=1761782400&v=beta&t=cZRzfYeC\_J9BNEF34dpfAJVWX\_uAHewxS0BGpmZatuY"

creator:true

followerCount:1002146

\[179\]:

urn:"ACoAAAAi_ZQB2p7HySGWhzg0MuK3dIaJHTkxUOo"

firstName:"Brian"

lastName:"Solis"

fullName:"Brian Solis"

publicIdentifier:"briansolis"

profilePictureURL:"https://media.licdn.com/dms/image/v2/D5603AQG4xEXg0Km6cQ/profile-displayphoto-shrink\_800\_800/profile-displayphoto-shrink\_800\_800/0/1679341835368?e=1761782400&v=beta&t=9GyAa2qLmiVAi1G-KBxDIpXmyjzcFub9WpG6hYppW2c"

creator:true

followerCount:364949

\[180\]:

urn:"ACoAAAAAf9ABwJ6ytqHDwtMeoR2Rhb-1UPd8zvI"

firstName:"Loic"

lastName:"Le Meur"

fullName:"Loic Le Meur"

publicIdentifier:"loiclemeur"

profilePictureURL:"https://media.licdn.com/dms/image/v2/D4D03AQHqjqjJGeE4xQ/profile-displayphoto-shrink\_800\_800/profile-displayphoto-shrink\_800\_800/0/1718235256812?e=1761782400&v=beta&t=QHrQN3wvy10-FAPxf0-5abcvGcklwubaljmY6tqhlAo"

creator:true

followerCount:419338

\[181\]:

urn:"ACoAAC4YFqMBVZCaz7pZKi_Nd-9mDkmT-ccWpn8"

firstName:"Dr. Arthur"

lastName:"Brooks"

fullName:"Dr. Arthur Brooks"

publicIdentifier:"arthur-c-brooks"

profilePictureURL:"https://media.licdn.com/dms/image/v2/D5603AQGb72wxHhYiXQ/profile-displayphoto-crop\_800\_800/B56Zf5lxn\_HUAQ-/0/1752239119258?e=1761782400&v=beta&t=My-pkJWRi9agySprsIaCkPQqC8bTkhHB9tm3K7y-v4U"

creator:true

followerCount:74904

\[182\]:

urn:"ACoAAACsJR4BWJlhUjOZMmHu54vpp1Dvv0qCHQk"

firstName:"Michael"

lastName:"Fertik"

fullName:"Michael Fertik"

publicIdentifier:"mikefertik"

profilePictureURL:"https://media.licdn.com/dms/image/v2/C5603AQFz005a2-qvgw/profile-displayphoto-shrink\_800\_800/profile-displayphoto-shrink\_800\_800/0/1631549884407?e=1761782400&v=beta&t=FIqlmu-Tw0bKgpEU8R7ioWy7uWThezCssqibcpIBYGI"

creator:true

followerCount:129346

\[183\]:

urn:"ACoAAAFDkOQB-lVJLeyJf0jSemI8lXQh1RE5XYw"

firstName:"Dave"

lastName:"Ricks"

fullName:"Dave Ricks"

publicIdentifier:"davearicks"

profilePictureURL:"https://media.licdn.com/dms/image/v2/C5603AQFkhjqcLwascA/profile-displayphoto-shrink\_800\_800/profile-displayphoto-shrink\_800\_800/0/1516306721833?e=1761782400&v=beta&t=RekoD5AKzDCYpzak1mxClOKpC0EA9Ukp-UYQ6JFqN-8"

creator:true

followerCount:102108

\[184\]:

urn:"ACoAAAEDZrwB24pP0XqwBYbLXNd3Fxng-COV3qI"

firstName:"Jeff"

lastName:"Selingo"

fullName:"Jeff Selingo"

publicIdentifier:"jeffselingo"

profilePictureURL:"https://media.licdn.com/dms/image/v2/D4E03AQF4dBqn-6en0Q/profile-displayphoto-shrink\_800\_800/B4EZa9fxM9HMAg-/0/1746935944297?e=1761782400&v=beta&t=Jw4w6TTyWoCJVJYrZ99HxFoSNZ0OSEr5aJD39xeYg9U"

creator:true

followerCount:597256

\[185\]:

urn:"ACoAAAAFEZMBSEaOfaRDIdwyXcac-VxvcIez4e0"

firstName:"Christopher"

lastName:"Elliott"

fullName:"Christopher Elliott"

publicIdentifier:"christopherelliott"

profilePictureURL:"https://media.licdn.com/dms/image/v2/C4E03AQFylbfltWkUQQ/profile-displayphoto-shrink\_800\_800/profile-displayphoto-shrink\_800\_800/0/1659427961180?e=1761782400&v=beta&t=6md8gHWXRAEmtDJbjqm1QqWSev\_6yS3Nd1zKWOKZ4P8"

creator:true

followerCount:333810

\[186\]:

urn:"ACoAAAANhhYBVSObc8qDXhBr0e3MDEQcjI8UAfI"

firstName:"Tom"

lastName:"Bedecarré"

fullName:"Tom Bedecarré"

publicIdentifier:"bedecarre"

profilePictureURL:"https://media.licdn.com/dms/image/v2/C5603AQF0cZJjmWAJzw/profile-displayphoto-shrink\_400\_400/profile-displayphoto-shrink\_400\_400/0/1546382129396?e=1761782400&v=beta&t=DvB3UD6iR1iGL8W-7yUzBR19t1PdaG92OlYLJnsNsG4"

creator:false

followerCount:79715

\[187\]:

urn:"ACoAABQPtEABbQEtTZLU6ToK5mNsvzEYa3BtPSU"

firstName:"Rachael"

lastName:"Higgins"

fullName:"Rachael Higgins"

publicIdentifier:"rachael-higgins-becauseofmarketing"

profilePictureURL:"https://media.licdn.com/dms/image/v2/D4E03AQGdeDC5ZozGoQ/profile-displayphoto-shrink\_800\_800/profile-displayphoto-shrink\_800\_800/0/1718745375573?e=1761782400&v=beta&t=jEYTkU4QItu6HgXEhWsSliiBAOU\_Lp1vY8UkKM1YL2g"

creator:true

followerCount:108900

\[188\]:

urn:"ACoAAABWhfIBwUr0AOHFGxxJ6iwMIv_j-BqL4zA"

firstName:"Jonah"

lastName:"Berger"

fullName:"Jonah Berger"

publicIdentifier:"j1berger"

profilePictureURL:"https://media.licdn.com/dms/image/v2/C5103AQHaLd0edWPThA/profile-displayphoto-shrink\_400\_400/profile-displayphoto-shrink\_400\_400/0/1516362709442?e=1761782400&v=beta&t=\_z2neDp5PV7Fj-FFgnO7R2ze06xi25RP2x2AKVDfjBg"

creator:true

followerCount:221671

\[189\]:

urn:"ACoAAAFa9ggBrrsaw5MFpYeJA5EuiV89izxDht0"

firstName:"Dana P"

lastName:"Goldman"

fullName:"Dana P Goldman"

publicIdentifier:"danapgoldman"

profilePictureURL:"https://media.licdn.com/dms/image/v2/D5603AQH7TJJBW9R74Q/profile-displayphoto-shrink\_800\_800/profile-displayphoto-shrink\_800\_800/0/1695557107236?e=1761782400&v=beta&t=3amqaSEK6zNpxwNhm8nJb5Zxft91myECotclBH5iuq8"

creator:true

followerCount:67714

\[190\]:

urn:"ACoAABkbm-0Be4xxSTDslQoX9c9qcRoExoNAGWk"

firstName:"John"

lastName:"Kraski"

fullName:"John Kraski"

publicIdentifier:"johnkraski"

profilePictureURL:"https://media.licdn.com/dms/image/v2/D4E03AQGYvWuOgSVBBw/profile-displayphoto-shrink\_800\_800/B4EZRfrbJ0GcAg-/0/1736772006887?e=1761782400&v=beta&t=0UbcDdMvCiWivUtTZyz1qDzT7LeGQHBduAD6TIZdc5k"

creator:true

followerCount:111467

\[191\]:

urn:"ACoAAA8BYqEBCGLg_vT_ca6mMEqkpp9nVffJ3hc"

firstName:"Bill"

lastName:"Gates"

fullName:"Bill Gates"

publicIdentifier:"williamhgates"

profilePictureURL:"https://media.licdn.com/dms/image/v2/D5603AQF-RYZP55jmXA/profile-displayphoto-shrink\_800\_800/B56ZRi8g.aGsAc-/0/1736826818808?e=1761782400&v=beta&t=L7SgZIFi1sIUoihJVpoAZ41WC99zQrlPL-UICrhcQFM"

creator:true

followerCount:38840974

\[192\]:

urn:"ACoAABKAUYcBIkfl70_BdU6EEAVG-lqRWidSbjk"

firstName:"Chloe"

lastName:"Shih"

fullName:"Chloe Shih"

publicIdentifier:"chloe-shih"

profilePictureURL:"https://media.licdn.com/dms/image/v2/D5603AQHEzahByyg-jA/profile-displayphoto-shrink\_800\_800/profile-displayphoto-shrink\_800\_800/0/1728334413271?e=1761782400&v=beta&t=8PG0u1T85kpjewQqlWeV-lD5rKKbEqvM4T51zvbqDAM"

creator:true

followerCount:149214

\[193\]:

urn:"ACoAAA9bEmIB505jy23F60yunQazd05Ge2fR8D0"

firstName:"Jamie"

lastName:"Dimon"

fullName:"Jamie Dimon"

publicIdentifier:"jamiedimon"

profilePictureURL:"https://media.licdn.com/dms/image/v2/C4D03AQFvg6D5s1Y45Q/profile-displayphoto-shrink\_800\_800/profile-displayphoto-shrink\_800\_800/0/1589887698145?e=1761782400&v=beta&t=aNpEXwugM2Lsf\_HTmbv3jhWyh8P0yG\_\_auyavNxLhE8"

creator:false

followerCount:1623946

\[194\]:

urn:"ACoAAABGGoABtGGICKdFwALCrSipphlV7r54Mlo"

firstName:"Dan"

lastName:"Schawbel"

fullName:"Dan Schawbel"

publicIdentifier:"danschawbel"

profilePictureURL:"https://media.licdn.com/dms/image/v2/C4E03AQEpIjuzWOwFsA/profile-displayphoto-shrink\_400\_400/profile-displayphoto-shrink\_400\_400/0/1625185140075?e=1761782400&v=beta&t=cyp5kZnxuU4ZUJoiHMmaoKJr25Ef-78TjYqbNjnX4yY"

creator:true

followerCount:169642

\[195\]:

urn:"ACoAAADpMnwB8H7bqOP0EwWEwTYAc_5OgxoeXnQ"

firstName:"Melanie"

lastName:"Nakagawa"

fullName:"Melanie Nakagawa"

publicIdentifier:"melanie-nakagawa-2781505"

profilePictureURL:"https://media.licdn.com/dms/image/v2/C4E03AQGh5oRzAKwXIg/profile-displayphoto-shrink\_800\_800/profile-displayphoto-shrink\_800\_800/0/1517729191092?e=1761782400&v=beta&t=KxL8dPBTSw44DZfrptg1kqk2-WN1eo8bnratTKrm2Rw"

creator:true

followerCount:91625

\[196\]:

urn:"ACoAAAKtByABecW_l5mGGL1sn7BFlE14MHEpnAo"

firstName:"Ilham"

lastName:"Kadri"

fullName:"Ilham Kadri"

publicIdentifier:"ilham-kadri"

profilePictureURL:"https://media.licdn.com/dms/image/v2/D4E03AQHpIG-Kb0rOJQ/profile-displayphoto-shrink\_800\_800/profile-displayphoto-shrink\_800\_800/0/1708015825751?e=1761782400&v=beta&t=AautPkpXQmOQRz4pmaedK5nXsyPeDpQE58AlmanH8AU"

creator:true

followerCount:164587

\[197\]:

urn:"ACoAAAA0GPEBRubIVUIMjLUeDhkskoVUYEx8EV8"

firstName:"Whitney"

lastName:"Johnson"

fullName:"Whitney Johnson"

publicIdentifier:"whitneyjohnson"

profilePictureURL:"https://media.licdn.com/dms/image/v2/C4E03AQGQ6tSqGMRl\_g/profile-displayphoto-shrink\_800\_800/profile-displayphoto-shrink\_800\_800/0/1663341928721?e=1761782400&v=beta&t=oLYbQj5rDyA6GIzSGM7fQ4F9d2TEdPtMSxQ3-sGDNPM"

creator:true

followerCount:1680729

\[198\]:

urn:"ACoAAAAAQKUButMb1DQgEIs_H0rucUM5Wn-cFHk"

firstName:"David"

lastName:"Kirkpatrick"

fullName:"David Kirkpatrick"

publicIdentifier:"davidkirkpatrick"

profilePictureURL:"https://media.licdn.com/dms/image/v2/D4E03AQGx3b3L5H-m2Q/profile-displayphoto-shrink\_800\_800/profile-displayphoto-shrink\_800\_800/0/1674275508494?e=1761782400&v=beta&t=JsAb\_LxhefvTpYDH6Nl5T86txmLIAd6dDJ5eaUkhPwo"

creator:true

followerCount:118020

\[199\]:

urn:"ACoAAAAAa8YBj2X_mC6ovnZB6DUm5fmETE15UTQ"

firstName:"Kara"

lastName:"Swisher"

fullName:"Kara Swisher"

publicIdentifier:"kara-swisher-b7213"

profilePictureURL:"https://media.licdn.com/dms/image/v2/D4E03AQEsarhLstDp7g/profile-displayphoto-shrink\_800\_800/B4EZdmEZHRGcAc-/0/1749764117277?e=1761782400&v=beta&t=vvzY2aYg2TwIxIVSL1lGgmqEkahBJW5ccr3OXBPd8hA"

creator:false

followerCount:43515

\[200\]:

urn:"ACoAAAAIgnoBSQKYiNnYlNgVtqfqik5TW2AQkgQ"

firstName:"Santiago"

lastName:"Iniguez"

fullName:"Santiago Iniguez"

publicIdentifier:"siniguez"

profilePictureURL:"https://media.licdn.com/dms/image/v2/D4D03AQFhmboPVpPChA/profile-displayphoto-shrink\_800\_800/profile-displayphoto-shrink\_800\_800/0/1726079006539?e=1761782400&v=beta&t=7tOPku72tnuBlp\_qfHyZZ68ZCmnIyM97mga73IocR-c"

creator:true

followerCount:167839

\[201\]:

urn:"ACoAAAwawi0BML0iBiyQ4mGsqlvmgtH2drumUk0"

firstName:"Marcus"

lastName:"Samuelsson"

fullName:"Marcus Samuelsson"

publicIdentifier:"marcus-samuelsson"

profilePictureURL:"https://media.licdn.com/dms/image/v2/C5103AQEAOQaCMMlNsA/profile-displayphoto-shrink\_800\_800/profile-displayphoto-shrink\_800\_800/0/1517008309350?e=1761782400&v=beta&t=5XoAPBsdFutdczVHghXHl2WffIEs\_CjDF1hVpaf6N9I"

creator:true

followerCount:234994

\[202\]:

urn:"ACoAADT-ngQB8pH3ogrfn0H0xC7J8se7OQ-v32E"

firstName:"Odell "

lastName:"Beckham Jr."

fullName:"Odell Beckham Jr."

publicIdentifier:"odellbeckhamjr"

profilePictureURL:"https://media.licdn.com/dms/image/v2/C4E03AQEIV5UroBm3ZA/profile-displayphoto-shrink\_800\_800/profile-displayphoto-shrink\_800\_800/0/1656536090022?e=1761782400&v=beta&t=gNMp10cLF99\_C4lp8Q1nSgoQr2pTXHHRdfDfe0XSsak"

creator:true

followerCount:77332

\[203\]:

urn:"ACoAACS_iBMBJxlfR5Sfr08qVK6GXb5YQhoA1PM"

firstName:"Stephan"

lastName:"Winkelmann"

fullName:"Stephan Winkelmann"

publicIdentifier:"stephan-winkelmann"

profilePictureURL:"https://media.licdn.com/dms/image/v2/D4D03AQHayF2VJhVgpQ/profile-displayphoto-shrink\_800\_800/profile-displayphoto-shrink\_800\_800/0/1670856094971?e=1761782400&v=beta&t=Z0\_458qPz84ETsfxScESeFNG1Hd-SWufh9WT5BD-ob0"

creator:true

followerCount:462274

\[204\]:

urn:"ACoAAAACqqQB8mBKcO9obmhEiTrZBZ7SZulrRBc"

firstName:"Noam"

lastName:"Bardin"

fullName:"Noam Bardin"

publicIdentifier:"noambardin"

profilePictureURL:"https://media.licdn.com/dms/image/v2/D4D03AQGoZ6xuAmMlbA/profile-displayphoto-shrink\_800\_800/profile-displayphoto-shrink\_800\_800/0/1723473404829?e=1761782400&v=beta&t=xzv7CzoTLymNvU8A9UI2auDR\_ur-68ar-fe9onUEQM4"

creator:true

followerCount:241976

\[205\]:

urn:"ACoAAAGDUYQBPGc74zfKDMljpzdVjzAz_eBUjcI"

firstName:"Michael"

lastName:"Dell"

fullName:"Michael Dell"

publicIdentifier:"mdell"

profilePictureURL:"https://media.licdn.com/dms/image/v2/C4E03AQG5TPXqcvwX2g/profile-displayphoto-shrink\_400\_400/profile-displayphoto-shrink\_400\_400/0/1517725438397?e=1761782400&v=beta&t=Gli\_pcsIr3RkS\_zdZU3sdVODzwleJjxN38kaxnbOoD0"

creator:true

followerCount:1947821

\[206\]:

urn:"ACoAAA_En28B4WRRkaAohFSqrk0cFnG1lbdxLxI"

firstName:"Barbara"

lastName:"Corcoran"

fullName:"Barbara Corcoran"

publicIdentifier:"barbaracorcoran"

profilePictureURL:"https://media.licdn.com/dms/image/v2/C5603AQEw2sxjHFLW5w/profile-displayphoto-shrink\_800\_800/profile-displayphoto-shrink\_800\_800/0/1600788895731?e=1761782400&v=beta&t=FG5I\_sYzOeMzaH\_WBGtg89Ol7bVyQLYsBEmzzvJeV0U"

creator:true

followerCount:1631571

\[207\]:

urn:"ACoAAACtDwIByWt_xXqBeMaOHEystrCubW5LL00"

firstName:"Heather"

lastName:"Elias"

fullName:"Heather Elias"

publicIdentifier:"heatherelias"

profilePictureURL:"https://media.licdn.com/dms/image/v2/C4D03AQGLBZ4d3tQtbw/profile-displayphoto-shrink\_800\_800/profile-displayphoto-shrink\_800\_800/0/1645027116171?e=1761782400&v=beta&t=1\_BO9tKWluYoQxldODtojoYPTUImTarRHAAgx3iF9YQ"

creator:true

followerCount:742105

\[208\]:

urn:"ACoAAAJHadoBHwpl-PEAa6sa5QZys_FP0rmOBBY"

firstName:"Clark"

lastName:"Wolf"

fullName:"Clark Wolf"

publicIdentifier:"clark-wolf-5b697a10"

profilePictureURL:"https://media.licdn.com/dms/image/v2/C5603AQG35l7FafEnnA/profile-displayphoto-shrink\_400\_400/profile-displayphoto-shrink\_400\_400/0/1517736620317?e=1761782400&v=beta&t=30T\_u8xjfpi1tZdJWhHBLl6AW33piZF\_6ky-ElpKp6E"

creator:true

followerCount:383937

\[209\]:

urn:"ACoAAAHv9QwB1NxSH3DzVqCerF1D3TiXG6W2P2M"

firstName:"Mike"

lastName:"Bloomberg"

fullName:"Mike Bloomberg"

publicIdentifier:"mikebloomberg"

profilePictureURL:"https://media.licdn.com/dms/image/v2/C4D03AQGN\_p1IGqoAMA/profile-displayphoto-shrink\_800\_800/profile-displayphoto-shrink\_800\_800/0/1605619247378?e=1761782400&v=beta&t=079u2Fl4YXKQoDOFkY0G025eS9nLpHzLh\_qIUi\_fWoY"

creator:true

followerCount:2728291

\[210\]:

urn:"ACoAAAi3_EEBnUrgI0jraC2bBIOfgN0QETNY7C4"

firstName:"Liz"

lastName:"Fosslien"

fullName:"Liz Fosslien"

publicIdentifier:"liz-fosslien"

profilePictureURL:"https://media.licdn.com/dms/image/v2/D4D03AQEc7EVbvsuQrQ/profile-displayphoto-shrink\_800\_800/profile-displayphoto-shrink\_800\_800/0/1649195396417?e=1761782400&v=beta&t=V84OT0o\_wmPjVHx-xb-W2K\_Bmz7qOKqrjlHkGI4j8nw"

creator:true

followerCount:182070

\[211\]:

urn:"ACoAAA0Xh1YBjpBQvVGASNO9VqaxjhSzoSPE5a0"

firstName:"Patrick"

lastName:"Collison"

fullName:"Patrick Collison"

publicIdentifier:"patrickcollison"

profilePictureURL:"https://media.licdn.com/dms/image/v2/D5603AQF87s-bD1PjDw/profile-displayphoto-shrink\_400\_400/profile-displayphoto-shrink\_400\_400/0/1639336707466?e=1761782400&v=beta&t=SWsUa\_RcA5xb\_eNpA1EewFju07oxkJOHjXd8FYIgBLg"

creator:false

followerCount:36890

\[212\]:

urn:"ACoAAFjWuM4B3W_0kjPHh3bqdq4oWGG_8EvAYQ4"

firstName:"Harvey"

lastName:"Schwartz"

fullName:"Harvey Schwartz"

publicIdentifier:"harvey-schwartz"

profilePictureURL:"https://media.licdn.com/dms/image/v2/D4D03AQFdU6OiOfilBQ/profile-displayphoto-shrink\_800\_800/B4DZWpkimGHkAc-/0/1742306683806?e=1761782400&v=beta&t=fkqBr1---FHN75ne\_DwU3CRaQant1ASeLX6zHH0MrV8"

creator:false

followerCount:16186

\[213\]:

urn:"ACoAAAAXP8UB4_GzJNUYcEDdAM6IBQNKZYe-WOU"

firstName:"Andy"

lastName:"Jassy"

fullName:"Andy Jassy"

publicIdentifier:"andy-jassy-8b1615"

profilePictureURL:"https://media.licdn.com/dms/image/v2/C5603AQGSl0b1ZCh2sQ/profile-displayphoto-shrink\_800\_800/profile-displayphoto-shrink\_800\_800/0/1631724420241?e=1761782400&v=beta&t=6JEMP-GdyNesypxc3CCsIDGb6TWhdej78STpXASrn8Y"

creator:true

followerCount:974446

\[214\]:

urn:"ACoAAAARQ5QBNr_sthvLd4THpuV910cPaooFF7Y"

firstName:"Donna"

lastName:"Morris"

fullName:"Donna Morris"

publicIdentifier:"donnamorris2"

profilePictureURL:"https://media.licdn.com/dms/image/v2/D4D03AQGm0n9WszhPaw/profile-displayphoto-shrink\_800\_800/profile-displayphoto-shrink\_800\_800/0/1698432872869?e=1761782400&v=beta&t=LLVsfDD9\_DrMW1UqHdTfkKK\_epOXBTAC-kBGuT\_r1Ok"

creator:true

followerCount:102929

\[215\]:

urn:"ACoAAAl1PFMBA_2rzdwM_cJNkNlBbhS8wapXVN0"

firstName:"Dirk"

lastName:"Hahn"

fullName:"Dirk Hahn"

publicIdentifier:"dirkhahnhays"

profilePictureURL:"https://media.licdn.com/dms/image/v2/D4E03AQE6lwnyFdbZgA/profile-displayphoto-shrink\_800\_800/profile-displayphoto-shrink\_800\_800/0/1692885110873?e=1761782400&v=beta&t=bFTeF\_1XuFofXjHvvMJbzCQjI0Xf5l627OAHwTD6imA"

creator:true

followerCount:24149

\[216\]:

urn:"ACoAAAAB8uIBkRPa54_fWhQc2C5o6xZidVirNRQ"

firstName:"Joel"

lastName:"Makower"

fullName:"Joel Makower"

publicIdentifier:"makower"

profilePictureURL:"https://media.licdn.com/dms/image/v2/D5603AQGz2K\_vzr40Rg/profile-displayphoto-shrink\_800\_800/B56ZQaG6ayGsAc-/0/1735604807560?e=1761782400&v=beta&t=wzcWyR6-gykyxDuaBsCOz0lcEFs3-TGV9MMkYsODwvA"

creator:true

followerCount:121895

\[217\]:

urn:"ACoAAAJubY8BqlwKdD7KDhcqWBRE_rVNVHbiG3c"

firstName:"Rajiv"

lastName:"Kumar"

fullName:"Rajiv Kumar"

publicIdentifier:"rajivk-ms"

profilePictureURL:"https://media.licdn.com/dms/image/v2/C4E03AQE8GP8oG1UECg/profile-displayphoto-shrink\_400\_400/profile-displayphoto-shrink\_400\_400/0/1568013879724?e=1761782400&v=beta&t=D9idJFUwS5dy8u-KQPAxcFW3b\_Lo72pHD6oidekHq5Y"

creator:true

followerCount:71283

\[218\]:

urn:"ACoAAAsrfQkBv0ZQPIqbrJI8Xnuoe7DfzGsoQIc"

firstName:"John"

lastName:"Donahoe"

fullName:"John Donahoe"

publicIdentifier:"john-donahoe-8b591452"

profilePictureURL:"https://media.licdn.com/dms/image/v2/C5603AQGDFVfh7BnzgQ/profile-displayphoto-shrink\_800\_800/profile-displayphoto-shrink\_800\_800/0/1579277472331?e=1761782400&v=beta&t=cailNlnCe-YNuzW9Rv5YAixFEJ8OYbugVPsZ4WcVs0U"

creator:false

followerCount:289109

\[219\]:

urn:"ACoAAAob47kBe5sgpgkWp2niMiiDT8CCCnp2HyU"

firstName:"Gavin"

lastName:"Newsom"

fullName:"Gavin Newsom"

publicIdentifier:"gavinnewsom"

profilePictureURL:"https://media.licdn.com/dms/image/v2/C5603AQFfsDfb7K5ewA/profile-displayphoto-shrink\_800\_800/profile-displayphoto-shrink\_800\_800/0/1588964902978?e=1761782400&v=beta&t=TtoEwwb\_X0yfZvUUuiEg\_QbdrW9We9dgQ8euN3CuYog"

creator:true

followerCount:93183

\[220\]:

urn:"ACoAAABSh6cBCDn4y6a_PZ32zhnrEhI5Y5kpD4g"

firstName:"Nicholas"

lastName:"Carlson"

fullName:"Nicholas Carlson"

publicIdentifier:"nicholasmcarlson"

profilePictureURL:"https://media.licdn.com/dms/image/v2/D4E03AQFQLSHP6sI8Xw/profile-displayphoto-shrink\_800\_800/profile-displayphoto-shrink\_800\_800/0/1730405089410?e=1761782400&v=beta&t=VS-Fgpe9A2-gDItd4SbME9C-cpHQ8UWBsAV\_phxwZWc"

creator:true

followerCount:43020

\[221\]:

urn:"ACoAABTEMg8Bn2yqo8poXI0HO9QpS0X6-M3Gxuo"

firstName:"Judy"

lastName:"Smith"

fullName:"Judy Smith"

publicIdentifier:"judyasmith"

profilePictureURL:"https://media.licdn.com/dms/image/v2/D5603AQFPLx64lwJmUQ/profile-displayphoto-shrink\_800\_800/B56ZSyQJcqHEAc-/0/1738157365375?e=1761782400&v=beta&t=6212wv\_fjfmo6D5ovCF8D\_cwwGgdsj1UlXwL0-9Ejuw"

creator:false

followerCount:80736

\[222\]:

urn:"ACoAABHDi_ABodsadw80SNE1ACE4Iz8gH3tAbzQ"

firstName:"Tory"

lastName:"Burch"

fullName:"Tory Burch"

publicIdentifier:"toryburch"

profilePictureURL:"https://media.licdn.com/dms/image/v2/C4D03AQFFOKnwJf0png/profile-displayphoto-shrink\_400\_400/profile-displayphoto-shrink\_400\_400/0/1613684596697?e=1761782400&v=beta&t=1tgSr9UYDsgBOQUwgwHu0nGpFwsvFSfMyCAaBY2emuA"

creator:true

followerCount:182880

\[223\]:

urn:"ACoAAAAAB6MBzV2ncd9FdZwASjTdhJp4itw-sqk"

firstName:"Rufus"

lastName:"Griscom"

fullName:"Rufus Griscom"

publicIdentifier:"rufus-griscom-16b1"

profilePictureURL:"https://media.licdn.com/dms/image/v2/C4D03AQFfsBJNoJqycw/profile-displayphoto-shrink\_800\_800/profile-displayphoto-shrink\_800\_800/0/1645617018791?e=1761782400&v=beta&t=FFG696KRod69ZwbEo41MpbNn0urPLC4oQLxWFDnnQJU"

creator:true

followerCount:15794

\[224\]:

urn:"ACoAAAHzAOYBsvHOzlpzgjCNIS8kMTek1itMPrk"

firstName:"Jim Yong"

lastName:"Kim"

fullName:"Jim Yong Kim"

publicIdentifier:"jimyongkim"

profilePictureURL:"https://media.licdn.com/dms/image/v2/C4D03AQFMq2U7AXrXyw/profile-displayphoto-shrink\_400\_400/profile-displayphoto-shrink\_400\_400/0/1548953679617?e=1761782400&v=beta&t=0iu87CpYE\_uzFaVDVtt7cU75tOUI1yhnEGcDYuFZlbI"

creator:true

followerCount:1946183

\[225\]:

urn:"ACoAAAAJUtgBMhLeVBdN67dVWi1p1oY2MUuy2nQ"

firstName:"Dave"

lastName:"Kline"

fullName:"Dave Kline"

publicIdentifier:"davidkline"

profilePictureURL:"https://media.licdn.com/dms/image/v2/D4E03AQEnXQz4gRZN8Q/profile-displayphoto-shrink\_800\_800/profile-displayphoto-shrink\_800\_800/0/1671283722082?e=1761782400&v=beta&t=e0WU6p\_3j1eVIgtIHBW9RwntWciDrm5fgAJj0o32m78"

creator:true

followerCount:145977

\[226\]:

urn:"ACoAAAFsK4wB1Ca6A61TF7ecn4v_csdFEYFx5ts"

firstName:"Jeremy"

lastName:"Zimmer"

fullName:"Jeremy Zimmer"

publicIdentifier:"zimmerjeremy"

profilePictureURL:""

creator:true

followerCount:13379

\[227\]:

urn:"ACoAAACdlxABjU5S5BXZoEThBko-HdXidpl42zE"

firstName:"Scott"

lastName:"Galloway"

fullName:"Scott Galloway"

publicIdentifier:"profgalloway"

profilePictureURL:"https://media.licdn.com/dms/image/v2/C4E03AQFDCAzTECuIiQ/profile-displayphoto-shrink\_800\_800/profile-displayphoto-shrink\_800\_800/0/1614739906857?e=1761782400&v=beta&t=SHtiCAeY-b5XnZMuKB2Q1UVHTNiS0jMQ8QRuzUVPF-E"

creator:true

followerCount:829217

\[228\]:

urn:"ACoAADfVU-kBMnbJZ_X9pujW_IzD9yquChtfHgI"

firstName:"Emma"

lastName:"Walmsley "

fullName:"Emma Walmsley "

publicIdentifier:"emmawalmsleygsk"

profilePictureURL:"https://media.licdn.com/dms/image/v2/C4E03AQH8EeXL9R\_LHQ/profile-displayphoto-shrink\_800\_800/profile-displayphoto-shrink\_800\_800/0/1654757044193?e=1761782400&v=beta&t=3916tfoh6yVSUbFhYZz6QiBOt2mdW9oST8GOYkq75gQ"

creator:true

followerCount:193843

\[229\]:

urn:"ACoAAA57dswBv8iAzHzwQ-n4chcNKQCvrW2y02E"

firstName:"Laxman"

lastName:"Narasimhan"

fullName:"Laxman Narasimhan"

publicIdentifier:"laxman-narasimhan"

profilePictureURL:"https://media.licdn.com/dms/image/v2/D5603AQHPf6JilPbtxA/profile-displayphoto-shrink\_800\_800/B56ZZ8nMbfGQAc-/0/1745847372185?e=1761782400&v=beta&t=m\_MMethuzDRIvTziLXU-scUu1D60YnZlADM\_j76Rz88"

creator:true

followerCount:157117

\[230\]:

urn:"ACoAABMznFkB_XPgkYHnUl33kIHTWt1DtMAV6Pg"

firstName:"Jensen"

lastName:"Huang"

fullName:"Jensen Huang"

publicIdentifier:"jenhsunhuang"

profilePictureURL:"https://media.licdn.com/dms/image/v2/D5603AQHOzNxbdK5hrg/profile-displayphoto-shrink\_800\_800/profile-displayphoto-shrink\_800\_800/0/1724130099627?e=1761782400&v=beta&t=iE6aYqNMqGZ2qx6BmEdUk0Kf74LVv-B-zGhuMfkjsu0"

creator:false

followerCount:463658

\[231\]:

urn:"ACoAAADfT54BJLzUu93X7dY_MqjEMsysix6TG9E"

firstName:"Jim"

lastName:"Clifton"

fullName:"Jim Clifton"

publicIdentifier:"jimcliftongallup"

profilePictureURL:"https://media.licdn.com/dms/image/v2/C4E03AQGDllUhNuJczA/profile-displayphoto-shrink\_800\_800/profile-displayphoto-shrink\_800\_800/0/1542225957412?e=1761782400&v=beta&t=pxlwSAk8TY17u9FOkrN3RZKRsvh-7o7bJJS2daYXWEw"

creator:false

followerCount:222010

\[232\]:

urn:"ACoAABLQJ6kBfQtnWINP7p_pCyH0bJDuAy2BJIg"

firstName:"Justin "Mr. Fascinate""

lastName:"Shaifer"

fullName:"Justin "Mr. Fascinate" Shaifer"

publicIdentifier:"jshaifer"

profilePictureURL:"https://media.licdn.com/dms/image/v2/D5603AQEG4gTlC0kuUA/profile-displayphoto-shrink\_800\_800/profile-displayphoto-shrink\_800\_800/0/1719016737584?e=1761782400&v=beta&t=g87H2V\_nUXMo6U8AjaqKYcV\_dyXa5NnGbABwpA7sFdM"

creator:true

followerCount:55604

\[233\]:

urn:"ACoAAAxqHaUBEa6zzXN--gv-wd8ih0vevPvr9eU"

firstName:"Sebastian"

lastName:"Raschka, PhD"

fullName:"Sebastian Raschka, PhD"

publicIdentifier:"sebastianraschka"

profilePictureURL:"https://media.licdn.com/dms/image/v2/C4E03AQHVyH-IfD1KbQ/profile-displayphoto-shrink\_800\_800/profile-displayphoto-shrink\_800\_800/0/1629877234109?e=1761782400&v=beta&t=NuOfTm2zY19sQwom3k1sDeuCUfR89IuH3k6\_Xhseivw"

creator:true

followerCount:193518

\[234\]:

urn:"ACoAACXw2xoBe80ME2Nu0z05iS8y25fkqbtIkGU"

firstName:"Dan"

lastName:"Goldin"

fullName:"Dan Goldin"

publicIdentifier:"dansgoldin"

profilePictureURL:"https://media.licdn.com/dms/image/v2/D5603AQEfObtN7e6XnA/profile-displayphoto-crop\_800\_800/B56Zj7k851HUAU-/0/1756567432849?e=1761782400&v=beta&t=FGXdfzDkNgb6lzBAPjD8MD\_uZpNcMpO9y9q3IPHterc"

creator:true

followerCount:114100

\[235\]:

urn:"ACoAAAB_eKABPFlEFflAfi4Wj7htdt3_bYFPWkQ"

firstName:"Greg"

lastName:"McKeown"

fullName:"Greg McKeown"

publicIdentifier:"gregmckeown"

profilePictureURL:"https://media.licdn.com/dms/image/v2/D5603AQHx\_hCVsyya\_Q/profile-displayphoto-shrink\_800\_800/profile-displayphoto-shrink\_800\_800/0/1694454119626?e=1761782400&v=beta&t=ql04Z66zPahxjxLD927GYQDjhcJBg8AX9\_0S078KG6I"

creator:true

followerCount:478667

\[236\]:

urn:"ACoAADvqvpUBQNmOpFV4gGBY_Hy7rDSfifRDdxw"

firstName:""

lastName:""

fullName:" "

publicIdentifier:""

profilePictureURL:""

creator:true

followerCount:0

\[237\]:

urn:"ACoAAAAGUakBGLMO02LmS5BwXexrsKODQQpx2qI"

firstName:"Ethan"

lastName:"Mollick"

fullName:"Ethan Mollick"

publicIdentifier:"emollick"

profilePictureURL:"https://media.licdn.com/dms/image/v2/D5603AQGvhhCjW5El4Q/profile-displayphoto-shrink\_800\_800/profile-displayphoto-shrink\_800\_800/0/1701211615166?e=1761782400&v=beta&t=E3tQII5odmYPb3f\_55J3Qw8fzkEkpwwprcJZrJNPg6Q"

creator:true

followerCount:325671

\[238\]:

urn:"ACoAAAADJvQBr6--Me3C1CVvrLJeBcd2hUNQpyA"

firstName:"Gijsbertus J.J."

lastName:"van Wulfen"

fullName:"Gijsbertus J.J. van Wulfen"

publicIdentifier:"gijsvanwulfen"

profilePictureURL:"https://media.licdn.com/dms/image/v2/D4D03AQGSshY5MVCxEg/profile-displayphoto-shrink\_800\_800/profile-displayphoto-shrink\_800\_800/0/1712396844013?e=1761782400&v=beta&t=LtyVOhfxXpAyliXgp0klR8fOjnQCa8S6EUoW4cOjRJs"

creator:true

followerCount:310631

\[239\]:

urn:"ACoAAAbbdW8Bo_YA-1ahwIWqmQZLAHdYYoQ7uvQ"

firstName:"Patrick"

lastName:"Mouratoglou"

fullName:"Patrick Mouratoglou"

publicIdentifier:"patrickmouratoglou"

profilePictureURL:"https://media.licdn.com/dms/image/v2/D4E03AQEAA5Sh2NC7Yw/profile-displayphoto-shrink\_800\_800/profile-displayphoto-shrink\_800\_800/0/1678980513913?e=1761782400&v=beta&t=8R4aQgAO9L7bmNHyyIsBqdVoNgensf65IHXkL89PJk0"

creator:true

followerCount:54385

\[240\]:

urn:"ACoAAACS5VIBuHVzBBxlIo7RZ9LwQFU1f60p_UQ"

firstName:"Harley"

lastName:"Finkelstein"

fullName:"Harley Finkelstein"

publicIdentifier:"harleyf"

profilePictureURL:"https://media.licdn.com/dms/image/v2/D4E03AQGW31Ku4QNBDA/profile-displayphoto-shrink\_800\_800/profile-displayphoto-shrink\_800\_800/0/1729782814940?e=1761782400&v=beta&t=6YHm\_96PYwjuQBW\_SPX6VcvKpVaIvfOOAgAoM6sLrjU"

creator:true

followerCount:123368

\[241\]:

urn:"ACoAACP3Z8sBD-VB2ez3ArHe2-9lHoPwTaCGV1c"

firstName:"Melinda"

lastName:"French Gates"

fullName:"Melinda French Gates"

publicIdentifier:"melindagates"

profilePictureURL:"https://media.licdn.com/dms/image/v2/D5603AQEnhirBBhb5kg/profile-displayphoto-shrink\_800\_800/B56ZSvzPngHQAk-/0/1738116234633?e=1761782400&v=beta&t=2kB-QV5ZHc-oRqYOAyGmifyVrhAnwBZKShwmI9z2UEU"

creator:true

followerCount:6671043

\[242\]:

urn:"ACoAAACberMBBrfM60spMCsot8uIreEK1jhC8eU"

firstName:"Dan"

lastName:"Rosensweig"

fullName:"Dan Rosensweig"

publicIdentifier:"danielrosensweig"

profilePictureURL:"https://media.licdn.com/dms/image/v2/C4E03AQEW4N8wWDMQAQ/profile-displayphoto-shrink\_200\_200/profile-displayphoto-shrink\_200\_200/0/1516306198523?e=1761782400&v=beta&t=7yiTX1pHhVZE2raljK78UP9hRgdT7KwWu4VOSiBKqkg"

creator:true

followerCount:115500

\[243\]:

urn:"ACoAACOznKMBqEagyMhWl_x2Ap9LEntBXY9fQGE"

firstName:"Baron"

lastName:"Davis"

fullName:"Baron Davis"

publicIdentifier:"barondavis"

profilePictureURL:"https://media.licdn.com/dms/image/v2/D5603AQGJ7WWRecaUjg/profile-displayphoto-shrink\_800\_800/profile-displayphoto-shrink\_800\_800/0/1714800074627?e=1761782400&v=beta&t=qAZzeZCrvnAIWv5HVGq8b4ZjJ4RSmHaf6\_RCi2k7GeI"

creator:true

followerCount:41121

\[244\]:

urn:"ACoAABpdKpMBALy5IhlPG7snuwgk0hCJy4K1xcg"

firstName:"Zak"

lastName:"Brown"

fullName:"Zak Brown"

publicIdentifier:"zak-brown-46b168104"

profilePictureURL:"https://media.licdn.com/dms/image/v2/D4E03AQF8QuW6fv7Upw/profile-displayphoto-shrink\_800\_800/B4EZYBM5FeGgAc-/0/1743776881132?e=1761782400&v=beta&t=dJuL-xrTsrTT340L3MszdT4qQpYzIiW8kjsU5YpHHxc"

creator:true

followerCount:452374

\[245\]:

urn:"ACoAAAWAYHIB3Co1-C9JaYk2HdwxlCUklfHIm5U"

firstName:"Candace"

lastName:"Nelson"

fullName:"Candace Nelson"

publicIdentifier:"candacenelson9"

profilePictureURL:"https://media.licdn.com/dms/image/v2/D5603AQHFR8\_KWeWwnQ/profile-displayphoto-shrink\_800\_800/B56ZXYtwmpGUAg-/0/1743097630558?e=1761782400&v=beta&t=psFQbJ570LQbFHgLMML8XyMm8NiBUKVKsn8eDtNVd-k"

creator:true

followerCount:21586

\[246\]:

urn:"ACoAAAGa9twBjNzZhvZFbwyGM1MPaoFkPXVuY1I"

firstName:"Tom"

lastName:"Popomaronis"

fullName:"Tom Popomaronis"

publicIdentifier:"tpopomaronis"

profilePictureURL:"https://media.licdn.com/dms/image/v2/D5603AQF2i-YGJte9Zg/profile-displayphoto-shrink\_800\_800/profile-displayphoto-shrink\_800\_800/0/1727996504150?e=1761782400&v=beta&t=nye7SV\_6uzNqKKXjGT2wt7PgzA6PX7PGFJ2lb3DmyUw"

creator:true

followerCount:29241

\[247\]:

urn:"ACoAAACoYQQBUPPW\_-0c_NCIqsRNDeo5xewco7g"

firstName:"Tom"

lastName:"Hood, CPA,CGMA,CITP"

fullName:"Tom Hood, CPA,CGMA,CITP"

publicIdentifier:"tomhood"

profilePictureURL:"https://media.licdn.com/dms/image/v2/C4E03AQF1D6jWMmGmow/profile-displayphoto-shrink\_800\_800/profile-displayphoto-shrink\_800\_800/0/1625081987045?e=1761782400&v=beta&t=QBHL2VLxeQXK2XSI7aX44dWWSnk-k9QVDwBogAvqW7Q"

creator:true

followerCount:700464

\[248\]:

urn:"ACoAAAABVV8B3z32txFuULj_UY1VgRzh14csq9U"

firstName:"Yuval"

lastName:"Atsmon"

fullName:"Yuval Atsmon"

publicIdentifier:"yuvalatsmon"

profilePictureURL:"https://media.licdn.com/dms/image/v2/C4E03AQFgaYCvi3R5eQ/profile-displayphoto-shrink\_400\_400/profile-displayphoto-shrink\_400\_400/0/1516166522260?e=1761782400&v=beta&t=skaZ-sg-T37WmbUaqwxp0VNbPgqAyveByAyf4gjKyQE"

creator:true

followerCount:103868

\[249\]:

urn:"ACoAAA41V-MB6KftbVSIJNFmHVaJ4aMMQ67pp8Y"

firstName:"Vivian"

lastName:"Tu"

fullName:"Vivian Tu"

publicIdentifier:"viviantu-yourrichbff"

profilePictureURL:"https://media.licdn.com/dms/image/v2/D5603AQGya5K-ghNvVg/profile-displayphoto-shrink\_800\_800/profile-displayphoto-shrink\_800\_800/0/1718257627285?e=1761782400&v=beta&t=1MT7xlh29WD-kAdFIR40G1MC-gfCWislLeekRSHr3Co"

creator:true

followerCount:70317

\[250\]:

urn:"ACoAAAB3MbsBLEBkdHGHLlzbYSMFSLGkg-CBWDo"

firstName:"Yasi"

lastName:"Baiani"

fullName:"Yasi Baiani"

publicIdentifier:"yasibaiani"

profilePictureURL:"https://media.licdn.com/dms/image/v2/D5603AQGO8zkLcP9KTQ/profile-displayphoto-shrink\_800\_800/profile-displayphoto-shrink\_800\_800/0/1710173733771?e=1761782400&v=beta&t=K\_h7eq38LHX2jx14jyH3Y-IzAES8Gx239b2MvGyP9cI"

creator:true

followerCount:486474

\[251\]:

urn:"ACoAADI9Dg8BPkAIq_PPJpEJp6W3U1ao0Tzfc9o"

firstName:"Elliott"

lastName:"Hill"

fullName:"Elliott Hill"

publicIdentifier:"elliotthillnike"

profilePictureURL:"https://media.licdn.com/dms/image/v2/D5603AQHBthOxie-osA/profile-displayphoto-shrink\_800\_800/profile-displayphoto-shrink\_800\_800/0/1726778380574?e=1761782400&v=beta&t=sgj4JxoG7BnLf2lJNtERb6utr0M\_yTJFH05k9fhnZAM"

creator:false

followerCount:149566

\[252\]:

urn:"ACoAAABr4nsBKu5ZtKWQTU3Ybg9POUUVN8u74MA"

firstName:"Nicholas"

lastName:"Thompson"

fullName:"Nicholas Thompson"

publicIdentifier:"nicholasxthompson"

profilePictureURL:"https://media.licdn.com/dms/image/v2/C4D03AQFLgC7rhIDT0g/profile-displayphoto-shrink\_400\_400/profile-displayphoto-shrink\_400\_400/0/1588374790345?e=1761782400&v=beta&t=bYAuUxJW4qH26-bdzSOhpTIuF8BM6cax8FUby-hvcv4"

creator:true

followerCount:1611696

\[253\]:

urn:"ACoAAAAOo3EBvCq8XhGFVG-\_9KVCJYmaf26M_9g"

firstName:"Morra"

lastName:"Aarons-Mele"

fullName:"Morra Aarons-Mele"

publicIdentifier:"morraaaronsmele"

profilePictureURL:"https://media.licdn.com/dms/image/v2/D4E03AQH1Gr3f\_7UONQ/profile-displayphoto-shrink\_800\_800/profile-displayphoto-shrink\_800\_800/0/1665940618265?e=1761782400&v=beta&t=B6SBnGACC0NZKiaFNdX7GXMWGIJTixbqwHZSZLcw8w4"

creator:true

followerCount:38922

\[254\]:

urn:"ACoAABGuupoBoNGEFD0Bhy00ZTaPCNJwetsCKZw"

firstName:"Frank Michael"

lastName:"Smith"

fullName:"Frank Michael Smith"

publicIdentifier:"frank27"

profilePictureURL:"https://media.licdn.com/dms/image/v2/D4E03AQHVVe9LgYD9zA/profile-displayphoto-shrink\_800\_800/profile-displayphoto-shrink\_800\_800/0/1671209221269?e=1761782400&v=beta&t=-G1IlUZ8eqIJmFQu7K1eURW1iiTCpJkEdTUB2eUWUP4"

creator:true

followerCount:8059

\[255\]:

urn:"ACoAAEFjOtYBUGJZTsmoCgLUzP4rX6o8mQVmJkE"

firstName:"António"

lastName:"Guterres"

fullName:"António Guterres"

publicIdentifier:"antonio-guterres"

profilePictureURL:"https://media.licdn.com/dms/image/v2/D4E03AQFlOM0cj6QpcQ/profile-displayphoto-shrink\_800\_800/profile-displayphoto-shrink\_800\_800/0/1678820023589?e=1761782400&v=beta&t=sujgoM62opDbablW\_S2Rl7EPXjQ2xl\_LpcU2clRofN8"

creator:true

followerCount:994996

\[256\]:

urn:"ACoAAAs1zzMBG5b9dRWE1AdHWmSD5U3oMOVtPSg"

firstName:"Rebecca"

lastName:"Jarvis"

fullName:"Rebecca Jarvis"

publicIdentifier:"rebecca-jarvis-217ba052"

profilePictureURL:"https://media.licdn.com/dms/image/v2/C5103AQFNp3pWDA2lAA/profile-displayphoto-shrink\_800\_800/profile-displayphoto-shrink\_800\_800/0/1516642218091?e=1761782400&v=beta&t=tR63cHSHDmh2kwTYofoDwtv\_\_7OZSlqGCk9Azm0Bd7E"

creator:true

followerCount:26148

\[257\]:

urn:"ACoAAEP9QIkB_SM4xoMxRT9N9qLCOJMgTDXRubA"

firstName:"HH Sheikh Mohamed "

lastName:"bin Zayed Al Nahyan"

fullName:"HH Sheikh Mohamed bin Zayed Al Nahyan"

publicIdentifier:"hh-sheikh-mohamed-bin-zayed-al-nahyan"

profilePictureURL:"https://media.licdn.com/dms/image/v2/D4D03AQGIIjgoUMA3Eg/profile-displayphoto-shrink\_800\_800/profile-displayphoto-shrink\_800\_800/0/1685948502053?e=1761782400&v=beta&t=eOGMWGukIAoPU04ODXHY3qv1M3CwuFq\_BBWGe8TLwVk"

creator:false

followerCount:890926

\[258\]:

urn:"ACoAAEcbPiAB_AFFnKH4yX_vDIGsAv2OrF0oPg8"

firstName:"Lewis"

lastName:"Hamilton"

fullName:"Lewis Hamilton"

publicIdentifier:"sirlewishamilton"

profilePictureURL:"https://media.licdn.com/dms/image/v2/D4D03AQH4Pi-e\_nakJQ/profile-displayphoto-shrink\_800\_800/profile-displayphoto-shrink\_800\_800/0/1695859013283?e=1761782400&v=beta&t=N69JNqQvFVX61DrKFaK25Z9s4bfibvysT3E6qLy4aLA"

creator:true

followerCount:466641

\[259\]:

urn:"ACoAAB-xjv8BVzjsMrBtCyUsVGW1m5DzbPYor34"

firstName:"Hannah"

lastName:"Williams"

fullName:"Hannah Williams"

publicIdentifier:"hannahawilliams"

profilePictureURL:"https://media.licdn.com/dms/image/v2/D5603AQHC7H1STvCQTQ/profile-displayphoto-shrink\_800\_800/profile-displayphoto-shrink\_800\_800/0/1689878380226?e=1761782400&v=beta&t=8simSq0CclddtUWpQiQAthlzGs0lAhHFSkwX9AzpY9E"

creator:true

followerCount:29265

\[260\]:

urn:"ACoAABwKLGsBbKSl38JNm_UeJo8PIjNKGi7OPW0"

firstName:"Mellody"

lastName:"Hobson"

fullName:"Mellody Hobson"

publicIdentifier:"mellodyhobson"

profilePictureURL:"https://media.licdn.com/dms/image/v2/C5603AQEgXoq9usHbQg/profile-displayphoto-shrink\_400\_400/profile-displayphoto-shrink\_400\_400/0/1517823314363?e=1761782400&v=beta&t=p0ADb8z-dqfRMRvj8ulTII3n40F4G2aYslTpVaRcDVg"

creator:false

followerCount:237121

\[261\]:

urn:"ACoAAAAwbW0BiTIYk_mvyL_odHuznPW70qwCYS8"

firstName:"Becky"

lastName:"Quick"

fullName:"Becky Quick"

publicIdentifier:"beckyquick"

profilePictureURL:"https://media.licdn.com/dms/image/v2/C4D03AQEu0y4vwaVESg/profile-displayphoto-shrink\_400\_400/profile-displayphoto-shrink\_400\_400/0/1516280950039?e=1761782400&v=beta&t=DUka5fEQiglMvPmCFS0mnFTdBR2G3fJQg807BpQkCK4"

creator:true

followerCount:232812

\[262\]:

urn:"ACoAADuJfoUBDntD0nJsVcduThhlJr8fDtv61Is"

firstName:"Jon"

lastName:"Gray"

fullName:"Jon Gray"

publicIdentifier:"jon-d-gray"

profilePictureURL:"https://media.licdn.com/dms/image/v2/D4E03AQG\_F4IiiTgAfg/profile-displayphoto-shrink\_400\_400/profile-displayphoto-shrink\_400\_400/0/1687268015148?e=1761782400&v=beta&t=9\_Lk5pZQ4fJ40My-J1o0qe5mNGkBRuChzNT4XMZGrkY"

creator:true

followerCount:256218

\[263\]:

urn:"ACoAABYuMjABdokupXx0oxsqcPA4noEpcDnDKCo"

firstName:"Dr. Shadé"

lastName:"Zahrai"

fullName:"Dr. Shadé Zahrai"

publicIdentifier:"shadezahrai"

profilePictureURL:"https://media.licdn.com/dms/image/v2/D5603AQEayueoaXQFJA/profile-displayphoto-shrink\_800\_800/B56ZN1.rVgHYAc-/0/1732851185891?e=1761782400&v=beta&t=-nZUnbLkf6\_3rRHyl-1Midq1PtLQsK5GvoxlcipjO2A"

creator:true

followerCount:558818

\[264\]:

urn:"ACoAABoibCgB1cz8KxGynFPuNBG-QFKI5ehzFyk"

firstName:"Grace"

lastName:"Beverley"

fullName:"Grace Beverley"

publicIdentifier:"grace-beverley-574a10102"

profilePictureURL:"https://media.licdn.com/dms/image/v2/C4D03AQExvyUE7Akxhg/profile-displayphoto-shrink\_800\_800/profile-displayphoto-shrink\_800\_800/0/1643801654367?e=1761782400&v=beta&t=DUj1T32xf7X1lLenOkhF37oAVBJtxlvw0r9biYHz9qQ"

creator:true

followerCount:209841

\[265\]:

urn:"ACoAAAYOxJIBT6RDark8OM-qQ3UdcOsu4amD7wE"

firstName:"Brad"

lastName:"Keywell"

fullName:"Brad Keywell"

publicIdentifier:"bradkeywell"

profilePictureURL:"https://media.licdn.com/dms/image/v2/C5603AQHzXN\_KY8le4w/profile-displayphoto-shrink\_800\_800/profile-displayphoto-shrink\_800\_800/0/1649733508590?e=1761782400&v=beta&t=SYc9RPFrYc9UevqgeXtDRjEepcBxMn-YusIr\_U2PcRQ"

creator:true

followerCount:89423

\[266\]:

urn:"ACoAAAxAEHMBewqCvrqdIMTa5THqtVkSm-z9kz4"

firstName:"Natalie"

lastName:"Allport"

fullName:"Natalie Allport"

publicIdentifier:"natalieallport"

profilePictureURL:"https://media.licdn.com/dms/image/v2/D4E03AQFwWxy8ZCZ2ZA/profile-displayphoto-shrink\_800\_800/profile-displayphoto-shrink\_800\_800/0/1718300195541?e=1761782400&v=beta&t=EnhZHReLyuSMiixczOPHs92E9YLX9HmQH3VZazlf\_Uo"

creator:true

followerCount:6389

\[267\]:

urn:"ACoAAAqLF0YBRBkPdT39IWdnDITxMMn3zbs6IDg"

firstName:"Jill"

lastName:"Schlesinger"

fullName:"Jill Schlesinger"

publicIdentifier:"jillonmoney"

profilePictureURL:"https://media.licdn.com/dms/image/v2/C4E03AQEVxX6YnaDB5g/profile-displayphoto-shrink\_800\_800/profile-displayphoto-shrink\_800\_800/0/1639180982919?e=1761782400&v=beta&t=yIVeasO09i12zVwr1wzobSj01WdzZbyM\_8oUTqyt1Eo"

creator:true

followerCount:716718

\[268\]:

urn:"ACoAABYeNH4Bc4Aahzq_pYB_KtPAQD-CejM_4vg"

firstName:"Lando"

lastName:"Norris"

fullName:"Lando Norris"

publicIdentifier:"landonorris"

profilePictureURL:"https://media.licdn.com/dms/image/v2/D5603AQG5ZNqGSqlAdA/profile-displayphoto-shrink\_800\_800/profile-displayphoto-shrink\_800\_800/0/1706693328200?e=1761782400&v=beta&t=LqVdXfhlxZTG0xKrxX5-lsImE9hF-3\_\_UG8-zaPs7-o"

creator:true

followerCount:178975

\[269\]:

urn:"ACoAADHU3GkBl-V4xKr09MRiC0zmUBq08yd_Wqs"

firstName:"Arnold "

lastName:"Schwarzenegger"

fullName:"Arnold Schwarzenegger"

publicIdentifier:"arnold-schwarzenegger"

profilePictureURL:"https://media.licdn.com/dms/image/v2/C4D03AQHZJ62C6foidA/profile-displayphoto-shrink\_800\_800/profile-displayphoto-shrink\_800\_800/0/1635787725134?e=1761782400&v=beta&t=me8DvPHY6sAHLQDGPOzHWDa4jX9dh-9VouzlNffVez0"

creator:true

followerCount:440234

\[270\]:

urn:"ACoAAAvBWfQBHtCtUhyKBpPiKxbo_O_qpqc3-5I"

firstName:"Jack"

lastName:"McKissen"

fullName:"Jack McKissen"

publicIdentifier:"jackmckissen"

profilePictureURL:"https://media.licdn.com/dms/image/v2/D4E03AQHK\_dXqG9vnrQ/profile-displayphoto-shrink\_800\_800/B4EZS9JVoTG0Ac-/0/1738340133121?e=1761782400&v=beta&t=qYDreDOOclFgzPLutU\_Speldpte\_iZTolDOYVLwV4cA"

creator:true

followerCount:104015

\[271\]:

urn:"ACoAACKFDEEBkA-4S3JaQswACrwz7rx0pdDfj-U"

firstName:"HH Sheikh Hamdan"

lastName:"Bin Mohammed Bin Rashid Al Maktoum"

fullName:"HH Sheikh Hamdan Bin Mohammed Bin Rashid Al Maktoum"

publicIdentifier:"hamdanbinmohammed"

profilePictureURL:"https://media.licdn.com/dms/image/v2/D4D03AQFzvrk-nuIX1Q/profile-displayphoto-shrink\_800\_800/profile-displayphoto-shrink\_800\_800/0/1708686567346?e=1761782400&v=beta&t=9UwRGQdOzHmpb5oX9QVy\_CJcuGgSFXD5nL7yVxtKv0A"

creator:false

followerCount:3740128

\[272\]:

urn:"ACoAADR1HGkBl8PVPBcO_zhhKOerSi3K8aGkt7Y"

firstName:"Daniel"

lastName:"Ricciardo"

fullName:"Daniel Ricciardo"

publicIdentifier:"daniel-ricciardo"

profilePictureURL:"https://media.licdn.com/dms/image/v2/D4D03AQFHPbw5sS3XhA/profile-displayphoto-shrink\_800\_800/profile-displayphoto-shrink\_800\_800/0/1730908153952?e=1761782400&v=beta&t=RL0UXNWQznAt0baSAaFqObTkScqKzMKkdsCIenPIfFg"

creator:true

followerCount:451872

\[273\]:

urn:"ACoAAAMlZakBzL56V-400HqosrL9y7GEpkw2dvw"

firstName:"Mickey"

lastName:"Mikitani"

fullName:"Mickey Mikitani"

publicIdentifier:"mikitani"

profilePictureURL:"https://media.licdn.com/dms/image/v2/C4D03AQEkKSrg8og\_Lg/profile-displayphoto-shrink\_800\_800/profile-displayphoto-shrink\_800\_800/0/1516569301754?e=1761782400&v=beta&t=89N-V5cvy7lz\_7fuOQDG3B7-DmMnS7Vv86fOB6ZvR18"

creator:true

followerCount:1258638

\[274\]:

urn:"ACoAAAIVweUBHROA8OzDPE2ccHUs5pLKjGcE-Yk"

firstName:"Kathryn"

lastName:"Minshew"

fullName:"Kathryn Minshew"

publicIdentifier:"kathryn-minshew"

profilePictureURL:"https://media.licdn.com/dms/image/v2/D4E03AQGaFIFgjNVygw/profile-displayphoto-shrink\_800\_800/B4EZdDpvzHHgAc-/0/1749186707004?e=1761782400&v=beta&t=JnN89YYhPPckzQGbkdv0cnHlXmTMyhTEfeJezoMr30M"

creator:true

followerCount:284290

\[275\]:

urn:"ACoAAAB2gUUB82vPOB28NQg6qklIkiHG5nsBaJo"

firstName:"Nilay"

lastName:"Patel"

fullName:"Nilay Patel"

publicIdentifier:"nilaypatel"

profilePictureURL:"https://media.licdn.com/dms/image/v2/C5603AQH\_9BvKiGz3gQ/profile-displayphoto-shrink\_400\_400/profile-displayphoto-shrink\_400\_400/0/1516281163642?e=1761782400&v=beta&t=rI-8al8R18U2pZHCsKy7bOtUdQzPoguepajGXAN0XjI"

creator:false

followerCount:6615

\[276\]:

urn:"ACoAAAAB5wgBnU6gULQF2GPOE1_1wB5JBu1TC6M"

firstName:"Fabricio"

lastName:"Bloisi"

fullName:"Fabricio Bloisi"

publicIdentifier:"fabriciobloisi"

profilePictureURL:"https://media.licdn.com/dms/image/v2/D4D03AQH5gCAuEKhxiw/profile-displayphoto-shrink\_800\_800/B4DZWjzsIuHkAc-/0/1742209991725?e=1761782400&v=beta&t=NhYHXF-RJTuRQX7reLt7sn85PSmEG0dUPX0RWG1Em54"

creator:true

followerCount:269438

\[277\]:

urn:"ACoAAAADFk0BbiOeu2Wrer11SaPH_5m1GM8pG6Q"

firstName:"Yann"

lastName:"LeCun"

fullName:"Yann LeCun"

publicIdentifier:"yann-lecun"

profilePictureURL:"https://media.licdn.com/dms/image/v2/C4D03AQHBLoV7GRUP2w/profile-displayphoto-shrink\_800\_800/profile-displayphoto-shrink\_800\_800/0/1642552032280?e=1761782400&v=beta&t=M-S0hHriAGyt7-ZilaKoLCRVlhFpMVCZfxpAe8HFEoI"

creator:true

followerCount:1062865

\[278\]:

urn:"ACoAAA8yGw8BFukJG4rcPfyjIiW_A3H_qAUbcY4"

firstName:"Alec"

lastName:"Ross"

fullName:"Alec Ross"

publicIdentifier:"rossalec"

profilePictureURL:"https://media.licdn.com/dms/image/v2/C4D03AQG5N\_auq\_yO2w/profile-displayphoto-shrink\_800\_800/profile-displayphoto-shrink\_800\_800/0/1658334667970?e=1761782400&v=beta&t=kmc1UBifcCUP\_FO9CqfrucBvuEjgKGMx-z8veJqdebE"

creator:true

followerCount:254175

\[279\]:

urn:"ACoAAAABcUIBj_DZ6-HVFVSo7vpA7LeFY7MaEDI"

firstName:"Dan"

lastName:"Sanker"

fullName:"Dan Sanker"

publicIdentifier:"dansanker"

profilePictureURL:"https://media.licdn.com/dms/image/v2/D5603AQFzWDi7jQS3rQ/profile-displayphoto-shrink\_800\_800/profile-displayphoto-shrink\_800\_800/0/1727275281085?e=1761782400&v=beta&t=fB4jTWJduyv33GX1iUfvAQx3VgILl2xhnBd8wLqfxwI"

creator:true

followerCount:394411

\[280\]:

urn:"ACoAAAFqCmkBVQU0y6mHCPrey\_\_8CSrTmyBwU4c"

firstName:"tristan"

lastName:"walker"

fullName:"tristan walker"

publicIdentifier:"tristanwalker"

profilePictureURL:"https://media.licdn.com/dms/image/v2/C5603AQFbP4olfNN0xg/profile-displayphoto-shrink\_800\_800/profile-displayphoto-shrink\_800\_800/0/1516342361653?e=1761782400&v=beta&t=kfdZyKyCT\_HE5xl1YzHK6WR-ajPP1jMp-n1ZAhuIG4I"

creator:true

followerCount:80946

\[281\]:

urn:"ACoAABi-9OEBIXkCs9orvKeMB9hkpOWCqyYLbSE"

firstName:"Maggie"

lastName:"Sellers"

fullName:"Maggie Sellers"

publicIdentifier:"sellersmaggie"

profilePictureURL:"https://media.licdn.com/dms/image/v2/D4E03AQFU1Wbn6qeBxw/profile-displayphoto-crop\_800\_800/B4EZgd.ccEGcAI-/0/1752849567145?e=1761782400&v=beta&t=Rmapi-QbmuMejiXqwSivT50TQZZzLaP8YW83hIyK\_ys"

creator:false

followerCount:13861

\[282\]:

urn:"ACoAABVEAZwBu0EgqQGsZBB51P6zKXBgv7rNlNI"

firstName:"HH Sheikh Mohammed"

lastName:"Bin Rashid Al Maktoum"

fullName:"HH Sheikh Mohammed Bin Rashid Al Maktoum"

publicIdentifier:"mohammedbinrashid"

profilePictureURL:"https://media.licdn.com/dms/image/v2/C4E03AQGK5PBQvEYGgQ/profile-displayphoto-shrink\_400\_400/profile-displayphoto-shrink\_400\_400/0/1516975098959?e=1761782400&v=beta&t=V\_ecITURqivA8lxl7-Xtd6T8S87ZPhj0KEOu\_maqVd8"

creator:false

followerCount:3393734

\[283\]:

urn:"ACoAAA0q508BLhDTKpQz1xHuVOMZu8qZtIQrRP8"

firstName:"Samir"

lastName:"Chaudry "

fullName:"Samir Chaudry "

publicIdentifier:"samirchaudry"

profilePictureURL:"https://media.licdn.com/dms/image/v2/C5603AQHNd\_YcDDjmKg/profile-displayphoto-shrink\_800\_800/profile-displayphoto-shrink\_800\_800/0/1652382658514?e=1761782400&v=beta&t=fvA9ala\_nnNf5AkiO9WkWX29kU1IE0QcaL6LMF2OBGk"

creator:true

followerCount:35807

\[284\]:

urn:"ACoAABQJdgUBDdZ-NyMRs1f2IJGYtCSlC-MZWDU"

firstName:"Marc"

lastName:"Lore"

fullName:"Marc Lore"

publicIdentifier:"marclore"

profilePictureURL:"https://media.licdn.com/dms/image/v2/C5603AQGDeCNMDXebpA/profile-displayphoto-shrink\_800\_800/profile-displayphoto-shrink\_800\_800/0/1615303489556?e=1761782400&v=beta&t=9rt-xACrn20kNJ\_DaZFSvtZkXhglIBJ08MvntX3ojHo"

creator:true

followerCount:217986

\[285\]:

urn:"ACoAAAAAYEkBYAFZdKpFhi0Pf6CaNoVrLc8SkII"

firstName:"Shishir"

lastName:"Mehrotra"

fullName:"Shishir Mehrotra"

publicIdentifier:"shishirmehrotra"

profilePictureURL:"https://media.licdn.com/dms/image/v2/C4E03AQHDTK1PQzTRrA/profile-displayphoto-shrink\_800\_800/profile-displayphoto-shrink\_800\_800/0/1516158398727?e=1761782400&v=beta&t=i7ViZrHTsaWFbAadQsiW53lU9\_UE5JVpa0TydUXYoOA"

creator:false

followerCount:26217

\[286\]:

urn:"ACoAACGBjJoBBl9NqMd1eV4PggmHAZ9a_XfWg58"

firstName:"Marie"

lastName:"Kondo"

fullName:"Marie Kondo"

publicIdentifier:"marie-kondo"

profilePictureURL:"https://media.licdn.com/dms/image/v2/C5603AQGcDRTwJRsg2g/profile-displayphoto-shrink\_800\_800/profile-displayphoto-shrink\_800\_800/0/1586222244838?e=1761782400&v=beta&t=A4vBWLs0xO3vORNa3XkaXWQRlJuJsMh2Is-Tqx9xBbI"

creator:false

followerCount:20586

\[287\]:

urn:"ACoAABt6Ew4Bq_m-hahX5ocf321ZyqZy7FpQlig"

firstName:"Emmanuel"

lastName:"Macron"

fullName:"Emmanuel Macron"

publicIdentifier:"emmanuelmacron"

profilePictureURL:"https://media.licdn.com/dms/image/v2/D4E03AQHdzozXOGcFgw/profile-displayphoto-shrink\_800\_800/profile-displayphoto-shrink\_800\_800/0/1712059080262?e=1761782400&v=beta&t=Tu27-51dKbG7B3qXIwZvmH8laJEX-Y0fI49SIdlWlxc"

creator:true

followerCount:3008409

\[288\]:

urn:"ACoAAAAicEoBnYXULNB7ThTcyqgS2uLN8t089MQ"

firstName:"Wopke"

lastName:"Hoekstra"

fullName:"Wopke Hoekstra"

publicIdentifier:"wopke-hoekstra"

profilePictureURL:"https://media.licdn.com/dms/image/v2/D4E03AQGCCi1gjI07bg/profile-displayphoto-shrink\_800\_800/B4EZOWmD3\_HAAc-/0/1733398380500?e=1761782400&v=beta&t=P00WBUIz4oxa9Yz\_wVPCdPtXYR32KfZMeD5KCYN6g3A"

creator:false

followerCount:125591

\[289\]:

urn:"ACoAAC2-MfsBDrYt2zuSFJK8hxJ5oZDCOj_Blr0"

firstName:"Christopher"

lastName:"Luxon"

fullName:"Christopher Luxon"

publicIdentifier:"christopher-luxon-bb701b195"

profilePictureURL:"https://media.licdn.com/dms/image/v2/D4D03AQHCRzmmPulolA/profile-displayphoto-shrink\_800\_800/profile-displayphoto-shrink\_800\_800/0/1701066641706?e=1761782400&v=beta&t=a\_26hEh07kW2\_2Hs\_muxE7HExDVI5TInCzL9ITlo1pY"

creator:false

followerCount:115720

\[290\]:

urn:"ACoAABATQloBfyWuESHWD211_EatYCVbdIpB9yA"

firstName:"Angela"

lastName:"Ahrendts"

fullName:"Angela Ahrendts"

publicIdentifier:"angelaahrendts"

profilePictureURL:"https://media.licdn.com/dms/image/v2/C4E03AQFxD57JEvoVUA/profile-displayphoto-shrink\_400\_400/profile-displayphoto-shrink\_400\_400/0/1516575907765?e=1761782400&v=beta&t=n\_QHyZ7hyn3\_aAdS2XoqSL-TS2XEguxYzpSbH77nT-M"

creator:true

followerCount:799719

\[291\]:

urn:"ACoAAAZ1GBwB_YLlrm8831LiFqbYyPB8nHi9B6E"

firstName:"Drew"

lastName:"Scott"

fullName:"Drew Scott"

publicIdentifier:"drew-scott-16434730"

profilePictureURL:"https://media.licdn.com/dms/image/v2/D5603AQFTEWwQRsdb5w/profile-displayphoto-shrink\_800\_800/profile-displayphoto-shrink\_800\_800/0/1710524878025?e=1761782400&v=beta&t=0CizV8y8ae4\_9IWAaWldetrx7vwGAcE-iWGnjv1ojSg"

creator:true

followerCount:4246

\[292\]:

urn:"ACoAAADeFaUBrmVCZf1j4QHkgmQz2bLLsHyL8Ao"

firstName:"Clarice Lin,"

lastName:"Marketing Strategist💪"

fullName:"Clarice Lin, Marketing Strategist💪"

publicIdentifier:"claricelin"

profilePictureURL:"https://media.licdn.com/dms/image/v2/C5603AQGpVyujneY4Ug/profile-displayphoto-shrink\_800\_800/profile-displayphoto-shrink\_800\_800/0/1541698574705?e=1761782400&v=beta&t=tBrHijGwrw7j2GT8-IGIo8fH4J1S3qDEnuCzq-\_UGh0"

creator:true

followerCount:7591

\[293\]:

urn:"ACoAAABMb7ABtHb6JCzTqQBzknbw1O0cQrAmjLc"

firstName:"Deborah"

lastName:"Liu"

fullName:"Deborah Liu"

publicIdentifier:"deborahliu"

profilePictureURL:"https://media.licdn.com/dms/image/v2/C5603AQFctKp8BRWU3Q/profile-displayphoto-shrink\_800\_800/profile-displayphoto-shrink\_800\_800/0/1574360662782?e=1761782400&v=beta&t=zpvRJmTDBZBfKZgJobeCTAQQEjQX3SCgwNasAeABsao"

creator:true

followerCount:104989

\[294\]:

urn:"ACoAAA6SSIsBCU74lDKTmPILaEOPsS95f_eqNyI"

firstName:"John"

lastName:"Henry"

fullName:"John Henry"

publicIdentifier:"johnhenrystyle"

profilePictureURL:"https://media.licdn.com/dms/image/v2/C4D03AQFtLozkUz1CDg/profile-displayphoto-shrink\_800\_800/profile-displayphoto-shrink\_800\_800/0/1633302809762?e=1761782400&v=beta&t=OdI20XvEBWp6e2boRY7N5aypKkAS2DmnL\_jpEUMdBpM"

creator:true

followerCount:54040

\[295\]:

urn:"ACoAAACfJUMB9zef7DrWoAYfFAbN32jlgdjKO80"

firstName:"Tomas"

lastName:"Kucera"

fullName:"Tomas Kucera"

publicIdentifier:"tomaskucera"

profilePictureURL:"https://media.licdn.com/dms/image/v2/C4E03AQFGHc57iBZnLw/profile-displayphoto-shrink\_800\_800/profile-displayphoto-shrink\_800\_800/0/1516311966095?e=1761782400&v=beta&t=aFggBaU-Z5GqDNn0bL3dXiscRWyc9EvwJUssJYJE\_H4"

creator:true

followerCount:14037

\[296\]:

urn:"ACoAAAEhb04BeDQeyERF94gC5e_gqZR39Hp9Czg"

firstName:"Sunny"

lastName:"Bonnell"

fullName:"Sunny Bonnell"

publicIdentifier:"sunnybonnell"

profilePictureURL:"https://media.licdn.com/dms/image/v2/D5603AQHfLVUNAGF4WQ/profile-displayphoto-shrink\_800\_800/profile-displayphoto-shrink\_800\_800/0/1698334142895?e=1761782400&v=beta&t=UL78PjV5PThT1j\_6pMjTu0wiaDp3Xw9mnZQugo75F6I"

creator:true

followerCount:19446

\[297\]:

urn:"ACoAAAAAg-cBm5i6KWa5l926DEsAD3KIO6cenp8"

firstName:"Charlene"

lastName:"Li"

fullName:"Charlene Li"

publicIdentifier:"charleneli"

profilePictureURL:"https://media.licdn.com/dms/image/v2/D4E03AQGyzStV9K3vcQ/profile-displayphoto-shrink\_800\_800/B4EZViqduFGwAc-/0/1741117054264?e=1761782400&v=beta&t=JQHq-AeygRbDEJrmp1KRZT2M68fuMAPryImUoL2uxYY"

creator:true

followerCount:278943

\[298\]:

urn:"ACoAAAAEcZkBIFPkmuI7RX3WBl_0W17G98fbtyY"

firstName:"Jon"

lastName:"Fortt"

fullName:"Jon Fortt"

publicIdentifier:"jonfortt"

profilePictureURL:"https://media.licdn.com/dms/image/v2/D4E03AQFSUum5TjHkhQ/profile-displayphoto-shrink\_800\_800/profile-displayphoto-shrink\_800\_800/0/1693777801017?e=1761782400&v=beta&t=vBw0s\_QI5z\_jx3LSwBmgFfEstEEJRjRh3EO60pHQ74s"

creator:true

followerCount:221118

\[299\]:

urn:"ACoAAAPddYgBzyPFRzHg5hZY_E3Rlyz_jdSO4ec"

firstName:"Albert"

lastName:"Bourla"

fullName:"Albert Bourla"

publicIdentifier:"albert-bourla"

profilePictureURL:"https://media.licdn.com/dms/image/v2/C4E03AQHH4cjVbeFdLw/profile-displayphoto-shrink\_800\_800/profile-displayphoto-shrink\_800\_800/0/1632326525506?e=1761782400&v=beta&t=ES4vBkBE0-jRe0wy5xNZd51RujIebL1jSuNygAZyiBk"

creator:true

followerCount:301835

\[300\]:

urn:"ACoAAACCl_YBa_oykqa3cmAo7JBPTkCJbC2H31k"

firstName:"Laura"

lastName:"Teclemariam"

fullName:"Laura Teclemariam"

publicIdentifier:"laurateclemariam"

profilePictureURL:"https://media.licdn.com/dms/image/v2/D5603AQGiyXMBVWGLTA/profile-displayphoto-shrink\_800\_800/profile-displayphoto-shrink\_800\_800/0/1691562796754?e=1761782400&v=beta&t=mAE\_TdLQz3OiI1D0z-eUu8Fz3FgOn3Glk37TEuhB-LM"

creator:false

followerCount:0

\[301\]:

urn:"ACoAAAO3AMUBwGqijaNpw6BRLAi3drS_mGtE5gk"

firstName:"Ruben"

lastName:"Harris"

fullName:"Ruben Harris"

publicIdentifier:"rubenharris"

profilePictureURL:"https://media.licdn.com/dms/image/v2/D5603AQH-f0UZfdz2GA/profile-displayphoto-crop\_800\_800/B56Zlb7Kn6KMAQ-/0/1758183862304?e=1761782400&v=beta&t=ZFvu7Naa6NcWlquvzmIOEBnfQAjut8bW4QyFeDv-BG0"

creator:true

followerCount:69459

\[302\]:

urn:"ACoAAAADlT4BXzW1jgPSHdoQYm3SnAXpgtHmbEk"

firstName:"David"

lastName:"Sable"

fullName:"David Sable"

publicIdentifier:"dsable"

profilePictureURL:"https://media.licdn.com/dms/image/v2/D4E03AQEnHEQJDrT4tw/profile-displayphoto-shrink\_800\_800/profile-displayphoto-shrink\_800\_800/0/1726052766241?e=1761782400&v=beta&t=oLBxTgh4OvL-ThVKir-HquUKzxJ0WK1ZsqaZZZwG-JQ"

creator:true

followerCount:903077

\[303\]:

urn:"ACoAAABwhvABzo9CzKajiOypJoHIaVXX6r1tXLs"

firstName:"Shane"

lastName:"Snow"

fullName:"Shane Snow"

publicIdentifier:"shanedsnow"

profilePictureURL:"https://media.licdn.com/dms/image/v2/C5603AQEXYJt5EdLC5g/profile-displayphoto-shrink\_800\_800/profile-displayphoto-shrink\_800\_800/0/1654189759727?e=1761782400&v=beta&t=ns9foNKkFDzmYYXdNs\_QRXYDwpjilurqlR7oZwQF0tg"

creator:true

followerCount:372002

\[304\]:

urn:"ACoAAABiUF0BatzJugPK4Psitky2YnQPWR4y-98"

firstName:"Dan"

lastName:"Frommer"

fullName:"Dan Frommer"

publicIdentifier:"fromedome"

profilePictureURL:"https://media.licdn.com/dms/image/v2/C4D03AQGaGZlVqytz7Q/profile-displayphoto-shrink\_800\_800/profile-displayphoto-shrink\_800\_800/0/1553644851153?e=1761782400&v=beta&t=ESmxGFiWZ3vQXZejO8i0QmTTPauhjkmxgKlUxcC3Jjo"

creator:true

followerCount:314000

\[305\]:

urn:"ACoAAABemvkBhw4NyDiIbBpEu0_cdUL4RwyaoQc"

firstName:"Katya"

lastName:"Andresen"

fullName:"Katya Andresen"

publicIdentifier:"katyaandresen"

profilePictureURL:"https://media.licdn.com/dms/image/v2/D4D03AQHfYYPgpJF3vQ/profile-displayphoto-shrink\_800\_800/profile-displayphoto-shrink\_800\_800/0/1642800000381?e=1761782400&v=beta&t=uTegdSGOkD2vGKgNAvyvnXCFtxug5h9-b-Q58U9gLcs"

creator:true

followerCount:1205110

\[306\]:

urn:"ACoAAAApQY0BBambLpKZ7cetcpabJ2BV5bJEPoU"

firstName:"Christian"

lastName:"Klein"

fullName:"Christian Klein"

publicIdentifier:"christian-klein"

profilePictureURL:"https://media.licdn.com/dms/image/v2/D4E03AQFwQRhEU7phIQ/profile-displayphoto-shrink\_800\_800/B4EZSOExLDGYAg-/0/1737550403545?e=1761782400&v=beta&t=KdcynbNLklChoKxiNCVXmCqdiumCkCEJMU7Bt2mESoY"

creator:true

followerCount:282750

\[307\]:

urn:"ACoAAABazrQBjEXD2eHYsHPADLkSaNh1oXCba3E"

firstName:"Ivan"

lastName:"Tornos"

fullName:"Ivan Tornos"

publicIdentifier:"ivantornos"

profilePictureURL:"https://media.licdn.com/dms/image/v2/D4E03AQFh-IX85yEH4g/profile-displayphoto-shrink\_800\_800/profile-displayphoto-shrink\_800\_800/0/1672928432927?e=1761782400&v=beta&t=NCL0lSIqLg-nECgoLLMsyt80oZjeNnNeJcwGIBcK9S4"

creator:true

followerCount:54014

\[308\]:

urn:"ACoAAAB8gmgBEvs0cNZ2ezbjgswUZjUbs_QPDzo"

firstName:"Mike"

lastName:"Sievert"

fullName:"Mike Sievert"

publicIdentifier:"sievert"

profilePictureURL:"https://media.licdn.com/dms/image/v2/C5603AQFsD\_-vfnt19Q/profile-displayphoto-shrink\_400\_400/profile-displayphoto-shrink\_400\_400/0/1603855639386?e=1761782400&v=beta&t=JZrwXrP1ormI2GEP3OugUIW\_v1flig7ru9q7YRHvnsY"

creator:true

followerCount:154613

companies:

\[0\]:

urn:"1035"

name:"Microsoft"

url:"https://www.linkedin.com/company/1035/"

logoURL:"https://media.licdn.com/dms/image/v2/D560BAQH32RJQCl3dDQ/company-logo\_400\_400/B56ZYQ0mrGGoAc-/0/1744038948046/microsoft\_logo?e=1761782400&v=beta&t=L8ON9gLWkI74oSmhibx6fLjSYJ-v8CGGwxCBHM\_uJq8"

followerCount:26453001

\[1\]:

urn:"1337"

name:"LinkedIn"

url:"https://www.linkedin.com/company/1337/"

logoURL:"https://media.licdn.com/dms/image/v2/C560BAQHaVYd13rRz3A/company-logo\_400\_400/company-logo\_400\_400/0/1638831590218/linkedin\_logo?e=1761782400&v=beta&t=x\_9t8LMKN1X\_iOpOKN33-CV7fzDbS5ZZY-S9gp6KmrU"

followerCount:31995927

\[2\]:

urn:"1371"

name:"McKinsey & Company"

url:"https://www.linkedin.com/company/1371/"

logoURL:"https://media.licdn.com/dms/image/v2/D4E0BAQF08d-lL0S8Yw/company-logo\_400\_400/B4EZfGo\_vEHwAc-/0/1751384325462/mckinsey\_logo?e=1761782400&v=beta&t=iTmXejNyzxDtkZwfhp2Mxq2kaV0P8fJ0uLzUqdjaRdk"

followerCount:6661777

\[3\]:

urn:"1649"

name:"Harvard Business Review"

url:"https://www.linkedin.com/company/1649/"

logoURL:"https://media.licdn.com/dms/image/v2/D560BAQFQxeS5AxkTQA/company-logo\_400\_400/company-logo\_400\_400/0/1732205737405/harvard\_business\_review\_logo?e=1761782400&v=beta&t=\_7o0vAmbA0hWIRhWnDaAhm73r-rxTlFnygkO-h1svC8"

followerCount:14543706

\[4\]:

urn:"1666"

name:"Intuit"

url:"https://www.linkedin.com/company/1666/"

logoURL:"https://media.licdn.com/dms/image/v2/C560BAQFTpF8uneqScw/company-logo\_400\_400/company-logo\_400\_400/0/1661446146222/intuit\_logo?e=1761782400&v=beta&t=R\_6NH1bC-HQG-rPaA3CyQA9bjEpO2lTHnKaCNjFCvLE"

followerCount:915604

\[5\]:

urn:"1694"

name:"The Coca-Cola Company"

url:"https://www.linkedin.com/company/1694/"

logoURL:"https://media.licdn.com/dms/image/v2/C560BAQFdDysNTJsI5Q/company-logo\_400\_400/company-logo\_400\_400/0/1673983420634/the\_coca\_cola\_company\_logo?e=1761782400&v=beta&t=mea2X6IuQ5olZFCpdcWkqVFzRDfd72K-hAL7mE1D2\_Y"

followerCount:8320763

\[6\]:

urn:"1748"

name:"TIME"

url:"https://www.linkedin.com/company/1748/"

logoURL:"https://media.licdn.com/dms/image/v2/C4E0BAQGOq0SlHwj8kg/company-logo\_400\_400/company-logo\_400\_400/0/1677855722639/time\_logo?e=1761782400&v=beta&t=n-E4QR0jByCX1lzVu3IY0lG0ebXGJExd7QoRvGn4yJs"

followerCount:2465184

\[7\]:

urn:"1791"

name:"Stanford University Graduate School of Business"

url:"https://www.linkedin.com/company/1791/"

logoURL:"https://media.licdn.com/dms/image/v2/C4D0BAQGyTHJCehyEuA/company-logo\_400\_400/company-logo\_400\_400/0/1630537027992/stanford\_graduate\_school\_of\_business\_logo?e=1761782400&v=beta&t=x21mmINu4XvCUJbgaocWq12dzqtDFNwLsOVUTTTaVJA"

followerCount:545107

\[8\]:

urn:"1833"

name:"CNBC"

url:"https://www.linkedin.com/company/1833/"

logoURL:"https://media.licdn.com/dms/image/v2/D4E0BAQGhTt03d9EW0w/company-logo\_400\_400/company-logo\_400\_400/0/1729250832732/cnbc\_logo?e=1761782400&v=beta&t=GJ43al2WUy13xo45Wl7AJNl5yb\_NVxnEFvP8nFN4bgA"

followerCount:2985932

\[9\]:

urn:"1935"

name:"PTC"

url:"https://www.linkedin.com/company/1935/"

logoURL:"https://media.licdn.com/dms/image/v2/D4E0BAQEpBSyxBzIEhw/company-logo\_400\_400/company-logo\_400\_400/0/1719854960782/ptcinc\_logo?e=1761782400&v=beta&t=dhb8WZQAPwlU5cjelvyqxrn4yHUUliNSyTqb6jIJhsY"

followerCount:378634

\[10\]:

urn:"2003"

name:"NASA - National Aeronautics and Space Administration"

url:"https://www.linkedin.com/company/2003/"

logoURL:"https://media.licdn.com/dms/image/v2/C4D0BAQGRBHWCcaAqGg/company-logo\_400\_400/company-logo\_400\_400/0/1630507197379/nasa\_logo?e=1761782400&v=beta&t=kRErtdPKi7Camwnh4Asv7u2IlC-a5x4rWFuxxzSiZHk"

followerCount:6820070

\[11\]:

urn:"2029"

name:"Nike"

url:"https://www.linkedin.com/company/2029/"

logoURL:"https://media.licdn.com/dms/image/v2/D560BAQHJk7IdfuV1Dw/company-logo\_400\_400/company-logo\_400\_400/0/1732131503851/nike\_logo?e=1761782400&v=beta&t=CrFOe5Ut3MHWze5U1n\_EUf6chRi90vX7GxXHBj-DQJc"

followerCount:5995735

\[12\]:

urn:"2517"

name:"University of California, Berkeley"

url:"https://www.linkedin.com/company/2517/"

logoURL:"https://media.licdn.com/dms/image/v2/D560BAQGwjF\_5CYj\_JQ/company-logo\_400\_400/company-logo\_400\_400/0/1732135669731/uc\_berkeley\_logo?e=1761782400&v=beta&t=HThFOELyrLR\_4QLD7BVIkRD3PafMuJnrlJIzRG8ECPg"

followerCount:984694

\[13\]:

urn:"2519"

name:"University of California, Berkeley, Haas School of Business"

url:"https://www.linkedin.com/company/2519/"

logoURL:"https://media.licdn.com/dms/image/v2/C4E0BAQEc1EFtLIThEw/company-logo\_400\_400/company-logo\_400\_400/0/1631312193135?e=1761782400&v=beta&t=2dJtrK2KqDuoYd\_3CQ8dDRYoxKEexUDQiS0qzAAhWJc"

followerCount:169934

\[14\]:

urn:"2842"

name:"University of California, Davis"

url:"https://www.linkedin.com/company/2842/"

logoURL:"https://media.licdn.com/dms/image/v2/C4E0BAQEBG25KNBwuCQ/company-logo\_400\_400/company-logo\_400\_400/0/1630629297217/uc\_davis\_logo?e=1761782400&v=beta&t=qZemvv4lSJ\_CTXfJiSzLHduUH8r8l-zAAgp0RDarkXc"

followerCount:401408

\[15\]:

urn:"4236"

name:"The New York Times"

url:"https://www.linkedin.com/company/4236/"

logoURL:"https://media.licdn.com/dms/image/v2/C560BAQEp-f9Ptu2yVQ/company-logo\_400\_400/company-logo\_400\_400/0/1631319717018?e=1761782400&v=beta&t=kWHZt7vFRKY9YytdwkmpD8NXH0AOhxBcx3ZHeqtbZ3c"

followerCount:6851662

\[16\]:

urn:"4471"

name:"IMG"

url:"https://www.linkedin.com/company/4471/"

logoURL:"https://media.licdn.com/dms/image/v2/D4E0BAQG-i2j7Q2WFIA/company-logo\_400\_400/company-logo\_400\_400/0/1694593112031/img\_logo?e=1761782400&v=beta&t=UvWY6bQ8Px7n48z5LPxZsov2kVaugRDavmpPd1g7Oyk"

followerCount:298001

\[17\]:

urn:"4697"

name:"Financial Times"

url:"https://www.linkedin.com/company/4697/"

logoURL:"https://media.licdn.com/dms/image/v2/C560BAQHkYotU-D9kCg/company-logo\_400\_400/company-logo\_400\_400/0/1631348726233?e=1761782400&v=beta&t=ObTIo2IbNFRU9a0imcsE1\_geRuDEgklVJZuPOQvVFZs"

followerCount:7622455

\[18\]:

urn:"4749"

name:"HBO"

url:"https://www.linkedin.com/company/4749/"

logoURL:"https://media.licdn.com/dms/image/v2/C560BAQHQ303-nahsMQ/company-logo\_400\_400/company-logo\_400\_400/0/1630654386710/hbo\_logo?e=1761782400&v=beta&t=DAJPHvb6tJU1ltGOexogfEJgg29dd6ca1UzxuZe31So"

followerCount:1183434

\[19\]:

urn:"5502"

name:"USA TODAY"

url:"https://www.linkedin.com/company/5502/"

logoURL:"https://media.licdn.com/dms/image/v2/C560BAQFVChLRUaoRmw/company-logo\_400\_400/company-logo\_400\_400/0/1674768908373/usa\_today\_logo?e=1761782400&v=beta&t=MPXy4VrjYylsVTVKYLTnUf3\_ZxGZni\_IzI\_Vw1cqBRg"

followerCount:329426

groups:

\[0\]:

urn:"13855160"

name:"Finding Your New Job"

logoURL:"https://media.licdn.com/dms/image/v2/D5607AQHHzvmkeUS7KQ/group-logo\_image-shrink\_400x400/group-logo\_image-shrink\_400x400/0/1655487952783?e=1759356000&v=beta&t=adcaFYVZp16o6QO0jGJqnMTgHrsc-eZ2OZSW6m\_zLOI"

\[1\]:

urn:"3245711"

name:"GoDaddy Users"

logoURL:"https://media.licdn.com/dms/image/v2/C4D07AQGhBahu1qahBQ/group-logo\_image-shrink\_200x200/group-logo\_image-shrink\_200x200/0/1631354248547?e=1759356000&v=beta&t=vXpWOAf8hvGiTtszapPiXDg3qp5TP2jj7Te1oiYfJDo"

\[2\]:

urn:"1822758"

name:"Grammar Geeks"

logoURL:"https://media.licdn.com/dms/image/v2/D4E07AQG1Wk1ksSprnw/group-logo\_image-shrink\_400x400/B4EZbOjcI\_HIAU-/0/1747222122433?e=1759356000&v=beta&t=ShbWfzsar1jgdWNy6-EeK7ZPT0W6cKu6LiB84NYULlc"

\[3\]:

urn:"14445195"

name:"The Cinco Reunions, '25"

logoURL:"https://media.licdn.com/dms/image/v2/D5607AQEbFqNul9v7IQ/group-logo\_image-shrink\_400x400/group-logo\_image-shrink\_400x400/0/1715120007737?e=1759356000&v=beta&t=n9orMiBMWi3mEZu0doqs7Xl6CkCb6LKCMa2OY0jrdjE"

\[4\]:

urn:"14081027"

name:"Microsoft Viva Community"

logoURL:"https://media.licdn.com/dms/image/v2/C5607AQEZblO9Asv9Dg/group-logo\_image-shrink\_400x400/group-logo\_image-shrink\_400x400/0/1650392118923?e=1759356000&v=beta&t=VdHh\_Tcdhte6rCdyvxKw29FjNNZlqU1SKt\_sB1G6\_rM"

\[5\]:

urn:"6791653"

name:"Drones, Entrepreneurship and Business Opportunities"

logoURL:"https://media.licdn.com/dms/image/v2/C4E07AQHrRuSOlOs1Tw/group-logo\_image-shrink\_200x200/group-logo\_image-shrink\_200x200/0/1631379339592?e=1759356000&v=beta&t=Wptu6po-FwKdggVfhSeWjjaTsOaacB4Ln1tYcNqheXc"

\[6\]:

urn:"12314659"

name:"Featured Items Ramp Group"

logoURL:""

newsletter:

\[0\]:

urn:"6640647216497209344"

title:"Dorie Clark Newsletter "

description:"Get your best ideas heard in a noisy world "

logoURL:"https://media.licdn.com/dms/image/v2/C4D12AQFBjxhKLpuuBA/series-logo\_image-shrink\_300\_300/series-logo\_image-shrink\_300\_300/0/1587707158230?e=1761782400&v=beta&t=19qO6WU939k\_U-BIqudFHRe3eEcqS28PWhlmVARbS1A"

authorName:"Dorie Clark"

authorProfile:"https://www.linkedin.com/in/doriec"

authorUrn:"ACoAAABNVj0BFGHyshoTwNkq9n1HNf36II_Czn0"

frequency:"Published weekly"

newsletterURL:"https://www.linkedin.com/newsletters/6640647216497209344"

\[1\]:

urn:"7267250675338637312"

title:"Implications"

description:"Implications of the latest advances in tech, shifts in culture, and the art and science of building products."

logoURL:"https://media.licdn.com/dms/image/v2/D4E12AQGowHDaEsZrIQ/series-logo\_image-shrink\_300\_300/series-logo\_image-shrink\_300\_300/0/1732647518585?e=1761782400&v=beta&t=fSaMTi60AZ7AhNW1ZZVNn\_jyLEPH6u1bBEl-B\_Petpk"

authorName:"Scott Belsky"

authorProfile:"https://www.linkedin.com/in/scottbelsky"

authorUrn:"ACoAAAA-LWUBWvoYu3LhTCyylEAp3v_ruqfh9ms"

frequency:"Published biweekly"

newsletterURL:"https://www.linkedin.com/newsletters/7267250675338637312"

\[2\]:

urn:"7356000404112920576"

title:"Built Different"

description:"A video podcast that goes behind the scenes of technologies that are doing good and doing well."

logoURL:"https://media.licdn.com/dms/image/v2/D5612AQEVBcblLctxKw/series-logo\_image-shrink\_300\_300/B56ZhXDVMbHcAY-/0/1753807149557?e=1761782400&v=beta&t=hIpOrv9DEHRd0G4VKok635u55R7WfI\_QIyJZUiBgEQo"

authorName:"Mohak Shroff"

authorProfile:"https://www.linkedin.com/in/mohakshroff"

authorUrn:"ACoAAAAXPtkB9TGjuEsfcXgmxz-mvVw1XzE2sBc"

frequency:"Published weekly"

newsletterURL:"https://www.linkedin.com/newsletters/7356000404112920576"

\[3\]:

urn:"6641420720876343296"

title:"LinkedIn 360 l By GaryVee"

description:"Gary Vaynerchuk's monthly recap of the most valuable content on business, social media, marketing and more."

logoURL:"https://media.licdn.com/dms/image/v2/D4E12AQGMnncpfIDhLQ/series-logo\_image-shrink\_300\_300/series-logo\_image-shrink\_300\_300/0/1662050735223?e=1761782400&v=beta&t=bnJMZksh2ZmVdz5Q9nPCI2pCjjU3suXXJtF7CqpGdBc"

authorName:"Gary Vaynerchuk"

authorProfile:"https://www.linkedin.com/in/garyvaynerchuk"

authorUrn:"ACoAAACgAVMBb8w4dbaqCMriT5tTYE0H4M_oFKE"

frequency:"Published monthly"

newsletterURL:"https://www.linkedin.com/newsletters/6641420720876343296"

\[4\]:

urn:"6633853504601550848"

title:"Notes from Melinda"

description:"Notes from Melinda French Gates."

logoURL:"https://media.licdn.com/dms/image/v2/D4E12AQFS0I6iNouVYQ/series-logo\_image-shrink\_300\_300/B4EZjnP6gDIQAY-/0/1756226370919?e=1761782400&v=beta&t=JLq7a8RU7zQo064vl5At-QK-AE3IQlYpWbjHwVLiIM4"

authorName:"Melinda French Gates"

authorProfile:"https://www.linkedin.com/in/melindagates"

authorUrn:"ACoAACP3Z8sBD-VB2ez3ArHe2-9lHoPwTaCGV1c"

frequency:"Published monthly"

newsletterURL:"https://www.linkedin.com/newsletters/6633853504601550848"

\[5\]:

urn:"7249182762300014593"

title:"a16z Enterprise Newsletter"

description:"News and analysis of the latest trends in B2B and enterprise tech."

logoURL:"https://media.licdn.com/dms/image/v2/D5612AQHn\_-1mzRzr7A/series-logo\_image-shrink\_300\_300/series-logo\_image-shrink\_300\_300/0/1732151063779?e=1761782400&v=beta&t=YvBVjBtpcSDveT6HwPNl5Rq7652MSffG-31LrSCta8M"

authorName:"Andreessen Horowitz"

authorProfile:"https://www.linkedin.com/company/439909/"

frequency:"Published biweekly"

newsletterURL:"https://www.linkedin.com/newsletters/7249182762300014593"

\[6\]:

urn:"7236593061605113856"

title:"Product Pulse "

description:"Provide valuable insights into product management, share Laura’s industry experiences, and highlight key trends in tech"

logoURL:"https://media.licdn.com/dms/image/v2/D4E12AQHxEkdrzVGRuQ/series-logo\_image-shrink\_300\_300/series-logo\_image-shrink\_300\_300/0/1725338222706?e=1761782400&v=beta&t=4uNl6DfKDIgEJEmDBgdmoNZeDcS-78Fi3na9DvDVaBg"

authorName:"Laura Teclemariam"

authorProfile:"https://www.linkedin.com/in/laurateclemariam"

authorUrn:"ACoAAACCl_YBa_oykqa3cmAo7JBPTkCJbC2H31k"

frequency:"Published biweekly"

newsletterURL:"https://www.linkedin.com/newsletters/7236593061605113856"

\[7\]:

urn:"7041765438745182208"

title:"Making the Difference"

description:"The future of work, workforce trends, what we're seeing at Walmart as the nation's largest private employer, and more"

logoURL:"https://media.licdn.com/dms/image/v2/D5612AQHcVsk2Yeb-cw/series-logo\_image-shrink\_300\_300/series-logo\_image-shrink\_300\_300/0/1678887409959?e=1761782400&v=beta&t=wy8XgDItZKyquA2fuMSXL1Ja66F2oGeTLuZvsFRhCWk"

authorName:"Donna Morris"

authorProfile:"https://www.linkedin.com/in/donnamorris2"

authorUrn:"ACoAAAARQ5QBNr_sthvLd4THpuV910cPaooFF7Y"

frequency:"Published monthly"

newsletterURL:"https://www.linkedin.com/newsletters/7041765438745182208"

\[8\]:

urn:"7183890373289648128"

title:"Spark"

description:"Tips and insights from TED events — plus inspiring extras from our global community"

logoURL:"https://media.licdn.com/dms/image/v2/D4E12AQGSyfbO\_8woUQ/series-logo\_image-shrink\_300\_300/series-logo\_image-shrink\_300\_300/0/1712852746366?e=1761782400&v=beta&t=btKirv6sWpykdGIlHKbOXMsajBNSgsBF84Pq0Cj2jJQ"

authorName:"TED Conferences"

authorProfile:"https://www.linkedin.com/company/610087/"

frequency:"Published monthly"

newsletterURL:"https://www.linkedin.com/newsletters/7183890373289648128"

\[9\]:

urn:"7181040435673321473"

title:"Transformative Trailblazers"

description:"A Q&A series featuring trailblazers at the forefront of business, technological and cultural transformation."

logoURL:"https://media.licdn.com/dms/image/v2/D4E12AQEHW9di5I\_g1Q/series-logo\_image-shrink\_300\_300/series-logo\_image-shrink\_300\_300/0/1712093410962?e=1761782400&v=beta&t=1dxWFiL53W7YCefzk-UslPQbYK4I9\_bAqr2PMImg2qU"

authorName:"Anneliese Olson"

authorProfile:"https://www.linkedin.com/in/annelieseolson"

authorUrn:"ACoAAACGC_8BWsHWisrF8Ay7NWxtRCVV2mLBRWU"

frequency:"Published monthly"

newsletterURL:"https://www.linkedin.com/newsletters/7181040435673321473"

\[10\]:

urn:"7074778308969721856"

title:"The Boardroom View"

description:"Authentic insights de-mystifying the boardroom for current and aspiring board members. "

logoURL:"https://media.licdn.com/dms/image/v2/D5612AQGguFQlWCwKIA/series-logo\_image-shrink\_300\_300/series-logo\_image-shrink\_300\_300/0/1686758580842?e=1761782400&v=beta&t=6AxSoZ1KDdldn-uMYlye6nNixH05YMgn29PhfqMbEDo"

authorName:"Jocelyn Mangan"

authorProfile:"https://www.linkedin.com/in/jocelynmangan"

authorUrn:"ACoAAAAGVOsB1cVPoExB1V4KcRPRc5ZCDAIVAo4"

frequency:"Published biweekly"

newsletterURL:"https://www.linkedin.com/newsletters/7074778308969721856"

\[11\]:

urn:"7247024170163666944"

title:"Create Design @ Linkedin"

description:"A look into the Create Design team at LinkedIn"

logoURL:"https://media.licdn.com/dms/image/v2/D4E12AQHrlxyBB7xMSA/series-logo\_image-shrink\_300\_300/B4EZbQoyJuHkAQ-/0/1747257074601?e=1761782400&v=beta&t=yXvk1KGV\_wEdt9r\_9FmVSaaOUf5DlRydOG9gbeJIt4Y"

authorName:"Create Design Team"

authorProfile:"https://www.linkedin.com/company/105227916/"

frequency:"Published monthly"

newsletterURL:"https://www.linkedin.com/newsletters/7247024170163666944"

\[12\]:

urn:"7359641376499687424"

title:"Trustbuilder"

description:"How to build trust and reputation in the age of AI"

logoURL:"https://media.licdn.com/dms/image/v2/D4D12AQE1zqPkk6GRRw/series-logo\_image-shrink\_300\_300/B4DZiKy0JkGkAQ-/0/1754675233870?e=1761782400&v=beta&t=ubMEHkI7\_ox-bU\_Z-72hNgsby5dHT\_VrmWpp6qI1jwY"

authorName:"Greg Snapper"

authorProfile:"https://www.linkedin.com/in/gregsnapper"

authorUrn:"ACoAAADhxLEBDEX-SllIpXPg1Cw0nTpWbhHYqpk"

frequency:"Published weekly"

newsletterURL:"https://www.linkedin.com/newsletters/7359641376499687424"

\[13\]:

urn:"6982807919197126656"

title:"Monday Morning Thoughts"

description:"Inspirational messages about leadership, business, family, and more. "

logoURL:"https://media.licdn.com/dms/image/v2/D5612AQGBe0211FMfQw/series-logo\_image-shrink\_300\_300/series-logo\_image-shrink\_300\_300/0/1664831138879?e=1761782400&v=beta&t=0zpojPA-tBnJIfSBbMfzPtkXLBZ7e\_\_vZJf2r0gemZs"

authorName:"Mark Haner"

authorProfile:"https://www.linkedin.com/in/markhaner"

authorUrn:"ACoAAAKkn_gBdU1rnZ3g8Ud9mkkpvy0AEbU-Q6M"

frequency:"Published weekly"

newsletterURL:"https://www.linkedin.com/newsletters/6982807919197126656"

\[14\]:

urn:"7205209437454680064"

title:"That Was The Week That Was"

description:"A look at the handful of stories that mattered last week. Title taken from the breakthrough 60’s news satire TV show."

logoURL:"https://media.licdn.com/dms/image/v2/D4E12AQGvcozRcvyQ9A/series-logo\_image-shrink\_300\_300/series-logo\_image-shrink\_300\_300/0/1721189502204?e=1761782400&v=beta&t=K4Avw20p5CLjFJ5UO2Trl-QglLVEoHKX5b8MqydhJZY"

authorName:"John C Abell"

authorProfile:"https://www.linkedin.com/in/johncabell"

authorUrn:"ACoAAABhexABw5_iaCRSRhrVsMAqlWbBxiVEvGY"

frequency:"Published weekly"

newsletterURL:"https://www.linkedin.com/newsletters/7205209437454680064"

\[15\]:

urn:"6973323419845111808"

title:"The Money"

description:"The Money delivers the best consumer news from USA TODAY. We break down financial news and get you to the point."

logoURL:"https://media.licdn.com/dms/image/v2/D5612AQH9Eq7eR9uQkg/series-logo\_image-shrink\_300\_300/series-logo\_image-shrink\_300\_300/0/1662563808443?e=1761782400&v=beta&t=NCqMbfaBaQLDOO66L5PCHdzgE5FZ3bV\_lFAdoWJiKQA"

authorName:"USA TODAY"

authorProfile:"https://www.linkedin.com/company/5502/"

frequency:"Published weekly"

newsletterURL:"https://www.linkedin.com/newsletters/6973323419845111808"

\[16\]:

urn:"7264677059531014146"

title:"The Marketing Collective "

description:"We're continuing to foster a vibrant community of B2B marketing leaders engaging in thoughtful discussions."

logoURL:"https://media.licdn.com/dms/image/v2/D5612AQGF35krDkSS\_w/series-logo\_image-shrink\_300\_300/series-logo\_image-shrink\_300\_300/0/1732033909575?e=1761782400&v=beta&t=BQX-B0RTCOHprhlCz4FhsP4SOxvegIjBsXppvQAysPY"

authorName:"LinkedIn for Marketing"

authorProfile:"https://www.linkedin.com/company/4973896/"

frequency:"Published monthly"

newsletterURL:"https://www.linkedin.com/newsletters/7264677059531014146"

\[17\]:

urn:"7196623567940153344"

title:"From the Wealthfront Blog"

description:"Investing insights, financial education, and more"

logoURL:"https://media.licdn.com/dms/image/v2/D4E12AQFMI-9nnFdnlA/series-logo\_image-shrink\_300\_300/B4EZVNktPzHgAY-/0/1740763223436?e=1761782400&v=beta&t=rOzwnJRg\_\_FTvAjrdi\_fjodBwGlxX3g1-PWPN\_6Gh6s"

authorName:"Wealthfront"

authorProfile:"https://www.linkedin.com/company/219483/"

frequency:"Published monthly"

newsletterURL:"https://www.linkedin.com/newsletters/7196623567940153344"

\[18\]:

urn:"7188618756821008384"

title:"Gametime"

description:"Your weekly dive into LinkedIn Games, community tips and the latest puzzle happenings."

logoURL:"https://media.licdn.com/dms/image/v2/D4D12AQHlVnz9GYeiWA/series-logo\_image-shrink\_300\_300/series-logo\_image-shrink\_300\_300/0/1713900261937?e=1761782400&v=beta&t=EU5PbAfY6sSZx8qs6mxG3bBtd9g6X5Y\_Jef2FT8mpC8"

authorName:"LinkedIn News"

authorProfile:"https://www.linkedin.com/company/11280505/"

frequency:"Published weekly"

newsletterURL:"https://www.linkedin.com/newsletters/7188618756821008384"

\[19\]:

urn:"7326389380695109632"

title:"Sidekicks Conversations"

description:"The takeaways, mindset shifts and backstories from real conversations with leaders who are pushing boundaries."

logoURL:"https://media.licdn.com/dms/image/v2/D4D12AQGESt17kEJjTA/series-logo\_image-shrink\_300\_300/B4DZbK4KU0G8Ac-/0/1747160442889?e=1761782400&v=beta&t=y64v4PKyiehN4KbRnmcCaPDJpygy49C-RhqkIrhtQ48"

authorName:"Mike Sievert"

authorProfile:"https://www.linkedin.com/in/sievert"

authorUrn:"ACoAAAB8gmgBEvs0cNZ2ezbjgswUZjUbs_QPDzo"

frequency:"Published monthly"

newsletterURL:"https://www.linkedin.com/newsletters/7326389380695109632"

school:

\[0\]:

urn:"2928156"

name:"IMG Academy"

logoURL:"https://media.licdn.com/dms/image/v2/C4D0BAQGL1FbhcNq\_QA/company-logo\_400\_400/company-logo\_400\_400/0/1631306829870?e=1761782400&v=beta&t=0y2J1zxD\_LvckIbxEUItjM\_tpcmtrtRZYAF3oZV4Y2A"

followerCount:35592

schoolURL:"https://www.linkedin.com/school/2928156/"

companyURL:"https://www.linkedin.com/company/2928156/"

\[1\]:

urn:"15248569"

name:"Yale University"

logoURL:"https://media.licdn.com/dms/image/v2/C560BAQGGJUjGgSYcWQ/company-logo\_400\_400/company-logo\_400\_400/0/1631385636084?e=1761782400&v=beta&t=js-199etV-1jlYSCiWTSTymtM4GA3dcC9plrgFOaKB4"

followerCount:565778

schoolURL:"https://www.linkedin.com/school/15248569/"

companyURL:"https://www.linkedin.com/company/15248569/"

\[2\]:

urn:"167872"

name:"Y Combinator"

logoURL:"https://media.licdn.com/dms/image/v2/C4D0BAQGPzdBPNxrmEg/company-logo\_400\_400/company-logo\_400\_400/0/1673555093250/y\_combinator\_logo?e=1761782400&v=beta&t=x36Lp8GchxxVLVs94OnbJtFV9s8\_AiNQfENdA4SZ8jY"

followerCount:1452785

schoolURL:"https://www.linkedin.com/school/167872/"

companyURL:"https://www.linkedin.com/company/167872/"

\[3\]:

urn:"2517"

name:"University of California, Berkeley"

logoURL:"https://media.licdn.com/dms/image/v2/D560BAQGwjF\_5CYj\_JQ/company-logo\_400\_400/company-logo\_400\_400/0/1732135669731/uc\_berkeley\_logo?e=1761782400&v=beta&t=HThFOELyrLR\_4QLD7BVIkRD3PafMuJnrlJIzRG8ECPg"

followerCount:984694

schoolURL:"https://www.linkedin.com/school/2517/"

companyURL:"https://www.linkedin.com/company/2517/"

\[4\]:

urn:"2519"

name:"University of California, Berkeley, Haas School of Business"

logoURL:"https://media.licdn.com/dms/image/v2/C4E0BAQEc1EFtLIThEw/company-logo\_400\_400/company-logo\_400\_400/0/1631312193135?e=1761782400&v=beta&t=2dJtrK2KqDuoYd\_3CQ8dDRYoxKEexUDQiS0qzAAhWJc"

followerCount:169934

schoolURL:"https://www.linkedin.com/school/2519/"

companyURL:"https://www.linkedin.com/company/2519/"

\[5\]:

urn:"18689652"

name:"San Mateo High School"

logoURL:"https://media.licdn.com/dms/image/v2/C560BAQEvr6rNMWfe-Q/company-logo\_400\_400/company-logo\_400\_400/0/1631407611968/san\_mateo\_high\_school\_logo?e=1761782400&v=beta&t=G6Mhu54-4n002x\_IrcIrYg7rb2ewkBvu4z8llkP\_Anc"

followerCount:2138

schoolURL:"https://www.linkedin.com/school/18689652/"

companyURL:"https://www.linkedin.com/company/18689652/"

\[6\]:

urn:"2842"

name:"University of California, Davis"

logoURL:"https://media.licdn.com/dms/image/v2/C4E0BAQEBG25KNBwuCQ/company-logo\_400\_400/company-logo\_400\_400/0/1630629297217/uc\_davis\_logo?e=1761782400&v=beta&t=qZemvv4lSJ\_CTXfJiSzLHduUH8r8l-zAAgp0RDarkXc"

followerCount:401408

schoolURL:"https://www.linkedin.com/school/2842/"

companyURL:"https://www.linkedin.com/company/2842/"

\[7\]:

urn:"9006914"

name:"UC Berkeley College of Environmental Design"

logoURL:"https://media.licdn.com/dms/image/v2/D4D0BAQFMRIBFo\_OZUA/company-logo\_400\_400/company-logo\_400\_400/0/1729717492991/cedberkeley\_logo?e=1761782400&v=beta&t=Ffp-PDsQnBlqV6rdmQJiPbe8hpzFys08l3m-O7IyGkA"

followerCount:11518

schoolURL:"https://www.linkedin.com/school/9006914/"

companyURL:"https://www.linkedin.com/company/9006914/"

\[8\]:

urn:"1791"

name:"Stanford University Graduate School of Business"

logoURL:"https://media.licdn.com/dms/image/v2/C4D0BAQGyTHJCehyEuA/company-logo\_400\_400/company-logo\_400\_400/0/1630537027992/stanford\_graduate\_school\_of\_business\_logo?e=1761782400&v=beta&t=x21mmINu4XvCUJbgaocWq12dzqtDFNwLsOVUTTTaVJA"

followerCount:545107

schoolURL:"https://www.linkedin.com/school/1791/"

companyURL:"https://www.linkedin.com/company/1791/"
