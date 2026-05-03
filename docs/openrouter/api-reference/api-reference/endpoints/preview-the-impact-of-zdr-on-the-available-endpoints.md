# Preview the impact of ZDR on the available endpoints

GET https://openrouter.ai/api/v1/endpoints/zdr

Reference: https://openrouter.ai/docs/api/api-reference/endpoints/list-endpoints-zdr

## OpenAPI Specification

```yaml
openapi: 3.1.0
info:
  title: OpenRouter API
  version: 1.0.0
paths:
  /endpoints/zdr:
    get:
      operationId: list-endpoints-zdr
      summary: Preview the impact of ZDR on the available endpoints
      tags:
        - subpackage_endpoints
      parameters:
        - name: Authorization
          in: header
          description: API key as bearer token in Authorization header
          required: true
          schema:
            type: string
      responses:
        "200":
          description: Returns a list of endpoints
          content:
            application/json:
              schema:
                $ref: "#/components/schemas/Endpoints_listEndpointsZdr_Response_200"
        "500":
          description: Internal Server Error - Unexpected server error
          content:
            application/json:
              schema:
                $ref: "#/components/schemas/InternalServerResponse"
servers:
  - url: https://openrouter.ai/api/v1
components:
  schemas:
    PublicEndpointPricingPrompt:
      type: object
      properties: {}
      title: PublicEndpointPricingPrompt
    PublicEndpointPricingCompletion:
      type: object
      properties: {}
      title: PublicEndpointPricingCompletion
    PublicEndpointPricingRequest:
      type: object
      properties: {}
      title: PublicEndpointPricingRequest
    PublicEndpointPricingImage:
      type: object
      properties: {}
      title: PublicEndpointPricingImage
    PublicEndpointPricingImageToken:
      type: object
      properties: {}
      title: PublicEndpointPricingImageToken
    PublicEndpointPricingImageOutput:
      type: object
      properties: {}
      title: PublicEndpointPricingImageOutput
    PublicEndpointPricingAudio:
      type: object
      properties: {}
      title: PublicEndpointPricingAudio
    PublicEndpointPricingAudioOutput:
      type: object
      properties: {}
      title: PublicEndpointPricingAudioOutput
    PublicEndpointPricingInputAudioCache:
      type: object
      properties: {}
      title: PublicEndpointPricingInputAudioCache
    PublicEndpointPricingWebSearch:
      type: object
      properties: {}
      title: PublicEndpointPricingWebSearch
    PublicEndpointPricingInternalReasoning:
      type: object
      properties: {}
      title: PublicEndpointPricingInternalReasoning
    PublicEndpointPricingInputCacheRead:
      type: object
      properties: {}
      title: PublicEndpointPricingInputCacheRead
    PublicEndpointPricingInputCacheWrite:
      type: object
      properties: {}
      title: PublicEndpointPricingInputCacheWrite
    PublicEndpointPricing:
      type: object
      properties:
        prompt:
          $ref: "#/components/schemas/PublicEndpointPricingPrompt"
        completion:
          $ref: "#/components/schemas/PublicEndpointPricingCompletion"
        request:
          $ref: "#/components/schemas/PublicEndpointPricingRequest"
        image:
          $ref: "#/components/schemas/PublicEndpointPricingImage"
        image_token:
          $ref: "#/components/schemas/PublicEndpointPricingImageToken"
        image_output:
          $ref: "#/components/schemas/PublicEndpointPricingImageOutput"
        audio:
          $ref: "#/components/schemas/PublicEndpointPricingAudio"
        audio_output:
          $ref: "#/components/schemas/PublicEndpointPricingAudioOutput"
        input_audio_cache:
          $ref: "#/components/schemas/PublicEndpointPricingInputAudioCache"
        web_search:
          $ref: "#/components/schemas/PublicEndpointPricingWebSearch"
        internal_reasoning:
          $ref: "#/components/schemas/PublicEndpointPricingInternalReasoning"
        input_cache_read:
          $ref: "#/components/schemas/PublicEndpointPricingInputCacheRead"
        input_cache_write:
          $ref: "#/components/schemas/PublicEndpointPricingInputCacheWrite"
        discount:
          type: number
          format: double
      required:
        - prompt
        - completion
      title: PublicEndpointPricing
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
    PublicEndpointQuantization:
      type: object
      properties: {}
      title: PublicEndpointQuantization
    Parameter:
      type: string
      enum:
        - temperature
        - top_p
        - top_k
        - min_p
        - top_a
        - frequency_penalty
        - presence_penalty
        - repetition_penalty
        - max_tokens
        - logit_bias
        - logprobs
        - top_logprobs
        - seed
        - response_format
        - structured_outputs
        - stop
        - tools
        - tool_choice
        - parallel_tool_calls
        - include_reasoning
        - reasoning
        - reasoning_effort
        - web_search_options
        - verbosity
      title: Parameter
    EndpointStatus:
      type: string
      enum:
        - "0"
        - "-1"
        - "-2"
        - "-3"
        - "-5"
        - "-10"
      title: EndpointStatus
    PercentileStats:
      type: object
      properties:
        p50:
          type: number
          format: double
          description: Median (50th percentile)
        p75:
          type: number
          format: double
          description: 75th percentile
        p90:
          type: number
          format: double
          description: 90th percentile
        p99:
          type: number
          format: double
          description: 99th percentile
      required:
        - p50
        - p75
        - p90
        - p99
      description: >-
        Latency percentiles in milliseconds over the last 30 minutes. Latency
        measures time to first token. Only visible when authenticated with an
        API key or cookie; returns null for unauthenticated requests.
      title: PercentileStats
    PublicEndpointThroughputLast30M:
      type: object
      properties:
        p50:
          type: number
          format: double
          description: Median (50th percentile)
        p75:
          type: number
          format: double
          description: 75th percentile
        p90:
          type: number
          format: double
          description: 90th percentile
        p99:
          type: number
          format: double
          description: 99th percentile
      required:
        - p50
        - p75
        - p90
        - p99
      title: PublicEndpointThroughputLast30M
    PublicEndpoint:
      type: object
      properties:
        name:
          type: string
        model_id:
          type: string
          description: The unique identifier for the model (permaslug)
        model_name:
          type: string
        context_length:
          type: number
          format: double
        pricing:
          $ref: "#/components/schemas/PublicEndpointPricing"
        provider_name:
          $ref: "#/components/schemas/ProviderName"
        tag:
          type: string
        quantization:
          $ref: "#/components/schemas/PublicEndpointQuantization"
        max_completion_tokens:
          type:
            - number
            - "null"
          format: double
        max_prompt_tokens:
          type:
            - number
            - "null"
          format: double
        supported_parameters:
          type: array
          items:
            $ref: "#/components/schemas/Parameter"
        status:
          $ref: "#/components/schemas/EndpointStatus"
        uptime_last_30m:
          type:
            - number
            - "null"
          format: double
        supports_implicit_caching:
          type: boolean
        latency_last_30m:
          $ref: "#/components/schemas/PercentileStats"
        throughput_last_30m:
          $ref: "#/components/schemas/PublicEndpointThroughputLast30M"
      required:
        - name
        - model_id
        - model_name
        - context_length
        - pricing
        - provider_name
        - tag
        - quantization
        - max_completion_tokens
        - max_prompt_tokens
        - supported_parameters
        - uptime_last_30m
        - supports_implicit_caching
        - latency_last_30m
        - throughput_last_30m
      description: Information about a specific model endpoint
      title: PublicEndpoint
    Endpoints_listEndpointsZdr_Response_200:
      type: object
      properties:
        data:
          type: array
          items:
            $ref: "#/components/schemas/PublicEndpoint"
      required:
        - data
      title: Endpoints_listEndpointsZdr_Response_200
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

url = "https://openrouter.ai/api/v1/endpoints/zdr"

headers = {"Authorization": "Bearer <token>"}

response = requests.get(url, headers=headers)

print(response.json())
```

```javascript
const url = "https://openrouter.ai/api/v1/endpoints/zdr";
const options = { method: "GET", headers: { Authorization: "Bearer <token>" } };

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
	"net/http"
	"io"
)

func main() {

	url := "https://openrouter.ai/api/v1/endpoints/zdr"

	req, _ := http.NewRequest("GET", url, nil)

	req.Header.Add("Authorization", "Bearer <token>")

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

url = URI("https://openrouter.ai/api/v1/endpoints/zdr")

http = Net::HTTP.new(url.host, url.port)
http.use_ssl = true

request = Net::HTTP::Get.new(url)
request["Authorization"] = 'Bearer <token>'

response = http.request(request)
puts response.read_body
```

```java
import com.mashape.unirest.http.HttpResponse;
import com.mashape.unirest.http.Unirest;

HttpResponse<String> response = Unirest.get("https://openrouter.ai/api/v1/endpoints/zdr")
  .header("Authorization", "Bearer <token>")
  .asString();
```

```php
<?php
require_once('vendor/autoload.php');

$client = new \GuzzleHttp\Client();

$response = $client->request('GET', 'https://openrouter.ai/api/v1/endpoints/zdr', [
  'headers' => [
    'Authorization' => 'Bearer <token>',
  ],
]);

echo $response->getBody();
```

```csharp
using RestSharp;

var client = new RestClient("https://openrouter.ai/api/v1/endpoints/zdr");
var request = new RestRequest(Method.GET);
request.AddHeader("Authorization", "Bearer <token>");
IRestResponse response = client.Execute(request);
```

```swift
import Foundation

let headers = ["Authorization": "Bearer <token>"]

let request = NSMutableURLRequest(url: NSURL(string: "https://openrouter.ai/api/v1/endpoints/zdr")! as URL,
                                        cachePolicy: .useProtocolCachePolicy,
                                    timeoutInterval: 10.0)
request.httpMethod = "GET"
request.allHTTPHeaderFields = headers

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
