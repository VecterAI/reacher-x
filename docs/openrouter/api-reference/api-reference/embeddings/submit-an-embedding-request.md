# Submit an embedding request

POST https://openrouter.ai/api/v1/embeddings
Content-Type: application/json

Submits an embedding request to the embeddings router

Reference: https://openrouter.ai/docs/api/api-reference/embeddings/create-embeddings

## OpenAPI Specification

```yaml
openapi: 3.1.0
info:
  title: OpenRouter API
  version: 1.0.0
paths:
  /embeddings:
    post:
      operationId: create-embeddings
      summary: Submit an embedding request
      description: Submits an embedding request to the embeddings router
      tags:
        - subpackage_embeddings
      parameters:
        - name: Authorization
          in: header
          description: API key as bearer token in Authorization header
          required: true
          schema:
            type: string
      responses:
        "200":
          description: Embedding response
          content:
            application/json:
              schema:
                $ref: "#/components/schemas/Embeddings_createEmbeddings_Response_200"
        "400":
          description: Bad Request - Invalid request parameters or malformed input
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
        "402":
          description: Payment Required - Insufficient credits or quota to complete request
          content:
            application/json:
              schema:
                $ref: "#/components/schemas/PaymentRequiredResponse"
        "404":
          description: Not Found - Resource does not exist
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
          description: Internal Server Error - Unexpected server error
          content:
            application/json:
              schema:
                $ref: "#/components/schemas/InternalServerResponse"
        "502":
          description: Bad Gateway - Provider/upstream API failure
          content:
            application/json:
              schema:
                $ref: "#/components/schemas/BadGatewayResponse"
        "503":
          description: Service Unavailable - Service temporarily unavailable
          content:
            application/json:
              schema:
                $ref: "#/components/schemas/ServiceUnavailableResponse"
      requestBody:
        content:
          application/json:
            schema:
              type: object
              properties:
                input:
                  $ref: >-
                    #/components/schemas/EmbeddingsPostRequestBodyContentApplicationJsonSchemaInput
                model:
                  type: string
                encoding_format:
                  $ref: >-
                    #/components/schemas/EmbeddingsPostRequestBodyContentApplicationJsonSchemaEncodingFormat
                dimensions:
                  type: integer
                user:
                  type: string
                provider:
                  $ref: "#/components/schemas/ProviderPreferences"
                input_type:
                  type: string
              required:
                - input
                - model
servers:
  - url: https://openrouter.ai/api/v1
components:
  schemas:
    EmbeddingsPostRequestBodyContentApplicationJsonSchemaInputOneOf4ItemsContentItemsOneOf0Type:
      type: string
      enum:
        - text
      title: >-
        EmbeddingsPostRequestBodyContentApplicationJsonSchemaInputOneOf4ItemsContentItemsOneOf0Type
    EmbeddingsPostRequestBodyContentApplicationJsonSchemaInputOneOf4ItemsContentItems0:
      type: object
      properties:
        type:
          $ref: >-
            #/components/schemas/EmbeddingsPostRequestBodyContentApplicationJsonSchemaInputOneOf4ItemsContentItemsOneOf0Type
        text:
          type: string
      required:
        - type
        - text
      title: >-
        EmbeddingsPostRequestBodyContentApplicationJsonSchemaInputOneOf4ItemsContentItems0
    EmbeddingsPostRequestBodyContentApplicationJsonSchemaInputOneOf4ItemsContentItemsOneOf1Type:
      type: string
      enum:
        - image_url
      title: >-
        EmbeddingsPostRequestBodyContentApplicationJsonSchemaInputOneOf4ItemsContentItemsOneOf1Type
    EmbeddingsPostRequestBodyContentApplicationJsonSchemaInputOneOf4ItemsContentItemsOneOf1ImageUrl:
      type: object
      properties:
        url:
          type: string
      required:
        - url
      title: >-
        EmbeddingsPostRequestBodyContentApplicationJsonSchemaInputOneOf4ItemsContentItemsOneOf1ImageUrl
    EmbeddingsPostRequestBodyContentApplicationJsonSchemaInputOneOf4ItemsContentItems1:
      type: object
      properties:
        type:
          $ref: >-
            #/components/schemas/EmbeddingsPostRequestBodyContentApplicationJsonSchemaInputOneOf4ItemsContentItemsOneOf1Type
        image_url:
          $ref: >-
            #/components/schemas/EmbeddingsPostRequestBodyContentApplicationJsonSchemaInputOneOf4ItemsContentItemsOneOf1ImageUrl
      required:
        - type
        - image_url
      title: >-
        EmbeddingsPostRequestBodyContentApplicationJsonSchemaInputOneOf4ItemsContentItems1
    EmbeddingsPostRequestBodyContentApplicationJsonSchemaInputOneOf4ItemsContentItems:
      oneOf:
        - $ref: >-
            #/components/schemas/EmbeddingsPostRequestBodyContentApplicationJsonSchemaInputOneOf4ItemsContentItems0
        - $ref: >-
            #/components/schemas/EmbeddingsPostRequestBodyContentApplicationJsonSchemaInputOneOf4ItemsContentItems1
      title: >-
        EmbeddingsPostRequestBodyContentApplicationJsonSchemaInputOneOf4ItemsContentItems
    EmbeddingsPostRequestBodyContentApplicationJsonSchemaInputOneOf4Items:
      type: object
      properties:
        content:
          type: array
          items:
            $ref: >-
              #/components/schemas/EmbeddingsPostRequestBodyContentApplicationJsonSchemaInputOneOf4ItemsContentItems
      required:
        - content
      title: EmbeddingsPostRequestBodyContentApplicationJsonSchemaInputOneOf4Items
    EmbeddingsPostRequestBodyContentApplicationJsonSchemaInput4:
      type: array
      items:
        $ref: >-
          #/components/schemas/EmbeddingsPostRequestBodyContentApplicationJsonSchemaInputOneOf4Items
      title: EmbeddingsPostRequestBodyContentApplicationJsonSchemaInput4
    EmbeddingsPostRequestBodyContentApplicationJsonSchemaInput:
      oneOf:
        - type: string
        - type: array
          items:
            type: string
        - type: array
          items:
            type: number
            format: double
        - type: array
          items:
            type: array
            items:
              type: number
              format: double
        - $ref: >-
            #/components/schemas/EmbeddingsPostRequestBodyContentApplicationJsonSchemaInput4
      title: EmbeddingsPostRequestBodyContentApplicationJsonSchemaInput
    EmbeddingsPostRequestBodyContentApplicationJsonSchemaEncodingFormat:
      type: string
      enum:
        - float
        - base64
      title: EmbeddingsPostRequestBodyContentApplicationJsonSchemaEncodingFormat
    DataCollection:
      type: string
      enum:
        - deny
        - allow
      description: >-
        Data collection setting. If no available model provider meets the
        requirement, your request will return an error.

        - allow: (default) allow providers which store user data non-transiently
        and may train on it


        - deny: use only providers which do not collect user data.
      title: DataCollection
    ProviderName:
      type: string
      enum:
        - AI21
        - AionLabs
        - Alibaba
        - Ambient
        - Amazon Bedrock
        - Amazon Nova
        - Anthropic
        - Arcee AI
        - AtlasCloud
        - Avian
        - Azure
        - BaseTen
        - BytePlus
        - Black Forest Labs
        - Cerebras
        - Chutes
        - Cirrascale
        - Clarifai
        - Cloudflare
        - Cohere
        - Crusoe
        - DeepInfra
        - DeepSeek
        - Featherless
        - Fireworks
        - Friendli
        - GMICloud
        - Google
        - Google AI Studio
        - Groq
        - Hyperbolic
        - Inception
        - Inceptron
        - InferenceNet
        - Ionstream
        - Infermatic
        - Io Net
        - Inflection
        - Liquid
        - Mara
        - Mancer 2
        - Minimax
        - ModelRun
        - Mistral
        - Modular
        - Moonshot AI
        - Morph
        - NCompass
        - Nebius
        - NextBit
        - Novita
        - Nvidia
        - OpenAI
        - OpenInference
        - Parasail
        - Perplexity
        - Phala
        - Relace
        - SambaNova
        - Seed
        - SiliconFlow
        - Sourceful
        - StepFun
        - Stealth
        - StreamLake
        - Switchpoint
        - Together
        - Upstage
        - Venice
        - WandB
        - Xiaomi
        - xAI
        - Z.AI
        - FakeProvider
      title: ProviderName
    ProviderPreferencesOrderItems:
      oneOf:
        - $ref: "#/components/schemas/ProviderName"
        - type: string
      title: ProviderPreferencesOrderItems
    ProviderPreferencesOnlyItems:
      oneOf:
        - $ref: "#/components/schemas/ProviderName"
        - type: string
      title: ProviderPreferencesOnlyItems
    ProviderPreferencesIgnoreItems:
      oneOf:
        - $ref: "#/components/schemas/ProviderName"
        - type: string
      title: ProviderPreferencesIgnoreItems
    Quantization:
      type: string
      enum:
        - int4
        - int8
        - fp4
        - fp6
        - fp8
        - fp16
        - bf16
        - fp32
        - unknown
      title: Quantization
    ProviderPreferencesSort:
      type: object
      properties: {}
      title: ProviderPreferencesSort
    BigNumberUnion:
      type: string
      description: Price per million prompt tokens
      title: BigNumberUnion
    ProviderPreferencesMaxPriceCompletion:
      type: object
      properties: {}
      title: ProviderPreferencesMaxPriceCompletion
    ProviderPreferencesMaxPriceImage:
      type: object
      properties: {}
      title: ProviderPreferencesMaxPriceImage
    ProviderPreferencesMaxPriceAudio:
      type: object
      properties: {}
      title: ProviderPreferencesMaxPriceAudio
    ProviderPreferencesMaxPriceRequest:
      type: object
      properties: {}
      title: ProviderPreferencesMaxPriceRequest
    ProviderPreferencesMaxPrice:
      type: object
      properties:
        prompt:
          $ref: "#/components/schemas/BigNumberUnion"
        completion:
          $ref: "#/components/schemas/ProviderPreferencesMaxPriceCompletion"
        image:
          $ref: "#/components/schemas/ProviderPreferencesMaxPriceImage"
        audio:
          $ref: "#/components/schemas/ProviderPreferencesMaxPriceAudio"
        request:
          $ref: "#/components/schemas/ProviderPreferencesMaxPriceRequest"
      description: >-
        The object specifying the maximum price you want to pay for this
        request. USD price per million tokens, for prompt and completion.
      title: ProviderPreferencesMaxPrice
    PercentileThroughputCutoffs:
      type: object
      properties:
        p50:
          type:
            - number
            - "null"
          format: double
          description: Minimum p50 throughput (tokens/sec)
        p75:
          type:
            - number
            - "null"
          format: double
          description: Minimum p75 throughput (tokens/sec)
        p90:
          type:
            - number
            - "null"
          format: double
          description: Minimum p90 throughput (tokens/sec)
        p99:
          type:
            - number
            - "null"
          format: double
          description: Minimum p99 throughput (tokens/sec)
      description: >-
        Percentile-based throughput cutoffs. All specified cutoffs must be met
        for an endpoint to be preferred.
      title: PercentileThroughputCutoffs
    PreferredMinThroughput:
      oneOf:
        - type: number
          format: double
        - $ref: "#/components/schemas/PercentileThroughputCutoffs"
        - description: Any type
      description: >-
        Preferred minimum throughput (in tokens per second). Can be a number
        (applies to p50) or an object with percentile-specific cutoffs.
        Endpoints below the threshold(s) may still be used, but are
        deprioritized in routing. When using fallback models, this may cause a
        fallback model to be used instead of the primary model if it meets the
        threshold.
      title: PreferredMinThroughput
    PercentileLatencyCutoffs:
      type: object
      properties:
        p50:
          type:
            - number
            - "null"
          format: double
          description: Maximum p50 latency (seconds)
        p75:
          type:
            - number
            - "null"
          format: double
          description: Maximum p75 latency (seconds)
        p90:
          type:
            - number
            - "null"
          format: double
          description: Maximum p90 latency (seconds)
        p99:
          type:
            - number
            - "null"
          format: double
          description: Maximum p99 latency (seconds)
      description: >-
        Percentile-based latency cutoffs. All specified cutoffs must be met for
        an endpoint to be preferred.
      title: PercentileLatencyCutoffs
    PreferredMaxLatency:
      oneOf:
        - type: number
          format: double
        - $ref: "#/components/schemas/PercentileLatencyCutoffs"
        - description: Any type
      description: >-
        Preferred maximum latency (in seconds). Can be a number (applies to p50)
        or an object with percentile-specific cutoffs. Endpoints above the
        threshold(s) may still be used, but are deprioritized in routing. When
        using fallback models, this may cause a fallback model to be used
        instead of the primary model if it meets the threshold.
      title: PreferredMaxLatency
    ProviderPreferences:
      type: object
      properties:
        allow_fallbacks:
          type:
            - boolean
            - "null"
          description: >
            Whether to allow backup providers to serve requests

            - true: (default) when the primary provider (or your custom
            providers in "order") is unavailable, use the next best provider.

            - false: use only the primary/custom provider, and return the
            upstream error if it's unavailable.
        require_parameters:
          type:
            - boolean
            - "null"
          description: >-
            Whether to filter providers to only those that support the
            parameters you've provided. If this setting is omitted or set to
            false, then providers will receive only the parameters they support,
            and ignore the rest.
        data_collection:
          $ref: "#/components/schemas/DataCollection"
        zdr:
          type:
            - boolean
            - "null"
          description: >-
            Whether to restrict routing to only ZDR (Zero Data Retention)
            endpoints. When true, only endpoints that do not retain prompts will
            be used.
        enforce_distillable_text:
          type:
            - boolean
            - "null"
          description: >-
            Whether to restrict routing to only models that allow text
            distillation. When true, only models where the author has allowed
            distillation will be used.
        order:
          type:
            - array
            - "null"
          items:
            $ref: "#/components/schemas/ProviderPreferencesOrderItems"
          description: >-
            An ordered list of provider slugs. The router will attempt to use
            the first provider in the subset of this list that supports your
            requested model, and fall back to the next if it is unavailable. If
            no providers are available, the request will fail with an error
            message.
        only:
          type:
            - array
            - "null"
          items:
            $ref: "#/components/schemas/ProviderPreferencesOnlyItems"
          description: >-
            List of provider slugs to allow. If provided, this list is merged
            with your account-wide allowed provider settings for this request.
        ignore:
          type:
            - array
            - "null"
          items:
            $ref: "#/components/schemas/ProviderPreferencesIgnoreItems"
          description: >-
            List of provider slugs to ignore. If provided, this list is merged
            with your account-wide ignored provider settings for this request.
        quantizations:
          type:
            - array
            - "null"
          items:
            $ref: "#/components/schemas/Quantization"
          description: A list of quantization levels to filter the provider by.
        sort:
          $ref: "#/components/schemas/ProviderPreferencesSort"
        max_price:
          $ref: "#/components/schemas/ProviderPreferencesMaxPrice"
          description: >-
            The object specifying the maximum price you want to pay for this
            request. USD price per million tokens, for prompt and completion.
        preferred_min_throughput:
          $ref: "#/components/schemas/PreferredMinThroughput"
        preferred_max_latency:
          $ref: "#/components/schemas/PreferredMaxLatency"
      description: Provider routing preferences for the request.
      title: ProviderPreferences
    EmbeddingsPostResponsesContentApplicationJsonSchemaObject:
      type: string
      enum:
        - list
      title: EmbeddingsPostResponsesContentApplicationJsonSchemaObject
    EmbeddingsPostResponsesContentApplicationJsonSchemaDataItemsObject:
      type: string
      enum:
        - embedding
      title: EmbeddingsPostResponsesContentApplicationJsonSchemaDataItemsObject
    EmbeddingsPostResponsesContentApplicationJsonSchemaDataItemsEmbedding:
      oneOf:
        - type: array
          items:
            type: number
            format: double
        - type: string
      title: EmbeddingsPostResponsesContentApplicationJsonSchemaDataItemsEmbedding
    EmbeddingsPostResponsesContentApplicationJsonSchemaDataItems:
      type: object
      properties:
        object:
          $ref: >-
            #/components/schemas/EmbeddingsPostResponsesContentApplicationJsonSchemaDataItemsObject
        embedding:
          $ref: >-
            #/components/schemas/EmbeddingsPostResponsesContentApplicationJsonSchemaDataItemsEmbedding
        index:
          type: number
          format: double
      required:
        - object
        - embedding
      title: EmbeddingsPostResponsesContentApplicationJsonSchemaDataItems
    EmbeddingsPostResponsesContentApplicationJsonSchemaUsage:
      type: object
      properties:
        prompt_tokens:
          type: number
          format: double
        total_tokens:
          type: number
          format: double
        cost:
          type: number
          format: double
      required:
        - prompt_tokens
        - total_tokens
      title: EmbeddingsPostResponsesContentApplicationJsonSchemaUsage
    Embeddings_createEmbeddings_Response_200:
      type: object
      properties:
        id:
          type: string
        object:
          $ref: >-
            #/components/schemas/EmbeddingsPostResponsesContentApplicationJsonSchemaObject
        data:
          type: array
          items:
            $ref: >-
              #/components/schemas/EmbeddingsPostResponsesContentApplicationJsonSchemaDataItems
        model:
          type: string
        usage:
          $ref: >-
            #/components/schemas/EmbeddingsPostResponsesContentApplicationJsonSchemaUsage
      required:
        - object
        - data
        - model
      title: Embeddings_createEmbeddings_Response_200
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
    PaymentRequiredResponseErrorData:
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
      description: Error data for PaymentRequiredResponse
      title: PaymentRequiredResponseErrorData
    PaymentRequiredResponse:
      type: object
      properties:
        error:
          $ref: "#/components/schemas/PaymentRequiredResponseErrorData"
        user_id:
          type:
            - string
            - "null"
      required:
        - error
      description: Payment Required - Insufficient credits or quota to complete request
      title: PaymentRequiredResponse
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
    BadGatewayResponseErrorData:
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
      description: Error data for BadGatewayResponse
      title: BadGatewayResponseErrorData
    BadGatewayResponse:
      type: object
      properties:
        error:
          $ref: "#/components/schemas/BadGatewayResponseErrorData"
        user_id:
          type:
            - string
            - "null"
      required:
        - error
      description: Bad Gateway - Provider/upstream API failure
      title: BadGatewayResponse
    ServiceUnavailableResponseErrorData:
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
      description: Error data for ServiceUnavailableResponse
      title: ServiceUnavailableResponseErrorData
    ServiceUnavailableResponse:
      type: object
      properties:
        error:
          $ref: "#/components/schemas/ServiceUnavailableResponseErrorData"
        user_id:
          type:
            - string
            - "null"
      required:
        - error
      description: Service Unavailable - Service temporarily unavailable
      title: ServiceUnavailableResponse
  securitySchemes:
    apiKey:
      type: http
      scheme: bearer
      description: API key as bearer token in Authorization header
```

## SDK Code Examples

```python
import requests

url = "https://openrouter.ai/api/v1/embeddings"

payload = {
    "input": "The quick brown fox jumps over the lazy dog",
    "model": "text-embedding-ada-002"
}
headers = {
    "Authorization": "Bearer <token>",
    "Content-Type": "application/json"
}

response = requests.post(url, json=payload, headers=headers)

print(response.json())
```

```javascript
const url = "https://openrouter.ai/api/v1/embeddings";
const options = {
  method: "POST",
  headers: {
    Authorization: "Bearer <token>",
    "Content-Type": "application/json",
  },
  body: '{"input":"The quick brown fox jumps over the lazy dog","model":"text-embedding-ada-002"}',
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

	url := "https://openrouter.ai/api/v1/embeddings"

	payload := strings.NewReader("{\n  \"input\": \"The quick brown fox jumps over the lazy dog\",\n  \"model\": \"text-embedding-ada-002\"\n}")

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

url = URI("https://openrouter.ai/api/v1/embeddings")

http = Net::HTTP.new(url.host, url.port)
http.use_ssl = true

request = Net::HTTP::Post.new(url)
request["Authorization"] = 'Bearer <token>'
request["Content-Type"] = 'application/json'
request.body = "{\n  \"input\": \"The quick brown fox jumps over the lazy dog\",\n  \"model\": \"text-embedding-ada-002\"\n}"

response = http.request(request)
puts response.read_body
```

```java
import com.mashape.unirest.http.HttpResponse;
import com.mashape.unirest.http.Unirest;

HttpResponse<String> response = Unirest.post("https://openrouter.ai/api/v1/embeddings")
  .header("Authorization", "Bearer <token>")
  .header("Content-Type", "application/json")
  .body("{\n  \"input\": \"The quick brown fox jumps over the lazy dog\",\n  \"model\": \"text-embedding-ada-002\"\n}")
  .asString();
```

```php
<?php
require_once('vendor/autoload.php');

$client = new \GuzzleHttp\Client();

$response = $client->request('POST', 'https://openrouter.ai/api/v1/embeddings', [
  'body' => '{
  "input": "The quick brown fox jumps over the lazy dog",
  "model": "text-embedding-ada-002"
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

var client = new RestClient("https://openrouter.ai/api/v1/embeddings");
var request = new RestRequest(Method.POST);
request.AddHeader("Authorization", "Bearer <token>");
request.AddHeader("Content-Type", "application/json");
request.AddParameter("application/json", "{\n  \"input\": \"The quick brown fox jumps over the lazy dog\",\n  \"model\": \"text-embedding-ada-002\"\n}", ParameterType.RequestBody);
IRestResponse response = client.Execute(request);
```

```swift
import Foundation

let headers = [
  "Authorization": "Bearer <token>",
  "Content-Type": "application/json"
]
let parameters = [
  "input": "The quick brown fox jumps over the lazy dog",
  "model": "text-embedding-ada-002"
] as [String : Any]

let postData = JSONSerialization.data(withJSONObject: parameters, options: [])

let request = NSMutableURLRequest(url: NSURL(string: "https://openrouter.ai/api/v1/embeddings")! as URL,
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
