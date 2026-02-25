# Twitter Account Monitoring API - Introduction | SocialAPI

# Twitter Account Monitoring API - Introduction

Monitoring API provides a convenient way to monitor actions by target users and receive notifications.

Five types of monitors are currently supported:

- [**User Tweets Monitor**](/monitoring/create-user-tweets-monitor) - triggered when a user posts a new tweet or makes a new retweet to deliver a nearly instant update
- [**User Following Monitor**](/monitoring/create-user-following-monitor) - triggered when a user follows a new account to deliver a nearly instant update
- [**User Profile Monitor**](/monitoring/create-user-profile-monitor) - triggered when a user makes a change to their Twitter profile information (e.g. bio, location or a website) to deliver a nearly instant update
- [**Search Query Monitor**](/monitoring/create-search-query-monitor) - triggered with a frequency you define and retrieves search results for any custom search query
- [**Pump.Fun Monitor**](/monitoring/create-pump-fun-monitor) - triggered when a new link to pump.fun coin page is posted by any user with at least 1000 followers (only detects non shadow-banned users, i.e. visible in Twitter search)

Once a monitor detects the new tweet or followed user - it will trigger a webhook call to your backend with complete tweet & user data. Refer to [Processing webhook events](/monitoring/processing-webhooks) page for details on webhook payload.

## Getting Started

1.  **Obtain your SocialAPI key**
2.  **Set up your webhook handler**

- Create a webhook endpoint on your own server to handle received webhook events
- Or expose your local development environment through a public URL using [Ngrok](https://ngrok.com) or [Cloudflare Tunnel](https://developers.cloudflare.com/pages/how-to/preview-with-cloudflare-tunnel/) - only recommended while testing, but not for production-ready applications

3.  **Set the webhook URL where you will receive updates**:

- Use `POST /user/webhook` [endpoint](/monitoring/set-global-webhook-url) to set a single default webhook URL that will receive events from all current and future monitors
- Or set `webhook_url` property when creating a new monitor to assign an individual webhook URL to each of your monitors

4.  **Create your first monitor**

# Processing Webhooks - API Reference | SocialAPI

# Processing Webhooks - API Reference

When a monitor detects an update (e.g., a new tweet from the target user), the API makes a `POST` request to your webhook URL. Each webhook request contains a single tweet or user profile. If the API detects multiple updates simultaneously, it dispatches an individual webhook request for each event.

The API first checks for a monitor-specific `webhook_url` (set using one of our “Create monitor” endpoints). If monitor-specific url is not defined, it uses your [default webhook URL](/monitoring/set-global-webhook-url).

Currently, the API does not retry failed requests. However, this behavior may change in the future. We recommend always returning `HTTP Status 200` for successfully received webhook requests.

## Webhook Payload

Each request contains 3 properties:

- `event` defines the type of event that triggered a webhook and will always be one of `new_tweet`, `new_following`, `profile_update`.
- `data` contains the actual data of the event and is consistent with our [tweet details](/reference/get-tweet) or [user details](/reference/get-user-profile) endpoints depending on the type of monitor.
- `meta` contains details of the monitor that triggered the event.

```
{    "event": "new_tweet",    "data": {        // ... Tweet details ...    },    "meta": {        "monitor_id": "01hx1r99s0nsqq1ffdhmyyqbfr",        "monitor_type": "user_tweets",        "monitored_id_str": "44196397",        "monitored_username": "elonmusk"    }}
```

## Event Examples

- [New Following](#tab-panel-72)
- [New Tweet](#tab-panel-73)
- [Profile Update](#tab-panel-74)
- [New Pump.fun Tweet](#tab-panel-75)

```
{  "event": "new_following",  "data": {    "id": 295218901,    "id_str": "295218901",    "name": "vitalik.eth",    "screen_name": "VitalikButerin",    "location": "Earth",    "url": null,    "description": "mi pinxe lo crino tcati",    "protected": false,    "verified": true,    "followers_count": 5702740,    "friends_count": 465,    "listed_count": 37058,    "favourites_count": 8856,    "statuses_count": 20628,    "created_at": "2011-05-08T16:03:03.000000Z",    "profile_banner_url": "https://pbs.twimg.com/profile_banners/295218901/1638557376",    "profile_image_url_https": "https://pbs.twimg.com/profile_images/1880759276169224192/rXpjZO0A_normal.jpg",    "can_dm": false  },  "meta": {    "monitor_id": "01jkt060zcz108b78fke6hm1g4",    "monitor_type": "user_following",    "monitored_id_str": "44196397",    "monitored_username": "elonmusk"  }}
```

```
{    "event": "new_tweet",    "data": {        "tweet_created_at": "2025-02-12T02:43:10.000000Z",        "id": 1889505498761703504,        "id_str": "1889505498761703504",        "conversation_id_str": "1889505498761703504",        "text": null,        "full_text": "Assange is right!",        "source": "<a href=\"http:\/\/twitter.com\/download\/iphone\" rel=\"nofollow\">Twitter for iPhone<\/a>",        "truncated": false,        "in_reply_to_status_id": null,        "in_reply_to_status_id_str": null,        "in_reply_to_user_id": null,        "in_reply_to_user_id_str": null,        "in_reply_to_screen_name": null,        "user": {            "id": 44196397,            "id_str": "44196397",            "name": "Elon Musk",            "screen_name": "elonmusk",            "location": "",            "url": null,            "description": "",            "protected": false,            "verified": true,            "followers_count": 217258406,            "friends_count": 1013,            "listed_count": 159662,            "favourites_count": 122139,            "statuses_count": 70054,            "created_at": "2009-06-02T20:12:29.000000Z",            "profile_banner_url": "https:\/\/pbs.twimg.com\/profile_banners\/44196397\/1726163678",            "profile_image_url_https": "https:\/\/pbs.twimg.com\/profile_images\/1874558173962481664\/8HSTqIlD_normal.jpg",            "can_dm": false        },        "quoted_status_id": null,        "quoted_status_id_str": "1889494636323885155",        "is_quote_status": true,        "quoted_status": {            "tweet_created_at": "2025-02-12T02:00:01.000000Z",            "id": 1889494636323885155,            "id_str": "1889494636323885155",            "conversation_id_str": "1889494636323885155",            "text": null,            "full_text": "\ud83d\udea8ASSANGE ON USAID: \u2018CIVIL SOCIETY IS A FABLE\u2019\n\nAssange exposed how NGOs have been co-opted into political weapons, arguing that civil society is no longer independent but a \u201cbuyer\u2019s market\u201d for influence:\n\n\u201cThe last forty years have seen a huge proliferation of think tanks and political NGOs whose purpose, beneath all the verbiage, is to execute political agendas by proxy.\u201d\n\nHe singled out USAID, Freedom House, and \u2018civil society\u2019 events as vehicles for Western political interests masquerading as grassroots activism.\n\nSource: @WikiLeaks",            "source": "<a href=\"http:\/\/twitter.com\" rel=\"nofollow\">Twitter Web Client<\/a>",            "truncated": false,            "in_reply_to_status_id": null,            "in_reply_to_status_id_str": null,            "in_reply_to_user_id": null,            "in_reply_to_user_id_str": null,            "in_reply_to_screen_name": null,            "user": {                "id": 1319287761048723458,                "id_str": "1319287761048723458",                "name": "Mario Nawfal",                "screen_name": "MarioNawfal",                "location": "",                "url": "https:\/\/roundtable.live",                "description": "Largest Show on X | Founder @ibcgroupio",                "protected": false,                "verified": true,                "followers_count": 2030538,                "friends_count": 44251,                "listed_count": 8614,                "favourites_count": 144210,                "statuses_count": 109900,                "created_at": "2020-10-22T14:42:25.000000Z",                "profile_banner_url": "https:\/\/pbs.twimg.com\/profile_banners\/1319287761048723458\/1736691634",                "profile_image_url_https": "https:\/\/pbs.twimg.com\/profile_images\/1670905743619268609\/pYItlWat_normal.jpg",                "can_dm": true            },            "quoted_status_id": null,            "quoted_status_id_str": null,            "is_quote_status": false,            "quoted_status": null,            "retweeted_status": null,            "quote_count": 16,            "reply_count": 51,            "retweet_count": 350,            "favorite_count": 871,            "views_count": 26067,            "bookmark_count": 54,            "lang": "en",            "entities": {                "user_mentions": [                    {                        "id_str": "16589206",                        "name": "WikiLeaks",                        "screen_name": "WikiLeaks",                        "indices": [                            532,                            542                        ]                    }                ],                "urls": [],                "hashtags": [],                "symbols": []            },            "is_pinned": false        },        "retweeted_status": null,        "quote_count": 0,        "reply_count": 7,        "retweet_count": 0,        "favorite_count": 1,        "views_count": null,        "bookmark_count": 2,        "lang": "en",        "entities": {            "user_mentions": [],            "urls": [],            "hashtags": [],            "symbols": []        },        "is_pinned": false    },    "meta": {        "monitor_id": "01jkt060zcz108b78fke6hm1g4",        "monitor_type": "user_tweets",        "monitored_id_str": "44196397",        "monitored_username": "elonmusk"    }}
```

```
{    "event": "profile_update",    "data": {      "id": 44196397,      "id_str": "44196397",      "name": "Kekius Maximus",      "screen_name": "elonmusk",      "location": "",      "url": null,      "description": "",      "protected": false,      "verified": true,      "followers_count": 217258406,      "friends_count": 1013,      "listed_count": 159662,      "favourites_count": 122139,      "statuses_count": 70054,      "created_at": "2009-06-02T20:12:29.000000Z",      "profile_banner_url": "https://pbs.twimg.com/profile_banners/44196397/1726163678",      "profile_image_url_https": "https://pbs.twimg.com/profile_images/1874558173962481664/8HSTqIlD_normal.jpg",      "can_dm": false,      "changes": {        "name": {            "old": "Elon Musk",            "new": "Kekius Maximus"        }    },    "meta": {        "monitor_id": "01jkt060zcz108b78fke6hm1g4",        "monitor_type": "user_profile",        "monitored_id_str": "44196397",        "monitored_username": "elonmusk"    }}
```

```
{    "event": "new_tweet",    "data": {        "tweet_created_at": "2025-03-11T04:49:55.000000Z",        "id": 1899321865522331859,        "id_str": "1899321865522331859",        "conversation_id_str": "1899321865522331859",        "text": null,        "full_text": "https:\/\/t.co\/HxlxOljYWB\n\nLFG \ud83d\ude80\ud83d\ude80\ud83d\ude80",        "source": "<a href=\"http:\/\/twitter.com\/download\/iphone\" rel=\"nofollow\">Twitter for iPhone<\/a>",        "truncated": false,        "in_reply_to_status_id": null,        "in_reply_to_status_id_str": null,        "in_reply_to_user_id": null,        "in_reply_to_user_id_str": null,        "in_reply_to_screen_name": null,        "user": {            "id": 1066319257951064069,            "id_str": "1066319257951064069",            "name": "Rohan Cerveli | TDO",            "screen_name": "rohancerv",            "location": "",            "url": "http:\/\/safemoon.meme",            "description": "No X support No Airdrops No giveaways \u2026 Just Advice \ud83d\ude02\ud83e\udef6\ud83c\udffe",            "protected": false,            "verified": true,            "followers_count": 1921,            "friends_count": 76,            "listed_count": 8,            "favourites_count": 19810,            "statuses_count": 17926,            "created_at": "2018-11-24T13:14:57.000000Z",            "profile_banner_url": "https:\/\/pbs.twimg.com\/profile_banners\/1066319257951064069\/1740427809",            "profile_image_url_https": "https:\/\/pbs.twimg.com\/profile_images\/1879574201641648128\/TMsKFPwm_normal.jpg",            "can_dm": true        },        "quoted_status_id": null,        "quoted_status_id_str": null,        "is_quote_status": false,        "quoted_status": null,        "retweeted_status": null,        "quote_count": 0,        "reply_count": 0,        "retweet_count": 0,        "favorite_count": 0,        "views_count": null,        "bookmark_count": 0,        "lang": "und",        "entities": {            "hashtags": [],            "symbols": [],            "timestamps": [],            "urls": [                {                    "display_url": "pump.fun\/coin\/FaGkRQrH3\u2026",                    "expanded_url": "https:\/\/pump.fun\/coin\/FaGkRQrH3Zop9XD8F7q7yS7dRT3JqZ7B7CfwG59opump",                    "url": "https:\/\/t.co\/HxlxOljYWB",                    "indices": [                        0,                        23                    ]                }            ],            "user_mentions": []        },        "is_pinned": false    },    "meta": {        "monitor_id": "01jmsjfcer1yhqb2qxgr3812f6",        "monitor_type": "search_pump_fun"    }}
```

# Set Global Webhook URL - API Reference | SocialAPI

# Set Global Webhook URL - API Reference

Used to set webhook URL that will be used for all monitors that don’t have a monitor-specific `webhook_url` set

POST https://api.socialapi.me/user/webhook

### Headers

Authorization string required

Authorization Bearer header containing your SocialAPI key

Example: Bearer YOUR_API_KEY

### Body

url string required

New webhook URL that will be used for all monitors that don't have an individual webhook_url set

Example: https://my-website.com/webhook

## Code Examples

- [curl](#tab-panel-78)
- [JavaScript](#tab-panel-79)
- [Python](#tab-panel-80)
- [PHP](#tab-panel-81)

Terminal window

```
curl -X POST "https://api.socialapi.me/user/webhook" \    -H 'Authorization: Bearer YOUR_API_KEY' \    -H 'Content-Type: application/json' \    -H 'Accept: application/json' \    -d '{"url": "https://my-website.com/webhook"}'
```

```
const API_KEY = 'YOUR_API_KEY_HERE';const webhookUrl = 'https://my-website.com/webhook';
fetch('https://api.socialapi.me/user/webhook', {    method: 'POST',    headers: {        'Authorization': `Bearer ${API_KEY}`,        'Content-Type': 'application/json',        'Accept': 'application/json'    },    body: JSON.stringify({ url: webhookUrl })}).then(response => response.json()).then(response => console.log(response)).catch(err => console.error(err));
```

```
import requests
API_KEY = 'YOUR_API_KEY_HERE'webhook_url = 'https://my-website.com/webhook'
url = 'https://api.socialapi.me/user/webhook'
headers = {    'Authorization': f'Bearer {API_KEY}',    'Content-Type': 'application/json',    'Accept': 'application/json'}
payload = {'url': webhook_url}
response = requests.post(url, json=payload, headers=headers)
if response.status_code == 200:    data = response.json()    print(data)else:    print(f"Error: {response.status_code}")    print(response.text)
```

```
$API_KEY = 'YOUR_API_KEY_HERE';$webhook_url = 'https://my-website.com/webhook';
$url = "https://api.socialapi.me/user/webhook";
$ch = curl_init();
curl_setopt_array($ch, [    CURLOPT_URL => $url,    CURLOPT_RETURNTRANSFER => true,    CURLOPT_POST => true,    CURLOPT_POSTFIELDS => json_encode(['url' => $webhook_url]),    CURLOPT_HTTPHEADER => [        "Authorization: Bearer $API_KEY",        "Content-Type: application/json",        "Accept: application/json"    ]]);
$response = curl_exec($ch);$data = json_decode($response, true);print_r($data);
curl_close($ch);
```

## Example Responses

- [200](#tab-panel-76)
- [404](#tab-panel-77)

```
{  "status": "success",  "message": "Webhook URL updated"}
```

```
{    "status": "error",    "message": "Not found"}
```

## Response Codes

- **200 OK** - request succeeded
- **404 Not Found** - requested tweet does not exist
- **422 Unprocessable Content** - validation failed (e.g. one of the required parameters was not provided)
- **500 Internal Error** - API internal error, typically means that SocialAPI failed to obtain the requested information and you should try again later

# Create New User Tweets Monitor - API Reference | SocialAPI

# Create New User Tweets Monitor - API Reference

Creates a new monitor to receive alerts when the target Twitter posts a new tweet or makes a retweet.

When adding a new monitor SocialAPI will attempt to fetch user details and return `HTTP Status 422` in case the user timeline is protected or user not found.

POST https://api.socialapi.me/monitors/user-tweets

### Headers

Authorization string required

Authorization Bearer header containing your SocialAPI key

Example: Bearer YOUR_API_KEY

### Body

user_id integer required

User ID of the target user. Required if `user_screen_name` not provided

Example: 1493446837214187523

user_screen_name string required

Username of the target user without @. Required if `user_id` not provided

Example: elonmusk

webhook_url string optional

Monitor-specific webhook URL that will override your [global webhook URL](/monitoring/set-global-webhook-url). Not required.

If you want to send events to Discord or Telegram, please read the [following section](#receiving-events-in-telegram-or-discord)

Example: https://my-website.com/webhook

## Code Examples

- [curl](#tab-panel-42)
- [JavaScript](#tab-panel-43)
- [Python](#tab-panel-44)
- [PHP](#tab-panel-45)

Terminal window

```
curl -X POST "https://api.socialapi.me/monitors/user-tweets" \    -H 'Authorization: Bearer YOUR_API_KEY' \    -H 'Content-Type: application/json' \    -H 'Accept: application/json' \    -d '{"user_id": 1493446837214187523}'
```

```
const API_KEY = 'YOUR_API_KEY_HERE';const userId = 1493446837214187523;
fetch('https://api.socialapi.me/monitors/user-tweets', {    method: 'POST',    headers: {        'Authorization': `Bearer ${API_KEY}`,        'Content-Type': 'application/json',        'Accept': 'application/json'    },    body: JSON.stringify({ user_id: userId })}).then(response => response.json()).then(response => console.log(response)).catch(err => console.error(err));
```

```
import requests
API_KEY = 'YOUR_API_KEY_HERE'user_id = 1493446837214187523
url = 'https://api.socialapi.me/monitors/user-tweets'
headers = {    'Authorization': f'Bearer {API_KEY}',    'Content-Type': 'application/json',    'Accept': 'application/json'}
payload = {'user_id': user_id}
response = requests.post(url, json=payload, headers=headers)
if response.status_code == 200:    data = response.json()    print(data)else:    print(f"Error: {response.status_code}")    print(response.text)
```

```
$API_KEY = 'YOUR_API_KEY_HERE';$user_id = 1493446837214187523;
$url = "https://api.socialapi.me/monitors/user-tweets";
$ch = curl_init();
curl_setopt_array($ch, [    CURLOPT_URL => $url,    CURLOPT_RETURNTRANSFER => true,    CURLOPT_POST => true,    CURLOPT_POSTFIELDS => json_encode(['user_id' => $user_id]),    CURLOPT_HTTPHEADER => [        "Authorization: Bearer $API_KEY",        "Content-Type: application/json",        "Accept: application/json"    ]]);
$response = curl_exec($ch);$data = json_decode($response, true);print_r($data);
curl_close($ch);
```

## Example Responses

- [200](#tab-panel-38)
- [402](#tab-panel-39)
- [404](#tab-panel-40)
- [500](#tab-panel-41)

```
{  "status": "success",  "data": {    "id": "01jm2569nf8jnn50zd8302vnpr",    "created_at": "2025-02-14T11:58:33.000000Z",    "monitor_type": "user_tweets",    "webhook_url": null,    "parameters": {      "user_screen_name": "MarioNawfal",      "user_name": "Mario Nawfal",      "user_id_str": "1319287761048723458"    }  }}
```

```
{    "status": "error",    "message": "Insufficient balance"}
```

```
{    "status": "error",    "message": "Not found"}
```

```
{    "status": "error",    "message": "Failed to fetch data from Twitter"}
```

## Response Codes

- **200 OK** - request succeeded
- **402 Payment Required** - not enough credits to perform this request
- **422 Unprocessable Content** - validation failed (e.g. one of the required parameters was not provided)
- **500 Internal Error** - API internal error, typically means that SocialAPI failed to obtain the requested information and you should try again later

## Webhook Payload Example

When a monitor detects a new tweet posted by the target user, the API will make a `POST` request to your webhook URL with the following payload:

- [json](#tab-panel-36)
- [TypeScript](#tab-panel-37)

```
{    "event": "new_tweet",    "data": {        "tweet_created_at": "2025-02-12T02:43:10.000000Z",        "id": 1889505498761703504,        "id_str": "1889505498761703504",        "conversation_id_str": "1889505498761703504",        "text": null,        "full_text": "Assange is right!",        "source": "<a href=\"http:\/\/twitter.com\/download\/iphone\" rel=\"nofollow\">Twitter for iPhone<\/a>",        "truncated": false,        "in_reply_to_status_id": null,        "in_reply_to_status_id_str": null,        "in_reply_to_user_id": null,        "in_reply_to_user_id_str": null,        "in_reply_to_screen_name": null,        "user": {            "id": 44196397,            "id_str": "44196397",            "name": "Elon Musk",            "screen_name": "elonmusk",            "location": "",            "url": null,            "description": "",            "protected": false,            "verified": true,            "followers_count": 217258406,            "friends_count": 1013,            "listed_count": 159662,            "favourites_count": 122139,            "statuses_count": 70054,            "created_at": "2009-06-02T20:12:29.000000Z",            "profile_banner_url": "https:\/\/pbs.twimg.com\/profile_banners\/44196397\/1726163678",            "profile_image_url_https": "https:\/\/pbs.twimg.com\/profile_images\/1874558173962481664\/8HSTqIlD_normal.jpg",            "can_dm": false        },        "quoted_status_id": null,        "quoted_status_id_str": "1889494636323885155",        "is_quote_status": true,        "quoted_status": {            "tweet_created_at": "2025-02-12T02:00:01.000000Z",            "id": 1889494636323885155,            "id_str": "1889494636323885155",            "conversation_id_str": "1889494636323885155",            "text": null,            "full_text": "\ud83d\udea8ASSANGE ON USAID: \u2018CIVIL SOCIETY IS A FABLE\u2019\n\nAssange exposed how NGOs have been co-opted into political weapons, arguing that civil society is no longer independent but a \u201cbuyer\u2019s market\u201d for influence:\n\n\u201cThe last forty years have seen a huge proliferation of think tanks and political NGOs whose purpose, beneath all the verbiage, is to execute political agendas by proxy.\u201d\n\nHe singled out USAID, Freedom House, and \u2018civil society\u2019 events as vehicles for Western political interests masquerading as grassroots activism.\n\nSource: @WikiLeaks",            "source": "<a href=\"http:\/\/twitter.com\" rel=\"nofollow\">Twitter Web Client<\/a>",            "truncated": false,            "in_reply_to_status_id": null,            "in_reply_to_status_id_str": null,            "in_reply_to_user_id": null,            "in_reply_to_user_id_str": null,            "in_reply_to_screen_name": null,            "user": {                "id": 1319287761048723458,                "id_str": "1319287761048723458",                "name": "Mario Nawfal",                "screen_name": "MarioNawfal",                "location": "",                "url": "https:\/\/roundtable.live",                "description": "Largest Show on X | Founder @ibcgroupio",                "protected": false,                "verified": true,                "followers_count": 2030538,                "friends_count": 44251,                "listed_count": 8614,                "favourites_count": 144210,                "statuses_count": 109900,                "created_at": "2020-10-22T14:42:25.000000Z",                "profile_banner_url": "https:\/\/pbs.twimg.com\/profile_banners\/1319287761048723458\/1736691634",                "profile_image_url_https": "https:\/\/pbs.twimg.com\/profile_images\/1670905743619268609\/pYItlWat_normal.jpg",                "can_dm": true            },            "quoted_status_id": null,            "quoted_status_id_str": null,            "is_quote_status": false,            "quoted_status": null,            "retweeted_status": null,            "quote_count": 16,            "reply_count": 51,            "retweet_count": 350,            "favorite_count": 871,            "views_count": 26067,            "bookmark_count": 54,            "lang": "en",            "entities": {                "user_mentions": [                    {                        "id_str": "16589206",                        "name": "WikiLeaks",                        "screen_name": "WikiLeaks",                        "indices": [                            532,                            542                        ]                    }                ],                "urls": [],                "hashtags": [],                "symbols": []            },            "is_pinned": false        },        "retweeted_status": null,        "quote_count": 0,        "reply_count": 7,        "retweet_count": 0,        "favorite_count": 1,        "views_count": null,        "bookmark_count": 2,        "lang": "en",        "entities": {            "user_mentions": [],            "urls": [],            "hashtags": [],            "symbols": []        },        "is_pinned": false    },    "meta": {        "monitor_id": "01jkt060zcz108b78fke6hm1g4",        "monitor_type": "user_tweets",        "monitored_id_str": "44196397",        "monitored_username": "elonmusk"    }}
```

```
interface NewTweetEvent {  event: string;  data: Tweet;  meta: {    monitor_id: string;    monitor_type: string;    monitored_id_str: string;    monitored_username: string;  };}
interface Tweet {  tweet_created_at: string;  id: number;  id_str: string;  conversation_id_str: string | null;  text: string | null;  full_text: string;  source: string;  truncated: boolean;  in_reply_to_status_id: number | null;  in_reply_to_status_id_str: string | null;  in_reply_to_user_id: number | null;  in_reply_to_user_id_str: string | null;  in_reply_to_screen_name: string | null;  user: User;  quoted_status_id: number | null;  quoted_status_id_str: string | null;  is_quote_status: boolean;  quoted_status: Tweet | null;  retweeted_status: Tweet | null;  quote_count: number;  reply_count: number;  retweet_count: number;  favorite_count: number;  views_count: number | null;  bookmark_count: number;  lang: string;  entities: any;  is_pinned: boolean;}
interface User {  id: number;  id_str: string;  name: string;  screen_name: string;  location: string;  url: string | null;  description: string;  protected: boolean;  verified: boolean;  followers_count: number;  friends_count: number;  listed_count: number;  favourites_count: number;  statuses_count: number;  created_at: string;  profile_banner_url: string;  profile_image_url_https: string;  can_dm: boolean;}
```

# Create Twitter User Following Monitor - API Reference | SocialAPI

# Create Twitter User Following Monitor - API Reference

Creates a new monitor to receive alerts when the target Twitter user follows someone.

POST https://api.socialapi.me/monitors/user-following

### Headers

Authorization string required

Authorization Bearer header containing your SocialAPI key

Example: Bearer YOUR_API_KEY

### Body

user_id integer required

User ID of the target user. Required if `user_screen_name` not provided

Example: 1493446837214187523

user_screen_name string required

Username of the target user without @. Required if `user_id` not provided

Example: elonmusk

webhook_url string optional

Monitor-specific webhook URL that will override your [global webhook URL](/monitoring/set-global-webhook-url). Not required.

If you want to send events to Discord or Telegram, please read the [following section](#receiving-events-in-telegram-or-discord)

Example: https://my-website.com/webhook

## Code Examples

- [curl](#tab-panel-22)
- [JavaScript](#tab-panel-23)
- [Python](#tab-panel-24)
- [PHP](#tab-panel-25)

Terminal window

```
curl -X POST "https://api.socialapi.me/monitors/user-following" \    -H 'Authorization: Bearer YOUR_API_KEY' \    -H 'Content-Type: application/json' \    -H 'Accept: application/json' \    -d '{"user_id": 1493446837214187523}'
```

```
const API_KEY = 'YOUR_API_KEY_HERE';const userId = 1493446837214187523;
fetch('https://api.socialapi.me/monitors/user-following', {    method: 'POST',    headers: {        'Authorization': `Bearer ${API_KEY}`,        'Content-Type': 'application/json',        'Accept': 'application/json'    },    body: JSON.stringify({ user_id: userId })}).then(response => response.json()).then(response => console.log(response)).catch(err => console.error(err));
```

```
import requests
API_KEY = 'YOUR_API_KEY_HERE'user_id = 1493446837214187523
url = 'https://api.socialapi.me/monitors/user-following'
headers = {    'Authorization': f'Bearer {API_KEY}',    'Content-Type': 'application/json',    'Accept': 'application/json'}
payload = {'user_id': user_id}
response = requests.post(url, json=payload, headers=headers)
if response.status_code == 200:    data = response.json()    print(data)else:    print(f"Error: {response.status_code}")    print(response.text)
```

```
$API_KEY = 'YOUR_API_KEY_HERE';$user_id = 1493446837214187523;
$url = "https://api.socialapi.me/monitors/user-following";
$ch = curl_init();
curl_setopt_array($ch, [    CURLOPT_URL => $url,    CURLOPT_RETURNTRANSFER => true,    CURLOPT_POST => true,    CURLOPT_POSTFIELDS => json_encode(['user_id' => $user_id]),    CURLOPT_HTTPHEADER => [        "Authorization: Bearer $API_KEY",        "Content-Type: application/json",        "Accept: application/json"    ]]);
$response = curl_exec($ch);$data = json_decode($response, true);print_r($data);
curl_close($ch);
```

## Example Responses

- [200](#tab-panel-19)
- [402](#tab-panel-20)
- [500](#tab-panel-21)

```
{  "status": "success",  "data": {    "id": "01jm2569nf8jnn50zd8302vnpr",    "created_at": "2025-02-14T11:58:33.000000Z",    "monitor_type": "user_following",    "webhook_url": null,    "parameters": {      "user_screen_name": "MarioNawfal",      "user_name": "Mario Nawfal",      "user_id_str": "1319287761048723458"    }  }}
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

## Webhook Payload Example

When a monitor detects a new user followed by the target user, the API will make a `POST` request to your webhook URL with the following payload:

- [json](#tab-panel-17)
- [TypeScript](#tab-panel-18)

```
{  "event": "new_following",  "data": {    "id": 295218901,    "id_str": "295218901",    "name": "vitalik.eth",    "screen_name": "VitalikButerin",    "location": "Earth",    "url": null,    "description": "mi pinxe lo crino tcati",    "protected": false,    "verified": true,    "followers_count": 5702740,    "friends_count": 465,    "listed_count": 37058,    "favourites_count": 8856,    "statuses_count": 20628,    "created_at": "2011-05-08T16:03:03.000000Z",    "profile_banner_url": "https://pbs.twimg.com/profile_banners/295218901/1638557376",    "profile_image_url_https": "https://pbs.twimg.com/profile_images/1880759276169224192/rXpjZO0A_normal.jpg",    "can_dm": false  },  "meta": {    "monitor_id": "01jkt060zcz108b78fke6hm1g4",    "monitor_type": "user_following",    "monitored_id_str": "44196397",    "monitored_username": "elonmusk"  }}
```

```
interface NewFollowingEvent {  event: string;  data: {    id: number;    id_str: string;    name: string;    screen_name: string;    location: string;    url: string | null;    description: string;    protected: boolean;    verified: boolean;    followers_count: number;    friends_count: number;    listed_count: number;    favourites_count: number;    statuses_count: number;    created_at: string;    profile_banner_url: string;    profile_image_url_https: string;    can_dm: boolean;  };  meta: {    monitor_id: string;    monitor_type: string;    monitored_id_str: string;    monitored_username: string;  };}
```

# Create Twitter User Profile Monitor - API Reference | SocialAPI

# Create Twitter User Profile Monitor - API Reference

Creates a new monitor to receive alerts when the target Twitter user changes their profile (e.g. updates their bio or location).

Changes in any of the following user profile properties will trigger an event: `name`, `screen_name`, `location`, `url`, `description`, `profile_banner_url`, `profile_image_url_https`

GET https://api.socialapi.me/monitors/user-profile

### Headers

Authorization string required

Authorization Bearer header containing your SocialAPI key

Example: Bearer YOUR_API_KEY

### Path Parameters

user_id integer required

User ID of the target user. Required if `user_screen_name` not provided

Example: 1493446837214187523

user_screen_name string required

Username of the target user without @. Required if `user_id` not provided

Example: elonmusk

webhook_url string optional

Monitor-specific webhook URL that will override your [global webhook URL](/monitoring/set-global-webhook-url). Not required.

If you want to send events to Discord or Telegram, please read the [following section](#receiving-events-in-telegram-or-discord)

Example: https://my-website.com/webhook

## Code Examples

- [curl](#tab-panel-32)
- [JavaScript](#tab-panel-33)
- [Python](#tab-panel-34)
- [PHP](#tab-panel-35)

Terminal window

```
curl -X POST "https://api.socialapi.me/monitors/user-profile" \    -H 'Authorization: Bearer YOUR_API_KEY' \    -H 'Content-Type: application/json' \    -H 'Accept: application/json' \    -d '{"user_id": 1493446837214187523}'
```

```
const API_KEY = 'YOUR_API_KEY_HERE';const userId = 1493446837214187523;
fetch('https://api.socialapi.me/monitors/user-profile', {    method: 'POST',    headers: {        'Authorization': `Bearer ${API_KEY}`,        'Content-Type': 'application/json',        'Accept': 'application/json'    },    body: JSON.stringify({ user_id: userId })}).then(response => response.json()).then(response => console.log(response)).catch(err => console.error(err));
```

```
import requests
API_KEY = 'YOUR_API_KEY_HERE'user_id = 1493446837214187523
url = 'https://api.socialapi.me/monitors/user-profile'
headers = {    'Authorization': f'Bearer {API_KEY}',    'Content-Type': 'application/json',    'Accept': 'application/json'}
payload = {'user_id': user_id}
response = requests.post(url, json=payload, headers=headers)
if response.status_code == 200:    data = response.json()    print(data)else:    print(f"Error: {response.status_code}")    print(response.text)
```

```
$API_KEY = 'YOUR_API_KEY_HERE';$user_id = 1493446837214187523;
$url = "https://api.socialapi.me/monitors/user-profile";
$ch = curl_init();
curl_setopt_array($ch, [    CURLOPT_URL => $url,    CURLOPT_RETURNTRANSFER => true,    CURLOPT_POST => true,    CURLOPT_POSTFIELDS => json_encode(['user_id' => $user_id]),    CURLOPT_HTTPHEADER => [        "Authorization: Bearer $API_KEY",        "Content-Type: application/json",        "Accept: application/json"    ]]);
$response = curl_exec($ch);$data = json_decode($response, true);print_r($data);
curl_close($ch);
```

## Example Responses

- [200](#tab-panel-28)
- [402](#tab-panel-29)
- [404](#tab-panel-30)
- [500](#tab-panel-31)

```
{  "status": "success",  "data": {    "id": "01jm2569nf8jnn50zd8302vnpr",    "created_at": "2025-02-14T11:58:33.000000Z",    "monitor_type": "user_profile",    "webhook_url": null,    "parameters": {      "user_screen_name": "MarioNawfal",      "user_name": "Mario Nawfal",      "user_id_str": "1319287761048723458"    }  }}
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
- **422 Unprocessable Content** - validation failed (e.g. one of the required parameters was not provided)
- **500 Internal Error** - API internal error, typically means that SocialAPI failed to obtain the requested information and you should try again later

## Webhook Payload Example

When a monitor detects any changes in the profile of your target user, the API will make a `POST` request to your webhook URL with the following payload:

- [json](#tab-panel-26)
- [TypeScript](#tab-panel-27)

```
{    "event": "profile_update",    "data": {      "id": 44196397,      "id_str": "44196397",      "name": "Kekius Maximus",      "screen_name": "elonmusk",      "location": "",      "url": null,      "description": "",      "protected": false,      "verified": true,      "followers_count": 217258406,      "friends_count": 1013,      "listed_count": 159662,      "favourites_count": 122139,      "statuses_count": 70054,      "created_at": "2009-06-02T20:12:29.000000Z",      "profile_banner_url": "https://pbs.twimg.com/profile_banners/44196397/1726163678",      "profile_image_url_https": "https://pbs.twimg.com/profile_images/1874558173962481664/8HSTqIlD_normal.jpg",      "can_dm": false,      "changes": {        "name": {            "old": "Elon Musk",            "new": "Kekius Maximus"        }    },    "meta": {        "monitor_id": "01jkt060zcz108b78fke6hm1g4",        "monitor_type": "user_profile",        "monitored_id_str": "44196397",        "monitored_username": "elonmusk"    }}
```

```
interface ProfileUpdateEvent {  event: string;  data: {    id: number;    id_str: string;    name: string;    screen_name: string;    location: string;    url: string | null;    description: string;    protected: boolean;    verified: boolean;    followers_count: number;    friends_count: number;    listed_count: number;    favourites_count: number;    statuses_count: number;    created_at: string;    profile_banner_url: string;    profile_image_url_https: string;    can_dm: boolean;    changes: {      [key: string]: {        old: string;        new: string;      };    };  };  meta: {    monitor_id: string;    monitor_type: string;    monitored_id_str: string;    monitored_username: string;  };}
```

# Create New Search Query Monitor - API Reference | SocialAPI

# Create New Search Query Monitor - API Reference

Creates a new search query monitor. SocialAPI will run your monitor every `refresh_frequency` seconds and retrieve recent search results for `query` search query.

The monitor will retrieve up to 5 pages of search results (typically ~100 most recent tweets) and dispatch each new tweet as an individual webhook event. The monitor also keeps track of last retrieved tweet and will stop execution when it reaches previously retrieved search results to minimize the cost.

POST https://api.socialapi.me/monitors/search-query

### Headers

Authorization string required

Authorization Bearer header containing your SocialAPI key

Example: Bearer YOUR_API_KEY

### Body

query string required

A UTF-8, URL-encoded search query, including any [operators supported by Twitter website search](/resources/twitter-search-operators)

Example: from:elonmusk doge

refresh_frequency integer required

Monitor update frequency in seconds (value between 1 and 3600)

Example: elonmusk

webhook_url string optional

Monitor-specific webhook URL that will override your [global webhook URL](/monitoring/set-global-webhook-url). Not required.

If you want to send events to Discord or Telegram, please read the [following section](#receiving-events-in-telegram-or-discord)

Example: https://my-website.com/webhook

## Code Examples

- [curl](#tab-panel-13)
- [JavaScript](#tab-panel-14)
- [Python](#tab-panel-15)
- [PHP](#tab-panel-16)

Terminal window

```
curl -X POST "https://api.socialapi.me/monitors/search-query" \    -H 'Authorization: Bearer YOUR_API_KEY' \    -H 'Content-Type: application/json' \    -H 'Accept: application/json' \    -d '{"refresh_frequency": 30, "query": "from:elonmusk"}'
```

```
const API_KEY = 'YOUR_API_KEY_HERE';
fetch('https://api.socialapi.me/monitors/search-query', {    method: 'POST',    headers: {        'Authorization': `Bearer ${API_KEY}`,        'Content-Type': 'application/json',        'Accept': 'application/json'    },    body: JSON.stringify({        refresh_frequency: 30,        query: "from:elonmusk"    })}).then(response => response.json()).then(response => console.log(response)).catch(err => console.error(err));
```

```
import requests
API_KEY = 'YOUR_API_KEY_HERE'
url = 'https://api.socialapi.me/monitors/search-query'
headers = {    'Authorization': f'Bearer {API_KEY}',    'Content-Type': 'application/json',    'Accept': 'application/json'}
payload = {    'refresh_frequency': 30,    'query': 'from:elonmusk'}
response = requests.post(url, headers=headers, json=payload)
if response.status_code == 200:    data = response.json()    print(data)else:    print(f"Error: {response.status_code}")    print(response.text)
```

```
$API_KEY = 'YOUR_API_KEY_HERE';
$url = "https://api.socialapi.me/monitors/search-query";
$ch = curl_init();
$payload = json_encode([    'refresh_frequency' => 30,    'query' => 'from:elonmusk']);
curl_setopt_array($ch, [    CURLOPT_URL => $url,    CURLOPT_RETURNTRANSFER => true,    CURLOPT_POST => true,    CURLOPT_HTTPHEADER => [        "Authorization: Bearer $API_KEY",        "Content-Type: application/json",        "Accept: application/json"    ],    CURLOPT_POSTFIELDS => $payload]);
$response = curl_exec($ch);$data = json_decode($response, true);print_r($data);
curl_close($ch)
```

## Example Responses

- [200](#tab-panel-11)
- [402](#tab-panel-12)

```
{  "status": "success",  "data": {    "id": "01jqty3m3dhg9xpsj373x12ck7",    "created_at": "2025-04-02T09:42:51.000000Z",    "monitor_type": "search_keyword",    "webhook_url": "...",    "parameters": {      "query": "from:elonmusk"    },    "refresh_frequency": "30"  }}
```

```
{    "status": "error",    "message": "Insufficient balance"}
```

## Response Codes

- **200 OK** - request succeeded
- **402 Payment Required** - not enough credits to perform this request
- **422 Unprocessable Content** - validation failed (e.g. one of the required parameters was not provided)

## Webhook Payload Example

When a monitor detects a new tweet that contains the target search `query`, the API will make a `POST` request to your webhook URL with the following payload:

- [json](#tab-panel-9)
- [TypeScript](#tab-panel-10)

```
{    "event": "new_tweet",    "data": {        "tweet_created_at": "2025-02-12T02:43:10.000000Z",        "id": 1889505498761703504,        "id_str": "1889505498761703504",        "conversation_id_str": "1889505498761703504",        "text": null,        "full_text": "Assange is right!",        "source": "<a href=\"http:\/\/twitter.com\/download\/iphone\" rel=\"nofollow\">Twitter for iPhone<\/a>",        "truncated": false,        "in_reply_to_status_id": null,        "in_reply_to_status_id_str": null,        "in_reply_to_user_id": null,        "in_reply_to_user_id_str": null,        "in_reply_to_screen_name": null,        "user": {            "id": 44196397,            "id_str": "44196397",            "name": "Elon Musk",            "screen_name": "elonmusk",            "location": "",            "url": null,            "description": "",            "protected": false,            "verified": true,            "followers_count": 217258406,            "friends_count": 1013,            "listed_count": 159662,            "favourites_count": 122139,            "statuses_count": 70054,            "created_at": "2009-06-02T20:12:29.000000Z",            "profile_banner_url": "https:\/\/pbs.twimg.com\/profile_banners\/44196397\/1726163678",            "profile_image_url_https": "https:\/\/pbs.twimg.com\/profile_images\/1874558173962481664\/8HSTqIlD_normal.jpg",            "can_dm": false        },        "quoted_status_id": null,        "quoted_status_id_str": "1889494636323885155",        "is_quote_status": true,        "quoted_status": {            "tweet_created_at": "2025-02-12T02:00:01.000000Z",            "id": 1889494636323885155,            "id_str": "1889494636323885155",            "conversation_id_str": "1889494636323885155",            "text": null,            "full_text": "\ud83d\udea8ASSANGE ON USAID: \u2018CIVIL SOCIETY IS A FABLE\u2019\n\nAssange exposed how NGOs have been co-opted into political weapons, arguing that civil society is no longer independent but a \u201cbuyer\u2019s market\u201d for influence:\n\n\u201cThe last forty years have seen a huge proliferation of think tanks and political NGOs whose purpose, beneath all the verbiage, is to execute political agendas by proxy.\u201d\n\nHe singled out USAID, Freedom House, and \u2018civil society\u2019 events as vehicles for Western political interests masquerading as grassroots activism.\n\nSource: @WikiLeaks",            "source": "<a href=\"http:\/\/twitter.com\" rel=\"nofollow\">Twitter Web Client<\/a>",            "truncated": false,            "in_reply_to_status_id": null,            "in_reply_to_status_id_str": null,            "in_reply_to_user_id": null,            "in_reply_to_user_id_str": null,            "in_reply_to_screen_name": null,            "user": {                "id": 1319287761048723458,                "id_str": "1319287761048723458",                "name": "Mario Nawfal",                "screen_name": "MarioNawfal",                "location": "",                "url": "https:\/\/roundtable.live",                "description": "Largest Show on X | Founder @ibcgroupio",                "protected": false,                "verified": true,                "followers_count": 2030538,                "friends_count": 44251,                "listed_count": 8614,                "favourites_count": 144210,                "statuses_count": 109900,                "created_at": "2020-10-22T14:42:25.000000Z",                "profile_banner_url": "https:\/\/pbs.twimg.com\/profile_banners\/1319287761048723458\/1736691634",                "profile_image_url_https": "https:\/\/pbs.twimg.com\/profile_images\/1670905743619268609\/pYItlWat_normal.jpg",                "can_dm": true            },            "quoted_status_id": null,            "quoted_status_id_str": null,            "is_quote_status": false,            "quoted_status": null,            "retweeted_status": null,            "quote_count": 16,            "reply_count": 51,            "retweet_count": 350,            "favorite_count": 871,            "views_count": 26067,            "bookmark_count": 54,            "lang": "en",            "entities": {                "user_mentions": [                    {                        "id_str": "16589206",                        "name": "WikiLeaks",                        "screen_name": "WikiLeaks",                        "indices": [                            532,                            542                        ]                    }                ],                "urls": [],                "hashtags": [],                "symbols": []            },            "is_pinned": false        },        "retweeted_status": null,        "quote_count": 0,        "reply_count": 7,        "retweet_count": 0,        "favorite_count": 1,        "views_count": null,        "bookmark_count": 2,        "lang": "en",        "entities": {            "user_mentions": [],            "urls": [],            "hashtags": [],            "symbols": []        },        "is_pinned": false    },    "meta": {        "monitor_id": "01jkt060zcz108b78fke6hm1g4",        "monitor_type": "search_keyword",        "monitored_query": "from:elonmusk"    }}
```

```
interface NewTweetEvent {  event: string;  data: Tweet;  meta: {    monitor_id: string;    monitor_type: string;    monitored_id_str: string;    monitored_username: string;  };}
interface Tweet {  tweet_created_at: string;  id: number;  id_str: string;  conversation_id_str: string | null;  text: string | null;  full_text: string;  source: string;  truncated: boolean;  in_reply_to_status_id: number | null;  in_reply_to_status_id_str: string | null;  in_reply_to_user_id: number | null;  in_reply_to_user_id_str: string | null;  in_reply_to_screen_name: string | null;  user: User;  quoted_status_id: number | null;  quoted_status_id_str: string | null;  is_quote_status: boolean;  quoted_status: Tweet | null;  retweeted_status: Tweet | null;  quote_count: number;  reply_count: number;  retweet_count: number;  favorite_count: number;  views_count: number | null;  bookmark_count: number;  lang: string;  entities: any;  is_pinned: boolean;}
interface User {  id: number;  id_str: string;  name: string;  screen_name: string;  location: string;  url: string | null;  description: string;  protected: boolean;  verified: boolean;  followers_count: number;  friends_count: number;  listed_count: number;  favourites_count: number;  statuses_count: number;  created_at: string;  profile_banner_url: string;  profile_image_url_https: string;  can_dm: boolean;}
```

# Get Monitor Details - API Reference | SocialAPI

# Get Monitor Details - API Reference

Returns monitor details

GET https://api.socialapi.me/monitors/{monitor\_id}

### Headers

Authorization string required

Authorization Bearer header containing your SocialAPI key

Example: Bearer YOUR_API_KEY

### Path Parameters

monitor_id string required

Target monitor ID

Example: 01jeg76qa91b095gttamsbwa6q

## Code Examples

- [curl](#tab-panel-68)
- [JavaScript](#tab-panel-69)
- [Python](#tab-panel-70)
- [PHP](#tab-panel-71)

Terminal window

```
curl "https://api.socialapi.me/monitors/01jeg76qa91b095gttamsbwa6q" \    -H 'Authorization: Bearer YOUR_API_KEY' \    -H 'Accept: application/json'
```

```
const monitorId = '01jeg76qa91b095gttamsbwa6q';const API_KEY = 'YOUR_API_KEY_HERE';
fetch(`https://api.socialapi.me/monitors/${monitorId}`, {    method: 'GET',    headers: {        'Authorization': `Bearer ${API_KEY}`,        'Accept': 'application/json'    }}).then(response => response.json()).then(response => console.log(response)).catch(err => console.error(err));
```

```
import requests
monitor_id = '01jeg76qa91b095gttamsbwa6q'API_KEY = 'YOUR_API_KEY_HERE'
url = f'https://api.socialapi.me/monitors/{monitor_id}'
headers = {    'Authorization': f'Bearer {API_KEY}',    'Accept': 'application/json'}
response = requests.get(url, headers=headers)
if response.status_code == 200:    data = response.json()    print(data)else:    print(f"Error: {response.status_code}")    print(response.text)
```

```
$monitor_id = '01jeg76qa91b095gttamsbwa6q';$API_KEY = 'YOUR_API_KEY_HERE';
$url = "https://api.socialapi.me/monitors/{$monitor_id}";
$ch = curl_init();
curl_setopt_array($ch, [    CURLOPT_URL => $url,    CURLOPT_RETURNTRANSFER => true,    CURLOPT_HTTPHEADER => [        "Authorization: Bearer $API_KEY",        "Accept: application/json"    ]]);
$response = curl_exec($ch);$data = json_decode($response, true);print_r($data);
curl_close($ch);
```

## Example Responses

- [200](#tab-panel-66)
- [404](#tab-panel-67)

```
{  "status": "success",  "data": {    "id": "01jkf3zgfwt8gnpgevxf9w6h58",    "created_at": "2025-02-07T02:31:47.000000Z",    "monitor_type": "user_following",    "webhook_url": null,    "parameters": {      "user_screen_name": "elonmusk",      "user_name": "Elon Musk",      "user_id_str": "44196397"    }  }}
```

```
{    "status": "error",    "message": "Not found"}
```

## Response Codes

- **200 OK** - request succeeded
- **404 Not Found** - requested monitor does not exist
- **500 Internal Error** - API internal error, typically means that SocialAPI failed to obtain the requested information and you should try again later

# List Active Monitors - API Reference | SocialAPI

# List Active Monitors - API Reference

Returns a list of monitors owned by the user

GET https://api.socialapi.me/monitors?page={page}

### Headers

Authorization string required

Authorization Bearer header containing your SocialAPI key

Example: Bearer YOUR_API_KEY

### Query Parameters

page integer optional

Page number. Endpoint returns up to 50 monitors per page

Example: 2

## Code Examples

- [curl](#tab-panel-58)
- [JavaScript](#tab-panel-59)
- [Python](#tab-panel-60)
- [PHP](#tab-panel-61)

Terminal window

```
curl "https://api.socialapi.me/monitors" \    -H 'Authorization: Bearer YOUR_API_KEY' \    -H 'Accept: application/json'
```

```
const API_KEY = 'YOUR_API_KEY_HERE';
fetch('https://api.socialapi.me/monitors', {    method: 'GET',    headers: {        'Authorization': `Bearer ${API_KEY}`,        'Accept': 'application/json'    }}).then(response => response.json()).then(response => console.log(response)).catch(err => console.error(err));
```

```
import requests
API_KEY = 'YOUR_API_KEY_HERE'
url = 'https://api.socialapi.me/monitors'
headers = {    'Authorization': f'Bearer {API_KEY}',    'Accept': 'application/json'}
response = requests.get(url, headers=headers)
if response.status_code == 200:    data = response.json()    print(data)else:    print(f"Error: {response.status_code}")    print(response.text)
```

```
$API_KEY = 'YOUR_API_KEY_HERE';
$url = "https://api.socialapi.me/monitors";
$ch = curl_init();
curl_setopt_array($ch, [    CURLOPT_URL => $url,    CURLOPT_RETURNTRANSFER => true,    CURLOPT_HTTPHEADER => [        "Authorization: Bearer $API_KEY",        "Accept: application/json"    ]]);
$response = curl_exec($ch);$data = json_decode($response, true);print_r($data);
curl_close($ch);
```

## Example Responses

- [200](#tab-panel-62)
- [402](#tab-panel-63)
- [404](#tab-panel-64)
- [500](#tab-panel-65)

```
{  "data": [    {      "id": "01jhfkd7xsvy6afdmwycs1qn61",      "created_at": "2025-01-13T15:30:02.000000Z",      "monitor_type": "user_followers",      "webhook_url": null,      "parameters": {        "user_screen_name": "elon_musk",        "user_name": "Elon Musk",        "user_id_str": "231198744196397360"      }    },    {      "id": "01jhfkdcmt0d8fjbbxqrtqbmck",      "created_at": "2025-01-13T15:30:07.000000Z",      "monitor_type": "user_tweets",      "webhook_url": null,      "parameters": {        "user_screen_name": "elon_musk",        "user_name": "Elon Musk",        "user_id_str": "44196397"      }    },        // ...  ],  "meta": {    "page": 1,    "last_page": 2,    "items_count": 100  }}
```

```
{    "status": "error",    "message": "Insufficient balance"}
```

```
{    "status": "error",    "message": "Not found"}
```

```
{    "status": "error",    "message": "Failed to fetch data from Twitter"}
```

## Response Codes

- **200 OK** - request succeeded
- **404 Not Found** - requested tweet does not exist
- **500 Internal Error** - API internal error, typically means that SocialAPI failed to obtain the requested information and you should try again later

# Edit Monitor Webhook URL - API Reference | SocialAPI

# Edit Monitor Webhook URL - API Reference

Used to update or remove a monitor-specific `webhook_url`. This only updates the webhook URL value associated with a single monitor and does not change your global webhook URL. When monitor-specific webhook is not set, all webhook requests will be routed to your [global webhook URL](/monitoring/set-global-webhook-url)

PATCH https://api.socialapi.me/monitors/{monitor\_id}

### Headers

Authorization string required

Authorization Bearer header containing your SocialAPI key

Example: Bearer YOUR_API_KEY

### Path Parameters

monitor_id string required

Target monitor ID

Example: 01jeg76qa91b095gttamsbwa6q

### Body

webhook_url string required

New webhook URL that will be used for all monitors that don't have an individual webhook_url set. Pass an empty value to remove monitor-specific webhook

Example: https://my-website.com/webhook or NULL

## Code Examples

- [curl](#tab-panel-54)
- [JavaScript](#tab-panel-55)
- [Python](#tab-panel-56)
- [PHP](#tab-panel-57)

Terminal window

```
curl -X PATCH "https://api.socialapi.me/monitors/01jeg76qa91b095gttamsbwa6q" \    -H 'Authorization: Bearer YOUR_API_KEY' \    -H 'Content-Type: application/json' \    -H 'Accept: application/json' \    -d '{"webhook_url": "https://my-website.com/webhook"}'
```

```
const monitorId = '01jeg76qa91b095gttamsbwa6q';const API_KEY = 'YOUR_API_KEY_HERE';const webhookUrl = 'https://my-website.com/webhook';
fetch(`https://api.socialapi.me/monitors/${monitorId}`, {    method: 'PATCH',    headers: {        'Authorization': `Bearer ${API_KEY}`,        'Content-Type': 'application/json',        'Accept': 'application/json'    },    body: JSON.stringify({ webhook_url: webhookUrl })}).then(response => response.json()).then(response => console.log(response)).catch(err => console.error(err));
```

```
import requests
monitor_id = '01jeg76qa91b095gttamsbwa6q'API_KEY = 'YOUR_API_KEY_HERE'webhook_url = 'https://my-website.com/webhook'
url = f'https://api.socialapi.me/monitors/{monitor_id}'
headers = {    'Authorization': f'Bearer {API_KEY}',    'Content-Type': 'application/json',    'Accept': 'application/json'}
payload = {'webhook_url': webhook_url}
response = requests.patch(url, json=payload, headers=headers)
if response.status_code == 200:    data = response.json()    print(data)else:    print(f"Error: {response.status_code}")    print(response.text)
```

```
$monitor_id = '01jeg76qa91b095gttamsbwa6q';$API_KEY = 'YOUR_API_KEY_HERE';$webhook_url = 'https://my-website.com/webhook';
$url = "https://api.socialapi.me/monitors/{$monitor_id}";
$ch = curl_init();
curl_setopt_array($ch, [    CURLOPT_URL => $url,    CURLOPT_RETURNTRANSFER => true,    CURLOPT_CUSTOMREQUEST => 'PATCH',    CURLOPT_POSTFIELDS => json_encode(['webhook_url' => $webhook_url]),    CURLOPT_HTTPHEADER => [        "Authorization: Bearer $API_KEY",        "Content-Type: application/json",        "Accept: application/json"    ]]);
$response = curl_exec($ch);$data = json_decode($response, true);print_r($data);
curl_close($ch);
```

## Example Responses

- [200](#tab-panel-52)
- [404](#tab-panel-53)

```
{  "status": "success",  "data": {    "id": "01jksy1wv06r3jgk8d0bzahhwg",    "created_at": "2025-02-11T07:19:53.000000Z",    "monitor_type": "user_profile",    "webhook_url": "https://my-website.com/webhook", // contains new webhook_url or null    "parameters": {      "user_screen_name": "MarioNawfal",      "user_name": "Mario Nawfal",      "user_id_str": "1319287761048723458"    }  }}
```

```
{    "status": "error",    "message": "Not found"}
```

## Response Codes

- **200 OK** - request succeeded
- **404 Not Found** - requested monitor does not exist

# Delete Monitor - API Reference | SocialAPI

# Delete Monitor - API Reference

Deletes an active monitor. This action stops the API from monitoring new events for the target user profile and halts all future charges associated with this monitor.

DELETE https://api.socialapi.me/monitors/{monitor\_id}

### Headers

Authorization string required

Authorization Bearer header containing your SocialAPI key

Example: Bearer YOUR_API_KEY

### Path Parameters

monitor_id string required

Target monitor ID

Example: 01jeg76qa91b095gttamsbwa6q

## Code Examples

- [curl](#tab-panel-48)
- [JavaScript](#tab-panel-49)
- [Python](#tab-panel-50)
- [PHP](#tab-panel-51)

Terminal window

```
curl -X DELETE "https://api.socialapi.me/monitors/01jeg76qa91b095gttamsbwa6q" \    -H 'Authorization: Bearer YOUR_API_KEY' \    -H 'Accept: application/json'
```

```
const monitorId = '01jeg76qa91b095gttamsbwa6q';const API_KEY = 'YOUR_API_KEY_HERE';
fetch(`https://api.socialapi.me/monitors/${monitorId}`, {    method: 'DELETE',    headers: {        'Authorization': `Bearer ${API_KEY}`,        'Accept': 'application/json'    }}).then(response => response.json()).then(response => console.log(response)).catch(err => console.error(err));
```

```
import requests
monitor_id = '01jeg76qa91b095gttamsbwa6q'API_KEY = 'YOUR_API_KEY_HERE'
url = f'https://api.socialapi.me/monitors/{monitor_id}'
headers = {    'Authorization': f'Bearer {API_KEY}',    'Accept': 'application/json'}
response = requests.delete(url, headers=headers)
if response.status_code == 200:    data = response.json()    print(data)else:    print(f"Error: {response.status_code}")    print(response.text)
```

```
$monitor_id = '01jeg76qa91b095gttamsbwa6q';$API_KEY = 'YOUR_API_KEY_HERE';
$url = "https://api.socialapi.me/monitors/{$monitor_id}";
$ch = curl_init();
curl_setopt_array($ch, [    CURLOPT_URL => $url,    CURLOPT_RETURNTRANSFER => true,    CURLOPT_CUSTOMREQUEST => "DELETE",    CURLOPT_HTTPHEADER => [        "Authorization: Bearer $API_KEY",        "Accept: application/json"    ]]);
$response = curl_exec($ch);$data = json_decode($response, true);print_r($data);
curl_close($ch);
```

## Example Responses

- [200](#tab-panel-46)
- [404](#tab-panel-47)

```
{  "status": "success"}
```

```
{    "status": "error",    "message": "Not found"}
```

## Response Codes

- **200 OK** - request succeeded
- **404 Not Found** - requested monitor does not exist

# Twitter Search Operators | SocialAPI

# Twitter Search Operators

## Search Operators

### Users

- `from:user` — Sent by a particular `@username` e.g. `"dogs from:NASA"`
- `to:user` — Replying to a particular `@username`
- `@user` — Mentioning a particular `@username`. Combine with `-from:username` to get only mentions
- `list:715919216927322112` or `list:esa/astronauts` — Tweets from members of this public list. Use the list ID from the API or with urls like `twitter.com/i/lists/715919216927322112`. List slug is for old list urls like `twitter.com/esa/lists/astronauts`. Cannot be negated, so you can’t search for “not on list”.
- `filter:blue_verified` — From “verified” users that paid $8 for Twitter Blue

### Tweet Type

- `filter:nativeretweets` — Only retweets created using the retweet button. Works well combined with `from:` to show only retweets. Only works within the last 7-10 days or so.
- `include:nativeretweets` — Native retweets are excluded by default. This shows them. In contrast to `filter:`, which shows only retweets, this includes retweets in addition to other tweets. Only works within the last 7-10 days or so.
- `filter:retweets` — Old style retweets (“RT”) + quoted tweets.
- `filter:replies` — Tweet is a reply to another Tweet. good for finding conversations, or threads if you add or remove `to:user`
- `filter:self_threads` — Only self-replies. Tweets that are part of a thread, not replies in other conversations.
- `conversation_id:tweet_id` — Tweets that are part of a thread (direct replies and other replies)
- `filter:quote` — Contain Quote Tweets
- `quoted_tweet_id:tweet_id` — Search for quotes of a specific tweet
- `quoted_user_id:user_id` — Search for all quotes of a specific user, by numeric User ID

### Date & Time

- `until:2021-12-31` — Before (NOT inclusive) a specified date. Combine with a “since” operator for dates between.
- `since:2021-12-31_23:59:59_UTC` — On or after (inclusive) a specified date and time in the specified timezone. 4 digit year, 2 digit month, 2 digit day separated by `-` dashes, an `_` underscore separating the 24 hour clock format hours:minutes:seconds and timezone abbreviation.
- `until:2021-12-31_23:59:59_UTC` — Before (NOT inclusive) a specified date and time in the specified timezone. Combine with a “since” operator for dates between.
- `since_time:1142974200` — On or after a specified unix timestamp in seconds. Combine with the “until” operator for dates between. Maybe easier to use than `since_id` below.
- `until_time:1142974215` — Before a specified unix timestamp in seconds. Combine with a “since” operator for dates between. Maybe easier to use than `max_id` below.
- `since_id:tweet_id` — After (NOT inclusive) a specified Tweet ID
- `max_id:tweet_id` — At or before (inclusive) a specified Tweet ID
- `within_time:2d` or `within_time:3h` or `within_time:5m` or `within_time:30s` — Search within the last number of days, hours, minutes, or seconds

### Tweet Content

- `url:google.com` — urls are tokenized and matched, works very well for subdomains and domains, not so well for long urls, depends on url. Youtube ids work well. Works for both shortened and canonical urls, eg: `gu.com` shortener for `theguardian.com`. When searching for Domains with hyphens in it, you have to replace the hyphen by an underscore (like `url:t_mobile.com`) but underscores `_` are also tokenized out, and may not match
- `lang:en` — Search for tweets in specified language, not always accurate

### Geo

- `near:city` — Geotagged in this place. Also supports Phrases, eg: `near:"The Hague"`
- `within:radius` — Within specific radius of the “near” operator, to apply a limit. Can use km or mi. e.g. `fire near:san-francisco within:10km`
- `geocode:lat,long,radius` — E.g., to get tweets 10km around twitters hq, use `geocode:37.7764685,-122.4172004,10km`
- `place:96683cc9126741d1` — Search tweets by place object ID, e.g.: USA Place ID is `96683cc9126741d1`

### Engagement Filters

- `filter:has_engagement` — Has some engagement (replies, likes, retweets). Can be negated to find tweets with no engagement. Note all of these are mutually exclusive with `filter:nativeretweets` or `include:nativeretweets`, as they apply to the retweet, not the original tweet, so they won’t work as expected.
- `min_retweets:5` — A minimum number of Retweets. Counts seem to be approximate for larger (1000+) values.
- `min_faves:10` — A minimum number of Likes
- `min_replies:100` — A minimum number of replies
- `-min_retweets:500` — A maximum number of Retweets
- `-min_faves:500` — A maximum number of Likes
- `-min_replies:100` — A maximum number of replies

### Media

- `filter:media` — All media types.
- `filter:twimg` — Native Twitter images (`pic.twitter.com` links)
- `filter:images` — All images.
- `filter:videos` — All video types, including native Twitter video and external sources such as Youtube.
- `filter:periscope` — Periscopes
- `filter:native_video` — All Twitter-owned video types (native video, vine, periscope)
- `filter:vine` — Vines (RIP)
- `filter:consumer_video` — Twitter native video only
- `filter:pro_video` — Twitter pro video (Amplify) only
- `filter:spaces` — Twitter Spaces only
- `filter:links` — Only containing some URL, includes media. use `-filter:media` for urls that aren’t media
- `filter:mentions` — Containing any sort of `@mentions`
- `filter:news` — Containing link to a news story. Combine with a list operator to narrow the user set down further
- `filter:safe` — Excluding NSFW content. Excludes content that users have marked as “Potentially Sensitive”. Doesn’t always guarantee SFW results.
- `filter:hashtags` Only Tweets with Hashtags.
