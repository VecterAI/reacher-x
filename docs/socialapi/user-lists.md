# Get User's Lists - API Reference | SocialAPI

# Get User's Lists - API Reference

Returns array of lists a user created or is subscribed to. Typically Twitter returns up to 100 lists per page. You can request additional results by sending another request to the same endpoint using `cursor` parameter.

GET https://api.socialapi.me/twitter/user/{user\_id}/lists?cursor={cursor}

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

- [curl](#tab-panel-269)
- [JavaScript](#tab-panel-270)
- [Python](#tab-panel-271)
- [PHP](#tab-panel-272)

Terminal window

```
curl "https://api.socialapi.me/twitter/user/44196397/lists" \    -H 'Authorization: Bearer API_KEY' \    -H 'Accept: application/json'
```

```
const userId = '44196397';const API_KEY = 'YOUR_API_KEY_HERE';
fetch(`https://api.socialapi.me/twitter/user/${userId}/lists`, {    method: 'GET',    headers: {        'Authorization': `Bearer ${API_KEY}`,        'Accept': 'application/json'    }}).then(response => response.json()).then(response => console.log(response)).catch(err => console.error(err));
```

```
import requests
userId = '44196397'API_KEY = 'YOUR_API_KEY_HERE'
url = f'https://api.socialapi.me/twitter/user/{userId}/lists'
headers = {    'Authorization': f'Bearer {API_KEY}',    'Accept': 'application/json'}
response = requests.get(url, headers=headers)
if response.status_code == 200:    data = response.json()    print(data)else:    print(f"Error: {response.status_code}")    print(response.text)
```

```
$userId = '44196397';$API_KEY = 'YOUR_API_KEY_HERE';
$url = "https://api.socialapi.me/twitter/user/{$userId}/lists";
$ch = curl_init();
curl_setopt_array($ch, [    CURLOPT_URL => $url,    CURLOPT_RETURNTRANSFER => true,    CURLOPT_HTTPHEADER => [        "Authorization: Bearer $API_KEY",        "Accept: application/json"    ]]);
$response = curl_exec($ch);$data = json_decode($response, true);print_r($data);
curl_close($ch);
```

## Example Responses

- [200](#tab-panel-273)
- [402](#tab-panel-274)
- [404](#tab-panel-275)
- [500](#tab-panel-276)

```
{    "next_cursor": "1545854927532064769|1752635769203195807",    "lists": [      {        "created_at": 1668221936000,        "default_banner_media": {          "media_info": {            "original_img_url": "https:\/\/pbs.twimg.com\/media\/EXZ2mJCUEAEbJb3.png",            "original_img_width": 1125,            "original_img_height": 375,            "salient_rect": {              "left": 562,              "top": 187,              "width": 1,              "height": 1            }          }        },        "default_banner_media_results": {          "result": {            "id": "QXBpTWVkaWE6DAABCgABEXZ2mJCUEAEKAAIQF4A+eBQgAAAA",            "media_key": "3_1258323543529361409",            "media_id": "1258323543529361409",            "media_info": {              "__typename": "ApiImage",              "original_img_height": 375,              "original_img_width": 1125,              "original_img_url": "https:\/\/pbs.twimg.com\/media\/EXZ2mJCUEAEbJb3.png",              "salient_rect": {                "height": 1,                "left": 562,                "top": 187,                "width": 1              }            },            "__typename": "ApiMedia"          }        },        "description": "",        "facepile_urls": [          "https:\/\/pbs.twimg.com\/profile_images\/1201525049766883328\/QPimCC9z_mini.jpg",          "https:\/\/pbs.twimg.com\/profile_images\/1603461568708153346\/plKcInwe_mini.jpg",          "https:\/\/pbs.twimg.com\/profile_images\/1598855439076425728\/q5FlqPZU_mini.jpg"        ],        "followers_context": "16 followers including @arvidkahl",        "following": false,        "id": "TGlzdDoxNTkxMjY0MjUxMzMwNDI4OTI5",        "id_str": "1591264251330428929",        "is_member": false,        "member_count": 85,        "members_context": "85 members",        "mode": "Public",        "muting": false,        "name": "\ud83c\udf1f Creators \ud83d\udd25",        "pinning": false,        "subscriber_count": 16,        "user_results": {          "result": {            "__typename": "User",            "id": "VXNlcjoyOTA0MjE5Njcz",            "rest_id": "2904219673",            "affiliates_highlighted_label": [],            "has_graduated_access": true,            "is_blue_verified": true,            "profile_image_shape": "Circle",            "legacy": {              "can_dm": false,              "can_media_tag": true,              "created_at": "Wed Nov 19 05:35:32 +0000 2014",              "default_profile": false,              "default_profile_image": false,              "description": "Helping digital creators save 20+ hours a month. Leverage AI\/Automation for content repurposing and distribution. Saved clients over 10,000+ hours",              "entities": {                "description": {                  "urls": []                },                "url": {                  "urls": [                    {                      "display_url": "hiddenlevers.ai\/subscribe?utm_\u2026",                      "expanded_url": "https:\/\/www.hiddenlevers.ai\/subscribe?utm_source=twitter&utm_medium=bio",                      "url": "https:\/\/t.co\/ykaoNAJGQD",                      "indices": [                        0,                        23                      ]                    }                  ]                }              },              "fast_followers_count": 0,              "favourites_count": 46302,              "followers_count": 7948,              "friends_count": 1722,              "has_custom_timelines": true,              "is_translator": false,              "listed_count": 234,              "location": "Amplify Your Impact \ud83d\udc47\ud83c\udffc",              "media_count": 2938,              "name": "Mike Cardona | Automation Alchemist \ud83e\uddea\ud83d\udd27",              "normal_followers_count": 7948,              "pinned_tweet_ids_str": [                "1699665975136878643"              ],              "possibly_sensitive": false,              "profile_banner_url": "https:\/\/pbs.twimg.com\/profile_banners\/2904219673\/1704725393",              "profile_image_url_https": "https:\/\/pbs.twimg.com\/profile_images\/1566400585137414145\/vkBaB3ca_normal.jpg",              "profile_interstitial_type": "",              "screen_name": "CSMikeCardona",              "statuses_count": 27559,              "translator_type": "none",              "url": "https:\/\/t.co\/ykaoNAJGQD",              "verified": false,              "want_retweets": false,              "withheld_in_countries": []            },            "professional": {              "rest_id": "1459282952534196228",              "professional_type": "Creator",              "category": []            }          }        }      },      ...  ]}
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
