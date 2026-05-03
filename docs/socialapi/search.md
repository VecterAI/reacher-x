# Get Search Results - API Reference | SocialAPI

# Get Search Results - API Reference

Returns array of tweets provided by Twitter search page. Typically Twitter returns ~20 results per page. You can request additional search results by sending another request to the same endpoint using cursor parameter.

GET https://api.socialapi.me/twitter/search?query={query}

### Headers

Authorization string required

Authorization Bearer header containing your SocialAPI key

Example: Bearer YOUR_API_KEY

### Query Parameters

query string required

A UTF-8, URL-encoded search query, including any operators supported by Twitter website search

Example: from:elonmusk doge

cursor string optional

Cursor value obtained from `next_cursor` response property. Used to retrieve additional pages for the same query

Example: DAACCgACGC12FhmAJxAKAAMYLXYWGX_Y8AgABAAAAAILAAUAAADoRW1QQzZ3QUFBZlEvZ0d...

type enum optional

Search type (`Latest` for recent tweets or `Top` for popular tweets). Default - `Latest`

Example: Top

## Code Examples

- [curl](#tab-panel-161)
- [JavaScript](#tab-panel-162)
- [Python](#tab-panel-163)
- [PHP](#tab-panel-164)

Terminal window

```
curl "https://api.socialapi.me/twitter/search?query=from%3Aelonmusk&type=Latest" \    -H 'Authorization: Bearer API_KEY' \    -H 'Accept: application/json'
```

```
const query = 'from:elonmusk -filter:replies since_id:1869986946031988780';const API_KEY = 'YOUR_API_KEY_HERE';
fetch(`https://api.socialapi.me/twitter/search?query=${encodeURIComponent(query)}&type=Latest`, {    method: 'GET',    headers: {        'Authorization': `Bearer ${API_KEY}`,        'Accept': 'application/json'    }}).then(response => response.json()).then(response => console.log(response)).catch(err => console.error(err));
```

```
import requests
query = 'from:elonmusk -filter:replies since_id:1869986946031988780'API_KEY = 'YOUR_API_KEY_HERE'
url = f'https://api.socialapi.me/twitter/search?query={requests.utils.quote(query)}&type=Latest'
headers = {    'Authorization': f'Bearer {API_KEY}',    'Accept': 'application/json'}
response = requests.get(url, headers=headers)
if response.status_code == 200:    data = response.json()    print(data)else:    print(f"Error: {response.status_code}")    print(response.text)
```

```
$query = 'from:elonmusk -filter:replies since_id:1869986946031988780';$API_KEY = 'YOUR_API_KEY_HERE';
$url = "https://api.socialapi.me/twitter/search?query=" . urlencode($query) . "&type=Latest";
$ch = curl_init();
curl_setopt_array($ch, [    CURLOPT_URL => $url,    CURLOPT_RETURNTRANSFER => true,    CURLOPT_HTTPHEADER => [        "Authorization: Bearer $API_KEY",        "Accept: application/json"    ]]);
$response = curl_exec($ch);$data = json_decode($response, true);print_r($data);
curl_close($ch);
```

## Example Responses

- [200](#tab-panel-165)
- [402](#tab-panel-166)
- [500](#tab-panel-167)

```
{    "next_cursor": "DAACCgACGC12FhmAJxAKAAMYLXYWGX_Y8AgABAAAAAILAAUAAADoRW1QQzZ3QUFBZlEvZ0dKTjB2R3AvQUFBQUJNWUxTNkQyQmFoUXhndFRReS9Ga0NOR0MwZG9yS1hzU2NZTFFwYm0xY1I0aGd0YmhZc1drQ3FHQzBjUXNSV1lSZ1lMVml5V3BxQU9CZ3RMbUhUV2tDb0dDMVFuVW1YMEFzWUxKYURhOVpob3hndFZtaklGakNNR0MxWGdlT1dZSE1ZTFRYNFNwZUEraGd0Y2h2bEYxRkxHQzFNMi83V1VGc1lMTTZwemhZQWt4Z3RWMkJKbDNGN0dDMWFGTXBYUUY4WUxUUERuRlp3UVE9PQgABgAAAAAIAAcAAAAADAAICgABGCyWg2vWYaMAAAA",    "tweets": [        {            "tweet_created_at": "2023-12-13T05:39:09.000000Z",            "id_str": "1734810168053956719",            "text": null,            "full_text": "@TeslaHype Pace of Progress",            "source": "<a href=\"http:\\/\\/twitter.com\\/download\\/iphone\" rel=\"nofollow\">Twitter for iPhone<\\/a>",            "truncated": false,            "in_reply_to_status_id_str": "1734777084268920960",            "in_reply_to_user_id_str": "1311506622821400581",            "in_reply_to_screen_name": "TeslaHype",            "user": {                "id_str": "44196397",                "name": "Elon Musk",                "screen_name": "elonmusk",                "location": "\\ud835\\udd4f\\u00d0",                "url": null,                "description": "",                "protected": false,                "verified": false,                "followers_count": 166213349,                "friends_count": 506,                "listed_count": 149586,                "favourites_count": 37958,                "statuses_count": 34934,                "created_at": "2009-06-02T20:12:29.000000Z",                "profile_banner_url": "https:\\/\\/pbs.twimg.com\\/profile_banners\\/44196397\\/1690621312",                "profile_image_url_https": "https:\\/\\/pbs.twimg.com\\/profile_images\\/1683325380441128960\\/yRsRRjGO_normal.jpg",                "can_dm": false            },            "quoted_status_id_str": null,            "is_quote_status": false,            "quoted_status": null,            "retweeted_status": null,            "quote_count": 11,            "reply_count": 156,            "retweet_count": 78,            "favorite_count": 977,            "lang": "en",            "entities": {                "user_mentions": [                    {                        "id_str": "1311506622821400581",                        "name": "Tesla Hype",                        "screen_name": "TeslaHype",                        "indices": [                            0,                            10                        ]                    }                ],                "urls": [],                "hashtags": [],                "symbols": []            },            "views_count": 32377,            "bookmark_count": 19        },        {            "tweet_created_at": "2023-12-13T05:38:26.000000Z",            "id_str": "1734809984674693446",            "text": null,            "full_text": "@anammostarac Yeah",            "source": "<a href=\"http:\\/\\/twitter.com\\/download\\/iphone\" rel=\"nofollow\">Twitter for iPhone<\\/a>",            "truncated": false,            "in_reply_to_status_id_str": "1734809562258276654",            "in_reply_to_user_id_str": "2852570664",            "in_reply_to_screen_name": "anammostarac",            "user": {                "id_str": "44196397",                "name": "Elon Musk",                "screen_name": "elonmusk",                "location": "\\ud835\\udd4f\\u00d0",                "url": null,                "description": "",                "protected": false,                "verified": false,                "followers_count": 166213349,                "friends_count": 506,                "listed_count": 149586,                "favourites_count": 37958,                "statuses_count": 34934,                "created_at": "2009-06-02T20:12:29.000000Z",                "profile_banner_url": "https:\\/\\/pbs.twimg.com\\/profile_banners\\/44196397\\/1690621312",                "profile_image_url_https": "https:\\/\\/pbs.twimg.com\\/profile_images\\/1683325380441128960\\/yRsRRjGO_normal.jpg",                "can_dm": false            },            "quoted_status_id_str": null,            "is_quote_status": false,            "quoted_status": null,            "retweeted_status": null,            "quote_count": 4,            "reply_count": 64,            "retweet_count": 30,            "favorite_count": 513,            "lang": "en",            "entities": {                "user_mentions": [                    {                        "id_str": "2852570664",                        "name": "Ana Mostarac",                        "screen_name": "anammostarac",                        "indices": [                            0,                            13                        ]                    }                ],                "urls": [],                "hashtags": [],                "symbols": []            },            "views_count": 25579,            "bookmark_count": 3        }    ]}
```

```
{    "status": "error",    "message": "Insufficient balance"}
```

```
{    "status": "error",    "message": "Failed to fetch data from Twitter"}
```

## Response Codes

- **200 OK** - request succeeded
- **402 Payment Required** - not enough credits to perform this request
- **422 Unprocessable Content** - validation failed (e.g. one of the required parameters was not provided)
- **500 Internal Error** - API internal error, typically means that SocialAPI failed to obtain the requested information and you should try again later

## Using Search Operators

This endpoint supports all [search operators supported by Twitter](/resources/twitter-search-operators). Search operators must be included as part of query parameter and not as separate endpoint parameters.

Some frequently used search operators:

- `@USERNAME -from:USERNAME` — will return all mentions of @username
- `from:USERNAME` — will return all tweets and replies made by user
- `from:USERNAME filter:replies` — will return only replies, but not tweets
- `from:USERNAME -filter:replies` — will return only tweets, but not replies
- `since_time:TIMESTAMP` and `until_time:TIMESTAMP` — will return tweets and comments posted after or before the provided UNIX timestamp
- `since_id:TWEET_ID` and `max_id:TWEET_ID` — will return tweets with ID higher or lower than the provided TWEET_ID
- `conversation_id:TWEET_ID` — will return all comments posted in response to TWEET_ID

For a more detailed overview of Twitter search operators refer to the [following page](/resources/twitter-search-operators)

## Known Limitations

Twitter removes tweets flagged as spam, or all tweets from all shadow-banned users. Request to retrieve tweets or comments made by a shadow-banned user (i.e. `from:USERNAME`) will always return 0 tweets, but the user’s timeline is still available through [User tweets and replies endpoint](/reference/get-user-tweets-replies).

## Retrieving Large Datasets

Occasionally when you need to scrape a large number of tweets, Twitter eventually refuses to provide additional cursor values after scraping too many page with “Latest” search filter. As a workaround, it is possible to cycle through a larger dataset using `max_id:` and `since_id:` search operators.

When retrieving “Latest” search results, Twitter provides the response with tweets sorted by ID in descending order. If you need to retrieve more posts - simply make another request with the same query adding `max_id:[lowest ID from current dataset]`. Using this approach it is possible to extract the entire timeline from the moment an account was registered.
