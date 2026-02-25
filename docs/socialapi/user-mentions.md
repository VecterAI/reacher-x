# Get User Mentions - API Reference | SocialAPI

# Get User Mentions - API Reference

Retrieve user information by their Twitter ID or screen name.

GET https://api.socialapi.me/twitter/user/{username}/mentions?cursor={cursor}

### Headers

Authorization string required

Authorization Bearer header containing your SocialAPI key

Example: Bearer YOUR_API_KEY

### Path Parameters

username string required

Username of the target user profile without @. Either a user_id or username is required for this endpoint.

Example: elonmusk

### Query Parameters

cursor string optional

Cursor value obtained from `next_cursor` response property. Used to retrieve additional pages for the same query

Example: 1890084840239985036

## Code Examples

- [curl](#tab-panel-277)
- [JavaScript](#tab-panel-278)
- [Python](#tab-panel-279)
- [PHP](#tab-panel-280)

Terminal window

```
curl "https://api.socialapi.me/twitter/user/elonmusk/mentions" \    -H 'Authorization: Bearer YOUR_API_KEY' \    -H 'Accept: application/json'
```

```
const username = 'elonmusk';const API_KEY = 'YOUR_API_KEY_HERE';
fetch(`https://api.socialapi.me/twitter/user/${username}/mentions`, {    method: 'GET',    headers: {        'Authorization': `Bearer ${API_KEY}`,        'Accept': 'application/json'    }}).then(response => response.json()).then(response => console.log(response)).catch(err => console.error(err));
```

```
import requests
username = 'elonmusk'API_KEY = 'YOUR_API_KEY_HERE'
url = f'https://api.socialapi.me/twitter/user/{username}/mentions'
headers = {    'Authorization': f'Bearer {API_KEY}',    'Accept': 'application/json'}
response = requests.get(url, headers=headers)
if response.status_code == 200:    data = response.json()    print(data)else:    print(f"Error: {response.status_code}")    print(response.text)
```

```
$username = 'elonmusk';$API_KEY = 'YOUR_API_KEY_HERE';
$url = "https://api.socialapi.me/twitter/user/{$username}/mentions";
$ch = curl_init();
curl_setopt_array($ch, [    CURLOPT_URL => $url,    CURLOPT_RETURNTRANSFER => true,    CURLOPT_HTTPHEADER => [        "Authorization: Bearer $API_KEY",        "Accept: application/json"    ]]);
$response = curl_exec($ch);$data = json_decode($response, true);print_r($data);
curl_close($ch);
```

## Example Responses

- [200](#tab-panel-281)
- [402](#tab-panel-282)
- [404](#tab-panel-283)
- [500](#tab-panel-284)

```
{    "next_cursor": "1890084840239985036",    "tweets": [        {            "tweet_created_at": "2023-12-13T05:39:09.000000Z",            "id_str": "1734810168053956719",            "text": null,            "full_text": "@TeslaHype Pace of Progress",            "source": "<a href=\"http:\\/\\/twitter.com\\/download\\/iphone\" rel=\"nofollow\">Twitter for iPhone<\\/a>",            "truncated": false,            "in_reply_to_status_id_str": "1734777084268920960",            "in_reply_to_user_id_str": "1311506622821400581",            "in_reply_to_screen_name": "TeslaHype",            "user": {                "id_str": "44196397",                "name": "Elon Musk",                "screen_name": "elonmusk",                "location": "\\ud835\\udd4f\\u00d0",                "url": null,                "description": "",                "protected": false,                "verified": false,                "followers_count": 166213349,                "friends_count": 506,                "listed_count": 149586,                "favourites_count": 37958,                "statuses_count": 34934,                "created_at": "2009-06-02T20:12:29.000000Z",                "profile_banner_url": "https:\\/\\/pbs.twimg.com\\/profile_banners\\/44196397\\/1690621312",                "profile_image_url_https": "https:\\/\\/pbs.twimg.com\\/profile_images\\/1683325380441128960\\/yRsRRjGO_normal.jpg",                "can_dm": false            },            "quoted_status_id_str": null,            "is_quote_status": false,            "quoted_status": null,            "retweeted_status": null,            "quote_count": 11,            "reply_count": 156,            "retweet_count": 78,            "favorite_count": 977,            "lang": "en",            "entities": {                "user_mentions": [                    {                        "id_str": "1311506622821400581",                        "name": "Tesla Hype",                        "screen_name": "TeslaHype",                        "indices": [                            0,                            10                        ]                    }                ],                "urls": [],                "hashtags": [],                "symbols": []            },            "views_count": 32377,            "bookmark_count": 19        },        // ...    ]}
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
- **404 Not Found** - requested user does not exist
- **422 Unprocessable Content** - validation failed (e.g. one of the required parameters was not provided)
- **500 Internal Error** - API internal error, typically means that SocialAPI failed to obtain the requested information and you should try again later
