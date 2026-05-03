# Get Tweets in a Twitter Thread - API Reference | SocialAPI

# Get Tweets in a Twitter Thread - API Reference

Returns an array of tweets associated with a thread and a `next_cursor` value used to retrieve more pages (if the thread contains more than 30 posts)

GET https://api.socialapi.me/twitter/thread/{thread\_id}?cursor={cursor}

### Headers

Authorization string required

Authorization Bearer header containing your SocialAPI key

Example: Bearer YOUR_API_KEY

### Path Parameters

thread_id integer required

The numerical ID of the desired thread

Example: 1729591119699124560

### Query Parameters

cursor string optional

Cursor value obtained from next_cursor response property

Example: PAAAAPAtPBwcFoCAsrHQ6pOAKxUC...

## Code Examples

- [curl](#tab-panel-208)
- [JavaScript](#tab-panel-209)
- [Python](#tab-panel-210)
- [PHP](#tab-panel-211)

Terminal window

```
curl "https://api.socialapi.me/twitter/thread/1549281861687451648" \    -H 'Authorization: Bearer API_KEY' \    -H 'Accept: application/json'
```

```
const threadId = '1549281861687451648';const API_KEY = 'YOUR_API_KEY_HERE';
fetch(`https://api.socialapi.me/twitter/thread/${threadId}`, {    method: 'GET',    headers: {        'Authorization': `Bearer ${API_KEY}`,        'Accept': 'application/json'    }}).then(response => response.json()).then(response => console.log(response)).catch(err => console.error(err));
```

```
import requests
threadId = '1549281861687451648'API_KEY = 'YOUR_API_KEY_HERE'
url = f'https://api.socialapi.me/twitter/thread/{threadId}'
headers = {    'Authorization': f'Bearer {API_KEY}',    'Accept': 'application/json'}
response = requests.get(url, headers=headers)
if response.status_code == 200:    data = response.json()    print(data)else:    print(f"Error: {response.status_code}")    print(response.text)
```

```
$threadId = '1549281861687451648';$API_KEY = 'YOUR_API_KEY_HERE';
$url = "https://api.socialapi.me/twitter/thread/{$threadId}";
$ch = curl_init();
curl_setopt_array($ch, [    CURLOPT_URL => $url,    CURLOPT_RETURNTRANSFER => true,    CURLOPT_HTTPHEADER => [        "Authorization: Bearer $API_KEY",        "Accept: application/json"    ]]);
$response = curl_exec($ch);$data = json_decode($response, true);print_r($data);
curl_close($ch);
```

## Example Responses

- [200](#tab-panel-212)
- [402](#tab-panel-213)
- [404](#tab-panel-214)
- [500](#tab-panel-215)

```
{  "tweets": [    {      "tweet_created_at": "2022-07-19T06:35:54+00:00",      "id": 1549281861687451648,      "id_str": "1549281861687451648",      "text": null,      "full_text": "100 tips I learned growing an iOS app to ~$5M in sales in 3 yrs, going through YC 1.5 times, and co-founding @Superwall 👇",      "source": "<a href=\"https:\/\/getchirrapp.com\" rel=\"nofollow\">chirr.app<\/a>",      "truncated": false,      "in_reply_to_status_id": null,      "in_reply_to_status_id_str": null,      "in_reply_to_user_id": null,      "in_reply_to_user_id_str": null,      "in_reply_to_screen_name": null,      "user": {        "id": 15118774,        "id_str": "15118774",        "name": "Jake Mor",        "screen_name": "jakemor",        "location": "New York, USA",        "url": "http:\/\/superwall.com",        "description": "CEO @Superwall — build & test paywalls without shipping updates. Past: Founder @FitnessAI_ (acquired). YC W20 & S21",        "protected": false,        "verified": true,        "followers_count": 5423,        "friends_count": 556,        "listed_count": 95,        "favourites_count": 1161,        "statuses_count": 1683,        "created_at": "2008-06-14T18:37:41+00:00",        "profile_banner_url": "https:\/\/pbs.twimg.com\/profile_banners\/15118774\/1636564314",        "profile_image_url_https": "https:\/\/pbs.twimg.com\/profile_images\/1167559170540875777\/nRn7p8em_normal.jpg",        "can_dm": true      },      "quoted_status_id": null,      "quoted_status_id_str": null,      "is_quote_status": false,      "quoted_status": null,      "retweeted_status": null,      "quote_count": 73,      "reply_count": 105,      "retweet_count": 492,      "favorite_count": 9419,      "views_count": null,      "bookmark_count": 4614,      "lang": "en",      "entities": {        "user_mentions": [          {            "id_str": "1427520876325613571",            "name": "Superwall",            "screen_name": "Superwall",            "indices": [              109,              119            ]          }        ],        "urls": [],        "hashtags": [],        "symbols": []      },      "is_pinned": false    },    ...  ],  "next_cursor": "PAAAAPAtPBwcFoCAsrHQ6pOAKxUCAAAYJmNvbnZlcnNhdGlvbnRocmVhZC0xNTQ5MjgxODYyNDYzNTA0Mzg0IgAA"}
```

```
{    "status": "error",    "message": "Insufficient balance"}
```

```
{    "status": "error",    "message": "Tweet not found"}
```

```
{    "status": "error",    "message": "Failed to fetch data from Twitter"}
```

## Response Codes

- **200 OK** - request succeeded
- **402 Payment Required** - not enough credits to perform this request
- **404 Not Found** - requested tweet does not exist
- **422 Unprocessable Content** - validation failed (e.g. one of the required parameters was not provided)
- **500 Internal Error** - API internal error, typically means that SocialAPI failed to obtain the requested information and you should try again later
