# Create a Coinbase charge for crypto payment

POST https://openrouter.ai/api/v1/credits/coinbase
Content-Type: application/json

Create a Coinbase charge for crypto payment

Reference: https://openrouter.ai/docs/api/api-reference/credits/create-coinbase-charge

## OpenAPI Specification

```yaml
openapi: 3.1.0
info:
  title: OpenRouter API
  version: 1.0.0
paths:
  /credits/coinbase:
    post:
      operationId: create-coinbase-charge
      summary: Create a Coinbase charge for crypto payment
      description: Create a Coinbase charge for crypto payment
      tags:
        - subpackage_credits
      parameters:
        - name: Authorization
          in: header
          description: API key as bearer token in Authorization header
          required: true
          schema:
            type: string
      responses:
        "200":
          description: Returns the calldata to fulfill the transaction
          content:
            application/json:
              schema:
                $ref: "#/components/schemas/Credits_createCoinbaseCharge_Response_200"
        "400":
          description: Bad Request - Invalid credit amount or request body
          content:
            application/json:
              schema:
                $ref: "#/components/schemas/BadRequestResponse"
        "401":
          description: Unauthorized - Authentication required or invalid credentials
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
          description: Internal Server Error - Unexpected server error
          content:
            application/json:
              schema:
                $ref: "#/components/schemas/InternalServerResponse"
      requestBody:
        content:
          application/json:
            schema:
              $ref: "#/components/schemas/CreateChargeRequest"
servers:
  - url: https://openrouter.ai/api/v1
components:
  schemas:
    CreateChargeRequestChainId:
      type: string
      enum:
        - "1"
        - "137"
        - "8453"
      title: CreateChargeRequestChainId
    CreateChargeRequest:
      type: object
      properties:
        amount:
          type: number
          format: double
        sender:
          type: string
        chain_id:
          $ref: "#/components/schemas/CreateChargeRequestChainId"
      required:
        - amount
        - sender
        - chain_id
      description: Create a Coinbase charge for crypto payment
      title: CreateChargeRequest
    CreditsCoinbasePostResponsesContentApplicationJsonSchemaDataWeb3DataTransferIntentCallData:
      type: object
      properties:
        deadline:
          type: string
        fee_amount:
          type: string
        id:
          type: string
        operator:
          type: string
        prefix:
          type: string
        recipient:
          type: string
        recipient_amount:
          type: string
        recipient_currency:
          type: string
        refund_destination:
          type: string
        signature:
          type: string
      required:
        - deadline
        - fee_amount
        - id
        - operator
        - prefix
        - recipient
        - recipient_amount
        - recipient_currency
        - refund_destination
        - signature
      title: >-
        CreditsCoinbasePostResponsesContentApplicationJsonSchemaDataWeb3DataTransferIntentCallData
    CreditsCoinbasePostResponsesContentApplicationJsonSchemaDataWeb3DataTransferIntentMetadata:
      type: object
      properties:
        chain_id:
          type: number
          format: double
        contract_address:
          type: string
        sender:
          type: string
      required:
        - chain_id
        - contract_address
        - sender
      title: >-
        CreditsCoinbasePostResponsesContentApplicationJsonSchemaDataWeb3DataTransferIntentMetadata
    CreditsCoinbasePostResponsesContentApplicationJsonSchemaDataWeb3DataTransferIntent:
      type: object
      properties:
        call_data:
          $ref: >-
            #/components/schemas/CreditsCoinbasePostResponsesContentApplicationJsonSchemaDataWeb3DataTransferIntentCallData
        metadata:
          $ref: >-
            #/components/schemas/CreditsCoinbasePostResponsesContentApplicationJsonSchemaDataWeb3DataTransferIntentMetadata
      required:
        - call_data
        - metadata
      title: >-
        CreditsCoinbasePostResponsesContentApplicationJsonSchemaDataWeb3DataTransferIntent
    CreditsCoinbasePostResponsesContentApplicationJsonSchemaDataWeb3Data:
      type: object
      properties:
        transfer_intent:
          $ref: >-
            #/components/schemas/CreditsCoinbasePostResponsesContentApplicationJsonSchemaDataWeb3DataTransferIntent
      required:
        - transfer_intent
      title: CreditsCoinbasePostResponsesContentApplicationJsonSchemaDataWeb3Data
    CreditsCoinbasePostResponsesContentApplicationJsonSchemaData:
      type: object
      properties:
        id:
          type: string
        created_at:
          type: string
        expires_at:
          type: string
        web3_data:
          $ref: >-
            #/components/schemas/CreditsCoinbasePostResponsesContentApplicationJsonSchemaDataWeb3Data
      required:
        - id
        - created_at
        - expires_at
        - web3_data
      title: CreditsCoinbasePostResponsesContentApplicationJsonSchemaData
    Credits_createCoinbaseCharge_Response_200:
      type: object
      properties:
        data:
          $ref: >-
            #/components/schemas/CreditsCoinbasePostResponsesContentApplicationJsonSchemaData
      required:
        - data
      title: Credits_createCoinbaseCharge_Response_200
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
    bearer:
      type: http
      scheme: bearer
      description: API key as bearer token in Authorization header
```

## SDK Code Examples

```python
import requests

url = "https://openrouter.ai/api/v1/credits/coinbase"

payload = {
    "amount": 150,
    "sender": "0xAbC1234567890DefABC1234567890dEfABC12345",
    "chain_id": 1
}
headers = {
    "Authorization": "Bearer <token>",
    "Content-Type": "application/json"
}

response = requests.post(url, json=payload, headers=headers)

print(response.json())
```

```javascript
const url = "https://openrouter.ai/api/v1/credits/coinbase";
const options = {
  method: "POST",
  headers: {
    Authorization: "Bearer <token>",
    "Content-Type": "application/json",
  },
  body: '{"amount":150,"sender":"0xAbC1234567890DefABC1234567890dEfABC12345","chain_id":1}',
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

	url := "https://openrouter.ai/api/v1/credits/coinbase"

	payload := strings.NewReader("{\n  \"amount\": 150,\n  \"sender\": \"0xAbC1234567890DefABC1234567890dEfABC12345\",\n  \"chain_id\": 1\n}")

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

url = URI("https://openrouter.ai/api/v1/credits/coinbase")

http = Net::HTTP.new(url.host, url.port)
http.use_ssl = true

request = Net::HTTP::Post.new(url)
request["Authorization"] = 'Bearer <token>'
request["Content-Type"] = 'application/json'
request.body = "{\n  \"amount\": 150,\n  \"sender\": \"0xAbC1234567890DefABC1234567890dEfABC12345\",\n  \"chain_id\": 1\n}"

response = http.request(request)
puts response.read_body
```

```java
import com.mashape.unirest.http.HttpResponse;
import com.mashape.unirest.http.Unirest;

HttpResponse<String> response = Unirest.post("https://openrouter.ai/api/v1/credits/coinbase")
  .header("Authorization", "Bearer <token>")
  .header("Content-Type", "application/json")
  .body("{\n  \"amount\": 150,\n  \"sender\": \"0xAbC1234567890DefABC1234567890dEfABC12345\",\n  \"chain_id\": 1\n}")
  .asString();
```

```php
<?php
require_once('vendor/autoload.php');

$client = new \GuzzleHttp\Client();

$response = $client->request('POST', 'https://openrouter.ai/api/v1/credits/coinbase', [
  'body' => '{
  "amount": 150,
  "sender": "0xAbC1234567890DefABC1234567890dEfABC12345",
  "chain_id": 1
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

var client = new RestClient("https://openrouter.ai/api/v1/credits/coinbase");
var request = new RestRequest(Method.POST);
request.AddHeader("Authorization", "Bearer <token>");
request.AddHeader("Content-Type", "application/json");
request.AddParameter("application/json", "{\n  \"amount\": 150,\n  \"sender\": \"0xAbC1234567890DefABC1234567890dEfABC12345\",\n  \"chain_id\": 1\n}", ParameterType.RequestBody);
IRestResponse response = client.Execute(request);
```

```swift
import Foundation

let headers = [
  "Authorization": "Bearer <token>",
  "Content-Type": "application/json"
]
let parameters = [
  "amount": 150,
  "sender": "0xAbC1234567890DefABC1234567890dEfABC12345",
  "chain_id": 1
] as [String : Any]

let postData = JSONSerialization.data(withJSONObject: parameters, options: [])

let request = NSMutableURLRequest(url: NSURL(string: "https://openrouter.ai/api/v1/credits/coinbase")! as URL,
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
