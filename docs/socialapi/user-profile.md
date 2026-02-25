# Get User Profile - API Reference | SocialAPI

# Get User Profile - API Reference

Retrieve user information by their Twitter ID or screen name.

GET https://api.socialapi.me/twitter/user/{user\_id}

GET https://api.socialapi.me/twitter/user/{username}

### Headers

Authorization string required

Authorization Bearer header containing your SocialAPI key

Example: Bearer YOUR_API_KEY

### Path Parameters

user_id integer required

The numerical id of the target user profile. Either a user_id or username is required for this endpoint.

Example: 44196397

username string required

Username of the target user profile without @. Either a user_id or username is required for this endpoint.

Example: elonmusk

## Code Examples

- [curl](#tab-panel-285)
- [JavaScript](#tab-panel-286)
- [Python](#tab-panel-287)
- [PHP](#tab-panel-288)

Terminal window

```
curl "https://api.socialapi.me/twitter/user/elonmusk" \    -H 'Authorization: Bearer API_KEY' \    -H 'Accept: application/json'
# OR
curl "https://api.socialapi.me/twitter/user/343990983" \    -H 'Authorization: Bearer API_KEY' \    -H 'Accept: application/json'
```

```
const username = 'elonmusk';const API_KEY = 'YOUR_API_KEY_HERE';
fetch(`https://api.socialapi.me/twitter/user/${username}`, {    method: 'GET',    headers: {        'Authorization': `Bearer ${API_KEY}`,        'Accept': 'application/json'    }}).then(response => response.json()).then(response => console.log(response)).catch(err => console.error(err));
```

```
import requests
username = 'elonmusk'API_KEY = 'YOUR_API_KEY_HERE'
url = f'https://api.socialapi.me/twitter/user/{username}'
headers = {    'Authorization': f'Bearer {API_KEY}',    'Accept': 'application/json'}
response = requests.get(url, headers=headers)
if response.status_code == 200:    data = response.json()    print(data)else:    print(f"Error: {response.status_code}")    print(response.text)
```

```
$username = 'elonmusk';$API_KEY = 'YOUR_API_KEY_HERE';
$url = "https://api.socialapi.me/twitter/user/{$username}";
$ch = curl_init();
curl_setopt_array($ch, [    CURLOPT_URL => $url,    CURLOPT_RETURNTRANSFER => true,    CURLOPT_HTTPHEADER => [        "Authorization: Bearer $API_KEY",        "Accept: application/json"    ]]);
$response = curl_exec($ch);$data = json_decode($response, true);print_r($data);
curl_close($ch);
```

## Example Responses

- [200](#tab-panel-289)
- [402](#tab-panel-290)
- [404](#tab-panel-291)
- [500](#tab-panel-292)

```
{    "id": 44196397,    "id_str": "44196397",    "name": "Elon Musk",    "screen_name": "elonmusk",    "location": "\\ud835\\udd4f\\u00d0",    "url": null,    "description": "",    "protected": false,    "verified": true,    "followers_count": 166213974,    "friends_count": 506,    "listed_count": 149577,    "favourites_count": 37987,    "statuses_count": 34934,    "created_at": "2009-06-02T20:12:29.000000Z",    "profile_banner_url": "https:\\/\\/pbs.twimg.com\\/profile_banners\\/44196397\\/1690621312",    "profile_image_url_https": "https:\\/\\/pbs.twimg.com\\/profile_images\\/1683325380441128960\\/yRsRRjGO_normal.jpg",    "can_dm": false}
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
