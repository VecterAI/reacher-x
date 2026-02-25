# Get Multiple User Profiles By Ids - API Reference | SocialAPI

# Get Multiple User Profiles By Ids - API Reference

Retrieve user information for up to 100 users per request.

POST https://api.socialapi.me/twitter/users-by-ids

### Headers

Authorization string required

Authorization Bearer header containing your SocialAPI key

Example: Bearer YOUR_API_KEY

### Body

ids array required

An array of Twitter user ids. Up to 100 ids per request

Example: \["44196397", "1319287761048723458", ...\]

## Code Examples

- [curl](#tab-panel-153)
- [JavaScript](#tab-panel-154)
- [Python](#tab-panel-155)
- [PHP](#tab-panel-156)

Terminal window

```
curl "https://api.socialapi.me/twitter/users-by-id" \    -X POST \    -H 'Authorization: Bearer YOUR_API_KEY' \    -H 'Content-Type: application/json' \    -H 'Accept: application/json' \    -d '{"ids": [44196397, 1319287761048723458]}'
```

```
const ids = ["44196397", "1319287761048723458"];const API_KEY = 'YOUR_API_KEY_HERE';
fetch('https://api.socialapi.me/twitter/users-by-id', {    method: 'POST',    headers: {        'Authorization': `Bearer ${API_KEY}`,        'Content-Type': 'application/json',        'Accept': 'application/json'    },    body: JSON.stringify({ ids })}).then(response => response.json()).then(response => console.log(response)).catch(err => console.error(err));
```

```
import requests
ids = [44196397, 1319287761048723458]API_KEY = 'YOUR_API_KEY_HERE'
url = 'https://api.socialapi.me/twitter/users-by-id'
headers = {    'Authorization': f'Bearer {API_KEY}',    'Content-Type': 'application/json',    'Accept': 'application/json'}
payload = {'ids': ids}
response = requests.post(url, json=payload, headers=headers)
if response.status_code == 200:    data = response.json()    print(data)else:    print(f"Error: {response.status_code}")    print(response.text)
```

```
$ids = [44196397, 1319287761048723458];$API_KEY = 'YOUR_API_KEY_HERE';
$url = "https://api.socialapi.me/twitter/users-by-id";
$ch = curl_init();
curl_setopt_array($ch, [    CURLOPT_URL => $url,    CURLOPT_RETURNTRANSFER => true,    CURLOPT_POST => true,    CURLOPT_POSTFIELDS => json_encode(['ids' => $ids]),    CURLOPT_HTTPHEADER => [        "Authorization: Bearer $API_KEY",        "Content-Type: application/json",        "Accept: application/json"    ]]);
$response = curl_exec($ch);$data = json_decode($response, true);print_r($data);
curl_close($ch);
```

## Example Responses

- [200](#tab-panel-157)
- [402](#tab-panel-158)
- [404](#tab-panel-159)
- [500](#tab-panel-160)

```
{    "users": [        {            "id": 44196397,            "id_str": "44196397",            "name": "Elon Musk",            "screen_name": "elonmusk",            "location": "\\ud835\\udd4f\\u00d0",            "url": null,            "description": "",            "protected": false,            "verified": true,            "followers_count": 166213974,            "friends_count": 506,            "listed_count": 149577,            "favourites_count": 37987,            "statuses_count": 34934,            "created_at": "2009-06-02T20:12:29.000000Z",            "profile_banner_url": "https:\\/\\/pbs.twimg.com\\/profile_banners\\/44196397\\/1690621312",            "profile_image_url_https": "https:\\/\\/pbs.twimg.com\\/profile_images\\/1683325380441128960\\/yRsRRjGO_normal.jpg",            "can_dm": false        },        // ...    ]}
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
