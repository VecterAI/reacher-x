# Verify user retweeted a tweet - Social Actions API | SocialAPI

# Verify user retweeted a tweet - Social Actions API

This endpoint provides a convenient way to check if a user retweeted a tweet identified by `tweet_id`. This will recursively retrieve all users who recently retweeted a tweet and check if the `user_id` is present among the retrieved users.

GET https://api.socialapi.me/twitter/tweets/{tweet\_id}/retweeted\_by/{user\_id}

### Headers

Authorization string required

Authorization Bearer header containing your SocialAPI key

Example: Bearer YOUR_API_KEY

### Path Parameters

tweet_id integer required

The numeric ID of the target tweet

Example: 1625802236571033602

user_id integer required

The numeric ID of the user

Example: 1489552236571048124

## Code Examples

- [curl](#tab-panel-336)
- [JavaScript](#tab-panel-337)
- [Python](#tab-panel-338)
- [PHP](#tab-panel-339)

Terminal window

```
curl "https://api.socialapi.me/twitter/tweets/456456456/retweeted_by/123123123" \    -H 'Authorization: Bearer API_KEY' \    -H 'Accept: application/json'
```

```
const tweetId = '456456456';const userId = '123123123';const API_KEY = 'YOUR_API_KEY_HERE';
fetch(`https://api.socialapi.me/twitter/tweets/${tweetId}/retweeted_by/${userId}`, {    method: 'GET',    headers: {        'Authorization': `Bearer ${API_KEY}`,        'Accept': 'application/json'    }}).then(response => response.json()).then(response => console.log(response)).catch(err => console.error(err));
```

```
import requests
tweetId = '456456456';userId = '123123123';API_KEY = 'YOUR_API_KEY_HERE'
url = f'https://api.socialapi.me/twitter/tweets/{tweetId}/retweeted_by/{userId}'
headers = {    'Authorization': f'Bearer {API_KEY}',    'Accept': 'application/json'}
response = requests.get(url, headers=headers)
if response.status_code == 200:    data = response.json()    print(data)else:    print(f"Error: {response.status_code}")    print(response.text)
```

```
$tweetId = '456456456';$userId = '123123123';$API_KEY = 'YOUR_API_KEY_HERE';
$url = "https://api.socialapi.me/twitter/tweets/{$tweetId}/retweeted_by/{$userId}";
$ch = curl_init();
curl_setopt_array($ch, [    CURLOPT_URL => $url,    CURLOPT_RETURNTRANSFER => true,    CURLOPT_HTTPHEADER => [        "Authorization: Bearer $API_KEY",        "Accept: application/json"    ]]);
$response = curl_exec($ch);$data = json_decode($response, true);print_r($data);
curl_close($ch);
```

## Example Responses

- [200](#tab-panel-332)
- [402](#tab-panel-333)
- [404](#tab-panel-334)
- [500](#tab-panel-335)

```
{    "status": "success",    "source_user_id": "123123123...",    "target_tweet_id": "456456456...",    "is_retweeted": true,    "retweeters_checked_count": null // Deprecated, always null}
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
- **404 Not Found** - requested tweet does not exist
- **422 Unprocessable Content** - validation failed (e.g. one of the required parameters was not provided)
- **500 Internal Error** - API internal error, typically means that SocialAPI failed to obtain the requested information and you should try again later
