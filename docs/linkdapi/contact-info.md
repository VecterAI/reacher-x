# LinkdAPI - Unofficial API | LinkedIn Data API

# LinkdAPI Documentation

The Ultimate Scalable and Reliable Unofficial API for LinkedIn.

# Contact Info

Get contact details for a profile by username

API Endpoint

Method

GET

Endpoint URL

`/api/v1/profile/contact-info?username=hnaser`

Query Parameters

`username`

Optional

Interactive ViewRaw JSON

Raw JSON

Copy

{
"success": true,
"statusCode": 200,
"message": "Data retrieved successfully",
"data": {
"emailAddress": null,
"phoneNumber": null,
"websites": \[
{
"url": "http://backend.husseinnasser.com",
"category": "PERSONAL"
},
{
"url": "https://anchor.fm/s/1eb6d14/podcast/rss",
"category": "RSS"
},
{
"url": "https://www.youtube.com/HusseinNasser-software-engineering",
"category": "OTHER"
}
\]
}
}
