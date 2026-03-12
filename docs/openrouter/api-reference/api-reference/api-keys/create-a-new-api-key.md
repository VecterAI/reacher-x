# Create a new API key

POST https://openrouter.ai/api/v1/keys
Content-Type: application/json

Create a new API key for the authenticated user. [Management key](/docs/guides/overview/auth/management-api-keys) required.

Reference: https://openrouter.ai/docs/api/api-reference/api-keys/create-keys

## OpenAPI Specification

```yaml
openapi: 3.1.0
info:
  title: OpenRouter API
  version: 1.0.0
paths:
  /keys:
    post:
      operationId: create-keys
      summary: Create a new API key
      description: >-
        Create a new API key for the authenticated user. [Management
        key](/docs/guides/overview/auth/management-api-keys) required.
      tags:
        - subpackage_apiKeys
      parameters:
        - name: Authorization
          in: header
          description: API key as bearer token in Authorization header
          required: true
          schema:
            type: string
      responses:
        "201":
          description: API key created successfully
          content:
            application/json:
              schema:
                $ref: "#/components/schemas/API Keys_createKeys_Response_201"
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
                  description: Name for the new API key
                limit:
                  type:
                    - number
                    - "null"
                  format: double
                  description: Optional spending limit for the API key in USD
                limit_reset:
                  oneOf:
                    - $ref: >-
                        #/components/schemas/KeysPostRequestBodyContentApplicationJsonSchemaLimitReset
                    - type: "null"
                  description: >-
                    Type of limit reset for the API key (daily, weekly, monthly,
                    or null for no reset). Resets happen automatically at
                    midnight UTC, and weeks are Monday through Sunday.
                include_byok_in_limit:
                  type: boolean
                  description: Whether to include BYOK usage in the limit
                expires_at:
                  type:
                    - string
                    - "null"
                  format: date-time
                  description: >-
                    Optional ISO 8601 UTC timestamp when the API key should
                    expire. Must be UTC, other timezones will be rejected
              required:
                - name
servers:
  - url: https://openrouter.ai/api/v1
components:
  schemas:
    KeysPostRequestBodyContentApplicationJsonSchemaLimitReset:
      type: string
      enum:
        - daily
        - weekly
        - monthly
      description: >-
        Type of limit reset for the API key (daily, weekly, monthly, or null for
        no reset). Resets happen automatically at midnight UTC, and weeks are
        Monday through Sunday.
      title: KeysPostRequestBodyContentApplicationJsonSchemaLimitReset
    KeysPostResponsesContentApplicationJsonSchemaData:
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
      description: The created API key information
      title: KeysPostResponsesContentApplicationJsonSchemaData
    API Keys_createKeys_Response_201:
      type: object
      properties:
        data:
          $ref: >-
            #/components/schemas/KeysPostResponsesContentApplicationJsonSchemaData
          description: The created API key information
        key:
          type: string
          description: The actual API key string (only shown once)
      required:
        - data
        - key
      title: API Keys_createKeys_Response_201
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

url = "https://openrouter.ai/api/v1/keys"

payload = {
    "name": "Analytics Service Key",
    "limit": 150,
    "limit_reset": "monthly",
    "include_byok_in_limit": True,
    "expires_at": "2028-06-30T23:59:59Z"
}
headers = {
    "Authorization": "Bearer <token>",
    "Content-Type": "application/json"
}

response = requests.post(url, json=payload, headers=headers)

print(response.json())
```

```javascript
const url = "https://openrouter.ai/api/v1/keys";
const options = {
  method: "POST",
  headers: {
    Authorization: "Bearer <token>",
    "Content-Type": "application/json",
  },
  body: '{"name":"Analytics Service Key","limit":150,"limit_reset":"monthly","include_byok_in_limit":true,"expires_at":"2028-06-30T23:59:59Z"}',
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

	url := "https://openrouter.ai/api/v1/keys"

	payload := strings.NewReader("{\n  \"name\": \"Analytics Service Key\",\n  \"limit\": 150,\n  \"limit_reset\": \"monthly\",\n  \"include_byok_in_limit\": true,\n  \"expires_at\": \"2028-06-30T23:59:59Z\"\n}")

	req, _ := http.NewRequest("POST", url, payload)

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

url = URI("https://openrouter.ai/api/v1/keys")

http = Net::HTTP.new(url.host, url.port)
http.use_ssl = true

request = Net::HTTP::Post.new(url)
request["Authorization"] = 'Bearer <token>'
request["Content-Type"] = 'application/json'
request.body = "{\n  \"name\": \"Analytics Service Key\",\n  \"limit\": 150,\n  \"limit_reset\": \"monthly\",\n  \"include_byok_in_limit\": true,\n  \"expires_at\": \"2028-06-30T23:59:59Z\"\n}"

response = http.request(request)
puts response.read_body
```

```java
import com.mashape.unirest.http.HttpResponse;
import com.mashape.unirest.http.Unirest;

HttpResponse<String> response = Unirest.post("https://openrouter.ai/api/v1/keys")
  .header("Authorization", "Bearer <token>")
  .header("Content-Type", "application/json")
  .body("{\n  \"name\": \"Analytics Service Key\",\n  \"limit\": 150,\n  \"limit_reset\": \"monthly\",\n  \"include_byok_in_limit\": true,\n  \"expires_at\": \"2028-06-30T23:59:59Z\"\n}")
  .asString();
```

```php
<?php
require_once('vendor/autoload.php');

$client = new \GuzzleHttp\Client();

$response = $client->request('POST', 'https://openrouter.ai/api/v1/keys', [
  'body' => '{
  "name": "Analytics Service Key",
  "limit": 150,
  "limit_reset": "monthly",
  "include_byok_in_limit": true,
  "expires_at": "2028-06-30T23:59:59Z"
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

var client = new RestClient("https://openrouter.ai/api/v1/keys");
var request = new RestRequest(Method.POST);
request.AddHeader("Authorization", "Bearer <token>");
request.AddHeader("Content-Type", "application/json");
request.AddParameter("application/json", "{\n  \"name\": \"Analytics Service Key\",\n  \"limit\": 150,\n  \"limit_reset\": \"monthly\",\n  \"include_byok_in_limit\": true,\n  \"expires_at\": \"2028-06-30T23:59:59Z\"\n}", ParameterType.RequestBody);
IRestResponse response = client.Execute(request);
```

```swift
import Foundation

let headers = [
  "Authorization": "Bearer <token>",
  "Content-Type": "application/json"
]
let parameters = [
  "name": "Analytics Service Key",
  "limit": 150,
  "limit_reset": "monthly",
  "include_byok_in_limit": true,
  "expires_at": "2028-06-30T23:59:59Z"
] as [String : Any]

let postData = JSONSerialization.data(withJSONObject: parameters, options: [])

let request = NSMutableURLRequest(url: NSURL(string: "https://openrouter.ai/api/v1/keys")! as URL,
                                        cachePolicy: .useProtocolCachePolicy,
                                    timeoutInterval: 10.0)
request.httpMethod = "POST"
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
