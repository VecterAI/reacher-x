# Update an API key

PATCH https://openrouter.ai/api/v1/keys/{hash}
Content-Type: application/json

Update an existing API key. [Management key](/docs/guides/overview/auth/management-api-keys) required.

Reference: https://openrouter.ai/docs/api/api-reference/api-keys/update-keys

## OpenAPI Specification

```yaml
openapi: 3.1.0
info:
  title: OpenRouter API
  version: 1.0.0
paths:
  /keys/{hash}:
    patch:
      operationId: update-keys
      summary: Update an API key
      description: >-
        Update an existing API key. [Management
        key](/docs/guides/overview/auth/management-api-keys) required.
      tags:
        - subpackage_apiKeys
      parameters:
        - name: hash
          in: path
          description: The hash identifier of the API key to update
          required: true
          schema:
            type: string
        - name: Authorization
          in: header
          description: API key as bearer token in Authorization header
          required: true
          schema:
            type: string
      responses:
        "200":
          description: API key updated successfully
          content:
            application/json:
              schema:
                $ref: "#/components/schemas/API Keys_updateKeys_Response_200"
        "400":
          description: Bad Request - Invalid request parameters
          content:
            application/json:
              schema:
                $ref: "#/components/schemas/BadRequestResponse"
        "401":
          description: Unauthorized - Missing or invalid authentication
          content:
            application/json:
              schema:
                $ref: "#/components/schemas/UnauthorizedResponse"
        "404":
          description: Not Found - API key does not exist
          content:
            application/json:
              schema:
                $ref: "#/components/schemas/NotFoundResponse"
        "429":
          description: Too Many Requests - Rate limit exceeded
          content:
            application/json:
              schema:
                $ref: "#/components/schemas/TooManyRequestsResponse"
        "500":
          description: Internal Server Error
          content:
            application/json:
              schema:
                $ref: "#/components/schemas/InternalServerResponse"
      requestBody:
        content:
          application/json:
            schema:
              type: object
              properties:
                name:
                  type: string
                  description: New name for the API key
                disabled:
                  type: boolean
                  description: Whether to disable the API key
                limit:
                  type:
                    - number
                    - "null"
                  format: double
                  description: New spending limit for the API key in USD
                limit_reset:
                  oneOf:
                    - $ref: >-
                        #/components/schemas/KeysHashPatchRequestBodyContentApplicationJsonSchemaLimitReset
                    - type: "null"
                  description: >-
                    New limit reset type for the API key (daily, weekly,
                    monthly, or null for no reset). Resets happen automatically
                    at midnight UTC, and weeks are Monday through Sunday.
                include_byok_in_limit:
                  type: boolean
                  description: Whether to include BYOK usage in the limit
servers:
  - url: https://openrouter.ai/api/v1
components:
  schemas:
    KeysHashPatchRequestBodyContentApplicationJsonSchemaLimitReset:
      type: string
      enum:
        - daily
        - weekly
        - monthly
      description: >-
        New limit reset type for the API key (daily, weekly, monthly, or null
        for no reset). Resets happen automatically at midnight UTC, and weeks
        are Monday through Sunday.
      title: KeysHashPatchRequestBodyContentApplicationJsonSchemaLimitReset
    KeysHashPatchResponsesContentApplicationJsonSchemaData:
      type: object
      properties:
        hash:
          type: string
          description: Unique hash identifier for the API key
        name:
          type: string
          description: Name of the API key
        label:
          type: string
          description: Human-readable label for the API key
        disabled:
          type: boolean
          description: Whether the API key is disabled
        limit:
          type:
            - number
            - "null"
          format: double
          description: Spending limit for the API key in USD
        limit_remaining:
          type:
            - number
            - "null"
          format: double
          description: Remaining spending limit in USD
        limit_reset:
          type:
            - string
            - "null"
          description: Type of limit reset for the API key
        include_byok_in_limit:
          type: boolean
          description: Whether to include external BYOK usage in the credit limit
        usage:
          type: number
          format: double
          description: Total OpenRouter credit usage (in USD) for the API key
        usage_daily:
          type: number
          format: double
          description: OpenRouter credit usage (in USD) for the current UTC day
        usage_weekly:
          type: number
          format: double
          description: >-
            OpenRouter credit usage (in USD) for the current UTC week
            (Monday-Sunday)
        usage_monthly:
          type: number
          format: double
          description: OpenRouter credit usage (in USD) for the current UTC month
        byok_usage:
          type: number
          format: double
          description: Total external BYOK usage (in USD) for the API key
        byok_usage_daily:
          type: number
          format: double
          description: External BYOK usage (in USD) for the current UTC day
        byok_usage_weekly:
          type: number
          format: double
          description: >-
            External BYOK usage (in USD) for the current UTC week
            (Monday-Sunday)
        byok_usage_monthly:
          type: number
          format: double
          description: External BYOK usage (in USD) for current UTC month
        created_at:
          type: string
          description: ISO 8601 timestamp of when the API key was created
        updated_at:
          type:
            - string
            - "null"
          description: ISO 8601 timestamp of when the API key was last updated
        expires_at:
          type:
            - string
            - "null"
          format: date-time
          description: >-
            ISO 8601 UTC timestamp when the API key expires, or null if no
            expiration
      required:
        - hash
        - name
        - label
        - disabled
        - limit
        - limit_remaining
        - limit_reset
        - include_byok_in_limit
        - usage
        - usage_daily
        - usage_weekly
        - usage_monthly
        - byok_usage
        - byok_usage_daily
        - byok_usage_weekly
        - byok_usage_monthly
        - created_at
        - updated_at
      description: The updated API key information
      title: KeysHashPatchResponsesContentApplicationJsonSchemaData
    API Keys_updateKeys_Response_200:
      type: object
      properties:
        data:
          $ref: >-
            #/components/schemas/KeysHashPatchResponsesContentApplicationJsonSchemaData
          description: The updated API key information
      required:
        - data
      title: API Keys_updateKeys_Response_200
    BadRequestResponseErrorData:
      type: object
      properties:
        code:
          type: integer
        message:
          type: string
        metadata:
          type:
            - object
            - "null"
          additionalProperties:
            description: Any type
      required:
        - code
        - message
      description: Error data for BadRequestResponse
      title: BadRequestResponseErrorData
    BadRequestResponse:
      type: object
      properties:
        error:
          $ref: "#/components/schemas/BadRequestResponseErrorData"
        user_id:
          type:
            - string
            - "null"
      required:
        - error
      description: Bad Request - Invalid request parameters or malformed input
      title: BadRequestResponse
    UnauthorizedResponseErrorData:
      type: object
      properties:
        code:
          type: integer
        message:
          type: string
        metadata:
          type:
            - object
            - "null"
          additionalProperties:
            description: Any type
      required:
        - code
        - message
      description: Error data for UnauthorizedResponse
      title: UnauthorizedResponseErrorData
    UnauthorizedResponse:
      type: object
      properties:
        error:
          $ref: "#/components/schemas/UnauthorizedResponseErrorData"
        user_id:
          type:
            - string
            - "null"
      required:
        - error
      description: Unauthorized - Authentication required or invalid credentials
      title: UnauthorizedResponse
    NotFoundResponseErrorData:
      type: object
      properties:
        code:
          type: integer
        message:
          type: string
        metadata:
          type:
            - object
            - "null"
          additionalProperties:
            description: Any type
      required:
        - code
        - message
      description: Error data for NotFoundResponse
      title: NotFoundResponseErrorData
    NotFoundResponse:
      type: object
      properties:
        error:
          $ref: "#/components/schemas/NotFoundResponseErrorData"
        user_id:
          type:
            - string
            - "null"
      required:
        - error
      description: Not Found - Resource does not exist
      title: NotFoundResponse
    TooManyRequestsResponseErrorData:
      type: object
      properties:
        code:
          type: integer
        message:
          type: string
        metadata:
          type:
            - object
            - "null"
          additionalProperties:
            description: Any type
      required:
        - code
        - message
      description: Error data for TooManyRequestsResponse
      title: TooManyRequestsResponseErrorData
    TooManyRequestsResponse:
      type: object
      properties:
        error:
          $ref: "#/components/schemas/TooManyRequestsResponseErrorData"
        user_id:
          type:
            - string
            - "null"
      required:
        - error
      description: Too Many Requests - Rate limit exceeded
      title: TooManyRequestsResponse
    InternalServerResponseErrorData:
      type: object
      properties:
        code:
          type: integer
        message:
          type: string
        metadata:
          type:
            - object
            - "null"
          additionalProperties:
            description: Any type
      required:
        - code
        - message
      description: Error data for InternalServerResponse
      title: InternalServerResponseErrorData
    InternalServerResponse:
      type: object
      properties:
        error:
          $ref: "#/components/schemas/InternalServerResponseErrorData"
        user_id:
          type:
            - string
            - "null"
      required:
        - error
      description: Internal Server Error - Unexpected server error
      title: InternalServerResponse
  securitySchemes:
    apiKey:
      type: http
      scheme: bearer
      description: API key as bearer token in Authorization header
```

## SDK Code Examples

```python
import requests

url = "https://openrouter.ai/api/v1/keys/f01d52606dc8f0a8303a7b5cc3fa07109c2e346cec7c0a16b40de462992ce943"

payload = {
    "name": "Updated API Key Name",
    "disabled": False,
    "limit": 75,
    "limit_reset": "daily",
    "include_byok_in_limit": True
}
headers = {
    "Authorization": "Bearer <token>",
    "Content-Type": "application/json"
}

response = requests.patch(url, json=payload, headers=headers)

print(response.json())
```

```javascript
const url =
  "https://openrouter.ai/api/v1/keys/f01d52606dc8f0a8303a7b5cc3fa07109c2e346cec7c0a16b40de462992ce943";
const options = {
  method: "PATCH",
  headers: {
    Authorization: "Bearer <token>",
    "Content-Type": "application/json",
  },
  body: '{"name":"Updated API Key Name","disabled":false,"limit":75,"limit_reset":"daily","include_byok_in_limit":true}',
};

try {
  const response = await fetch(url, options);
  const data = await response.json();
  console.log(data);
} catch (error) {
  console.error(error);
}
```

```go
package main

import (
	"fmt"
	"strings"
	"net/http"
	"io"
)

func main() {

	url := "https://openrouter.ai/api/v1/keys/f01d52606dc8f0a8303a7b5cc3fa07109c2e346cec7c0a16b40de462992ce943"

	payload := strings.NewReader("{\n  \"name\": \"Updated API Key Name\",\n  \"disabled\": false,\n  \"limit\": 75,\n  \"limit_reset\": \"daily\",\n  \"include_byok_in_limit\": true\n}")

	req, _ := http.NewRequest("PATCH", url, payload)

	req.Header.Add("Authorization", "Bearer <token>")
	req.Header.Add("Content-Type", "application/json")

	res, _ := http.DefaultClient.Do(req)

	defer res.Body.Close()
	body, _ := io.ReadAll(res.Body)

	fmt.Println(res)
	fmt.Println(string(body))

}
```

```ruby
require 'uri'
require 'net/http'

url = URI("https://openrouter.ai/api/v1/keys/f01d52606dc8f0a8303a7b5cc3fa07109c2e346cec7c0a16b40de462992ce943")

http = Net::HTTP.new(url.host, url.port)
http.use_ssl = true

request = Net::HTTP::Patch.new(url)
request["Authorization"] = 'Bearer <token>'
request["Content-Type"] = 'application/json'
request.body = "{\n  \"name\": \"Updated API Key Name\",\n  \"disabled\": false,\n  \"limit\": 75,\n  \"limit_reset\": \"daily\",\n  \"include_byok_in_limit\": true\n}"

response = http.request(request)
puts response.read_body
```

```java
import com.mashape.unirest.http.HttpResponse;
import com.mashape.unirest.http.Unirest;

HttpResponse<String> response = Unirest.patch("https://openrouter.ai/api/v1/keys/f01d52606dc8f0a8303a7b5cc3fa07109c2e346cec7c0a16b40de462992ce943")
  .header("Authorization", "Bearer <token>")
  .header("Content-Type", "application/json")
  .body("{\n  \"name\": \"Updated API Key Name\",\n  \"disabled\": false,\n  \"limit\": 75,\n  \"limit_reset\": \"daily\",\n  \"include_byok_in_limit\": true\n}")
  .asString();
```

```php
<?php
require_once('vendor/autoload.php');

$client = new \GuzzleHttp\Client();

$response = $client->request('PATCH', 'https://openrouter.ai/api/v1/keys/f01d52606dc8f0a8303a7b5cc3fa07109c2e346cec7c0a16b40de462992ce943', [
  'body' => '{
  "name": "Updated API Key Name",
  "disabled": false,
  "limit": 75,
  "limit_reset": "daily",
  "include_byok_in_limit": true
}',
  'headers' => [
    'Authorization' => 'Bearer <token>',
    'Content-Type' => 'application/json',
  ],
]);

echo $response->getBody();
```

```csharp
using RestSharp;

var client = new RestClient("https://openrouter.ai/api/v1/keys/f01d52606dc8f0a8303a7b5cc3fa07109c2e346cec7c0a16b40de462992ce943");
var request = new RestRequest(Method.PATCH);
request.AddHeader("Authorization", "Bearer <token>");
request.AddHeader("Content-Type", "application/json");
request.AddParameter("application/json", "{\n  \"name\": \"Updated API Key Name\",\n  \"disabled\": false,\n  \"limit\": 75,\n  \"limit_reset\": \"daily\",\n  \"include_byok_in_limit\": true\n}", ParameterType.RequestBody);
IRestResponse response = client.Execute(request);
```

```swift
import Foundation

let headers = [
  "Authorization": "Bearer <token>",
  "Content-Type": "application/json"
]
let parameters = [
  "name": "Updated API Key Name",
  "disabled": false,
  "limit": 75,
  "limit_reset": "daily",
  "include_byok_in_limit": true
] as [String : Any]

let postData = JSONSerialization.data(withJSONObject: parameters, options: [])

let request = NSMutableURLRequest(url: NSURL(string: "https://openrouter.ai/api/v1/keys/f01d52606dc8f0a8303a7b5cc3fa07109c2e346cec7c0a16b40de462992ce943")! as URL,
                                        cachePolicy: .useProtocolCachePolicy,
                                    timeoutInterval: 10.0)
request.httpMethod = "PATCH"
request.allHTTPHeaderFields = headers
request.httpBody = postData as Data

let session = URLSession.shared
let dataTask = session.dataTask(with: request as URLRequest, completionHandler: { (data, response, error) -> Void in
  if (error != nil) {
    print(error as Any)
  } else {
    let httpResponse = response as? HTTPURLResponse
    print(httpResponse)
  }
})

dataTask.resume()
```
