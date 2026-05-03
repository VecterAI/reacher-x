# Verify user commented on a tweet on Twitter/X - Social Actions API | SocialAPI

# Verify user commented on a tweet on Twitter/X - Social Actions API

This endpoint provides a convenient way to check if a user identified by `user_id` posted a comment in response to a tweet identified by `tweet_id`. This endpoint only detects direct replies to a target tweet, and not comments posted under other comments.

The endpoint returns an array of `comment_ids` taking into account that a single user may have posted more than a single reply.

GET https://api.socialapi.me/twitter/tweets/{tweet\_id}/commented\_by/{user\_id}

### Headers

Authorization string required

Authorization Bearer header containing your SocialAPI key

Example: Bearer YOUR_API_KEY

### Parameters

tweet_id integer required

The numeric ID of the target tweet

Example: 1625802236571033602

user_id integer required

The numeric ID of the user

Example: 1489552236571048124

## Approach

This endpoint performs a number of tests to detect the relevant comment with high accuracy and low latency:

1.  SocialAPI will attempt to retrieve a user’s Tweets and replies page and check if any of their recent replies were posted in response to the target `tweet_id` (i.e. where `in_reply_to_status_id == tweet_id`) - this requires that a user’s profile privacy is set to public and not “protected”
2.  If the previous test fails, SocialAPI will also retrieve Twitter search results for the following query `conversation_id:TWEET_ID` (i.e. any comments posted under the target tweet)

SocialAPI will cache all detected comments on each request and validate subsequent requests against cache to minimize the latency of this endpoint.

## Known Limitations

While in general this endpoint provides highly accurate results, it may occasionally fail to detect any relevant comments, even if the user commented on the target tweet, in the following cases:

- A comment was posted a long time ago and it is not found in the first few pages of the user’s tweets and replies page, or in their comment search results
- A comment was posted by a shadow-banned user (i.e. marked by Twitter as spam/bot account) and their comments don’t show up in search

However, you are unlikely to experience any of these issues if the endpoint is called shortly after the user posted their comment.

Keep in mind that the endpoint will not detect any deleted comments - if a `comment_id` was detected earlier, it will be stored in cache even if the user deletes it, and will be returned in subsequent endpoint responses. If your app needs to detect if any of the relevant comments were deleted - use the [tweet details](/reference/get-tweet) endpoint to retrieve the comment. Any deleted comments will result in error `404 Not Found`

## Code Examples

- [curl](#tab-panel-328)
- [JavaScript](#tab-panel-329)
- [Python](#tab-panel-330)
- [PHP](#tab-panel-331)

Terminal window

```
curl "https://api.socialapi.me/twitter/tweets/456456456/commented_by/123123123" \    -H 'Authorization: Bearer API_KEY' \    -H 'Accept: application/json'
```

```
const tweetId = '456456456';const userId = '123123123';const API_KEY = 'YOUR_API_KEY_HERE';
fetch(`https://api.socialapi.me/twitter/tweets/${tweetId}/commented_by/${userId}`, {    method: 'GET',    headers: {        'Authorization': `Bearer ${API_KEY}`,        'Accept': 'application/json'    }}).then(response => response.json()).then(response => console.log(response)).catch(err => console.error(err));
```

```
import requests
tweetId = '456456456';userId = '123123123';API_KEY = 'YOUR_API_KEY_HERE'
url = f'https://api.socialapi.me/twitter/tweets/{tweetId}/commented_by/{userId}'
headers = {    'Authorization': f'Bearer {API_KEY}',    'Accept': 'application/json'}
response = requests.get(url, headers=headers)
if response.status_code == 200:    data = response.json()    print(data)else:    print(f"Error: {response.status_code}")    print(response.text)
```

```
$tweetId = '456456456';$userId = '123123123';$API_KEY = 'YOUR_API_KEY_HERE';
$url = "https://api.socialapi.me/twitter/tweets/{$tweetId}/commented_by/{$userId}";
$ch = curl_init();
curl_setopt_array($ch, [    CURLOPT_URL => $url,    CURLOPT_RETURNTRANSFER => true,    CURLOPT_HTTPHEADER => [        "Authorization: Bearer $API_KEY",        "Accept: application/json"    ]]);
$response = curl_exec($ch);$data = json_decode($response, true);print_r($data);
curl_close($ch);
```

## Example Responses

- [200](#tab-panel-324)
- [402](#tab-panel-325)
- [404](#tab-panel-326)
- [500](#tab-panel-327)

```
{    "status": "success",    "is_commented": true,    "comment_ids": [        "1111111...",        "2222222...",    ]}
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
