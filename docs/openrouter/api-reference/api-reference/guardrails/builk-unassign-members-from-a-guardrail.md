# Bulk unassign members from a guardrail

POST https://openrouter.ai/api/v1/guardrails/{id}/assignments/members/remove
Content-Type: application/json

Unassign multiple organization members from a specific guardrail. [Management key](/docs/guides/overview/auth/management-api-keys) required.

Reference: https://openrouter.ai/docs/api/api-reference/guardrails/bulk-unassign-members-from-guardrail

## OpenAPI Specification

```yaml
openapi: 3.1.0
info:
  title: OpenRouter API
  version: 1.0.0
paths:
  /guardrails/{id}/assignments/members/remove:
    post:
      operationId: bulk-unassign-members-from-guardrail
      summary: Bulk unassign members from a guardrail
      description: >-
        Unassign multiple organization members from a specific guardrail.
        [Management key](/docs/guides/overview/auth/management-api-keys)
        required.
      tags:
        - subpackage_guardrails
      parameters:
        - name: id
          in: path
          description: The unique identifier of the guardrail
          required: true
          schema:
            type: string
            format: uuid
        - name: Authorization
          in: header
          description: API key as bearer token in Authorization header
          required: true
          schema:
            type: string
      responses:
        "200":
          description: Unassignment result
          content:
            application/json:
              schema:
                $ref: >-
                  #/components/schemas/Guardrails_bulkUnassignMembersFromGuardrail_Response_200
        "400":
          description: Bad Request - Invalid input
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
          description: Guardrail not found
          content:
            application/json:
              schema:
                $ref: "#/components/schemas/NotFoundResponse"
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
                member_user_ids:
                  type: array
                  items:
                    type: string
                  description: Array of member user IDs to unassign from the guardrail
              required:
                - member_user_ids
servers:
  - url: https://openrouter.ai/api/v1
components:
  schemas:
    Guardrails_bulkUnassignMembersFromGuardrail_Response_200:
      type: object
      properties:
        unassigned_count:
          type: number
          format: double
          description: Number of members successfully unassigned
      required:
        - unassigned_count
      title: Guardrails_bulkUnassignMembersFromGuardrail_Response_200
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

url = "https://openrouter.ai/api/v1/guardrails/550e8400-e29b-41d4-a716-446655440000/assignments/members/remove"

payload = { "member_user_ids": ["user_abc123", "user_def456"] }
headers = {
    "Authorization": "Bearer <token>",
    "Content-Type": "application/json"
}

response = requests.post(url, json=payload, headers=headers)

print(response.json())
```

```javascript
const url =
  "https://openrouter.ai/api/v1/guardrails/550e8400-e29b-41d4-a716-446655440000/assignments/members/remove";
const options = {
  method: "POST",
  headers: {
    Authorization: "Bearer <token>",
    "Content-Type": "application/json",
  },
  body: '{"member_user_ids":["user_abc123","user_def456"]}',
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

	url := "https://openrouter.ai/api/v1/guardrails/550e8400-e29b-41d4-a716-446655440000/assignments/members/remove"

	payload := strings.NewReader("{\n  \"member_user_ids\": [\n    \"user_abc123\",\n    \"user_def456\"\n  ]\n}")

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

url = URI("https://openrouter.ai/api/v1/guardrails/550e8400-e29b-41d4-a716-446655440000/assignments/members/remove")

http = Net::HTTP.new(url.host, url.port)
http.use_ssl = true

request = Net::HTTP::Post.new(url)
request["Authorization"] = 'Bearer <token>'
request["Content-Type"] = 'application/json'
request.body = "{\n  \"member_user_ids\": [\n    \"user_abc123\",\n    \"user_def456\"\n  ]\n}"

response = http.request(request)
puts response.read_body
```

```java
import com.mashape.unirest.http.HttpResponse;
import com.mashape.unirest.http.Unirest;

HttpResponse<String> response = Unirest.post("https://openrouter.ai/api/v1/guardrails/550e8400-e29b-41d4-a716-446655440000/assignments/members/remove")
  .header("Authorization", "Bearer <token>")
  .header("Content-Type", "application/json")
  .body("{\n  \"member_user_ids\": [\n    \"user_abc123\",\n    \"user_def456\"\n  ]\n}")
  .asString();
```

```php
<?php
require_once('vendor/autoload.php');

$client = new \GuzzleHttp\Client();

$response = $client->request('POST', 'https://openrouter.ai/api/v1/guardrails/550e8400-e29b-41d4-a716-446655440000/assignments/members/remove', [
  'body' => '{
  "member_user_ids": [
    "user_abc123",
    "user_def456"
  ]
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

var client = new RestClient("https://openrouter.ai/api/v1/guardrails/550e8400-e29b-41d4-a716-446655440000/assignments/members/remove");
var request = new RestRequest(Method.POST);
request.AddHeader("Authorization", "Bearer <token>");
request.AddHeader("Content-Type", "application/json");
request.AddParameter("application/json", "{\n  \"member_user_ids\": [\n    \"user_abc123\",\n    \"user_def456\"\n  ]\n}", ParameterType.RequestBody);
IRestResponse response = client.Execute(request);
```

```swift
import Foundation

let headers = [
  "Authorization": "Bearer <token>",
  "Content-Type": "application/json"
]
let parameters = ["member_user_ids": ["user_abc123", "user_def456"]] as [String : Any]

let postData = JSONSerialization.data(withJSONObject: parameters, options: [])

let request = NSMutableURLRequest(url: NSURL(string: "https://openrouter.ai/api/v1/guardrails/550e8400-e29b-41d4-a716-446655440000/assignments/members/remove")! as URL,
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
