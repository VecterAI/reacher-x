# LinkdAPI - Unofficial API | LinkedIn Data API

# LinkdAPI Documentation

The Ultimate Scalable and Reliable Unofficial API for LinkedIn.

# Get Company Details

Get company Details either By ID or name

API Endpoint

Method

GET

Endpoint URL

`/api/v1/companies/company/info?id=1441&name=google`

Query Parameters

`id`

Optional

company ID

`name`

Optional

company name

Interactive ViewRaw JSON

Raw JSON

Copy

{
"success": true,
"statusCode": 200,
"message": "Data retrieved successfully",
"errors": null,
"data": {
"id": "1441",
"name": "Google",
"universalName": "google",
"linkedinUrl": "https://www.linkedin.com/company/google/",
"description": "A problem isn't truly solved until it's solved for all. Googlers build products that help create opportunities for everyone, whether down the street or across the globe. Bring your insight, imagination and a healthy disregard for the impossible. Bring everything that makes you unique. Together, we can build for everyone.\\n\\nCheck out our career opportunities at goo.gle/3DLEokh",
"type": "COMPANY",
"images": {
"logo": "https://media.licdn.com/dms/image/v2/C4D0BAQHiNSL4Or29cg/company-logo\_400\_400/company-logo\_400\_400/0/1631311446380?e=1759363200&v=beta&t=iFttuk\_hULNmNrq3KH\_faZVvrfR4A40NWhVD4T\_QuvQ",
"cover": "https://media.licdn.com/dms/image/v2/D4E1BAQGppW6ZLvm9Jg/company-background\_400/B4EZge3rcQGUAc-/0/1752864569610/google\_cover?e=1757246400&v=beta&t=yB41H8Sku9IeXxq-iPenPoNt8CUTXl9me9JkDc2W-GU"
},
"isClaimable": false,
"backgroundCoverImages": \[
{
"url": "https://media.licdn.com/dms/image/v2/D4E1BAQGppW6ZLvm9Jg/company-background\_400/B4EZge3rcQGUAc-/0/1752864569610/google\_cover?e=1757246400&v=beta&t=yB41H8Sku9IeXxq-iPenPoNt8CUTXl9me9JkDc2W-GU",
"width": 400,
"height": 67
},
{
"url": "https://media.licdn.com/dms/image/v2/D4E1BAQGppW6ZLvm9Jg/company-background\_200/B4EZge3rcQGUAg-/0/1752864569610/google\_cover?e=1757246400&v=beta&t=sPbW3LytT6PB01LvLlNWhzGHRlS1iYrQjYdH4wWfKTM",
"width": 200,
"height": 33
},
{
"url": "https://media.licdn.com/dms/image/v2/D4E1BAQGppW6ZLvm9Jg/company-background\_10000/B4EZge3rcQGUAY-/0/1752864569610/google\_cover?e=1757246400&v=beta&t=qFQr1GHDcf\_JBSi6KUlpT6KEoTp24vGRtyis0Pp3vEM",
"width": 1692,
"height": 287
}
\],
"logos": \[
{
"url": "https://media.licdn.com/dms/image/v2/C4D0BAQHiNSL4Or29cg/company-logo\_200\_200/company-logo\_200\_200/0/1631311446380?e=1759363200&v=beta&t=lGbuFb5qWVZLEGGoIoOIeOxqIN1jmUR8YjidVVveYnU",
"width": 200,
"height": 200
},
{
"url": "https://media.licdn.com/dms/image/v2/C4D0BAQHiNSL4Or29cg/company-logo\_100\_100/company-logo\_100\_100/0/1631311446380?e=1759363200&v=beta&t=kNH4pfEB\_eDxB3hYl8SPuSaNx\_vRacYgYXL3cS3M4PU",
"width": 100,
"height": 100
},
{
"url": "https://media.licdn.com/dms/image/v2/C4D0BAQHiNSL4Or29cg/company-logo\_400\_400/company-logo\_400\_400/0/1631311446380?e=1759363200&v=beta&t=iFttuk\_hULNmNrq3KH\_faZVvrfR4A40NWhVD4T\_QuvQ",
"width": 400,
"height": 400
}
\],
"staffCount": 315498,
"headquarter": {
"countryCode": "US",
"geographicArea": "CA",
"country": "US",
"city": "Mountain View",
"postalCode": "94043",
"headquarter": true,
"line1": "1600 Amphitheatre Parkway"
},
"locations": \[
{
"countryCode": "GB",
"geographicArea": "England",
"country": "GB",
"city": "London",
"postalCode": "WC2H 8AG",
"headquarter": false,
"line1": "St Giles High Street"
},
{
"countryCode": "IE",
"geographicArea": "County Dublin",
"country": "IE",
"city": "Dublin",
"headquarter": false,
"line1": "Barrow Street"
},
{
"countryCode": "CO",
"geographicArea": "Bogota, D.C.",
"country": "CO",
"city": "Bogota",
"postalCode": "110221",
"headquarter": false,
"line1": "Carrera 11A 94-45"
},
{
"countryCode": "SG",
"geographicArea": "Singapore",
"country": "SG",
"city": "Singapore",
"postalCode": "118484",
"headquarter": false,
"line1": "3 Pasir Panjang Rd"
},
{
"countryCode": "MX",
"geographicArea": "CDMX",
"country": "MX",
"city": "Miguel Hidalgo",
"postalCode": "11000",
"headquarter": false,
"line1": "Montes Urales"
},
{
"countryCode": "IL",
"geographicArea": "Tel Aviv",
"country": "IL",
"city": "Tel Aviv-Yafo",
"postalCode": "67891",
"headquarter": false,
"line1": "Yigal Allon 98"
},
{
"countryCode": "CA",
"geographicArea": "ON",
"country": "CA",
"city": "Toronto",
"postalCode": "M5H 2G4",
"headquarter": false,
"line1": "111 Richmond St W"
},
{
"countryCode": "CA",
"geographicArea": "ON",
"country": "CA",
"city": "Kitchener",
"postalCode": "N2H 5G5",
"headquarter": false,
"line1": "51 Breithaupt St"
},
{
"countryCode": "CL",
"geographicArea": "Santiago Metropolitan",
"country": "CL",
"city": "Las Condes",
"postalCode": "7550000",
"headquarter": false,
"line1": "Avenida Costanera Sur"
},
{
"countryCode": "IT",
"geographicArea": "Lomb.",
"country": "IT",
"city": "Milan",
"postalCode": "20124",
"headquarter": false,
"line1": "Via Federico Confalonieri, 4"
},
{
"countryCode": "PH",
"geographicArea": "National Capital Region",
"country": "PH",
"city": "Taguig City",
"headquarter": false,
"line1": "5th Ave"
},
{
"countryCode": "AU",
"geographicArea": "NSW",
"country": "AU",
"city": "Sydney",
"postalCode": "2009",
"headquarter": false,
"line1": "48 Pirrama Rd"
},
{
"countryCode": "AU",
"geographicArea": "VIC",
"country": "AU",
"city": "Melbourne",
"postalCode": "3000",
"headquarter": false,
"line1": "90 Collins St"
},
{
"countryCode": "CH",
"geographicArea": "ZH",
"country": "CH",
"city": "Zurich",
"postalCode": "8002",
"headquarter": false,
"line1": "Brandschenkestrasse 110"
},
{
"countryCode": "FR",
"geographicArea": "IdF",
"country": "FR",
"city": "Paris",
"postalCode": "75009",
"headquarter": false,
"line1": "8 Rue de Londres"
},
{
"countryCode": "AR",
"geographicArea": "Buenos Aires Autonomous City",
"country": "AR",
"city": "Buenos Aires City",
"postalCode": "1107",
"headquarter": false,
"line1": "Avenida Alicia Moreau de Justo 350"
},
{
"countryCode": "DE",
"geographicArea": "HH",
"country": "DE",
"city": "Hamburg",
"postalCode": "20354",
"headquarter": false,
"line1": "ABC-Strasse 19"
},
{
"countryCode": "DE",
"geographicArea": "BE",
"country": "DE",
"city": "Berlin",
"postalCode": "10117",
"headquarter": false,
"line1": "Unter den Linden 14"
},
{
"countryCode": "DE",
"geographicArea": "BY",
"country": "DE",
"city": "Munich",
"postalCode": "80636",
"headquarter": false,
"line1": "Erika-Mann-Strasse 33"
},
{
"countryCode": "PL",
"geographicArea": "MA",
"country": "PL",
"city": "Warsaw",
"postalCode": "00-125",
"headquarter": false,
"line1": "ulica Emilii Plater 53"
},
{
"countryCode": "NL",
"geographicArea": "North Holland",
"country": "NL",
"city": "Amsterdam",
"postalCode": "1082 MD",
"headquarter": false,
"line1": "Claude Debussylaan 34"
},
{
"countryCode": "ES",
"geographicArea": "Community of Madrid",
"country": "ES",
"city": "Madrid",
"postalCode": "28046",
"headquarter": false,
"line1": "Plaza Pablo Ruiz Picasso"
},
{
"countryCode": "ES",
"geographicArea": "Community of Madrid",
"country": "ES",
"city": "Madrid",
"postalCode": "28020",
"headquarter": false,
"line1": "Plaza Pablo Ruiz Picasso"
},
{
"countryCode": "US",
"geographicArea": "GA",
"country": "US",
"city": "Atlanta",
"postalCode": "30309",
"headquarter": false,
"line1": "10 10th St NE"
},
{
"countryCode": "US",
"geographicArea": "MA",
"country": "US",
"city": "Cambridge",
"postalCode": "02142",
"headquarter": false,
"line1": "355 Main St"
},
{
"countryCode": "US",
"geographicArea": "CA",
"country": "US",
"city": "Mountain View",
"postalCode": "94043",
"headquarter": true,
"line1": "1600 Amphitheatre Parkway"
},
{
"countryCode": "US",
"geographicArea": "CA",
"country": "US",
"city": "San Bruno",
"postalCode": "94066",
"headquarter": false,
"line1": "901 Cherry Ave"
},
{
"countryCode": "US",
"geographicArea": "CA",
"country": "US",
"city": "San Francisco",
"postalCode": "94105",
"headquarter": false,
"line1": "345 Spear St"
},
{
"countryCode": "US",
"geographicArea": "TX",
"country": "US",
"city": "Austin",
"postalCode": "78759",
"headquarter": false,
"line1": "9606 N Mopac Expy"
},
{
"countryCode": "US",
"geographicArea": "CA",
"country": "US",
"city": "Irvine",
"postalCode": "92612",
"headquarter": false,
"line1": "19510 Jamboree Rd"
},
{
"countryCode": "US",
"geographicArea": "CA",
"country": "US",
"city": "Los Angeles",
"postalCode": "90291",
"headquarter": false,
"line1": "340 Main St"
},
{
"countryCode": "US",
"geographicArea": "IL",
"country": "US",
"city": "Chicago",
"postalCode": "60607",
"headquarter": false,
"line1": "320 N Morgan St"
},
{
"countryCode": "US",
"geographicArea": "CO",
"country": "US",
"city": "Boulder",
"postalCode": "80302",
"headquarter": false,
"line1": "2590 Pearl St"
},
{
"countryCode": "US",
"geographicArea": "TX",
"country": "US",
"city": "Frisco",
"postalCode": "75034",
"headquarter": false,
"line1": "6175 Main St"
},
{
"countryCode": "US",
"geographicArea": "MI",
"country": "US",
"city": "Ann Arbor",
"postalCode": "48105",
"headquarter": false,
"line1": "2300 Traverwood Dr"
},
{
"countryCode": "US",
"geographicArea": "DC",
"country": "US",
"city": "Washington",
"postalCode": "20001",
"headquarter": false,
"line1": "25 Massachusetts Ave NW"
},
{
"countryCode": "US",
"geographicArea": "VA",
"country": "US",
"city": "Reston",
"postalCode": "20190",
"headquarter": false,
"line1": "1875 Explorer St"
},
{
"countryCode": "US",
"geographicArea": "WA",
"country": "US",
"city": "Kirkland",
"postalCode": "98033",
"headquarter": false,
"line1": "777 6th St S"
},
{
"countryCode": "US",
"geographicArea": "WA",
"country": "US",
"city": "Seattle",
"postalCode": "98103",
"headquarter": false,
"line1": "601 N 34th St"
},
{
"countryCode": "US",
"geographicArea": "NY",
"country": "US",
"city": "New York",
"postalCode": "10011",
"headquarter": false,
"line1": "111 8th Ave"
},
{
"countryCode": "SE",
"geographicArea": "Stockholm County",
"country": "SE",
"city": "Stockholm",
"postalCode": "111 22",
"headquarter": false,
"line1": "Kungsbron 2"
},
{
"countryCode": "BR",
"geographicArea": "SP",
"country": "BR",
"city": "Sao Paulo",
"postalCode": "04538-133",
"headquarter": false,
"line1": "Avenida Brigadeiro Faria Lima, 3477"
},
{
"countryCode": "HK",
"geographicArea": "Hong Kong",
"country": "HK",
"city": "Wan Chai",
"headquarter": false,
"line1": "2 Matheson St"
},
{
"countryCode": "IN",
"geographicArea": "TS",
"country": "IN",
"city": "Hyderabad",
"postalCode": "500084",
"headquarter": false,
"line1": "13"
},
{
"countryCode": "IN",
"geographicArea": "Maharashtra",
"country": "IN",
"city": "Mumbai",
"postalCode": "400051",
"headquarter": false,
"line1": "3 Bandra Kurla Complex Road"
},
{
"countryCode": "IN",
"geographicArea": "Karnataka",
"country": "IN",
"city": "Bengaluru",
"postalCode": "560016",
"headquarter": false,
"line1": "Old Madras Road"
},
{
"countryCode": "IN",
"geographicArea": "Karnataka",
"country": "IN",
"city": "Bengaluru",
"postalCode": "560016",
"headquarter": false,
"line1": "3 Swamy Vivekananda Road"
},
{
"countryCode": "IN",
"geographicArea": "HR",
"country": "IN",
"city": "Gurugram",
"postalCode": "122001",
"headquarter": false,
"line1": "15"
}
\],
"industriesV2": \[
"Software Development"
\],
"industriesLegacy": \[
"Computer Software"
\],
"specialities": \[
"search",
"ads",
"mobile",
"android",
"online video",
"apps",
"machine learning",
"virtual reality",
"cloud",
"hardware",
"artificial intelligence",
"youtube",
"software"
\],
"website": "https://goo.gle/3DLEokh",
"founded": {
"year": 0,
"month": 0,
"day": 0
},
"callToAction": {
"type": "VIEW_WEBSITE",
"displayText": "Visit website",
"visible": true,
"url": "https://goo.gle/3DLEokh"
},
"followerCount": 38634459,
"staffCountRange": "10,001+ employees",
"crunchbaseUrl": "https://www.crunchbase.com/organization/google",
"topOrganizationListing": {
"rank": 18,
"listName": "LinkedIn Top Companies",
"articleUrl": "https://www.linkedin.com/pulse/linkedin-top-companies-2025-25-best-large-employers-grow-cq7nc/",
"text": "This company has been Ranked on LinkedIn Top Companies"
},
"fundingData": {
"updatedAt": "1754885702",
"numFundingRounds": 3,
"lastFundingRound": {
"fundingType": "Series unknown",
"moneyRaised": {
"amount": "25000000",
"currencyCode": "USD"
},
"numOtherInvestors": 0,
"announcedOn": {
"year": 1999,
"month": 6,
"day": 7
},
"fundingRoundCrunchbaseUrl": "https://www.crunchbase.com/funding\_round/google-series-unknown--6c4715f9",
"investorsCrunchbaseUrl": "https://www.crunchbase.com/funding\_round/google-series-unknown--6c4715f9",
"leadInvestors": null
},
"crunchbaseUrl": "https://www.crunchbase.com/organization/google"
},
"pageVerification": {
"verified": true,
"lastModifiedAt": 1692139093065
},
"availabeTabs": \[
{
"name": "Home",
"tabType": "HOME"
},
{
"name": "About",
"tabType": "ABOUT"
},
{
"name": "Posts",
"tabType": "POSTS"
},
{
"name": "Jobs",
"tabType": "JOBS"
},
{
"name": "Life",
"tabType": "LIFE"
},
{
"name": "People",
"tabType": "PEOPLE"
}
\]
}
}
