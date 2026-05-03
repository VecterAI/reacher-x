# Get User Affiliates - API Reference | SocialAPI

# Get User Affiliates - API Reference

Verified organization profiles (i.e. users with the gold checkmark) occasionally have affiliated accounts listed under “Affiliates” tab on their profile page. The endpoint returns an array of user profiles affiliated with this organization.

GET https://api.socialapi.me/twitter/user/{user\_id}/affiliates?cursor={cursor}

### Headers

Authorization string required

Authorization Bearer header containing your SocialAPI key

Example: Bearer YOUR_API_KEY

### Path Parameters

user_id integer required

The numeric ID of the desired user.

Example: 1729591119699124560

### Query Parameters

cursor string optional

Cursor value obtained from next_cursor response property. Omit this value to retrieve the first page. Always remember to urlendode the value

Example: DAACCgACGC12FhmAJxAKAAMYLXYWGX_Y8AgABAAAAAILAAUAAADoRW1QQzZ3QUFBZlEvZ0d...

## Code Examples

- [curl](#tab-panel-225)
- [JavaScript](#tab-panel-226)
- [Python](#tab-panel-227)
- [PHP](#tab-panel-228)

Terminal window

```
curl "https://api.socialapi.me/twitter/user/783214/affiliates" \    -H 'Authorization: Bearer API_KEY' \    -H 'Accept: application/json'
```

```
const userId = '783214';const API_KEY = 'YOUR_API_KEY_HERE';
fetch(`https://api.socialapi.me/twitter/user/${userId}/affiliates`, {    method: 'GET',    headers: {        'Authorization': `Bearer ${API_KEY}`,        'Accept': 'application/json'    }}).then(response => response.json()).then(response => console.log(response)).catch(err => console.error(err));
```

```
import requests
userId = '783214'API_KEY = 'YOUR_API_KEY_HERE'
url = f'https://api.socialapi.me/twitter/user/{userId}/affiliates'
headers = {    'Authorization': f'Bearer {API_KEY}',    'Accept': 'application/json'}
response = requests.get(url, headers=headers)
if response.status_code == 200:    data = response.json()    print(data)else:    print(f"Error: {response.status_code}")    print(response.text)
```

```
$userId = '783214';$API_KEY = 'YOUR_API_KEY_HERE';
$url = "https://api.socialapi.me/twitter/user/{$userId}/affiliates";
$ch = curl_init();
curl_setopt_array($ch, [    CURLOPT_URL => $url,    CURLOPT_RETURNTRANSFER => true,    CURLOPT_HTTPHEADER => [        "Authorization: Bearer $API_KEY",        "Accept: application/json"    ]]);
$response = curl_exec($ch);$data = json_decode($response, true);print_r($data);
curl_close($ch);
```

## Example Responses

- [200](#tab-panel-229)
- [402](#tab-panel-230)
- [404](#tab-panel-231)
- [500](#tab-panel-232)

```
{    "users": [        {            "id": 1076061,            "id_str": "1076061",            "name": "Keith Coleman 🌱😀🙌",            "screen_name": "kcoleman",            "location": "San Francisco, CA",            "url": null,            "description": "VP Product @X. Previously CEO at Yes Inc, @google 🙌",            "protected": false,            "verified": true,            "followers_count": 30521,            "friends_count": 825,            "listed_count": 334,            "favourites_count": 14063,            "statuses_count": 2734,            "created_at": "2007-03-13T08:18:45.000000Z",            "profile_banner_url": "https:\/\/pbs.twimg.com\/profile_banners\/1076061\/1478574872",            "profile_image_url_https": "https:\/\/pbs.twimg.com\/profile_images\/1093367487566012416\/9Wc1J-Pk_normal.jpg",            "can_dm": true        },        // ...    ],    "next_cursor": "DAAHCgABGPytdBi__-wLAAIAAAAIMTUxMzM0ODEIAAMAAAACAAA"}
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
