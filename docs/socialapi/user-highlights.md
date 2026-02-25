# Get User Highlighted Tweets - API Reference | SocialAPI

# Get User Highlighted Tweets - API Reference

Returns array of tweets from the user’s Highlights tab. Typically Twitter returns ~20 results per page. You can request additional results by sending another request to the same endpoint using `cursor` parameter.

GET https://api.socialapi.me/twitter/user/{user\_id}/highlights?cursor={cursor}

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

- [curl](#tab-panel-253)
- [JavaScript](#tab-panel-254)
- [Python](#tab-panel-255)
- [PHP](#tab-panel-256)

Terminal window

```
curl "https://api.socialapi.me/twitter/user/44196397/highlights" \    -H 'Authorization: Bearer API_KEY' \    -H 'Accept: application/json'
```

```
const userId = '44196397';const API_KEY = 'YOUR_API_KEY_HERE';
fetch(`https://api.socialapi.me/twitter/user/${userId}/highlights`, {    method: 'GET',    headers: {        'Authorization': `Bearer ${API_KEY}`,        'Accept': 'application/json'    }}).then(response => response.json()).then(response => console.log(response)).catch(err => console.error(err));
```

```
import requests
userId = '44196397'API_KEY = 'YOUR_API_KEY_HERE'
url = f'https://api.socialapi.me/twitter/user/{userId}/highlights'
headers = {    'Authorization': f'Bearer {API_KEY}',    'Accept': 'application/json'}
response = requests.get(url, headers=headers)
if response.status_code == 200:    data = response.json()    print(data)else:    print(f"Error: {response.status_code}")    print(response.text)
```

```
$userId = '44196397';$API_KEY = 'YOUR_API_KEY_HERE';
$url = "https://api.socialapi.me/twitter/user/{$userId}/highlights";
$ch = curl_init();
curl_setopt_array($ch, [    CURLOPT_URL => $url,    CURLOPT_RETURNTRANSFER => true,    CURLOPT_HTTPHEADER => [        "Authorization: Bearer $API_KEY",        "Accept: application/json"    ]]);
$response = curl_exec($ch);$data = json_decode($response, true);print_r($data);
curl_close($ch);
```

## Example Responses

- [200](#tab-panel-257)
- [402](#tab-panel-258)
- [404](#tab-panel-259)
- [500](#tab-panel-260)

```
{    "next_cursor": "DAACCgACGC12FhmAJxAKAAMYLXYWGX_Y8AgABAAAAAILAAUAAADoRW1QQzZ3QUFBZlEvZ0dKTjB2R3AvQUFBQUJNWUxTNkQyQmFoUXhndFRReS9Ga0NOR0MwZG9yS1hzU2NZTFFwYm0xY1I0aGd0YmhZc1drQ3FHQzBjUXNSV1lSZ1lMVml5V3BxQU9CZ3RMbUhUV2tDb0dDMVFuVW1YMEFzWUxKYURhOVpob3hndFZtaklGakNNR0MxWGdlT1dZSE1ZTFRYNFNwZUEraGd0Y2h2bEYxRkxHQzFNMi83V1VGc1lMTTZwemhZQWt4Z3RWMkJKbDNGN0dDMWFGTXBYUUY4WUxUUERuRlp3UVE9PQgABgAAAAAIAAcAAAAADAAICgABGCyWg2vWYaMAAAA",    "tweets": [        {      "tweet_created_at": "2024-05-15T22:33:29.000000Z",      "id": 1790873164374810919,      "id_str": "1790873164374810919",      "text": null,      "full_text": "https:\/\/t.co\/mS960WQX4Y",      "source": "<a href=\"https:\/\/mobile.twitter.com\" rel=\"nofollow\">Twitter Web App<\/a>",      "truncated": false,      "in_reply_to_status_id": null,      "in_reply_to_status_id_str": null,      "in_reply_to_user_id": null,      "in_reply_to_user_id_str": null,      "in_reply_to_screen_name": null,      "user": {        "id": 783214,        "id_str": "783214",        "name": "X",        "screen_name": "X",        "location": "everywhere",        "url": "https:\/\/about.x.com\/",        "description": "what's happening?!",        "protected": false,        "verified": true,        "followers_count": 67739714,        "friends_count": 0,        "listed_count": 88755,        "favourites_count": 5892,        "statuses_count": 15327,        "created_at": "2007-02-20T14:35:54.000000Z",        "profile_banner_url": "https:\/\/pbs.twimg.com\/profile_banners\/783214\/1690175171",        "profile_image_url_https": "https:\/\/pbs.twimg.com\/profile_images\/1683899100922511378\/5lY42eHs_normal.jpg",        "can_dm": false      }    },    // ...    ]}
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
