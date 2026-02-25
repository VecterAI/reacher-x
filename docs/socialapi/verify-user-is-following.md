# Verify user is following another user on Twitter/X - Social Actions API | SocialAPI

# Verify user is following another user on Twitter/X - Social Actions API

This endpoint provides a convenient way to check if a user (identified by `source_user_id`) is following another user (identified by `target_user_id`). The endpoint achieves this without scraping the entire followers list which allows us to deliver a fully accurate result with minimal latency.

GET https://api.socialapi.me/twitter/user/{source\_user\_id}/following/{target\_user\_id}

### Headers

Authorization string required

Authorization Bearer header containing your SocialAPI key

Example: Bearer YOUR_API_KEY

### Path Parameters

source_user_id integer required

The numeric ID of the follower user

Example: 1729591119699124560

target_user_id integer required

The numeric ID of the user being followed

Example: 1729591119699124560

## Code Examples

- [curl](#tab-panel-320)
- [JavaScript](#tab-panel-321)
- [Python](#tab-panel-322)
- [PHP](#tab-panel-323)

Terminal window

```
curl "https://api.socialapi.me/twitter/user/1319287761048723458/following/44196397" \    -H 'Authorization: Bearer API_KEY' \    -H 'Accept: application/json'
```

```
const followerId = '1319287761048723458';const targetId = '44196397';const API_KEY = 'YOUR_API_KEY_HERE';
fetch(`https://api.socialapi.me/twitter/user/${followerId}/following/${targetId}`, {    method: 'GET',    headers: {        'Authorization': `Bearer ${API_KEY}`,        'Accept': 'application/json'    }}).then(response => response.json()).then(response => console.log(response)).catch(err => console.error(err));
```

```
import requests
followerId = '1319287761048723458'targetId = '44196397'API_KEY = 'YOUR_API_KEY_HERE'
url = f'https://api.socialapi.me/twitter/user/{followerId}/following/{targetId}'
headers = {    'Authorization': f'Bearer {API_KEY}',    'Accept': 'application/json'}
response = requests.get(url, headers=headers)
if response.status_code == 200:    data = response.json()    print(data)else:    print(f"Error: {response.status_code}")    print(response.text)
```

```
$followerId = '1319287761048723458';$targetId = '44196397';$API_KEY = 'YOUR_API_KEY_HERE';
$url = "https://api.socialapi.me/twitter/user/{$followerId}/following/{$targetId}";
$ch = curl_init();
curl_setopt_array($ch, [    CURLOPT_URL => $url,    CURLOPT_RETURNTRANSFER => true,    CURLOPT_HTTPHEADER => [        "Authorization: Bearer $API_KEY",        "Accept: application/json"    ]]);
$response = curl_exec($ch);$data = json_decode($response, true);print_r($data);
curl_close($ch);
```

## Example Responses

- [200](#tab-panel-316)
- [402](#tab-panel-317)
- [404](#tab-panel-318)
- [500](#tab-panel-319)

```
{    "status": "success",    "source_user_id": "123123123...",    "target_user_id": "456456456...",    "is_following": true,    "followers_checked_count": null // Deprecated, always null}
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
- **404 Not Found** - requested target user does not exist
- **422 Unprocessable Content** - validation failed (e.g. one of the required parameters was not provided)
- **500 Internal Error** - API internal error, typically means that SocialAPI failed to obtain the requested information and you should try again later
