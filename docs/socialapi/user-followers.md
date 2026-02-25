# Get User Followers - API Reference | SocialAPI

# Get User Followers - API Reference

This endpoint returns an array of user profiles that are following the target profile identified by `user_id`. The profiles are returned in reverse chronological order, with the most recent followers appearing on the first page.

GET https://api.socialapi.me/twitter/followers/list?user\_id={user\_id}

### Headers

Authorization string required

Authorization Bearer header containing your SocialAPI key

Example: Bearer YOUR_API_KEY

### Query Parameters

user_id integer required

The numeric ID of the desired user.

Example: 1625802236571033602

cursor string optional

Cursor value obtained from next_cursor response property. Omit this value to retrieve the first page

Example: 4611686018541662731|1741085517660815316

## Code Examples

- [curl](#tab-panel-245)
- [JavaScript](#tab-panel-246)
- [Python](#tab-panel-247)
- [PHP](#tab-panel-248)

Terminal window

```
curl "https://api.socialapi.me/twitter/followers/list?user_id=44196397" \    -H 'Authorization: Bearer API_KEY' \    -H 'Accept: application/json'
```

```
const userId = '44196397';const API_KEY = 'YOUR_API_KEY_HERE';
fetch(`https://api.socialapi.me/twitter/followers/list?user_id=${userId}`, {    method: 'GET',    headers: {        'Authorization': `Bearer ${API_KEY}`,        'Accept': 'application/json'    }}).then(response => response.json()).then(response => console.log(response)).catch(err => console.error(err));
```

```
import requests
userId = '44196397'API_KEY = 'YOUR_API_KEY_HERE'
url = f'https://api.socialapi.me/twitter/followers/list?user_id={userId}'
headers = {    'Authorization': f'Bearer {API_KEY}',    'Accept': 'application/json'}
response = requests.get(url, headers=headers)
if response.status_code == 200:    data = response.json()    print(data)else:    print(f"Error: {response.status_code}")    print(response.text)
```

```
$userId = '44196397';$API_KEY = 'YOUR_API_KEY_HERE';
$url = "https://api.socialapi.me/twitter/followers/list?user_id={$userId}";
$ch = curl_init();
curl_setopt_array($ch, [    CURLOPT_URL => $url,    CURLOPT_RETURNTRANSFER => true,    CURLOPT_HTTPHEADER => [        "Authorization: Bearer $API_KEY",        "Accept: application/json"    ]]);
$response = curl_exec($ch);$data = json_decode($response, true);print_r($data);
curl_close($ch);
```

## Example Responses

- [200](#tab-panel-249)
- [402](#tab-panel-250)
- [404](#tab-panel-251)
- [500](#tab-panel-252)

```
{    "next_cursor": "4611686018541662731|1741080922217775060",    "users": [        {            "id": 1547124452596523008,            "id_str": "1547124452596523008",            "name": "Gwendal Brossard",            "screen_name": "GwendalBrossard",            "location": "Building",            "url": "https:\/\/t.co\/6o4TTYu7LQ",            "description": "I'm an indie maker building products \ud83d\udc68\u200d\ud83d\udcbb @PaletteBrain\u2506https:\/\/t.co\/BEadk6UDlz \u2728",            "protected": false,            "verified": false,            "followers_count": 3557,            "friends_count": 149,            "listed_count": 41,            "favourites_count": 12425,            "statuses_count": 6778,            "created_at": "2022-07-13T07:43:56.000000Z",            "profile_banner_url": "https:\/\/pbs.twimg.com\/profile_banners\/1547124452596523008\/1672736091",            "profile_image_url_https": "https:\/\/pbs.twimg.com\/profile_images\/1572151372455313409\/qq1yH56d_normal.jpg",            "can_dm": true        },        // ...    ]}
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
- **404 Not Found** - requested user not found
- **422 Unprocessable Content** - validation failed (e.g. one of the required parameters was not provided)
- **500 Internal Error** - API internal error, typically means that SocialAPI failed to obtain the requested information and you should try again later
