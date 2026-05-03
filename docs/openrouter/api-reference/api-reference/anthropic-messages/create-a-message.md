# Create a message

POST https://openrouter.ai/api/v1/messages
Content-Type: application/json

Creates a message using the Anthropic Messages API format. Supports text, images, PDFs, tools, and extended thinking.

Reference: https://openrouter.ai/docs/api/api-reference/anthropic-messages/create-messages

## OpenAPI Specification

```yaml
openapi: 3.1.0
info:
  title: OpenRouter API
  version: 1.0.0
paths:
  /messages:
    post:
      operationId: create-messages
      summary: Create a message
      description: >-
        Creates a message using the Anthropic Messages API format. Supports
        text, images, PDFs, tools, and extended thinking.
      tags:
        - subpackage_anthropicMessages
      parameters:
        - name: Authorization
          in: header
          description: API key as bearer token in Authorization header
          required: true
          schema:
            type: string
      responses:
        "200":
          description: Successful response
          content:
            application/json:
              schema:
                $ref: "#/components/schemas/AnthropicMessagesResponse"
        "400":
          description: Invalid request error
          content:
            application/json:
              schema:
                $ref: "#/components/schemas/CreateMessagesRequestBadRequestError"
        "401":
          description: Authentication error
          content:
            application/json:
              schema:
                $ref: "#/components/schemas/CreateMessagesRequestUnauthorizedError"
        "403":
          description: Permission denied error
          content:
            application/json:
              schema:
                $ref: "#/components/schemas/CreateMessagesRequestForbiddenError"
        "404":
          description: Not found error
          content:
            application/json:
              schema:
                $ref: "#/components/schemas/CreateMessagesRequestNotFoundError"
        "429":
          description: Rate limit error
          content:
            application/json:
              schema:
                $ref: "#/components/schemas/CreateMessagesRequestTooManyRequestsError"
        "500":
          description: API error
          content:
            application/json:
              schema:
                $ref: "#/components/schemas/CreateMessagesRequestInternalServerError"
        "503":
          description: Overloaded error
          content:
            application/json:
              schema:
                $ref: >-
                  #/components/schemas/CreateMessagesRequestServiceUnavailableError
      requestBody:
        content:
          application/json:
            schema:
              $ref: "#/components/schemas/AnthropicMessagesRequest"
servers:
  - url: https://openrouter.ai/api/v1
components:
  schemas:
    OpenRouterAnthropicMessageParamRole:
      type: string
      enum:
        - user
        - assistant
      title: OpenRouterAnthropicMessageParamRole
    OpenRouterAnthropicMessageParamContentOneOf1ItemsOneOf0Type:
      type: string
      enum:
        - text
      title: OpenRouterAnthropicMessageParamContentOneOf1ItemsOneOf0Type
    OpenRouterAnthropicMessageParamContentOneOf1ItemsOneOf0CitationsItemsOneOf0Type:
      type: string
      enum:
        - char_location
      title: >-
        OpenRouterAnthropicMessageParamContentOneOf1ItemsOneOf0CitationsItemsOneOf0Type
    OpenRouterAnthropicMessageParamContentOneOf1ItemsOneOf0CitationsItems0:
      type: object
      properties:
        type:
          $ref: >-
            #/components/schemas/OpenRouterAnthropicMessageParamContentOneOf1ItemsOneOf0CitationsItemsOneOf0Type
        cited_text:
          type: string
        document_index:
          type: number
          format: double
        document_title:
          type:
            - string
            - "null"
        start_char_index:
          type: number
          format: double
        end_char_index:
          type: number
          format: double
      required:
        - type
        - cited_text
        - document_index
        - document_title
        - start_char_index
        - end_char_index
      title: OpenRouterAnthropicMessageParamContentOneOf1ItemsOneOf0CitationsItems0
    OpenRouterAnthropicMessageParamContentOneOf1ItemsOneOf0CitationsItemsOneOf1Type:
      type: string
      enum:
        - page_location
      title: >-
        OpenRouterAnthropicMessageParamContentOneOf1ItemsOneOf0CitationsItemsOneOf1Type
    OpenRouterAnthropicMessageParamContentOneOf1ItemsOneOf0CitationsItems1:
      type: object
      properties:
        type:
          $ref: >-
            #/components/schemas/OpenRouterAnthropicMessageParamContentOneOf1ItemsOneOf0CitationsItemsOneOf1Type
        cited_text:
          type: string
        document_index:
          type: number
          format: double
        document_title:
          type:
            - string
            - "null"
        start_page_number:
          type: number
          format: double
        end_page_number:
          type: number
          format: double
      required:
        - type
        - cited_text
        - document_index
        - document_title
        - start_page_number
        - end_page_number
      title: OpenRouterAnthropicMessageParamContentOneOf1ItemsOneOf0CitationsItems1
    OpenRouterAnthropicMessageParamContentOneOf1ItemsOneOf0CitationsItemsOneOf2Type:
      type: string
      enum:
        - content_block_location
      title: >-
        OpenRouterAnthropicMessageParamContentOneOf1ItemsOneOf0CitationsItemsOneOf2Type
    OpenRouterAnthropicMessageParamContentOneOf1ItemsOneOf0CitationsItems2:
      type: object
      properties:
        type:
          $ref: >-
            #/components/schemas/OpenRouterAnthropicMessageParamContentOneOf1ItemsOneOf0CitationsItemsOneOf2Type
        cited_text:
          type: string
        document_index:
          type: number
          format: double
        document_title:
          type:
            - string
            - "null"
        start_block_index:
          type: number
          format: double
        end_block_index:
          type: number
          format: double
      required:
        - type
        - cited_text
        - document_index
        - document_title
        - start_block_index
        - end_block_index
      title: OpenRouterAnthropicMessageParamContentOneOf1ItemsOneOf0CitationsItems2
    OpenRouterAnthropicMessageParamContentOneOf1ItemsOneOf0CitationsItemsOneOf3Type:
      type: string
      enum:
        - web_search_result_location
      title: >-
        OpenRouterAnthropicMessageParamContentOneOf1ItemsOneOf0CitationsItemsOneOf3Type
    OpenRouterAnthropicMessageParamContentOneOf1ItemsOneOf0CitationsItems3:
      type: object
      properties:
        type:
          $ref: >-
            #/components/schemas/OpenRouterAnthropicMessageParamContentOneOf1ItemsOneOf0CitationsItemsOneOf3Type
        cited_text:
          type: string
        encrypted_index:
          type: string
        title:
          type:
            - string
            - "null"
        url:
          type: string
      required:
        - type
        - cited_text
        - encrypted_index
        - title
        - url
      title: OpenRouterAnthropicMessageParamContentOneOf1ItemsOneOf0CitationsItems3
    OpenRouterAnthropicMessageParamContentOneOf1ItemsOneOf0CitationsItemsOneOf4Type:
      type: string
      enum:
        - search_result_location
      title: >-
        OpenRouterAnthropicMessageParamContentOneOf1ItemsOneOf0CitationsItemsOneOf4Type
    OpenRouterAnthropicMessageParamContentOneOf1ItemsOneOf0CitationsItems4:
      type: object
      properties:
        type:
          $ref: >-
            #/components/schemas/OpenRouterAnthropicMessageParamContentOneOf1ItemsOneOf0CitationsItemsOneOf4Type
        cited_text:
          type: string
        search_result_index:
          type: number
          format: double
        source:
          type: string
        title:
          type:
            - string
            - "null"
        start_block_index:
          type: number
          format: double
        end_block_index:
          type: number
          format: double
      required:
        - type
        - cited_text
        - search_result_index
        - source
        - title
        - start_block_index
        - end_block_index
      title: OpenRouterAnthropicMessageParamContentOneOf1ItemsOneOf0CitationsItems4
    OpenRouterAnthropicMessageParamContentOneOf1ItemsOneOf0CitationsItems:
      oneOf:
        - $ref: >-
            #/components/schemas/OpenRouterAnthropicMessageParamContentOneOf1ItemsOneOf0CitationsItems0
        - $ref: >-
            #/components/schemas/OpenRouterAnthropicMessageParamContentOneOf1ItemsOneOf0CitationsItems1
        - $ref: >-
            #/components/schemas/OpenRouterAnthropicMessageParamContentOneOf1ItemsOneOf0CitationsItems2
        - $ref: >-
            #/components/schemas/OpenRouterAnthropicMessageParamContentOneOf1ItemsOneOf0CitationsItems3
        - $ref: >-
            #/components/schemas/OpenRouterAnthropicMessageParamContentOneOf1ItemsOneOf0CitationsItems4
      title: OpenRouterAnthropicMessageParamContentOneOf1ItemsOneOf0CitationsItems
    OpenRouterAnthropicMessageParamContentOneOf1ItemsOneOf0CacheControlType:
      type: string
      enum:
        - ephemeral
      title: OpenRouterAnthropicMessageParamContentOneOf1ItemsOneOf0CacheControlType
    OpenRouterAnthropicMessageParamContentOneOf1ItemsOneOf0CacheControlTtl:
      type: string
      enum:
        - 5m
        - 1h
      title: OpenRouterAnthropicMessageParamContentOneOf1ItemsOneOf0CacheControlTtl
    OpenRouterAnthropicMessageParamContentOneOf1ItemsOneOf0CacheControl:
      type: object
      properties:
        type:
          $ref: >-
            #/components/schemas/OpenRouterAnthropicMessageParamContentOneOf1ItemsOneOf0CacheControlType
        ttl:
          $ref: >-
            #/components/schemas/OpenRouterAnthropicMessageParamContentOneOf1ItemsOneOf0CacheControlTtl
      required:
        - type
      title: OpenRouterAnthropicMessageParamContentOneOf1ItemsOneOf0CacheControl
    OpenRouterAnthropicMessageParamContentOneOf1Items0:
      type: object
      properties:
        type:
          $ref: >-
            #/components/schemas/OpenRouterAnthropicMessageParamContentOneOf1ItemsOneOf0Type
        text:
          type: string
        citations:
          type:
            - array
            - "null"
          items:
            $ref: >-
              #/components/schemas/OpenRouterAnthropicMessageParamContentOneOf1ItemsOneOf0CitationsItems
        cache_control:
          $ref: >-
            #/components/schemas/OpenRouterAnthropicMessageParamContentOneOf1ItemsOneOf0CacheControl
      required:
        - type
        - text
      title: OpenRouterAnthropicMessageParamContentOneOf1Items0
    OpenRouterAnthropicMessageParamContentOneOf1ItemsOneOf1Type:
      type: string
      enum:
        - image
      title: OpenRouterAnthropicMessageParamContentOneOf1ItemsOneOf1Type
    OpenRouterAnthropicMessageParamContentOneOf1ItemsOneOf1SourceOneOf0Type:
      type: string
      enum:
        - base64
      title: OpenRouterAnthropicMessageParamContentOneOf1ItemsOneOf1SourceOneOf0Type
    OpenRouterAnthropicMessageParamContentOneOf1ItemsOneOf1SourceOneOf0MediaType:
      type: string
      enum:
        - image/jpeg
        - image/png
        - image/gif
        - image/webp
      title: >-
        OpenRouterAnthropicMessageParamContentOneOf1ItemsOneOf1SourceOneOf0MediaType
    OpenRouterAnthropicMessageParamContentOneOf1ItemsOneOf1Source0:
      type: object
      properties:
        type:
          $ref: >-
            #/components/schemas/OpenRouterAnthropicMessageParamContentOneOf1ItemsOneOf1SourceOneOf0Type
        media_type:
          $ref: >-
            #/components/schemas/OpenRouterAnthropicMessageParamContentOneOf1ItemsOneOf1SourceOneOf0MediaType
        data:
          type: string
      required:
        - type
        - media_type
        - data
      title: OpenRouterAnthropicMessageParamContentOneOf1ItemsOneOf1Source0
    OpenRouterAnthropicMessageParamContentOneOf1ItemsOneOf1SourceOneOf1Type:
      type: string
      enum:
        - url
      title: OpenRouterAnthropicMessageParamContentOneOf1ItemsOneOf1SourceOneOf1Type
    OpenRouterAnthropicMessageParamContentOneOf1ItemsOneOf1Source1:
      type: object
      properties:
        type:
          $ref: >-
            #/components/schemas/OpenRouterAnthropicMessageParamContentOneOf1ItemsOneOf1SourceOneOf1Type
        url:
          type: string
      required:
        - type
        - url
      title: OpenRouterAnthropicMessageParamContentOneOf1ItemsOneOf1Source1
    OpenRouterAnthropicMessageParamContentOneOf1ItemsOneOf1Source:
      oneOf:
        - $ref: >-
            #/components/schemas/OpenRouterAnthropicMessageParamContentOneOf1ItemsOneOf1Source0
        - $ref: >-
            #/components/schemas/OpenRouterAnthropicMessageParamContentOneOf1ItemsOneOf1Source1
      title: OpenRouterAnthropicMessageParamContentOneOf1ItemsOneOf1Source
    OpenRouterAnthropicMessageParamContentOneOf1ItemsOneOf1CacheControlType:
      type: string
      enum:
        - ephemeral
      title: OpenRouterAnthropicMessageParamContentOneOf1ItemsOneOf1CacheControlType
    OpenRouterAnthropicMessageParamContentOneOf1ItemsOneOf1CacheControlTtl:
      type: string
      enum:
        - 5m
        - 1h
      title: OpenRouterAnthropicMessageParamContentOneOf1ItemsOneOf1CacheControlTtl
    OpenRouterAnthropicMessageParamContentOneOf1ItemsOneOf1CacheControl:
      type: object
      properties:
        type:
          $ref: >-
            #/components/schemas/OpenRouterAnthropicMessageParamContentOneOf1ItemsOneOf1CacheControlType
        ttl:
          $ref: >-
            #/components/schemas/OpenRouterAnthropicMessageParamContentOneOf1ItemsOneOf1CacheControlTtl
      required:
        - type
      title: OpenRouterAnthropicMessageParamContentOneOf1ItemsOneOf1CacheControl
    OpenRouterAnthropicMessageParamContentOneOf1Items1:
      type: object
      properties:
        type:
          $ref: >-
            #/components/schemas/OpenRouterAnthropicMessageParamContentOneOf1ItemsOneOf1Type
        source:
          $ref: >-
            #/components/schemas/OpenRouterAnthropicMessageParamContentOneOf1ItemsOneOf1Source
        cache_control:
          $ref: >-
            #/components/schemas/OpenRouterAnthropicMessageParamContentOneOf1ItemsOneOf1CacheControl
      required:
        - type
        - source
      title: OpenRouterAnthropicMessageParamContentOneOf1Items1
    OpenRouterAnthropicMessageParamContentOneOf1ItemsOneOf2Type:
      type: string
      enum:
        - document
      title: OpenRouterAnthropicMessageParamContentOneOf1ItemsOneOf2Type
    OpenRouterAnthropicMessageParamContentOneOf1ItemsOneOf2SourceOneOf0Type:
      type: string
      enum:
        - base64
      title: OpenRouterAnthropicMessageParamContentOneOf1ItemsOneOf2SourceOneOf0Type
    OpenRouterAnthropicMessageParamContentOneOf1ItemsOneOf2SourceOneOf0MediaType:
      type: string
      enum:
        - application/pdf
      title: >-
        OpenRouterAnthropicMessageParamContentOneOf1ItemsOneOf2SourceOneOf0MediaType
    OpenRouterAnthropicMessageParamContentOneOf1ItemsOneOf2Source0:
      type: object
      properties:
        type:
          $ref: >-
            #/components/schemas/OpenRouterAnthropicMessageParamContentOneOf1ItemsOneOf2SourceOneOf0Type
        media_type:
          $ref: >-
            #/components/schemas/OpenRouterAnthropicMessageParamContentOneOf1ItemsOneOf2SourceOneOf0MediaType
        data:
          type: string
      required:
        - type
        - media_type
        - data
      title: OpenRouterAnthropicMessageParamContentOneOf1ItemsOneOf2Source0
    OpenRouterAnthropicMessageParamContentOneOf1ItemsOneOf2SourceOneOf1Type:
      type: string
      enum:
        - text
      title: OpenRouterAnthropicMessageParamContentOneOf1ItemsOneOf2SourceOneOf1Type
    OpenRouterAnthropicMessageParamContentOneOf1ItemsOneOf2SourceOneOf1MediaType:
      type: string
      enum:
        - text/plain
      title: >-
        OpenRouterAnthropicMessageParamContentOneOf1ItemsOneOf2SourceOneOf1MediaType
    OpenRouterAnthropicMessageParamContentOneOf1ItemsOneOf2Source1:
      type: object
      properties:
        type:
          $ref: >-
            #/components/schemas/OpenRouterAnthropicMessageParamContentOneOf1ItemsOneOf2SourceOneOf1Type
        media_type:
          $ref: >-
            #/components/schemas/OpenRouterAnthropicMessageParamContentOneOf1ItemsOneOf2SourceOneOf1MediaType
        data:
          type: string
      required:
        - type
        - media_type
        - data
      title: OpenRouterAnthropicMessageParamContentOneOf1ItemsOneOf2Source1
    OpenRouterAnthropicMessageParamContentOneOf1ItemsOneOf2SourceOneOf2Type:
      type: string
      enum:
        - content
      title: OpenRouterAnthropicMessageParamContentOneOf1ItemsOneOf2SourceOneOf2Type
    OpenRouterAnthropicMessageParamContentOneOf1ItemsOneOf2SourceOneOf2ContentOneOf1ItemsOneOf0Type:
      type: string
      enum:
        - text
      title: >-
        OpenRouterAnthropicMessageParamContentOneOf1ItemsOneOf2SourceOneOf2ContentOneOf1ItemsOneOf0Type
    OpenRouterAnthropicMessageParamContentOneOf1ItemsOneOf2SourceOneOf2ContentOneOf1ItemsOneOf0CitationsItemsOneOf0Type:
      type: string
      enum:
        - char_location
      title: >-
        OpenRouterAnthropicMessageParamContentOneOf1ItemsOneOf2SourceOneOf2ContentOneOf1ItemsOneOf0CitationsItemsOneOf0Type
    OpenRouterAnthropicMessageParamContentOneOf1ItemsOneOf2SourceOneOf2ContentOneOf1ItemsOneOf0CitationsItems0:
      type: object
      properties:
        type:
          $ref: >-
            #/components/schemas/OpenRouterAnthropicMessageParamContentOneOf1ItemsOneOf2SourceOneOf2ContentOneOf1ItemsOneOf0CitationsItemsOneOf0Type
        cited_text:
          type: string
        document_index:
          type: number
          format: double
        document_title:
          type:
            - string
            - "null"
        start_char_index:
          type: number
          format: double
        end_char_index:
          type: number
          format: double
      required:
        - type
        - cited_text
        - document_index
        - document_title
        - start_char_index
        - end_char_index
      title: >-
        OpenRouterAnthropicMessageParamContentOneOf1ItemsOneOf2SourceOneOf2ContentOneOf1ItemsOneOf0CitationsItems0
    OpenRouterAnthropicMessageParamContentOneOf1ItemsOneOf2SourceOneOf2ContentOneOf1ItemsOneOf0CitationsItemsOneOf1Type:
      type: string
      enum:
        - page_location
      title: >-
        OpenRouterAnthropicMessageParamContentOneOf1ItemsOneOf2SourceOneOf2ContentOneOf1ItemsOneOf0CitationsItemsOneOf1Type
    OpenRouterAnthropicMessageParamContentOneOf1ItemsOneOf2SourceOneOf2ContentOneOf1ItemsOneOf0CitationsItems1:
      type: object
      properties:
        type:
          $ref: >-
            #/components/schemas/OpenRouterAnthropicMessageParamContentOneOf1ItemsOneOf2SourceOneOf2ContentOneOf1ItemsOneOf0CitationsItemsOneOf1Type
        cited_text:
          type: string
        document_index:
          type: number
          format: double
        document_title:
          type:
            - string
            - "null"
        start_page_number:
          type: number
          format: double
        end_page_number:
          type: number
          format: double
      required:
        - type
        - cited_text
        - document_index
        - document_title
        - start_page_number
        - end_page_number
      title: >-
        OpenRouterAnthropicMessageParamContentOneOf1ItemsOneOf2SourceOneOf2ContentOneOf1ItemsOneOf0CitationsItems1
    OpenRouterAnthropicMessageParamContentOneOf1ItemsOneOf2SourceOneOf2ContentOneOf1ItemsOneOf0CitationsItemsOneOf2Type:
      type: string
      enum:
        - content_block_location
      title: >-
        OpenRouterAnthropicMessageParamContentOneOf1ItemsOneOf2SourceOneOf2ContentOneOf1ItemsOneOf0CitationsItemsOneOf2Type
    OpenRouterAnthropicMessageParamContentOneOf1ItemsOneOf2SourceOneOf2ContentOneOf1ItemsOneOf0CitationsItems2:
      type: object
      properties:
        type:
          $ref: >-
            #/components/schemas/OpenRouterAnthropicMessageParamContentOneOf1ItemsOneOf2SourceOneOf2ContentOneOf1ItemsOneOf0CitationsItemsOneOf2Type
        cited_text:
          type: string
        document_index:
          type: number
          format: double
        document_title:
          type:
            - string
            - "null"
        start_block_index:
          type: number
          format: double
        end_block_index:
          type: number
          format: double
      required:
        - type
        - cited_text
        - document_index
        - document_title
        - start_block_index
        - end_block_index
      title: >-
        OpenRouterAnthropicMessageParamContentOneOf1ItemsOneOf2SourceOneOf2ContentOneOf1ItemsOneOf0CitationsItems2
    OpenRouterAnthropicMessageParamContentOneOf1ItemsOneOf2SourceOneOf2ContentOneOf1ItemsOneOf0CitationsItemsOneOf3Type:
      type: string
      enum:
        - web_search_result_location
      title: >-
        OpenRouterAnthropicMessageParamContentOneOf1ItemsOneOf2SourceOneOf2ContentOneOf1ItemsOneOf0CitationsItemsOneOf3Type
    OpenRouterAnthropicMessageParamContentOneOf1ItemsOneOf2SourceOneOf2ContentOneOf1ItemsOneOf0CitationsItems3:
      type: object
      properties:
        type:
          $ref: >-
            #/components/schemas/OpenRouterAnthropicMessageParamContentOneOf1ItemsOneOf2SourceOneOf2ContentOneOf1ItemsOneOf0CitationsItemsOneOf3Type
        cited_text:
          type: string
        encrypted_index:
          type: string
        title:
          type:
            - string
            - "null"
        url:
          type: string
      required:
        - type
        - cited_text
        - encrypted_index
        - title
        - url
      title: >-
        OpenRouterAnthropicMessageParamContentOneOf1ItemsOneOf2SourceOneOf2ContentOneOf1ItemsOneOf0CitationsItems3
    OpenRouterAnthropicMessageParamContentOneOf1ItemsOneOf2SourceOneOf2ContentOneOf1ItemsOneOf0CitationsItemsOneOf4Type:
      type: string
      enum:
        - search_result_location
      title: >-
        OpenRouterAnthropicMessageParamContentOneOf1ItemsOneOf2SourceOneOf2ContentOneOf1ItemsOneOf0CitationsItemsOneOf4Type
    OpenRouterAnthropicMessageParamContentOneOf1ItemsOneOf2SourceOneOf2ContentOneOf1ItemsOneOf0CitationsItems4:
      type: object
      properties:
        type:
          $ref: >-
            #/components/schemas/OpenRouterAnthropicMessageParamContentOneOf1ItemsOneOf2SourceOneOf2ContentOneOf1ItemsOneOf0CitationsItemsOneOf4Type
        cited_text:
          type: string
        search_result_index:
          type: number
          format: double
        source:
          type: string
        title:
          type:
            - string
            - "null"
        start_block_index:
          type: number
          format: double
        end_block_index:
          type: number
          format: double
      required:
        - type
        - cited_text
        - search_result_index
        - source
        - title
        - start_block_index
        - end_block_index
      title: >-
        OpenRouterAnthropicMessageParamContentOneOf1ItemsOneOf2SourceOneOf2ContentOneOf1ItemsOneOf0CitationsItems4
    OpenRouterAnthropicMessageParamContentOneOf1ItemsOneOf2SourceOneOf2ContentOneOf1ItemsOneOf0CitationsItems:
      oneOf:
        - $ref: >-
            #/components/schemas/OpenRouterAnthropicMessageParamContentOneOf1ItemsOneOf2SourceOneOf2ContentOneOf1ItemsOneOf0CitationsItems0
        - $ref: >-
            #/components/schemas/OpenRouterAnthropicMessageParamContentOneOf1ItemsOneOf2SourceOneOf2ContentOneOf1ItemsOneOf0CitationsItems1
        - $ref: >-
            #/components/schemas/OpenRouterAnthropicMessageParamContentOneOf1ItemsOneOf2SourceOneOf2ContentOneOf1ItemsOneOf0CitationsItems2
        - $ref: >-
            #/components/schemas/OpenRouterAnthropicMessageParamContentOneOf1ItemsOneOf2SourceOneOf2ContentOneOf1ItemsOneOf0CitationsItems3
        - $ref: >-
            #/components/schemas/OpenRouterAnthropicMessageParamContentOneOf1ItemsOneOf2SourceOneOf2ContentOneOf1ItemsOneOf0CitationsItems4
      title: >-
        OpenRouterAnthropicMessageParamContentOneOf1ItemsOneOf2SourceOneOf2ContentOneOf1ItemsOneOf0CitationsItems
    OpenRouterAnthropicMessageParamContentOneOf1ItemsOneOf2SourceOneOf2ContentOneOf1ItemsOneOf0CacheControlType:
      type: string
      enum:
        - ephemeral
      title: >-
        OpenRouterAnthropicMessageParamContentOneOf1ItemsOneOf2SourceOneOf2ContentOneOf1ItemsOneOf0CacheControlType
    OpenRouterAnthropicMessageParamContentOneOf1ItemsOneOf2SourceOneOf2ContentOneOf1ItemsOneOf0CacheControlTtl:
      type: string
      enum:
        - 5m
        - 1h
      title: >-
        OpenRouterAnthropicMessageParamContentOneOf1ItemsOneOf2SourceOneOf2ContentOneOf1ItemsOneOf0CacheControlTtl
    OpenRouterAnthropicMessageParamContentOneOf1ItemsOneOf2SourceOneOf2ContentOneOf1ItemsOneOf0CacheControl:
      type: object
      properties:
        type:
          $ref: >-
            #/components/schemas/OpenRouterAnthropicMessageParamContentOneOf1ItemsOneOf2SourceOneOf2ContentOneOf1ItemsOneOf0CacheControlType
        ttl:
          $ref: >-
            #/components/schemas/OpenRouterAnthropicMessageParamContentOneOf1ItemsOneOf2SourceOneOf2ContentOneOf1ItemsOneOf0CacheControlTtl
      required:
        - type
      title: >-
        OpenRouterAnthropicMessageParamContentOneOf1ItemsOneOf2SourceOneOf2ContentOneOf1ItemsOneOf0CacheControl
    OpenRouterAnthropicMessageParamContentOneOf1ItemsOneOf2SourceOneOf2ContentOneOf1Items0:
      type: object
      properties:
        type:
          $ref: >-
            #/components/schemas/OpenRouterAnthropicMessageParamContentOneOf1ItemsOneOf2SourceOneOf2ContentOneOf1ItemsOneOf0Type
        text:
          type: string
        citations:
          type:
            - array
            - "null"
          items:
            $ref: >-
              #/components/schemas/OpenRouterAnthropicMessageParamContentOneOf1ItemsOneOf2SourceOneOf2ContentOneOf1ItemsOneOf0CitationsItems
        cache_control:
          $ref: >-
            #/components/schemas/OpenRouterAnthropicMessageParamContentOneOf1ItemsOneOf2SourceOneOf2ContentOneOf1ItemsOneOf0CacheControl
      required:
        - type
        - text
      title: >-
        OpenRouterAnthropicMessageParamContentOneOf1ItemsOneOf2SourceOneOf2ContentOneOf1Items0
    OpenRouterAnthropicMessageParamContentOneOf1ItemsOneOf2SourceOneOf2ContentOneOf1ItemsOneOf1Type:
      type: string
      enum:
        - image
      title: >-
        OpenRouterAnthropicMessageParamContentOneOf1ItemsOneOf2SourceOneOf2ContentOneOf1ItemsOneOf1Type
    OpenRouterAnthropicMessageParamContentOneOf1ItemsOneOf2SourceOneOf2ContentOneOf1ItemsOneOf1SourceOneOf0Type:
      type: string
      enum:
        - base64
      title: >-
        OpenRouterAnthropicMessageParamContentOneOf1ItemsOneOf2SourceOneOf2ContentOneOf1ItemsOneOf1SourceOneOf0Type
    OpenRouterAnthropicMessageParamContentOneOf1ItemsOneOf2SourceOneOf2ContentOneOf1ItemsOneOf1SourceOneOf0MediaType:
      type: string
      enum:
        - image/jpeg
        - image/png
        - image/gif
        - image/webp
      title: >-
        OpenRouterAnthropicMessageParamContentOneOf1ItemsOneOf2SourceOneOf2ContentOneOf1ItemsOneOf1SourceOneOf0MediaType
    OpenRouterAnthropicMessageParamContentOneOf1ItemsOneOf2SourceOneOf2ContentOneOf1ItemsOneOf1Source0:
      type: object
      properties:
        type:
          $ref: >-
            #/components/schemas/OpenRouterAnthropicMessageParamContentOneOf1ItemsOneOf2SourceOneOf2ContentOneOf1ItemsOneOf1SourceOneOf0Type
        media_type:
          $ref: >-
            #/components/schemas/OpenRouterAnthropicMessageParamContentOneOf1ItemsOneOf2SourceOneOf2ContentOneOf1ItemsOneOf1SourceOneOf0MediaType
        data:
          type: string
      required:
        - type
        - media_type
        - data
      title: >-
        OpenRouterAnthropicMessageParamContentOneOf1ItemsOneOf2SourceOneOf2ContentOneOf1ItemsOneOf1Source0
    OpenRouterAnthropicMessageParamContentOneOf1ItemsOneOf2SourceOneOf2ContentOneOf1ItemsOneOf1SourceOneOf1Type:
      type: string
      enum:
        - url
      title: >-
        OpenRouterAnthropicMessageParamContentOneOf1ItemsOneOf2SourceOneOf2ContentOneOf1ItemsOneOf1SourceOneOf1Type
    OpenRouterAnthropicMessageParamContentOneOf1ItemsOneOf2SourceOneOf2ContentOneOf1ItemsOneOf1Source1:
      type: object
      properties:
        type:
          $ref: >-
            #/components/schemas/OpenRouterAnthropicMessageParamContentOneOf1ItemsOneOf2SourceOneOf2ContentOneOf1ItemsOneOf1SourceOneOf1Type
        url:
          type: string
      required:
        - type
        - url
      title: >-
        OpenRouterAnthropicMessageParamContentOneOf1ItemsOneOf2SourceOneOf2ContentOneOf1ItemsOneOf1Source1
    OpenRouterAnthropicMessageParamContentOneOf1ItemsOneOf2SourceOneOf2ContentOneOf1ItemsOneOf1Source:
      oneOf:
        - $ref: >-
            #/components/schemas/OpenRouterAnthropicMessageParamContentOneOf1ItemsOneOf2SourceOneOf2ContentOneOf1ItemsOneOf1Source0
        - $ref: >-
            #/components/schemas/OpenRouterAnthropicMessageParamContentOneOf1ItemsOneOf2SourceOneOf2ContentOneOf1ItemsOneOf1Source1
      title: >-
        OpenRouterAnthropicMessageParamContentOneOf1ItemsOneOf2SourceOneOf2ContentOneOf1ItemsOneOf1Source
    OpenRouterAnthropicMessageParamContentOneOf1ItemsOneOf2SourceOneOf2ContentOneOf1ItemsOneOf1CacheControlType:
      type: string
      enum:
        - ephemeral
      title: >-
        OpenRouterAnthropicMessageParamContentOneOf1ItemsOneOf2SourceOneOf2ContentOneOf1ItemsOneOf1CacheControlType
    OpenRouterAnthropicMessageParamContentOneOf1ItemsOneOf2SourceOneOf2ContentOneOf1ItemsOneOf1CacheControlTtl:
      type: string
      enum:
        - 5m
        - 1h
      title: >-
        OpenRouterAnthropicMessageParamContentOneOf1ItemsOneOf2SourceOneOf2ContentOneOf1ItemsOneOf1CacheControlTtl
    OpenRouterAnthropicMessageParamContentOneOf1ItemsOneOf2SourceOneOf2ContentOneOf1ItemsOneOf1CacheControl:
      type: object
      properties:
        type:
          $ref: >-
            #/components/schemas/OpenRouterAnthropicMessageParamContentOneOf1ItemsOneOf2SourceOneOf2ContentOneOf1ItemsOneOf1CacheControlType
        ttl:
          $ref: >-
            #/components/schemas/OpenRouterAnthropicMessageParamContentOneOf1ItemsOneOf2SourceOneOf2ContentOneOf1ItemsOneOf1CacheControlTtl
      required:
        - type
      title: >-
        OpenRouterAnthropicMessageParamContentOneOf1ItemsOneOf2SourceOneOf2ContentOneOf1ItemsOneOf1CacheControl
    OpenRouterAnthropicMessageParamContentOneOf1ItemsOneOf2SourceOneOf2ContentOneOf1Items1:
      type: object
      properties:
        type:
          $ref: >-
            #/components/schemas/OpenRouterAnthropicMessageParamContentOneOf1ItemsOneOf2SourceOneOf2ContentOneOf1ItemsOneOf1Type
        source:
          $ref: >-
            #/components/schemas/OpenRouterAnthropicMessageParamContentOneOf1ItemsOneOf2SourceOneOf2ContentOneOf1ItemsOneOf1Source
        cache_control:
          $ref: >-
            #/components/schemas/OpenRouterAnthropicMessageParamContentOneOf1ItemsOneOf2SourceOneOf2ContentOneOf1ItemsOneOf1CacheControl
      required:
        - type
        - source
      title: >-
        OpenRouterAnthropicMessageParamContentOneOf1ItemsOneOf2SourceOneOf2ContentOneOf1Items1
    OpenRouterAnthropicMessageParamContentOneOf1ItemsOneOf2SourceOneOf2ContentOneOf1Items:
      oneOf:
        - $ref: >-
            #/components/schemas/OpenRouterAnthropicMessageParamContentOneOf1ItemsOneOf2SourceOneOf2ContentOneOf1Items0
        - $ref: >-
            #/components/schemas/OpenRouterAnthropicMessageParamContentOneOf1ItemsOneOf2SourceOneOf2ContentOneOf1Items1
      title: >-
        OpenRouterAnthropicMessageParamContentOneOf1ItemsOneOf2SourceOneOf2ContentOneOf1Items
    OpenRouterAnthropicMessageParamContentOneOf1ItemsOneOf2SourceOneOf2Content1:
      type: array
      items:
        $ref: >-
          #/components/schemas/OpenRouterAnthropicMessageParamContentOneOf1ItemsOneOf2SourceOneOf2ContentOneOf1Items
      title: >-
        OpenRouterAnthropicMessageParamContentOneOf1ItemsOneOf2SourceOneOf2Content1
    OpenRouterAnthropicMessageParamContentOneOf1ItemsOneOf2SourceOneOf2Content:
      oneOf:
        - type: string
        - $ref: >-
            #/components/schemas/OpenRouterAnthropicMessageParamContentOneOf1ItemsOneOf2SourceOneOf2Content1
      title: >-
        OpenRouterAnthropicMessageParamContentOneOf1ItemsOneOf2SourceOneOf2Content
    OpenRouterAnthropicMessageParamContentOneOf1ItemsOneOf2Source2:
      type: object
      properties:
        type:
          $ref: >-
            #/components/schemas/OpenRouterAnthropicMessageParamContentOneOf1ItemsOneOf2SourceOneOf2Type
        content:
          $ref: >-
            #/components/schemas/OpenRouterAnthropicMessageParamContentOneOf1ItemsOneOf2SourceOneOf2Content
      required:
        - type
        - content
      title: OpenRouterAnthropicMessageParamContentOneOf1ItemsOneOf2Source2
    OpenRouterAnthropicMessageParamContentOneOf1ItemsOneOf2SourceOneOf3Type:
      type: string
      enum:
        - url
      title: OpenRouterAnthropicMessageParamContentOneOf1ItemsOneOf2SourceOneOf3Type
    OpenRouterAnthropicMessageParamContentOneOf1ItemsOneOf2Source3:
      type: object
      properties:
        type:
          $ref: >-
            #/components/schemas/OpenRouterAnthropicMessageParamContentOneOf1ItemsOneOf2SourceOneOf3Type
        url:
          type: string
      required:
        - type
        - url
      title: OpenRouterAnthropicMessageParamContentOneOf1ItemsOneOf2Source3
    OpenRouterAnthropicMessageParamContentOneOf1ItemsOneOf2Source:
      oneOf:
        - $ref: >-
            #/components/schemas/OpenRouterAnthropicMessageParamContentOneOf1ItemsOneOf2Source0
        - $ref: >-
            #/components/schemas/OpenRouterAnthropicMessageParamContentOneOf1ItemsOneOf2Source1
        - $ref: >-
            #/components/schemas/OpenRouterAnthropicMessageParamContentOneOf1ItemsOneOf2Source2
        - $ref: >-
            #/components/schemas/OpenRouterAnthropicMessageParamContentOneOf1ItemsOneOf2Source3
      title: OpenRouterAnthropicMessageParamContentOneOf1ItemsOneOf2Source
    OpenRouterAnthropicMessageParamContentOneOf1ItemsOneOf2Citations:
      type: object
      properties:
        enabled:
          type: boolean
      title: OpenRouterAnthropicMessageParamContentOneOf1ItemsOneOf2Citations
    OpenRouterAnthropicMessageParamContentOneOf1ItemsOneOf2CacheControlType:
      type: string
      enum:
        - ephemeral
      title: OpenRouterAnthropicMessageParamContentOneOf1ItemsOneOf2CacheControlType
    OpenRouterAnthropicMessageParamContentOneOf1ItemsOneOf2CacheControlTtl:
      type: string
      enum:
        - 5m
        - 1h
      title: OpenRouterAnthropicMessageParamContentOneOf1ItemsOneOf2CacheControlTtl
    OpenRouterAnthropicMessageParamContentOneOf1ItemsOneOf2CacheControl:
      type: object
      properties:
        type:
          $ref: >-
            #/components/schemas/OpenRouterAnthropicMessageParamContentOneOf1ItemsOneOf2CacheControlType
        ttl:
          $ref: >-
            #/components/schemas/OpenRouterAnthropicMessageParamContentOneOf1ItemsOneOf2CacheControlTtl
      required:
        - type
      title: OpenRouterAnthropicMessageParamContentOneOf1ItemsOneOf2CacheControl
    OpenRouterAnthropicMessageParamContentOneOf1Items2:
      type: object
      properties:
        type:
          $ref: >-
            #/components/schemas/OpenRouterAnthropicMessageParamContentOneOf1ItemsOneOf2Type
        source:
          $ref: >-
            #/components/schemas/OpenRouterAnthropicMessageParamContentOneOf1ItemsOneOf2Source
        citations:
          oneOf:
            - $ref: >-
                #/components/schemas/OpenRouterAnthropicMessageParamContentOneOf1ItemsOneOf2Citations
            - type: "null"
        context:
          type:
            - string
            - "null"
        title:
          type:
            - string
            - "null"
        cache_control:
          $ref: >-
            #/components/schemas/OpenRouterAnthropicMessageParamContentOneOf1ItemsOneOf2CacheControl
      required:
        - type
        - source
      title: OpenRouterAnthropicMessageParamContentOneOf1Items2
    OpenRouterAnthropicMessageParamContentOneOf1ItemsOneOf3Type:
      type: string
      enum:
        - tool_use
      title: OpenRouterAnthropicMessageParamContentOneOf1ItemsOneOf3Type
    OpenRouterAnthropicMessageParamContentOneOf1ItemsOneOf3CacheControlType:
      type: string
      enum:
        - ephemeral
      title: OpenRouterAnthropicMessageParamContentOneOf1ItemsOneOf3CacheControlType
    OpenRouterAnthropicMessageParamContentOneOf1ItemsOneOf3CacheControlTtl:
      type: string
      enum:
        - 5m
        - 1h
      title: OpenRouterAnthropicMessageParamContentOneOf1ItemsOneOf3CacheControlTtl
    OpenRouterAnthropicMessageParamContentOneOf1ItemsOneOf3CacheControl:
      type: object
      properties:
        type:
          $ref: >-
            #/components/schemas/OpenRouterAnthropicMessageParamContentOneOf1ItemsOneOf3CacheControlType
        ttl:
          $ref: >-
            #/components/schemas/OpenRouterAnthropicMessageParamContentOneOf1ItemsOneOf3CacheControlTtl
      required:
        - type
      title: OpenRouterAnthropicMessageParamContentOneOf1ItemsOneOf3CacheControl
    OpenRouterAnthropicMessageParamContentOneOf1Items3:
      type: object
      properties:
        type:
          $ref: >-
            #/components/schemas/OpenRouterAnthropicMessageParamContentOneOf1ItemsOneOf3Type
        id:
          type: string
        name:
          type: string
        input:
          oneOf:
            - description: Any type
            - type: "null"
        cache_control:
          $ref: >-
            #/components/schemas/OpenRouterAnthropicMessageParamContentOneOf1ItemsOneOf3CacheControl
      required:
        - type
        - id
        - name
      title: OpenRouterAnthropicMessageParamContentOneOf1Items3
    OpenRouterAnthropicMessageParamContentOneOf1ItemsOneOf4Type:
      type: string
      enum:
        - tool_result
      title: OpenRouterAnthropicMessageParamContentOneOf1ItemsOneOf4Type
    OpenRouterAnthropicMessageParamContentOneOf1ItemsOneOf4ContentOneOf1ItemsOneOf0Type:
      type: string
      enum:
        - text
      title: >-
        OpenRouterAnthropicMessageParamContentOneOf1ItemsOneOf4ContentOneOf1ItemsOneOf0Type
    OpenRouterAnthropicMessageParamContentOneOf1ItemsOneOf4ContentOneOf1ItemsOneOf0CitationsItemsOneOf0Type:
      type: string
      enum:
        - char_location
      title: >-
        OpenRouterAnthropicMessageParamContentOneOf1ItemsOneOf4ContentOneOf1ItemsOneOf0CitationsItemsOneOf0Type
    OpenRouterAnthropicMessageParamContentOneOf1ItemsOneOf4ContentOneOf1ItemsOneOf0CitationsItems0:
      type: object
      properties:
        type:
          $ref: >-
            #/components/schemas/OpenRouterAnthropicMessageParamContentOneOf1ItemsOneOf4ContentOneOf1ItemsOneOf0CitationsItemsOneOf0Type
        cited_text:
          type: string
        document_index:
          type: number
          format: double
        document_title:
          type:
            - string
            - "null"
        start_char_index:
          type: number
          format: double
        end_char_index:
          type: number
          format: double
      required:
        - type
        - cited_text
        - document_index
        - document_title
        - start_char_index
        - end_char_index
      title: >-
        OpenRouterAnthropicMessageParamContentOneOf1ItemsOneOf4ContentOneOf1ItemsOneOf0CitationsItems0
    OpenRouterAnthropicMessageParamContentOneOf1ItemsOneOf4ContentOneOf1ItemsOneOf0CitationsItemsOneOf1Type:
      type: string
      enum:
        - page_location
      title: >-
        OpenRouterAnthropicMessageParamContentOneOf1ItemsOneOf4ContentOneOf1ItemsOneOf0CitationsItemsOneOf1Type
    OpenRouterAnthropicMessageParamContentOneOf1ItemsOneOf4ContentOneOf1ItemsOneOf0CitationsItems1:
      type: object
      properties:
        type:
          $ref: >-
            #/components/schemas/OpenRouterAnthropicMessageParamContentOneOf1ItemsOneOf4ContentOneOf1ItemsOneOf0CitationsItemsOneOf1Type
        cited_text:
          type: string
        document_index:
          type: number
          format: double
        document_title:
          type:
            - string
            - "null"
        start_page_number:
          type: number
          format: double
        end_page_number:
          type: number
          format: double
      required:
        - type
        - cited_text
        - document_index
        - document_title
        - start_page_number
        - end_page_number
      title: >-
        OpenRouterAnthropicMessageParamContentOneOf1ItemsOneOf4ContentOneOf1ItemsOneOf0CitationsItems1
    OpenRouterAnthropicMessageParamContentOneOf1ItemsOneOf4ContentOneOf1ItemsOneOf0CitationsItemsOneOf2Type:
      type: string
      enum:
        - content_block_location
      title: >-
        OpenRouterAnthropicMessageParamContentOneOf1ItemsOneOf4ContentOneOf1ItemsOneOf0CitationsItemsOneOf2Type
    OpenRouterAnthropicMessageParamContentOneOf1ItemsOneOf4ContentOneOf1ItemsOneOf0CitationsItems2:
      type: object
      properties:
        type:
          $ref: >-
            #/components/schemas/OpenRouterAnthropicMessageParamContentOneOf1ItemsOneOf4ContentOneOf1ItemsOneOf0CitationsItemsOneOf2Type
        cited_text:
          type: string
        document_index:
          type: number
          format: double
        document_title:
          type:
            - string
            - "null"
        start_block_index:
          type: number
          format: double
        end_block_index:
          type: number
          format: double
      required:
        - type
        - cited_text
        - document_index
        - document_title
        - start_block_index
        - end_block_index
      title: >-
        OpenRouterAnthropicMessageParamContentOneOf1ItemsOneOf4ContentOneOf1ItemsOneOf0CitationsItems2
    OpenRouterAnthropicMessageParamContentOneOf1ItemsOneOf4ContentOneOf1ItemsOneOf0CitationsItemsOneOf3Type:
      type: string
      enum:
        - web_search_result_location
      title: >-
        OpenRouterAnthropicMessageParamContentOneOf1ItemsOneOf4ContentOneOf1ItemsOneOf0CitationsItemsOneOf3Type
    OpenRouterAnthropicMessageParamContentOneOf1ItemsOneOf4ContentOneOf1ItemsOneOf0CitationsItems3:
      type: object
      properties:
        type:
          $ref: >-
            #/components/schemas/OpenRouterAnthropicMessageParamContentOneOf1ItemsOneOf4ContentOneOf1ItemsOneOf0CitationsItemsOneOf3Type
        cited_text:
          type: string
        encrypted_index:
          type: string
        title:
          type:
            - string
            - "null"
        url:
          type: string
      required:
        - type
        - cited_text
        - encrypted_index
        - title
        - url
      title: >-
        OpenRouterAnthropicMessageParamContentOneOf1ItemsOneOf4ContentOneOf1ItemsOneOf0CitationsItems3
    OpenRouterAnthropicMessageParamContentOneOf1ItemsOneOf4ContentOneOf1ItemsOneOf0CitationsItemsOneOf4Type:
      type: string
      enum:
        - search_result_location
      title: >-
        OpenRouterAnthropicMessageParamContentOneOf1ItemsOneOf4ContentOneOf1ItemsOneOf0CitationsItemsOneOf4Type
    OpenRouterAnthropicMessageParamContentOneOf1ItemsOneOf4ContentOneOf1ItemsOneOf0CitationsItems4:
      type: object
      properties:
        type:
          $ref: >-
            #/components/schemas/OpenRouterAnthropicMessageParamContentOneOf1ItemsOneOf4ContentOneOf1ItemsOneOf0CitationsItemsOneOf4Type
        cited_text:
          type: string
        search_result_index:
          type: number
          format: double
        source:
          type: string
        title:
          type:
            - string
            - "null"
        start_block_index:
          type: number
          format: double
        end_block_index:
          type: number
          format: double
      required:
        - type
        - cited_text
        - search_result_index
        - source
        - title
        - start_block_index
        - end_block_index
      title: >-
        OpenRouterAnthropicMessageParamContentOneOf1ItemsOneOf4ContentOneOf1ItemsOneOf0CitationsItems4
    OpenRouterAnthropicMessageParamContentOneOf1ItemsOneOf4ContentOneOf1ItemsOneOf0CitationsItems:
      oneOf:
        - $ref: >-
            #/components/schemas/OpenRouterAnthropicMessageParamContentOneOf1ItemsOneOf4ContentOneOf1ItemsOneOf0CitationsItems0
        - $ref: >-
            #/components/schemas/OpenRouterAnthropicMessageParamContentOneOf1ItemsOneOf4ContentOneOf1ItemsOneOf0CitationsItems1
        - $ref: >-
            #/components/schemas/OpenRouterAnthropicMessageParamContentOneOf1ItemsOneOf4ContentOneOf1ItemsOneOf0CitationsItems2
        - $ref: >-
            #/components/schemas/OpenRouterAnthropicMessageParamContentOneOf1ItemsOneOf4ContentOneOf1ItemsOneOf0CitationsItems3
        - $ref: >-
            #/components/schemas/OpenRouterAnthropicMessageParamContentOneOf1ItemsOneOf4ContentOneOf1ItemsOneOf0CitationsItems4
      title: >-
        OpenRouterAnthropicMessageParamContentOneOf1ItemsOneOf4ContentOneOf1ItemsOneOf0CitationsItems
    OpenRouterAnthropicMessageParamContentOneOf1ItemsOneOf4ContentOneOf1ItemsOneOf0CacheControlType:
      type: string
      enum:
        - ephemeral
      title: >-
        OpenRouterAnthropicMessageParamContentOneOf1ItemsOneOf4ContentOneOf1ItemsOneOf0CacheControlType
    OpenRouterAnthropicMessageParamContentOneOf1ItemsOneOf4ContentOneOf1ItemsOneOf0CacheControlTtl:
      type: string
      enum:
        - 5m
        - 1h
      title: >-
        OpenRouterAnthropicMessageParamContentOneOf1ItemsOneOf4ContentOneOf1ItemsOneOf0CacheControlTtl
    OpenRouterAnthropicMessageParamContentOneOf1ItemsOneOf4ContentOneOf1ItemsOneOf0CacheControl:
      type: object
      properties:
        type:
          $ref: >-
            #/components/schemas/OpenRouterAnthropicMessageParamContentOneOf1ItemsOneOf4ContentOneOf1ItemsOneOf0CacheControlType
        ttl:
          $ref: >-
            #/components/schemas/OpenRouterAnthropicMessageParamContentOneOf1ItemsOneOf4ContentOneOf1ItemsOneOf0CacheControlTtl
      required:
        - type
      title: >-
        OpenRouterAnthropicMessageParamContentOneOf1ItemsOneOf4ContentOneOf1ItemsOneOf0CacheControl
    OpenRouterAnthropicMessageParamContentOneOf1ItemsOneOf4ContentOneOf1Items0:
      type: object
      properties:
        type:
          $ref: >-
            #/components/schemas/OpenRouterAnthropicMessageParamContentOneOf1ItemsOneOf4ContentOneOf1ItemsOneOf0Type
        text:
          type: string
        citations:
          type:
            - array
            - "null"
          items:
            $ref: >-
              #/components/schemas/OpenRouterAnthropicMessageParamContentOneOf1ItemsOneOf4ContentOneOf1ItemsOneOf0CitationsItems
        cache_control:
          $ref: >-
            #/components/schemas/OpenRouterAnthropicMessageParamContentOneOf1ItemsOneOf4ContentOneOf1ItemsOneOf0CacheControl
      required:
        - type
        - text
      title: >-
        OpenRouterAnthropicMessageParamContentOneOf1ItemsOneOf4ContentOneOf1Items0
    OpenRouterAnthropicMessageParamContentOneOf1ItemsOneOf4ContentOneOf1ItemsOneOf1Type:
      type: string
      enum:
        - image
      title: >-
        OpenRouterAnthropicMessageParamContentOneOf1ItemsOneOf4ContentOneOf1ItemsOneOf1Type
    OpenRouterAnthropicMessageParamContentOneOf1ItemsOneOf4ContentOneOf1ItemsOneOf1SourceOneOf0Type:
      type: string
      enum:
        - base64
      title: >-
        OpenRouterAnthropicMessageParamContentOneOf1ItemsOneOf4ContentOneOf1ItemsOneOf1SourceOneOf0Type
    OpenRouterAnthropicMessageParamContentOneOf1ItemsOneOf4ContentOneOf1ItemsOneOf1SourceOneOf0MediaType:
      type: string
      enum:
        - image/jpeg
        - image/png
        - image/gif
        - image/webp
      title: >-
        OpenRouterAnthropicMessageParamContentOneOf1ItemsOneOf4ContentOneOf1ItemsOneOf1SourceOneOf0MediaType
    OpenRouterAnthropicMessageParamContentOneOf1ItemsOneOf4ContentOneOf1ItemsOneOf1Source0:
      type: object
      properties:
        type:
          $ref: >-
            #/components/schemas/OpenRouterAnthropicMessageParamContentOneOf1ItemsOneOf4ContentOneOf1ItemsOneOf1SourceOneOf0Type
        media_type:
          $ref: >-
            #/components/schemas/OpenRouterAnthropicMessageParamContentOneOf1ItemsOneOf4ContentOneOf1ItemsOneOf1SourceOneOf0MediaType
        data:
          type: string
      required:
        - type
        - media_type
        - data
      title: >-
        OpenRouterAnthropicMessageParamContentOneOf1ItemsOneOf4ContentOneOf1ItemsOneOf1Source0
    OpenRouterAnthropicMessageParamContentOneOf1ItemsOneOf4ContentOneOf1ItemsOneOf1SourceOneOf1Type:
      type: string
      enum:
        - url
      title: >-
        OpenRouterAnthropicMessageParamContentOneOf1ItemsOneOf4ContentOneOf1ItemsOneOf1SourceOneOf1Type
    OpenRouterAnthropicMessageParamContentOneOf1ItemsOneOf4ContentOneOf1ItemsOneOf1Source1:
      type: object
      properties:
        type:
          $ref: >-
            #/components/schemas/OpenRouterAnthropicMessageParamContentOneOf1ItemsOneOf4ContentOneOf1ItemsOneOf1SourceOneOf1Type
        url:
          type: string
      required:
        - type
        - url
      title: >-
        OpenRouterAnthropicMessageParamContentOneOf1ItemsOneOf4ContentOneOf1ItemsOneOf1Source1
    OpenRouterAnthropicMessageParamContentOneOf1ItemsOneOf4ContentOneOf1ItemsOneOf1Source:
      oneOf:
        - $ref: >-
            #/components/schemas/OpenRouterAnthropicMessageParamContentOneOf1ItemsOneOf4ContentOneOf1ItemsOneOf1Source0
        - $ref: >-
            #/components/schemas/OpenRouterAnthropicMessageParamContentOneOf1ItemsOneOf4ContentOneOf1ItemsOneOf1Source1
      title: >-
        OpenRouterAnthropicMessageParamContentOneOf1ItemsOneOf4ContentOneOf1ItemsOneOf1Source
    OpenRouterAnthropicMessageParamContentOneOf1ItemsOneOf4ContentOneOf1ItemsOneOf1CacheControlType:
      type: string
      enum:
        - ephemeral
      title: >-
        OpenRouterAnthropicMessageParamContentOneOf1ItemsOneOf4ContentOneOf1ItemsOneOf1CacheControlType
    OpenRouterAnthropicMessageParamContentOneOf1ItemsOneOf4ContentOneOf1ItemsOneOf1CacheControlTtl:
      type: string
      enum:
        - 5m
        - 1h
      title: >-
        OpenRouterAnthropicMessageParamContentOneOf1ItemsOneOf4ContentOneOf1ItemsOneOf1CacheControlTtl
    OpenRouterAnthropicMessageParamContentOneOf1ItemsOneOf4ContentOneOf1ItemsOneOf1CacheControl:
      type: object
      properties:
        type:
          $ref: >-
            #/components/schemas/OpenRouterAnthropicMessageParamContentOneOf1ItemsOneOf4ContentOneOf1ItemsOneOf1CacheControlType
        ttl:
          $ref: >-
            #/components/schemas/OpenRouterAnthropicMessageParamContentOneOf1ItemsOneOf4ContentOneOf1ItemsOneOf1CacheControlTtl
      required:
        - type
      title: >-
        OpenRouterAnthropicMessageParamContentOneOf1ItemsOneOf4ContentOneOf1ItemsOneOf1CacheControl
    OpenRouterAnthropicMessageParamContentOneOf1ItemsOneOf4ContentOneOf1Items1:
      type: object
      properties:
        type:
          $ref: >-
            #/components/schemas/OpenRouterAnthropicMessageParamContentOneOf1ItemsOneOf4ContentOneOf1ItemsOneOf1Type
        source:
          $ref: >-
            #/components/schemas/OpenRouterAnthropicMessageParamContentOneOf1ItemsOneOf4ContentOneOf1ItemsOneOf1Source
        cache_control:
          $ref: >-
            #/components/schemas/OpenRouterAnthropicMessageParamContentOneOf1ItemsOneOf4ContentOneOf1ItemsOneOf1CacheControl
      required:
        - type
        - source
      title: >-
        OpenRouterAnthropicMessageParamContentOneOf1ItemsOneOf4ContentOneOf1Items1
    OpenRouterAnthropicMessageParamContentOneOf1ItemsOneOf4ContentOneOf1ItemsOneOf2Type:
      type: string
      enum:
        - tool_reference
      title: >-
        OpenRouterAnthropicMessageParamContentOneOf1ItemsOneOf4ContentOneOf1ItemsOneOf2Type
    OpenRouterAnthropicMessageParamContentOneOf1ItemsOneOf4ContentOneOf1Items2:
      type: object
      properties:
        type:
          $ref: >-
            #/components/schemas/OpenRouterAnthropicMessageParamContentOneOf1ItemsOneOf4ContentOneOf1ItemsOneOf2Type
        tool_name:
          type: string
      required:
        - type
        - tool_name
      title: >-
        OpenRouterAnthropicMessageParamContentOneOf1ItemsOneOf4ContentOneOf1Items2
    OpenRouterAnthropicMessageParamContentOneOf1ItemsOneOf4ContentOneOf1ItemsOneOf3Type:
      type: string
      enum:
        - search_result
      title: >-
        OpenRouterAnthropicMessageParamContentOneOf1ItemsOneOf4ContentOneOf1ItemsOneOf3Type
    OpenRouterAnthropicMessageParamContentOneOf1ItemsOneOf4ContentOneOf1ItemsOneOf3ContentItemsType:
      type: string
      enum:
        - text
      title: >-
        OpenRouterAnthropicMessageParamContentOneOf1ItemsOneOf4ContentOneOf1ItemsOneOf3ContentItemsType
    OpenRouterAnthropicMessageParamContentOneOf1ItemsOneOf4ContentOneOf1ItemsOneOf3ContentItemsCitationsItemsOneOf0Type:
      type: string
      enum:
        - char_location
      title: >-
        OpenRouterAnthropicMessageParamContentOneOf1ItemsOneOf4ContentOneOf1ItemsOneOf3ContentItemsCitationsItemsOneOf0Type
    OpenRouterAnthropicMessageParamContentOneOf1ItemsOneOf4ContentOneOf1ItemsOneOf3ContentItemsCitationsItems0:
      type: object
      properties:
        type:
          $ref: >-
            #/components/schemas/OpenRouterAnthropicMessageParamContentOneOf1ItemsOneOf4ContentOneOf1ItemsOneOf3ContentItemsCitationsItemsOneOf0Type
        cited_text:
          type: string
        document_index:
          type: number
          format: double
        document_title:
          type:
            - string
            - "null"
        start_char_index:
          type: number
          format: double
        end_char_index:
          type: number
          format: double
      required:
        - type
        - cited_text
        - document_index
        - document_title
        - start_char_index
        - end_char_index
      title: >-
        OpenRouterAnthropicMessageParamContentOneOf1ItemsOneOf4ContentOneOf1ItemsOneOf3ContentItemsCitationsItems0
    OpenRouterAnthropicMessageParamContentOneOf1ItemsOneOf4ContentOneOf1ItemsOneOf3ContentItemsCitationsItemsOneOf1Type:
      type: string
      enum:
        - page_location
      title: >-
        OpenRouterAnthropicMessageParamContentOneOf1ItemsOneOf4ContentOneOf1ItemsOneOf3ContentItemsCitationsItemsOneOf1Type
    OpenRouterAnthropicMessageParamContentOneOf1ItemsOneOf4ContentOneOf1ItemsOneOf3ContentItemsCitationsItems1:
      type: object
      properties:
        type:
          $ref: >-
            #/components/schemas/OpenRouterAnthropicMessageParamContentOneOf1ItemsOneOf4ContentOneOf1ItemsOneOf3ContentItemsCitationsItemsOneOf1Type
        cited_text:
          type: string
        document_index:
          type: number
          format: double
        document_title:
          type:
            - string
            - "null"
        start_page_number:
          type: number
          format: double
        end_page_number:
          type: number
          format: double
      required:
        - type
        - cited_text
        - document_index
        - document_title
        - start_page_number
        - end_page_number
      title: >-
        OpenRouterAnthropicMessageParamContentOneOf1ItemsOneOf4ContentOneOf1ItemsOneOf3ContentItemsCitationsItems1
    OpenRouterAnthropicMessageParamContentOneOf1ItemsOneOf4ContentOneOf1ItemsOneOf3ContentItemsCitationsItemsOneOf2Type:
      type: string
      enum:
        - content_block_location
      title: >-
        OpenRouterAnthropicMessageParamContentOneOf1ItemsOneOf4ContentOneOf1ItemsOneOf3ContentItemsCitationsItemsOneOf2Type
    OpenRouterAnthropicMessageParamContentOneOf1ItemsOneOf4ContentOneOf1ItemsOneOf3ContentItemsCitationsItems2:
      type: object
      properties:
        type:
          $ref: >-
            #/components/schemas/OpenRouterAnthropicMessageParamContentOneOf1ItemsOneOf4ContentOneOf1ItemsOneOf3ContentItemsCitationsItemsOneOf2Type
        cited_text:
          type: string
        document_index:
          type: number
          format: double
        document_title:
          type:
            - string
            - "null"
        start_block_index:
          type: number
          format: double
        end_block_index:
          type: number
          format: double
      required:
        - type
        - cited_text
        - document_index
        - document_title
        - start_block_index
        - end_block_index
      title: >-
        OpenRouterAnthropicMessageParamContentOneOf1ItemsOneOf4ContentOneOf1ItemsOneOf3ContentItemsCitationsItems2
    OpenRouterAnthropicMessageParamContentOneOf1ItemsOneOf4ContentOneOf1ItemsOneOf3ContentItemsCitationsItemsOneOf3Type:
      type: string
      enum:
        - web_search_result_location
      title: >-
        OpenRouterAnthropicMessageParamContentOneOf1ItemsOneOf4ContentOneOf1ItemsOneOf3ContentItemsCitationsItemsOneOf3Type
    OpenRouterAnthropicMessageParamContentOneOf1ItemsOneOf4ContentOneOf1ItemsOneOf3ContentItemsCitationsItems3:
      type: object
      properties:
        type:
          $ref: >-
            #/components/schemas/OpenRouterAnthropicMessageParamContentOneOf1ItemsOneOf4ContentOneOf1ItemsOneOf3ContentItemsCitationsItemsOneOf3Type
        cited_text:
          type: string
        encrypted_index:
          type: string
        title:
          type:
            - string
            - "null"
        url:
          type: string
      required:
        - type
        - cited_text
        - encrypted_index
        - title
        - url
      title: >-
        OpenRouterAnthropicMessageParamContentOneOf1ItemsOneOf4ContentOneOf1ItemsOneOf3ContentItemsCitationsItems3
    OpenRouterAnthropicMessageParamContentOneOf1ItemsOneOf4ContentOneOf1ItemsOneOf3ContentItemsCitationsItemsOneOf4Type:
      type: string
      enum:
        - search_result_location
      title: >-
        OpenRouterAnthropicMessageParamContentOneOf1ItemsOneOf4ContentOneOf1ItemsOneOf3ContentItemsCitationsItemsOneOf4Type
    OpenRouterAnthropicMessageParamContentOneOf1ItemsOneOf4ContentOneOf1ItemsOneOf3ContentItemsCitationsItems4:
      type: object
      properties:
        type:
          $ref: >-
            #/components/schemas/OpenRouterAnthropicMessageParamContentOneOf1ItemsOneOf4ContentOneOf1ItemsOneOf3ContentItemsCitationsItemsOneOf4Type
        cited_text:
          type: string
        search_result_index:
          type: number
          format: double
        source:
          type: string
        title:
          type:
            - string
            - "null"
        start_block_index:
          type: number
          format: double
        end_block_index:
          type: number
          format: double
      required:
        - type
        - cited_text
        - search_result_index
        - source
        - title
        - start_block_index
        - end_block_index
      title: >-
        OpenRouterAnthropicMessageParamContentOneOf1ItemsOneOf4ContentOneOf1ItemsOneOf3ContentItemsCitationsItems4
    OpenRouterAnthropicMessageParamContentOneOf1ItemsOneOf4ContentOneOf1ItemsOneOf3ContentItemsCitationsItems:
      oneOf:
        - $ref: >-
            #/components/schemas/OpenRouterAnthropicMessageParamContentOneOf1ItemsOneOf4ContentOneOf1ItemsOneOf3ContentItemsCitationsItems0
        - $ref: >-
            #/components/schemas/OpenRouterAnthropicMessageParamContentOneOf1ItemsOneOf4ContentOneOf1ItemsOneOf3ContentItemsCitationsItems1
        - $ref: >-
            #/components/schemas/OpenRouterAnthropicMessageParamContentOneOf1ItemsOneOf4ContentOneOf1ItemsOneOf3ContentItemsCitationsItems2
        - $ref: >-
            #/components/schemas/OpenRouterAnthropicMessageParamContentOneOf1ItemsOneOf4ContentOneOf1ItemsOneOf3ContentItemsCitationsItems3
        - $ref: >-
            #/components/schemas/OpenRouterAnthropicMessageParamContentOneOf1ItemsOneOf4ContentOneOf1ItemsOneOf3ContentItemsCitationsItems4
      title: >-
        OpenRouterAnthropicMessageParamContentOneOf1ItemsOneOf4ContentOneOf1ItemsOneOf3ContentItemsCitationsItems
    OpenRouterAnthropicMessageParamContentOneOf1ItemsOneOf4ContentOneOf1ItemsOneOf3ContentItemsCacheControlType:
      type: string
      enum:
        - ephemeral
      title: >-
        OpenRouterAnthropicMessageParamContentOneOf1ItemsOneOf4ContentOneOf1ItemsOneOf3ContentItemsCacheControlType
    OpenRouterAnthropicMessageParamContentOneOf1ItemsOneOf4ContentOneOf1ItemsOneOf3ContentItemsCacheControlTtl:
      type: string
      enum:
        - 5m
        - 1h
      title: >-
        OpenRouterAnthropicMessageParamContentOneOf1ItemsOneOf4ContentOneOf1ItemsOneOf3ContentItemsCacheControlTtl
    OpenRouterAnthropicMessageParamContentOneOf1ItemsOneOf4ContentOneOf1ItemsOneOf3ContentItemsCacheControl:
      type: object
      properties:
        type:
          $ref: >-
            #/components/schemas/OpenRouterAnthropicMessageParamContentOneOf1ItemsOneOf4ContentOneOf1ItemsOneOf3ContentItemsCacheControlType
        ttl:
          $ref: >-
            #/components/schemas/OpenRouterAnthropicMessageParamContentOneOf1ItemsOneOf4ContentOneOf1ItemsOneOf3ContentItemsCacheControlTtl
      required:
        - type
      title: >-
        OpenRouterAnthropicMessageParamContentOneOf1ItemsOneOf4ContentOneOf1ItemsOneOf3ContentItemsCacheControl
    OpenRouterAnthropicMessageParamContentOneOf1ItemsOneOf4ContentOneOf1ItemsOneOf3ContentItems:
      type: object
      properties:
        type:
          $ref: >-
            #/components/schemas/OpenRouterAnthropicMessageParamContentOneOf1ItemsOneOf4ContentOneOf1ItemsOneOf3ContentItemsType
        text:
          type: string
        citations:
          type:
            - array
            - "null"
          items:
            $ref: >-
              #/components/schemas/OpenRouterAnthropicMessageParamContentOneOf1ItemsOneOf4ContentOneOf1ItemsOneOf3ContentItemsCitationsItems
        cache_control:
          $ref: >-
            #/components/schemas/OpenRouterAnthropicMessageParamContentOneOf1ItemsOneOf4ContentOneOf1ItemsOneOf3ContentItemsCacheControl
      required:
        - type
        - text
      title: >-
        OpenRouterAnthropicMessageParamContentOneOf1ItemsOneOf4ContentOneOf1ItemsOneOf3ContentItems
    OpenRouterAnthropicMessageParamContentOneOf1ItemsOneOf4ContentOneOf1ItemsOneOf3Citations:
      type: object
      properties:
        enabled:
          type: boolean
      title: >-
        OpenRouterAnthropicMessageParamContentOneOf1ItemsOneOf4ContentOneOf1ItemsOneOf3Citations
    OpenRouterAnthropicMessageParamContentOneOf1ItemsOneOf4ContentOneOf1ItemsOneOf3CacheControlType:
      type: string
      enum:
        - ephemeral
      title: >-
        OpenRouterAnthropicMessageParamContentOneOf1ItemsOneOf4ContentOneOf1ItemsOneOf3CacheControlType
    OpenRouterAnthropicMessageParamContentOneOf1ItemsOneOf4ContentOneOf1ItemsOneOf3CacheControlTtl:
      type: string
      enum:
        - 5m
        - 1h
      title: >-
        OpenRouterAnthropicMessageParamContentOneOf1ItemsOneOf4ContentOneOf1ItemsOneOf3CacheControlTtl
    OpenRouterAnthropicMessageParamContentOneOf1ItemsOneOf4ContentOneOf1ItemsOneOf3CacheControl:
      type: object
      properties:
        type:
          $ref: >-
            #/components/schemas/OpenRouterAnthropicMessageParamContentOneOf1ItemsOneOf4ContentOneOf1ItemsOneOf3CacheControlType
        ttl:
          $ref: >-
            #/components/schemas/OpenRouterAnthropicMessageParamContentOneOf1ItemsOneOf4ContentOneOf1ItemsOneOf3CacheControlTtl
      required:
        - type
      title: >-
        OpenRouterAnthropicMessageParamContentOneOf1ItemsOneOf4ContentOneOf1ItemsOneOf3CacheControl
    OpenRouterAnthropicMessageParamContentOneOf1ItemsOneOf4ContentOneOf1Items3:
      type: object
      properties:
        type:
          $ref: >-
            #/components/schemas/OpenRouterAnthropicMessageParamContentOneOf1ItemsOneOf4ContentOneOf1ItemsOneOf3Type
        source:
          type: string
        title:
          type: string
        content:
          type: array
          items:
            $ref: >-
              #/components/schemas/OpenRouterAnthropicMessageParamContentOneOf1ItemsOneOf4ContentOneOf1ItemsOneOf3ContentItems
        citations:
          $ref: >-
            #/components/schemas/OpenRouterAnthropicMessageParamContentOneOf1ItemsOneOf4ContentOneOf1ItemsOneOf3Citations
        cache_control:
          $ref: >-
            #/components/schemas/OpenRouterAnthropicMessageParamContentOneOf1ItemsOneOf4ContentOneOf1ItemsOneOf3CacheControl
      required:
        - type
        - source
        - title
        - content
      title: >-
        OpenRouterAnthropicMessageParamContentOneOf1ItemsOneOf4ContentOneOf1Items3
    OpenRouterAnthropicMessageParamContentOneOf1ItemsOneOf4ContentOneOf1ItemsOneOf4Type:
      type: string
      enum:
        - document
      title: >-
        OpenRouterAnthropicMessageParamContentOneOf1ItemsOneOf4ContentOneOf1ItemsOneOf4Type
    OpenRouterAnthropicMessageParamContentOneOf1ItemsOneOf4ContentOneOf1ItemsOneOf4SourceOneOf0Type:
      type: string
      enum:
        - base64
      title: >-
        OpenRouterAnthropicMessageParamContentOneOf1ItemsOneOf4ContentOneOf1ItemsOneOf4SourceOneOf0Type
    OpenRouterAnthropicMessageParamContentOneOf1ItemsOneOf4ContentOneOf1ItemsOneOf4SourceOneOf0MediaType:
      type: string
      enum:
        - application/pdf
      title: >-
        OpenRouterAnthropicMessageParamContentOneOf1ItemsOneOf4ContentOneOf1ItemsOneOf4SourceOneOf0MediaType
    OpenRouterAnthropicMessageParamContentOneOf1ItemsOneOf4ContentOneOf1ItemsOneOf4Source0:
      type: object
      properties:
        type:
          $ref: >-
            #/components/schemas/OpenRouterAnthropicMessageParamContentOneOf1ItemsOneOf4ContentOneOf1ItemsOneOf4SourceOneOf0Type
        media_type:
          $ref: >-
            #/components/schemas/OpenRouterAnthropicMessageParamContentOneOf1ItemsOneOf4ContentOneOf1ItemsOneOf4SourceOneOf0MediaType
        data:
          type: string
      required:
        - type
        - media_type
        - data
      title: >-
        OpenRouterAnthropicMessageParamContentOneOf1ItemsOneOf4ContentOneOf1ItemsOneOf4Source0
    OpenRouterAnthropicMessageParamContentOneOf1ItemsOneOf4ContentOneOf1ItemsOneOf4SourceOneOf1Type:
      type: string
      enum:
        - text
      title: >-
        OpenRouterAnthropicMessageParamContentOneOf1ItemsOneOf4ContentOneOf1ItemsOneOf4SourceOneOf1Type
    OpenRouterAnthropicMessageParamContentOneOf1ItemsOneOf4ContentOneOf1ItemsOneOf4SourceOneOf1MediaType:
      type: string
      enum:
        - text/plain
      title: >-
        OpenRouterAnthropicMessageParamContentOneOf1ItemsOneOf4ContentOneOf1ItemsOneOf4SourceOneOf1MediaType
    OpenRouterAnthropicMessageParamContentOneOf1ItemsOneOf4ContentOneOf1ItemsOneOf4Source1:
      type: object
      properties:
        type:
          $ref: >-
            #/components/schemas/OpenRouterAnthropicMessageParamContentOneOf1ItemsOneOf4ContentOneOf1ItemsOneOf4SourceOneOf1Type
        media_type:
          $ref: >-
            #/components/schemas/OpenRouterAnthropicMessageParamContentOneOf1ItemsOneOf4ContentOneOf1ItemsOneOf4SourceOneOf1MediaType
        data:
          type: string
      required:
        - type
        - media_type
        - data
      title: >-
        OpenRouterAnthropicMessageParamContentOneOf1ItemsOneOf4ContentOneOf1ItemsOneOf4Source1
    OpenRouterAnthropicMessageParamContentOneOf1ItemsOneOf4ContentOneOf1ItemsOneOf4SourceOneOf2Type:
      type: string
      enum:
        - content
      title: >-
        OpenRouterAnthropicMessageParamContentOneOf1ItemsOneOf4ContentOneOf1ItemsOneOf4SourceOneOf2Type
    OpenRouterAnthropicMessageParamContentOneOf1ItemsOneOf4ContentOneOf1ItemsOneOf4SourceOneOf2ContentOneOf1ItemsOneOf0Type:
      type: string
      enum:
        - text
      title: >-
        OpenRouterAnthropicMessageParamContentOneOf1ItemsOneOf4ContentOneOf1ItemsOneOf4SourceOneOf2ContentOneOf1ItemsOneOf0Type
    OpenRouterAnthropicMessageParamContentOneOf1ItemsOneOf4ContentOneOf1ItemsOneOf4SourceOneOf2ContentOneOf1ItemsOneOf0CitationsItemsOneOf0Type:
      type: string
      enum:
        - char_location
      title: >-
        OpenRouterAnthropicMessageParamContentOneOf1ItemsOneOf4ContentOneOf1ItemsOneOf4SourceOneOf2ContentOneOf1ItemsOneOf0CitationsItemsOneOf0Type
    OpenRouterAnthropicMessageParamContentOneOf1ItemsOneOf4ContentOneOf1ItemsOneOf4SourceOneOf2ContentOneOf1ItemsOneOf0CitationsItems0:
      type: object
      properties:
        type:
          $ref: >-
            #/components/schemas/OpenRouterAnthropicMessageParamContentOneOf1ItemsOneOf4ContentOneOf1ItemsOneOf4SourceOneOf2ContentOneOf1ItemsOneOf0CitationsItemsOneOf0Type
        cited_text:
          type: string
        document_index:
          type: number
          format: double
        document_title:
          type:
            - string
            - "null"
        start_char_index:
          type: number
          format: double
        end_char_index:
          type: number
          format: double
      required:
        - type
        - cited_text
        - document_index
        - document_title
        - start_char_index
        - end_char_index
      title: >-
        OpenRouterAnthropicMessageParamContentOneOf1ItemsOneOf4ContentOneOf1ItemsOneOf4SourceOneOf2ContentOneOf1ItemsOneOf0CitationsItems0
    OpenRouterAnthropicMessageParamContentOneOf1ItemsOneOf4ContentOneOf1ItemsOneOf4SourceOneOf2ContentOneOf1ItemsOneOf0CitationsItemsOneOf1Type:
      type: string
      enum:
        - page_location
      title: >-
        OpenRouterAnthropicMessageParamContentOneOf1ItemsOneOf4ContentOneOf1ItemsOneOf4SourceOneOf2ContentOneOf1ItemsOneOf0CitationsItemsOneOf1Type
    OpenRouterAnthropicMessageParamContentOneOf1ItemsOneOf4ContentOneOf1ItemsOneOf4SourceOneOf2ContentOneOf1ItemsOneOf0CitationsItems1:
      type: object
      properties:
        type:
          $ref: >-
            #/components/schemas/OpenRouterAnthropicMessageParamContentOneOf1ItemsOneOf4ContentOneOf1ItemsOneOf4SourceOneOf2ContentOneOf1ItemsOneOf0CitationsItemsOneOf1Type
        cited_text:
          type: string
        document_index:
          type: number
          format: double
        document_title:
          type:
            - string
            - "null"
        start_page_number:
          type: number
          format: double
        end_page_number:
          type: number
          format: double
      required:
        - type
        - cited_text
        - document_index
        - document_title
        - start_page_number
        - end_page_number
      title: >-
        OpenRouterAnthropicMessageParamContentOneOf1ItemsOneOf4ContentOneOf1ItemsOneOf4SourceOneOf2ContentOneOf1ItemsOneOf0CitationsItems1
    OpenRouterAnthropicMessageParamContentOneOf1ItemsOneOf4ContentOneOf1ItemsOneOf4SourceOneOf2ContentOneOf1ItemsOneOf0CitationsItemsOneOf2Type:
      type: string
      enum:
        - content_block_location
      title: >-
        OpenRouterAnthropicMessageParamContentOneOf1ItemsOneOf4ContentOneOf1ItemsOneOf4SourceOneOf2ContentOneOf1ItemsOneOf0CitationsItemsOneOf2Type
    OpenRouterAnthropicMessageParamContentOneOf1ItemsOneOf4ContentOneOf1ItemsOneOf4SourceOneOf2ContentOneOf1ItemsOneOf0CitationsItems2:
      type: object
      properties:
        type:
          $ref: >-
            #/components/schemas/OpenRouterAnthropicMessageParamContentOneOf1ItemsOneOf4ContentOneOf1ItemsOneOf4SourceOneOf2ContentOneOf1ItemsOneOf0CitationsItemsOneOf2Type
        cited_text:
          type: string
        document_index:
          type: number
          format: double
        document_title:
          type:
            - string
            - "null"
        start_block_index:
          type: number
          format: double
        end_block_index:
          type: number
          format: double
      required:
        - type
        - cited_text
        - document_index
        - document_title
        - start_block_index
        - end_block_index
      title: >-
        OpenRouterAnthropicMessageParamContentOneOf1ItemsOneOf4ContentOneOf1ItemsOneOf4SourceOneOf2ContentOneOf1ItemsOneOf0CitationsItems2
    OpenRouterAnthropicMessageParamContentOneOf1ItemsOneOf4ContentOneOf1ItemsOneOf4SourceOneOf2ContentOneOf1ItemsOneOf0CitationsItemsOneOf3Type:
      type: string
      enum:
        - web_search_result_location
      title: >-
        OpenRouterAnthropicMessageParamContentOneOf1ItemsOneOf4ContentOneOf1ItemsOneOf4SourceOneOf2ContentOneOf1ItemsOneOf0CitationsItemsOneOf3Type
    OpenRouterAnthropicMessageParamContentOneOf1ItemsOneOf4ContentOneOf1ItemsOneOf4SourceOneOf2ContentOneOf1ItemsOneOf0CitationsItems3:
      type: object
      properties:
        type:
          $ref: >-
            #/components/schemas/OpenRouterAnthropicMessageParamContentOneOf1ItemsOneOf4ContentOneOf1ItemsOneOf4SourceOneOf2ContentOneOf1ItemsOneOf0CitationsItemsOneOf3Type
        cited_text:
          type: string
        encrypted_index:
          type: string
        title:
          type:
            - string
            - "null"
        url:
          type: string
      required:
        - type
        - cited_text
        - encrypted_index
        - title
        - url
      title: >-
        OpenRouterAnthropicMessageParamContentOneOf1ItemsOneOf4ContentOneOf1ItemsOneOf4SourceOneOf2ContentOneOf1ItemsOneOf0CitationsItems3
    OpenRouterAnthropicMessageParamContentOneOf1ItemsOneOf4ContentOneOf1ItemsOneOf4SourceOneOf2ContentOneOf1ItemsOneOf0CitationsItemsOneOf4Type:
      type: string
      enum:
        - search_result_location
      title: >-
        OpenRouterAnthropicMessageParamContentOneOf1ItemsOneOf4ContentOneOf1ItemsOneOf4SourceOneOf2ContentOneOf1ItemsOneOf0CitationsItemsOneOf4Type
    OpenRouterAnthropicMessageParamContentOneOf1ItemsOneOf4ContentOneOf1ItemsOneOf4SourceOneOf2ContentOneOf1ItemsOneOf0CitationsItems4:
      type: object
      properties:
        type:
          $ref: >-
            #/components/schemas/OpenRouterAnthropicMessageParamContentOneOf1ItemsOneOf4ContentOneOf1ItemsOneOf4SourceOneOf2ContentOneOf1ItemsOneOf0CitationsItemsOneOf4Type
        cited_text:
          type: string
        search_result_index:
          type: number
          format: double
        source:
          type: string
        title:
          type:
            - string
            - "null"
        start_block_index:
          type: number
          format: double
        end_block_index:
          type: number
          format: double
      required:
        - type
        - cited_text
        - search_result_index
        - source
        - title
        - start_block_index
        - end_block_index
      title: >-
        OpenRouterAnthropicMessageParamContentOneOf1ItemsOneOf4ContentOneOf1ItemsOneOf4SourceOneOf2ContentOneOf1ItemsOneOf0CitationsItems4
    OpenRouterAnthropicMessageParamContentOneOf1ItemsOneOf4ContentOneOf1ItemsOneOf4SourceOneOf2ContentOneOf1ItemsOneOf0CitationsItems:
      oneOf:
        - $ref: >-
            #/components/schemas/OpenRouterAnthropicMessageParamContentOneOf1ItemsOneOf4ContentOneOf1ItemsOneOf4SourceOneOf2ContentOneOf1ItemsOneOf0CitationsItems0
        - $ref: >-
            #/components/schemas/OpenRouterAnthropicMessageParamContentOneOf1ItemsOneOf4ContentOneOf1ItemsOneOf4SourceOneOf2ContentOneOf1ItemsOneOf0CitationsItems1
        - $ref: >-
            #/components/schemas/OpenRouterAnthropicMessageParamContentOneOf1ItemsOneOf4ContentOneOf1ItemsOneOf4SourceOneOf2ContentOneOf1ItemsOneOf0CitationsItems2
        - $ref: >-
            #/components/schemas/OpenRouterAnthropicMessageParamContentOneOf1ItemsOneOf4ContentOneOf1ItemsOneOf4SourceOneOf2ContentOneOf1ItemsOneOf0CitationsItems3
        - $ref: >-
            #/components/schemas/OpenRouterAnthropicMessageParamContentOneOf1ItemsOneOf4ContentOneOf1ItemsOneOf4SourceOneOf2ContentOneOf1ItemsOneOf0CitationsItems4
      title: >-
        OpenRouterAnthropicMessageParamContentOneOf1ItemsOneOf4ContentOneOf1ItemsOneOf4SourceOneOf2ContentOneOf1ItemsOneOf0CitationsItems
    OpenRouterAnthropicMessageParamContentOneOf1ItemsOneOf4ContentOneOf1ItemsOneOf4SourceOneOf2ContentOneOf1ItemsOneOf0CacheControlType:
      type: string
      enum:
        - ephemeral
      title: >-
        OpenRouterAnthropicMessageParamContentOneOf1ItemsOneOf4ContentOneOf1ItemsOneOf4SourceOneOf2ContentOneOf1ItemsOneOf0CacheControlType
    OpenRouterAnthropicMessageParamContentOneOf1ItemsOneOf4ContentOneOf1ItemsOneOf4SourceOneOf2ContentOneOf1ItemsOneOf0CacheControlTtl:
      type: string
      enum:
        - 5m
        - 1h
      title: >-
        OpenRouterAnthropicMessageParamContentOneOf1ItemsOneOf4ContentOneOf1ItemsOneOf4SourceOneOf2ContentOneOf1ItemsOneOf0CacheControlTtl
    OpenRouterAnthropicMessageParamContentOneOf1ItemsOneOf4ContentOneOf1ItemsOneOf4SourceOneOf2ContentOneOf1ItemsOneOf0CacheControl:
      type: object
      properties:
        type:
          $ref: >-
            #/components/schemas/OpenRouterAnthropicMessageParamContentOneOf1ItemsOneOf4ContentOneOf1ItemsOneOf4SourceOneOf2ContentOneOf1ItemsOneOf0CacheControlType
        ttl:
          $ref: >-
            #/components/schemas/OpenRouterAnthropicMessageParamContentOneOf1ItemsOneOf4ContentOneOf1ItemsOneOf4SourceOneOf2ContentOneOf1ItemsOneOf0CacheControlTtl
      required:
        - type
      title: >-
        OpenRouterAnthropicMessageParamContentOneOf1ItemsOneOf4ContentOneOf1ItemsOneOf4SourceOneOf2ContentOneOf1ItemsOneOf0CacheControl
    OpenRouterAnthropicMessageParamContentOneOf1ItemsOneOf4ContentOneOf1ItemsOneOf4SourceOneOf2ContentOneOf1Items0:
      type: object
      properties:
        type:
          $ref: >-
            #/components/schemas/OpenRouterAnthropicMessageParamContentOneOf1ItemsOneOf4ContentOneOf1ItemsOneOf4SourceOneOf2ContentOneOf1ItemsOneOf0Type
        text:
          type: string
        citations:
          type:
            - array
            - "null"
          items:
            $ref: >-
              #/components/schemas/OpenRouterAnthropicMessageParamContentOneOf1ItemsOneOf4ContentOneOf1ItemsOneOf4SourceOneOf2ContentOneOf1ItemsOneOf0CitationsItems
        cache_control:
          $ref: >-
            #/components/schemas/OpenRouterAnthropicMessageParamContentOneOf1ItemsOneOf4ContentOneOf1ItemsOneOf4SourceOneOf2ContentOneOf1ItemsOneOf0CacheControl
      required:
        - type
        - text
      title: >-
        OpenRouterAnthropicMessageParamContentOneOf1ItemsOneOf4ContentOneOf1ItemsOneOf4SourceOneOf2ContentOneOf1Items0
    OpenRouterAnthropicMessageParamContentOneOf1ItemsOneOf4ContentOneOf1ItemsOneOf4SourceOneOf2ContentOneOf1ItemsOneOf1Type:
      type: string
      enum:
        - image
      title: >-
        OpenRouterAnthropicMessageParamContentOneOf1ItemsOneOf4ContentOneOf1ItemsOneOf4SourceOneOf2ContentOneOf1ItemsOneOf1Type
    OpenRouterAnthropicMessageParamContentOneOf1ItemsOneOf4ContentOneOf1ItemsOneOf4SourceOneOf2ContentOneOf1ItemsOneOf1SourceOneOf0Type:
      type: string
      enum:
        - base64
      title: >-
        OpenRouterAnthropicMessageParamContentOneOf1ItemsOneOf4ContentOneOf1ItemsOneOf4SourceOneOf2ContentOneOf1ItemsOneOf1SourceOneOf0Type
    OpenRouterAnthropicMessageParamContentOneOf1ItemsOneOf4ContentOneOf1ItemsOneOf4SourceOneOf2ContentOneOf1ItemsOneOf1SourceOneOf0MediaType:
      type: string
      enum:
        - image/jpeg
        - image/png
        - image/gif
        - image/webp
      title: >-
        OpenRouterAnthropicMessageParamContentOneOf1ItemsOneOf4ContentOneOf1ItemsOneOf4SourceOneOf2ContentOneOf1ItemsOneOf1SourceOneOf0MediaType
    OpenRouterAnthropicMessageParamContentOneOf1ItemsOneOf4ContentOneOf1ItemsOneOf4SourceOneOf2ContentOneOf1ItemsOneOf1Source0:
      type: object
      properties:
        type:
          $ref: >-
            #/components/schemas/OpenRouterAnthropicMessageParamContentOneOf1ItemsOneOf4ContentOneOf1ItemsOneOf4SourceOneOf2ContentOneOf1ItemsOneOf1SourceOneOf0Type
        media_type:
          $ref: >-
            #/components/schemas/OpenRouterAnthropicMessageParamContentOneOf1ItemsOneOf4ContentOneOf1ItemsOneOf4SourceOneOf2ContentOneOf1ItemsOneOf1SourceOneOf0MediaType
        data:
          type: string
      required:
        - type
        - media_type
        - data
      title: >-
        OpenRouterAnthropicMessageParamContentOneOf1ItemsOneOf4ContentOneOf1ItemsOneOf4SourceOneOf2ContentOneOf1ItemsOneOf1Source0
    OpenRouterAnthropicMessageParamContentOneOf1ItemsOneOf4ContentOneOf1ItemsOneOf4SourceOneOf2ContentOneOf1ItemsOneOf1SourceOneOf1Type:
      type: string
      enum:
        - url
      title: >-
        OpenRouterAnthropicMessageParamContentOneOf1ItemsOneOf4ContentOneOf1ItemsOneOf4SourceOneOf2ContentOneOf1ItemsOneOf1SourceOneOf1Type
    OpenRouterAnthropicMessageParamContentOneOf1ItemsOneOf4ContentOneOf1ItemsOneOf4SourceOneOf2ContentOneOf1ItemsOneOf1Source1:
      type: object
      properties:
        type:
          $ref: >-
            #/components/schemas/OpenRouterAnthropicMessageParamContentOneOf1ItemsOneOf4ContentOneOf1ItemsOneOf4SourceOneOf2ContentOneOf1ItemsOneOf1SourceOneOf1Type
        url:
          type: string
      required:
        - type
        - url
      title: >-
        OpenRouterAnthropicMessageParamContentOneOf1ItemsOneOf4ContentOneOf1ItemsOneOf4SourceOneOf2ContentOneOf1ItemsOneOf1Source1
    OpenRouterAnthropicMessageParamContentOneOf1ItemsOneOf4ContentOneOf1ItemsOneOf4SourceOneOf2ContentOneOf1ItemsOneOf1Source:
      oneOf:
        - $ref: >-
            #/components/schemas/OpenRouterAnthropicMessageParamContentOneOf1ItemsOneOf4ContentOneOf1ItemsOneOf4SourceOneOf2ContentOneOf1ItemsOneOf1Source0
        - $ref: >-
            #/components/schemas/OpenRouterAnthropicMessageParamContentOneOf1ItemsOneOf4ContentOneOf1ItemsOneOf4SourceOneOf2ContentOneOf1ItemsOneOf1Source1
      title: >-
        OpenRouterAnthropicMessageParamContentOneOf1ItemsOneOf4ContentOneOf1ItemsOneOf4SourceOneOf2ContentOneOf1ItemsOneOf1Source
    OpenRouterAnthropicMessageParamContentOneOf1ItemsOneOf4ContentOneOf1ItemsOneOf4SourceOneOf2ContentOneOf1ItemsOneOf1CacheControlType:
      type: string
      enum:
        - ephemeral
      title: >-
        OpenRouterAnthropicMessageParamContentOneOf1ItemsOneOf4ContentOneOf1ItemsOneOf4SourceOneOf2ContentOneOf1ItemsOneOf1CacheControlType
    OpenRouterAnthropicMessageParamContentOneOf1ItemsOneOf4ContentOneOf1ItemsOneOf4SourceOneOf2ContentOneOf1ItemsOneOf1CacheControlTtl:
      type: string
      enum:
        - 5m
        - 1h
      title: >-
        OpenRouterAnthropicMessageParamContentOneOf1ItemsOneOf4ContentOneOf1ItemsOneOf4SourceOneOf2ContentOneOf1ItemsOneOf1CacheControlTtl
    OpenRouterAnthropicMessageParamContentOneOf1ItemsOneOf4ContentOneOf1ItemsOneOf4SourceOneOf2ContentOneOf1ItemsOneOf1CacheControl:
      type: object
      properties:
        type:
          $ref: >-
            #/components/schemas/OpenRouterAnthropicMessageParamContentOneOf1ItemsOneOf4ContentOneOf1ItemsOneOf4SourceOneOf2ContentOneOf1ItemsOneOf1CacheControlType
        ttl:
          $ref: >-
            #/components/schemas/OpenRouterAnthropicMessageParamContentOneOf1ItemsOneOf4ContentOneOf1ItemsOneOf4SourceOneOf2ContentOneOf1ItemsOneOf1CacheControlTtl
      required:
        - type
      title: >-
        OpenRouterAnthropicMessageParamContentOneOf1ItemsOneOf4ContentOneOf1ItemsOneOf4SourceOneOf2ContentOneOf1ItemsOneOf1CacheControl
    OpenRouterAnthropicMessageParamContentOneOf1ItemsOneOf4ContentOneOf1ItemsOneOf4SourceOneOf2ContentOneOf1Items1:
      type: object
      properties:
        type:
          $ref: >-
            #/components/schemas/OpenRouterAnthropicMessageParamContentOneOf1ItemsOneOf4ContentOneOf1ItemsOneOf4SourceOneOf2ContentOneOf1ItemsOneOf1Type
        source:
          $ref: >-
            #/components/schemas/OpenRouterAnthropicMessageParamContentOneOf1ItemsOneOf4ContentOneOf1ItemsOneOf4SourceOneOf2ContentOneOf1ItemsOneOf1Source
        cache_control:
          $ref: >-
            #/components/schemas/OpenRouterAnthropicMessageParamContentOneOf1ItemsOneOf4ContentOneOf1ItemsOneOf4SourceOneOf2ContentOneOf1ItemsOneOf1CacheControl
      required:
        - type
        - source
      title: >-
        OpenRouterAnthropicMessageParamContentOneOf1ItemsOneOf4ContentOneOf1ItemsOneOf4SourceOneOf2ContentOneOf1Items1
    OpenRouterAnthropicMessageParamContentOneOf1ItemsOneOf4ContentOneOf1ItemsOneOf4SourceOneOf2ContentOneOf1Items:
      oneOf:
        - $ref: >-
            #/components/schemas/OpenRouterAnthropicMessageParamContentOneOf1ItemsOneOf4ContentOneOf1ItemsOneOf4SourceOneOf2ContentOneOf1Items0
        - $ref: >-
            #/components/schemas/OpenRouterAnthropicMessageParamContentOneOf1ItemsOneOf4ContentOneOf1ItemsOneOf4SourceOneOf2ContentOneOf1Items1
      title: >-
        OpenRouterAnthropicMessageParamContentOneOf1ItemsOneOf4ContentOneOf1ItemsOneOf4SourceOneOf2ContentOneOf1Items
    OpenRouterAnthropicMessageParamContentOneOf1ItemsOneOf4ContentOneOf1ItemsOneOf4SourceOneOf2Content1:
      type: array
      items:
        $ref: >-
          #/components/schemas/OpenRouterAnthropicMessageParamContentOneOf1ItemsOneOf4ContentOneOf1ItemsOneOf4SourceOneOf2ContentOneOf1Items
      title: >-
        OpenRouterAnthropicMessageParamContentOneOf1ItemsOneOf4ContentOneOf1ItemsOneOf4SourceOneOf2Content1
    OpenRouterAnthropicMessageParamContentOneOf1ItemsOneOf4ContentOneOf1ItemsOneOf4SourceOneOf2Content:
      oneOf:
        - type: string
        - $ref: >-
            #/components/schemas/OpenRouterAnthropicMessageParamContentOneOf1ItemsOneOf4ContentOneOf1ItemsOneOf4SourceOneOf2Content1
      title: >-
        OpenRouterAnthropicMessageParamContentOneOf1ItemsOneOf4ContentOneOf1ItemsOneOf4SourceOneOf2Content
    OpenRouterAnthropicMessageParamContentOneOf1ItemsOneOf4ContentOneOf1ItemsOneOf4Source2:
      type: object
      properties:
        type:
          $ref: >-
            #/components/schemas/OpenRouterAnthropicMessageParamContentOneOf1ItemsOneOf4ContentOneOf1ItemsOneOf4SourceOneOf2Type
        content:
          $ref: >-
            #/components/schemas/OpenRouterAnthropicMessageParamContentOneOf1ItemsOneOf4ContentOneOf1ItemsOneOf4SourceOneOf2Content
      required:
        - type
        - content
      title: >-
        OpenRouterAnthropicMessageParamContentOneOf1ItemsOneOf4ContentOneOf1ItemsOneOf4Source2
    OpenRouterAnthropicMessageParamContentOneOf1ItemsOneOf4ContentOneOf1ItemsOneOf4SourceOneOf3Type:
      type: string
      enum:
        - url
      title: >-
        OpenRouterAnthropicMessageParamContentOneOf1ItemsOneOf4ContentOneOf1ItemsOneOf4SourceOneOf3Type
    OpenRouterAnthropicMessageParamContentOneOf1ItemsOneOf4ContentOneOf1ItemsOneOf4Source3:
      type: object
      properties:
        type:
          $ref: >-
            #/components/schemas/OpenRouterAnthropicMessageParamContentOneOf1ItemsOneOf4ContentOneOf1ItemsOneOf4SourceOneOf3Type
        url:
          type: string
      required:
        - type
        - url
      title: >-
        OpenRouterAnthropicMessageParamContentOneOf1ItemsOneOf4ContentOneOf1ItemsOneOf4Source3
    OpenRouterAnthropicMessageParamContentOneOf1ItemsOneOf4ContentOneOf1ItemsOneOf4Source:
      oneOf:
        - $ref: >-
            #/components/schemas/OpenRouterAnthropicMessageParamContentOneOf1ItemsOneOf4ContentOneOf1ItemsOneOf4Source0
        - $ref: >-
            #/components/schemas/OpenRouterAnthropicMessageParamContentOneOf1ItemsOneOf4ContentOneOf1ItemsOneOf4Source1
        - $ref: >-
            #/components/schemas/OpenRouterAnthropicMessageParamContentOneOf1ItemsOneOf4ContentOneOf1ItemsOneOf4Source2
        - $ref: >-
            #/components/schemas/OpenRouterAnthropicMessageParamContentOneOf1ItemsOneOf4ContentOneOf1ItemsOneOf4Source3
      title: >-
        OpenRouterAnthropicMessageParamContentOneOf1ItemsOneOf4ContentOneOf1ItemsOneOf4Source
    OpenRouterAnthropicMessageParamContentOneOf1ItemsOneOf4ContentOneOf1ItemsOneOf4Citations:
      type: object
      properties:
        enabled:
          type: boolean
      title: >-
        OpenRouterAnthropicMessageParamContentOneOf1ItemsOneOf4ContentOneOf1ItemsOneOf4Citations
    OpenRouterAnthropicMessageParamContentOneOf1ItemsOneOf4ContentOneOf1ItemsOneOf4CacheControlType:
      type: string
      enum:
        - ephemeral
      title: >-
        OpenRouterAnthropicMessageParamContentOneOf1ItemsOneOf4ContentOneOf1ItemsOneOf4CacheControlType
    OpenRouterAnthropicMessageParamContentOneOf1ItemsOneOf4ContentOneOf1ItemsOneOf4CacheControlTtl:
      type: string
      enum:
        - 5m
        - 1h
      title: >-
        OpenRouterAnthropicMessageParamContentOneOf1ItemsOneOf4ContentOneOf1ItemsOneOf4CacheControlTtl
    OpenRouterAnthropicMessageParamContentOneOf1ItemsOneOf4ContentOneOf1ItemsOneOf4CacheControl:
      type: object
      properties:
        type:
          $ref: >-
            #/components/schemas/OpenRouterAnthropicMessageParamContentOneOf1ItemsOneOf4ContentOneOf1ItemsOneOf4CacheControlType
        ttl:
          $ref: >-
            #/components/schemas/OpenRouterAnthropicMessageParamContentOneOf1ItemsOneOf4ContentOneOf1ItemsOneOf4CacheControlTtl
      required:
        - type
      title: >-
        OpenRouterAnthropicMessageParamContentOneOf1ItemsOneOf4ContentOneOf1ItemsOneOf4CacheControl
    OpenRouterAnthropicMessageParamContentOneOf1ItemsOneOf4ContentOneOf1Items4:
      type: object
      properties:
        type:
          $ref: >-
            #/components/schemas/OpenRouterAnthropicMessageParamContentOneOf1ItemsOneOf4ContentOneOf1ItemsOneOf4Type
        source:
          $ref: >-
            #/components/schemas/OpenRouterAnthropicMessageParamContentOneOf1ItemsOneOf4ContentOneOf1ItemsOneOf4Source
        citations:
          oneOf:
            - $ref: >-
                #/components/schemas/OpenRouterAnthropicMessageParamContentOneOf1ItemsOneOf4ContentOneOf1ItemsOneOf4Citations
            - type: "null"
        context:
          type:
            - string
            - "null"
        title:
          type:
            - string
            - "null"
        cache_control:
          $ref: >-
            #/components/schemas/OpenRouterAnthropicMessageParamContentOneOf1ItemsOneOf4ContentOneOf1ItemsOneOf4CacheControl
      required:
        - type
        - source
      title: >-
        OpenRouterAnthropicMessageParamContentOneOf1ItemsOneOf4ContentOneOf1Items4
    OpenRouterAnthropicMessageParamContentOneOf1ItemsOneOf4ContentOneOf1Items:
      oneOf:
        - $ref: >-
            #/components/schemas/OpenRouterAnthropicMessageParamContentOneOf1ItemsOneOf4ContentOneOf1Items0
        - $ref: >-
            #/components/schemas/OpenRouterAnthropicMessageParamContentOneOf1ItemsOneOf4ContentOneOf1Items1
        - $ref: >-
            #/components/schemas/OpenRouterAnthropicMessageParamContentOneOf1ItemsOneOf4ContentOneOf1Items2
        - $ref: >-
            #/components/schemas/OpenRouterAnthropicMessageParamContentOneOf1ItemsOneOf4ContentOneOf1Items3
        - $ref: >-
            #/components/schemas/OpenRouterAnthropicMessageParamContentOneOf1ItemsOneOf4ContentOneOf1Items4
      title: >-
        OpenRouterAnthropicMessageParamContentOneOf1ItemsOneOf4ContentOneOf1Items
    OpenRouterAnthropicMessageParamContentOneOf1ItemsOneOf4Content1:
      type: array
      items:
        $ref: >-
          #/components/schemas/OpenRouterAnthropicMessageParamContentOneOf1ItemsOneOf4ContentOneOf1Items
      title: OpenRouterAnthropicMessageParamContentOneOf1ItemsOneOf4Content1
    OpenRouterAnthropicMessageParamContentOneOf1ItemsOneOf4Content:
      oneOf:
        - type: string
        - $ref: >-
            #/components/schemas/OpenRouterAnthropicMessageParamContentOneOf1ItemsOneOf4Content1
      title: OpenRouterAnthropicMessageParamContentOneOf1ItemsOneOf4Content
    OpenRouterAnthropicMessageParamContentOneOf1ItemsOneOf4CacheControlType:
      type: string
      enum:
        - ephemeral
      title: OpenRouterAnthropicMessageParamContentOneOf1ItemsOneOf4CacheControlType
    OpenRouterAnthropicMessageParamContentOneOf1ItemsOneOf4CacheControlTtl:
      type: string
      enum:
        - 5m
        - 1h
      title: OpenRouterAnthropicMessageParamContentOneOf1ItemsOneOf4CacheControlTtl
    OpenRouterAnthropicMessageParamContentOneOf1ItemsOneOf4CacheControl:
      type: object
      properties:
        type:
          $ref: >-
            #/components/schemas/OpenRouterAnthropicMessageParamContentOneOf1ItemsOneOf4CacheControlType
        ttl:
          $ref: >-
            #/components/schemas/OpenRouterAnthropicMessageParamContentOneOf1ItemsOneOf4CacheControlTtl
      required:
        - type
      title: OpenRouterAnthropicMessageParamContentOneOf1ItemsOneOf4CacheControl
    OpenRouterAnthropicMessageParamContentOneOf1Items4:
      type: object
      properties:
        type:
          $ref: >-
            #/components/schemas/OpenRouterAnthropicMessageParamContentOneOf1ItemsOneOf4Type
        tool_use_id:
          type: string
        content:
          $ref: >-
            #/components/schemas/OpenRouterAnthropicMessageParamContentOneOf1ItemsOneOf4Content
        is_error:
          type: boolean
        cache_control:
          $ref: >-
            #/components/schemas/OpenRouterAnthropicMessageParamContentOneOf1ItemsOneOf4CacheControl
      required:
        - type
        - tool_use_id
      title: OpenRouterAnthropicMessageParamContentOneOf1Items4
    OpenRouterAnthropicMessageParamContentOneOf1ItemsOneOf5Type:
      type: string
      enum:
        - thinking
      title: OpenRouterAnthropicMessageParamContentOneOf1ItemsOneOf5Type
    OpenRouterAnthropicMessageParamContentOneOf1Items5:
      type: object
      properties:
        type:
          $ref: >-
            #/components/schemas/OpenRouterAnthropicMessageParamContentOneOf1ItemsOneOf5Type
        thinking:
          type: string
        signature:
          type: string
      required:
        - type
        - thinking
        - signature
      title: OpenRouterAnthropicMessageParamContentOneOf1Items5
    OpenRouterAnthropicMessageParamContentOneOf1ItemsOneOf6Type:
      type: string
      enum:
        - redacted_thinking
      title: OpenRouterAnthropicMessageParamContentOneOf1ItemsOneOf6Type
    OpenRouterAnthropicMessageParamContentOneOf1Items6:
      type: object
      properties:
        type:
          $ref: >-
            #/components/schemas/OpenRouterAnthropicMessageParamContentOneOf1ItemsOneOf6Type
        data:
          type: string
      required:
        - type
        - data
      title: OpenRouterAnthropicMessageParamContentOneOf1Items6
    OpenRouterAnthropicMessageParamContentOneOf1ItemsOneOf7Type:
      type: string
      enum:
        - server_tool_use
      title: OpenRouterAnthropicMessageParamContentOneOf1ItemsOneOf7Type
    OpenRouterAnthropicMessageParamContentOneOf1ItemsOneOf7Name:
      type: string
      enum:
        - web_search
        - web_fetch
        - code_execution
        - bash_code_execution
        - text_editor_code_execution
        - tool_search_tool_regex
        - tool_search_tool_bm25
      title: OpenRouterAnthropicMessageParamContentOneOf1ItemsOneOf7Name
    OpenRouterAnthropicMessageParamContentOneOf1ItemsOneOf7CacheControlType:
      type: string
      enum:
        - ephemeral
      title: OpenRouterAnthropicMessageParamContentOneOf1ItemsOneOf7CacheControlType
    OpenRouterAnthropicMessageParamContentOneOf1ItemsOneOf7CacheControlTtl:
      type: string
      enum:
        - 5m
        - 1h
      title: OpenRouterAnthropicMessageParamContentOneOf1ItemsOneOf7CacheControlTtl
    OpenRouterAnthropicMessageParamContentOneOf1ItemsOneOf7CacheControl:
      type: object
      properties:
        type:
          $ref: >-
            #/components/schemas/OpenRouterAnthropicMessageParamContentOneOf1ItemsOneOf7CacheControlType
        ttl:
          $ref: >-
            #/components/schemas/OpenRouterAnthropicMessageParamContentOneOf1ItemsOneOf7CacheControlTtl
      required:
        - type
      title: OpenRouterAnthropicMessageParamContentOneOf1ItemsOneOf7CacheControl
    OpenRouterAnthropicMessageParamContentOneOf1Items7:
      type: object
      properties:
        type:
          $ref: >-
            #/components/schemas/OpenRouterAnthropicMessageParamContentOneOf1ItemsOneOf7Type
        id:
          type: string
        name:
          $ref: >-
            #/components/schemas/OpenRouterAnthropicMessageParamContentOneOf1ItemsOneOf7Name
        input:
          oneOf:
            - description: Any type
            - type: "null"
        cache_control:
          $ref: >-
            #/components/schemas/OpenRouterAnthropicMessageParamContentOneOf1ItemsOneOf7CacheControl
      required:
        - type
        - id
        - name
      title: OpenRouterAnthropicMessageParamContentOneOf1Items7
    OpenRouterAnthropicMessageParamContentOneOf1ItemsOneOf8Type:
      type: string
      enum:
        - web_search_tool_result
      title: OpenRouterAnthropicMessageParamContentOneOf1ItemsOneOf8Type
    OpenRouterAnthropicMessageParamContentOneOf1ItemsOneOf8ContentOneOf0ItemsType:
      type: string
      enum:
        - web_search_result
      title: >-
        OpenRouterAnthropicMessageParamContentOneOf1ItemsOneOf8ContentOneOf0ItemsType
    OpenRouterAnthropicMessageParamContentOneOf1ItemsOneOf8ContentOneOf0Items:
      type: object
      properties:
        type:
          $ref: >-
            #/components/schemas/OpenRouterAnthropicMessageParamContentOneOf1ItemsOneOf8ContentOneOf0ItemsType
        encrypted_content:
          type: string
        title:
          type: string
        url:
          type: string
        page_age:
          type:
            - string
            - "null"
      required:
        - type
        - encrypted_content
        - title
        - url
      title: >-
        OpenRouterAnthropicMessageParamContentOneOf1ItemsOneOf8ContentOneOf0Items
    OpenRouterAnthropicMessageParamContentOneOf1ItemsOneOf8Content0:
      type: array
      items:
        $ref: >-
          #/components/schemas/OpenRouterAnthropicMessageParamContentOneOf1ItemsOneOf8ContentOneOf0Items
      title: OpenRouterAnthropicMessageParamContentOneOf1ItemsOneOf8Content0
    OpenRouterAnthropicMessageParamContentOneOf1ItemsOneOf8ContentOneOf1Type:
      type: string
      enum:
        - web_search_tool_result_error
      title: OpenRouterAnthropicMessageParamContentOneOf1ItemsOneOf8ContentOneOf1Type
    OpenRouterAnthropicMessageParamContentOneOf1ItemsOneOf8ContentOneOf1ErrorCode:
      type: string
      enum:
        - invalid_tool_input
        - unavailable
        - max_uses_exceeded
        - too_many_requests
        - query_too_long
      title: >-
        OpenRouterAnthropicMessageParamContentOneOf1ItemsOneOf8ContentOneOf1ErrorCode
    OpenRouterAnthropicMessageParamContentOneOf1ItemsOneOf8Content1:
      type: object
      properties:
        type:
          $ref: >-
            #/components/schemas/OpenRouterAnthropicMessageParamContentOneOf1ItemsOneOf8ContentOneOf1Type
        error_code:
          $ref: >-
            #/components/schemas/OpenRouterAnthropicMessageParamContentOneOf1ItemsOneOf8ContentOneOf1ErrorCode
      required:
        - type
        - error_code
      title: OpenRouterAnthropicMessageParamContentOneOf1ItemsOneOf8Content1
    OpenRouterAnthropicMessageParamContentOneOf1ItemsOneOf8Content:
      oneOf:
        - $ref: >-
            #/components/schemas/OpenRouterAnthropicMessageParamContentOneOf1ItemsOneOf8Content0
        - $ref: >-
            #/components/schemas/OpenRouterAnthropicMessageParamContentOneOf1ItemsOneOf8Content1
      title: OpenRouterAnthropicMessageParamContentOneOf1ItemsOneOf8Content
    OpenRouterAnthropicMessageParamContentOneOf1ItemsOneOf8CacheControlType:
      type: string
      enum:
        - ephemeral
      title: OpenRouterAnthropicMessageParamContentOneOf1ItemsOneOf8CacheControlType
    OpenRouterAnthropicMessageParamContentOneOf1ItemsOneOf8CacheControlTtl:
      type: string
      enum:
        - 5m
        - 1h
      title: OpenRouterAnthropicMessageParamContentOneOf1ItemsOneOf8CacheControlTtl
    OpenRouterAnthropicMessageParamContentOneOf1ItemsOneOf8CacheControl:
      type: object
      properties:
        type:
          $ref: >-
            #/components/schemas/OpenRouterAnthropicMessageParamContentOneOf1ItemsOneOf8CacheControlType
        ttl:
          $ref: >-
            #/components/schemas/OpenRouterAnthropicMessageParamContentOneOf1ItemsOneOf8CacheControlTtl
      required:
        - type
      title: OpenRouterAnthropicMessageParamContentOneOf1ItemsOneOf8CacheControl
    OpenRouterAnthropicMessageParamContentOneOf1Items8:
      type: object
      properties:
        type:
          $ref: >-
            #/components/schemas/OpenRouterAnthropicMessageParamContentOneOf1ItemsOneOf8Type
        tool_use_id:
          type: string
        content:
          $ref: >-
            #/components/schemas/OpenRouterAnthropicMessageParamContentOneOf1ItemsOneOf8Content
        cache_control:
          $ref: >-
            #/components/schemas/OpenRouterAnthropicMessageParamContentOneOf1ItemsOneOf8CacheControl
      required:
        - type
        - tool_use_id
        - content
      title: OpenRouterAnthropicMessageParamContentOneOf1Items8
    OpenRouterAnthropicMessageParamContentOneOf1ItemsOneOf9Type:
      type: string
      enum:
        - search_result
      title: OpenRouterAnthropicMessageParamContentOneOf1ItemsOneOf9Type
    OpenRouterAnthropicMessageParamContentOneOf1ItemsOneOf9ContentItemsType:
      type: string
      enum:
        - text
      title: OpenRouterAnthropicMessageParamContentOneOf1ItemsOneOf9ContentItemsType
    OpenRouterAnthropicMessageParamContentOneOf1ItemsOneOf9ContentItemsCitationsItemsOneOf0Type:
      type: string
      enum:
        - char_location
      title: >-
        OpenRouterAnthropicMessageParamContentOneOf1ItemsOneOf9ContentItemsCitationsItemsOneOf0Type
    OpenRouterAnthropicMessageParamContentOneOf1ItemsOneOf9ContentItemsCitationsItems0:
      type: object
      properties:
        type:
          $ref: >-
            #/components/schemas/OpenRouterAnthropicMessageParamContentOneOf1ItemsOneOf9ContentItemsCitationsItemsOneOf0Type
        cited_text:
          type: string
        document_index:
          type: number
          format: double
        document_title:
          type:
            - string
            - "null"
        start_char_index:
          type: number
          format: double
        end_char_index:
          type: number
          format: double
      required:
        - type
        - cited_text
        - document_index
        - document_title
        - start_char_index
        - end_char_index
      title: >-
        OpenRouterAnthropicMessageParamContentOneOf1ItemsOneOf9ContentItemsCitationsItems0
    OpenRouterAnthropicMessageParamContentOneOf1ItemsOneOf9ContentItemsCitationsItemsOneOf1Type:
      type: string
      enum:
        - page_location
      title: >-
        OpenRouterAnthropicMessageParamContentOneOf1ItemsOneOf9ContentItemsCitationsItemsOneOf1Type
    OpenRouterAnthropicMessageParamContentOneOf1ItemsOneOf9ContentItemsCitationsItems1:
      type: object
      properties:
        type:
          $ref: >-
            #/components/schemas/OpenRouterAnthropicMessageParamContentOneOf1ItemsOneOf9ContentItemsCitationsItemsOneOf1Type
        cited_text:
          type: string
        document_index:
          type: number
          format: double
        document_title:
          type:
            - string
            - "null"
        start_page_number:
          type: number
          format: double
        end_page_number:
          type: number
          format: double
      required:
        - type
        - cited_text
        - document_index
        - document_title
        - start_page_number
        - end_page_number
      title: >-
        OpenRouterAnthropicMessageParamContentOneOf1ItemsOneOf9ContentItemsCitationsItems1
    OpenRouterAnthropicMessageParamContentOneOf1ItemsOneOf9ContentItemsCitationsItemsOneOf2Type:
      type: string
      enum:
        - content_block_location
      title: >-
        OpenRouterAnthropicMessageParamContentOneOf1ItemsOneOf9ContentItemsCitationsItemsOneOf2Type
    OpenRouterAnthropicMessageParamContentOneOf1ItemsOneOf9ContentItemsCitationsItems2:
      type: object
      properties:
        type:
          $ref: >-
            #/components/schemas/OpenRouterAnthropicMessageParamContentOneOf1ItemsOneOf9ContentItemsCitationsItemsOneOf2Type
        cited_text:
          type: string
        document_index:
          type: number
          format: double
        document_title:
          type:
            - string
            - "null"
        start_block_index:
          type: number
          format: double
        end_block_index:
          type: number
          format: double
      required:
        - type
        - cited_text
        - document_index
        - document_title
        - start_block_index
        - end_block_index
      title: >-
        OpenRouterAnthropicMessageParamContentOneOf1ItemsOneOf9ContentItemsCitationsItems2
    OpenRouterAnthropicMessageParamContentOneOf1ItemsOneOf9ContentItemsCitationsItemsOneOf3Type:
      type: string
      enum:
        - web_search_result_location
      title: >-
        OpenRouterAnthropicMessageParamContentOneOf1ItemsOneOf9ContentItemsCitationsItemsOneOf3Type
    OpenRouterAnthropicMessageParamContentOneOf1ItemsOneOf9ContentItemsCitationsItems3:
      type: object
      properties:
        type:
          $ref: >-
            #/components/schemas/OpenRouterAnthropicMessageParamContentOneOf1ItemsOneOf9ContentItemsCitationsItemsOneOf3Type
        cited_text:
          type: string
        encrypted_index:
          type: string
        title:
          type:
            - string
            - "null"
        url:
          type: string
      required:
        - type
        - cited_text
        - encrypted_index
        - title
        - url
      title: >-
        OpenRouterAnthropicMessageParamContentOneOf1ItemsOneOf9ContentItemsCitationsItems3
    OpenRouterAnthropicMessageParamContentOneOf1ItemsOneOf9ContentItemsCitationsItemsOneOf4Type:
      type: string
      enum:
        - search_result_location
      title: >-
        OpenRouterAnthropicMessageParamContentOneOf1ItemsOneOf9ContentItemsCitationsItemsOneOf4Type
    OpenRouterAnthropicMessageParamContentOneOf1ItemsOneOf9ContentItemsCitationsItems4:
      type: object
      properties:
        type:
          $ref: >-
            #/components/schemas/OpenRouterAnthropicMessageParamContentOneOf1ItemsOneOf9ContentItemsCitationsItemsOneOf4Type
        cited_text:
          type: string
        search_result_index:
          type: number
          format: double
        source:
          type: string
        title:
          type:
            - string
            - "null"
        start_block_index:
          type: number
          format: double
        end_block_index:
          type: number
          format: double
      required:
        - type
        - cited_text
        - search_result_index
        - source
        - title
        - start_block_index
        - end_block_index
      title: >-
        OpenRouterAnthropicMessageParamContentOneOf1ItemsOneOf9ContentItemsCitationsItems4
    OpenRouterAnthropicMessageParamContentOneOf1ItemsOneOf9ContentItemsCitationsItems:
      oneOf:
        - $ref: >-
            #/components/schemas/OpenRouterAnthropicMessageParamContentOneOf1ItemsOneOf9ContentItemsCitationsItems0
        - $ref: >-
            #/components/schemas/OpenRouterAnthropicMessageParamContentOneOf1ItemsOneOf9ContentItemsCitationsItems1
        - $ref: >-
            #/components/schemas/OpenRouterAnthropicMessageParamContentOneOf1ItemsOneOf9ContentItemsCitationsItems2
        - $ref: >-
            #/components/schemas/OpenRouterAnthropicMessageParamContentOneOf1ItemsOneOf9ContentItemsCitationsItems3
        - $ref: >-
            #/components/schemas/OpenRouterAnthropicMessageParamContentOneOf1ItemsOneOf9ContentItemsCitationsItems4
      title: >-
        OpenRouterAnthropicMessageParamContentOneOf1ItemsOneOf9ContentItemsCitationsItems
    OpenRouterAnthropicMessageParamContentOneOf1ItemsOneOf9ContentItemsCacheControlType:
      type: string
      enum:
        - ephemeral
      title: >-
        OpenRouterAnthropicMessageParamContentOneOf1ItemsOneOf9ContentItemsCacheControlType
    OpenRouterAnthropicMessageParamContentOneOf1ItemsOneOf9ContentItemsCacheControlTtl:
      type: string
      enum:
        - 5m
        - 1h
      title: >-
        OpenRouterAnthropicMessageParamContentOneOf1ItemsOneOf9ContentItemsCacheControlTtl
    OpenRouterAnthropicMessageParamContentOneOf1ItemsOneOf9ContentItemsCacheControl:
      type: object
      properties:
        type:
          $ref: >-
            #/components/schemas/OpenRouterAnthropicMessageParamContentOneOf1ItemsOneOf9ContentItemsCacheControlType
        ttl:
          $ref: >-
            #/components/schemas/OpenRouterAnthropicMessageParamContentOneOf1ItemsOneOf9ContentItemsCacheControlTtl
      required:
        - type
      title: >-
        OpenRouterAnthropicMessageParamContentOneOf1ItemsOneOf9ContentItemsCacheControl
    OpenRouterAnthropicMessageParamContentOneOf1ItemsOneOf9ContentItems:
      type: object
      properties:
        type:
          $ref: >-
            #/components/schemas/OpenRouterAnthropicMessageParamContentOneOf1ItemsOneOf9ContentItemsType
        text:
          type: string
        citations:
          type:
            - array
            - "null"
          items:
            $ref: >-
              #/components/schemas/OpenRouterAnthropicMessageParamContentOneOf1ItemsOneOf9ContentItemsCitationsItems
        cache_control:
          $ref: >-
            #/components/schemas/OpenRouterAnthropicMessageParamContentOneOf1ItemsOneOf9ContentItemsCacheControl
      required:
        - type
        - text
      title: OpenRouterAnthropicMessageParamContentOneOf1ItemsOneOf9ContentItems
    OpenRouterAnthropicMessageParamContentOneOf1ItemsOneOf9Citations:
      type: object
      properties:
        enabled:
          type: boolean
      title: OpenRouterAnthropicMessageParamContentOneOf1ItemsOneOf9Citations
    OpenRouterAnthropicMessageParamContentOneOf1ItemsOneOf9CacheControlType:
      type: string
      enum:
        - ephemeral
      title: OpenRouterAnthropicMessageParamContentOneOf1ItemsOneOf9CacheControlType
    OpenRouterAnthropicMessageParamContentOneOf1ItemsOneOf9CacheControlTtl:
      type: string
      enum:
        - 5m
        - 1h
      title: OpenRouterAnthropicMessageParamContentOneOf1ItemsOneOf9CacheControlTtl
    OpenRouterAnthropicMessageParamContentOneOf1ItemsOneOf9CacheControl:
      type: object
      properties:
        type:
          $ref: >-
            #/components/schemas/OpenRouterAnthropicMessageParamContentOneOf1ItemsOneOf9CacheControlType
        ttl:
          $ref: >-
            #/components/schemas/OpenRouterAnthropicMessageParamContentOneOf1ItemsOneOf9CacheControlTtl
      required:
        - type
      title: OpenRouterAnthropicMessageParamContentOneOf1ItemsOneOf9CacheControl
    OpenRouterAnthropicMessageParamContentOneOf1Items9:
      type: object
      properties:
        type:
          $ref: >-
            #/components/schemas/OpenRouterAnthropicMessageParamContentOneOf1ItemsOneOf9Type
        source:
          type: string
        title:
          type: string
        content:
          type: array
          items:
            $ref: >-
              #/components/schemas/OpenRouterAnthropicMessageParamContentOneOf1ItemsOneOf9ContentItems
        citations:
          $ref: >-
            #/components/schemas/OpenRouterAnthropicMessageParamContentOneOf1ItemsOneOf9Citations
        cache_control:
          $ref: >-
            #/components/schemas/OpenRouterAnthropicMessageParamContentOneOf1ItemsOneOf9CacheControl
      required:
        - type
        - source
        - title
        - content
      title: OpenRouterAnthropicMessageParamContentOneOf1Items9
    OpenRouterAnthropicMessageParamContentOneOf1Items:
      oneOf:
        - $ref: >-
            #/components/schemas/OpenRouterAnthropicMessageParamContentOneOf1Items0
        - $ref: >-
            #/components/schemas/OpenRouterAnthropicMessageParamContentOneOf1Items1
        - $ref: >-
            #/components/schemas/OpenRouterAnthropicMessageParamContentOneOf1Items2
        - $ref: >-
            #/components/schemas/OpenRouterAnthropicMessageParamContentOneOf1Items3
        - $ref: >-
            #/components/schemas/OpenRouterAnthropicMessageParamContentOneOf1Items4
        - $ref: >-
            #/components/schemas/OpenRouterAnthropicMessageParamContentOneOf1Items5
        - $ref: >-
            #/components/schemas/OpenRouterAnthropicMessageParamContentOneOf1Items6
        - $ref: >-
            #/components/schemas/OpenRouterAnthropicMessageParamContentOneOf1Items7
        - $ref: >-
            #/components/schemas/OpenRouterAnthropicMessageParamContentOneOf1Items8
        - $ref: >-
            #/components/schemas/OpenRouterAnthropicMessageParamContentOneOf1Items9
      title: OpenRouterAnthropicMessageParamContentOneOf1Items
    OpenRouterAnthropicMessageParamContent1:
      type: array
      items:
        $ref: "#/components/schemas/OpenRouterAnthropicMessageParamContentOneOf1Items"
      title: OpenRouterAnthropicMessageParamContent1
    OpenRouterAnthropicMessageParamContent:
      oneOf:
        - type: string
        - $ref: "#/components/schemas/OpenRouterAnthropicMessageParamContent1"
      title: OpenRouterAnthropicMessageParamContent
    OpenRouterAnthropicMessageParam:
      type: object
      properties:
        role:
          $ref: "#/components/schemas/OpenRouterAnthropicMessageParamRole"
        content:
          $ref: "#/components/schemas/OpenRouterAnthropicMessageParamContent"
      required:
        - role
        - content
      description: Anthropic message with OpenRouter extensions
      title: OpenRouterAnthropicMessageParam
    AnthropicMessagesRequestSystemOneOf1ItemsType:
      type: string
      enum:
        - text
      title: AnthropicMessagesRequestSystemOneOf1ItemsType
    AnthropicMessagesRequestSystemOneOf1ItemsCitationsItemsOneOf0Type:
      type: string
      enum:
        - char_location
      title: AnthropicMessagesRequestSystemOneOf1ItemsCitationsItemsOneOf0Type
    AnthropicMessagesRequestSystemOneOf1ItemsCitationsItems0:
      type: object
      properties:
        type:
          $ref: >-
            #/components/schemas/AnthropicMessagesRequestSystemOneOf1ItemsCitationsItemsOneOf0Type
        cited_text:
          type: string
        document_index:
          type: number
          format: double
        document_title:
          type:
            - string
            - "null"
        start_char_index:
          type: number
          format: double
        end_char_index:
          type: number
          format: double
      required:
        - type
        - cited_text
        - document_index
        - document_title
        - start_char_index
        - end_char_index
      title: AnthropicMessagesRequestSystemOneOf1ItemsCitationsItems0
    AnthropicMessagesRequestSystemOneOf1ItemsCitationsItemsOneOf1Type:
      type: string
      enum:
        - page_location
      title: AnthropicMessagesRequestSystemOneOf1ItemsCitationsItemsOneOf1Type
    AnthropicMessagesRequestSystemOneOf1ItemsCitationsItems1:
      type: object
      properties:
        type:
          $ref: >-
            #/components/schemas/AnthropicMessagesRequestSystemOneOf1ItemsCitationsItemsOneOf1Type
        cited_text:
          type: string
        document_index:
          type: number
          format: double
        document_title:
          type:
            - string
            - "null"
        start_page_number:
          type: number
          format: double
        end_page_number:
          type: number
          format: double
      required:
        - type
        - cited_text
        - document_index
        - document_title
        - start_page_number
        - end_page_number
      title: AnthropicMessagesRequestSystemOneOf1ItemsCitationsItems1
    AnthropicMessagesRequestSystemOneOf1ItemsCitationsItemsOneOf2Type:
      type: string
      enum:
        - content_block_location
      title: AnthropicMessagesRequestSystemOneOf1ItemsCitationsItemsOneOf2Type
    AnthropicMessagesRequestSystemOneOf1ItemsCitationsItems2:
      type: object
      properties:
        type:
          $ref: >-
            #/components/schemas/AnthropicMessagesRequestSystemOneOf1ItemsCitationsItemsOneOf2Type
        cited_text:
          type: string
        document_index:
          type: number
          format: double
        document_title:
          type:
            - string
            - "null"
        start_block_index:
          type: number
          format: double
        end_block_index:
          type: number
          format: double
      required:
        - type
        - cited_text
        - document_index
        - document_title
        - start_block_index
        - end_block_index
      title: AnthropicMessagesRequestSystemOneOf1ItemsCitationsItems2
    AnthropicMessagesRequestSystemOneOf1ItemsCitationsItemsOneOf3Type:
      type: string
      enum:
        - web_search_result_location
      title: AnthropicMessagesRequestSystemOneOf1ItemsCitationsItemsOneOf3Type
    AnthropicMessagesRequestSystemOneOf1ItemsCitationsItems3:
      type: object
      properties:
        type:
          $ref: >-
            #/components/schemas/AnthropicMessagesRequestSystemOneOf1ItemsCitationsItemsOneOf3Type
        cited_text:
          type: string
        encrypted_index:
          type: string
        title:
          type:
            - string
            - "null"
        url:
          type: string
      required:
        - type
        - cited_text
        - encrypted_index
        - title
        - url
      title: AnthropicMessagesRequestSystemOneOf1ItemsCitationsItems3
    AnthropicMessagesRequestSystemOneOf1ItemsCitationsItemsOneOf4Type:
      type: string
      enum:
        - search_result_location
      title: AnthropicMessagesRequestSystemOneOf1ItemsCitationsItemsOneOf4Type
    AnthropicMessagesRequestSystemOneOf1ItemsCitationsItems4:
      type: object
      properties:
        type:
          $ref: >-
            #/components/schemas/AnthropicMessagesRequestSystemOneOf1ItemsCitationsItemsOneOf4Type
        cited_text:
          type: string
        search_result_index:
          type: number
          format: double
        source:
          type: string
        title:
          type:
            - string
            - "null"
        start_block_index:
          type: number
          format: double
        end_block_index:
          type: number
          format: double
      required:
        - type
        - cited_text
        - search_result_index
        - source
        - title
        - start_block_index
        - end_block_index
      title: AnthropicMessagesRequestSystemOneOf1ItemsCitationsItems4
    AnthropicMessagesRequestSystemOneOf1ItemsCitationsItems:
      oneOf:
        - $ref: >-
            #/components/schemas/AnthropicMessagesRequestSystemOneOf1ItemsCitationsItems0
        - $ref: >-
            #/components/schemas/AnthropicMessagesRequestSystemOneOf1ItemsCitationsItems1
        - $ref: >-
            #/components/schemas/AnthropicMessagesRequestSystemOneOf1ItemsCitationsItems2
        - $ref: >-
            #/components/schemas/AnthropicMessagesRequestSystemOneOf1ItemsCitationsItems3
        - $ref: >-
            #/components/schemas/AnthropicMessagesRequestSystemOneOf1ItemsCitationsItems4
      title: AnthropicMessagesRequestSystemOneOf1ItemsCitationsItems
    AnthropicMessagesRequestSystemOneOf1ItemsCacheControlType:
      type: string
      enum:
        - ephemeral
      title: AnthropicMessagesRequestSystemOneOf1ItemsCacheControlType
    AnthropicMessagesRequestSystemOneOf1ItemsCacheControlTtl:
      type: string
      enum:
        - 5m
        - 1h
      title: AnthropicMessagesRequestSystemOneOf1ItemsCacheControlTtl
    AnthropicMessagesRequestSystemOneOf1ItemsCacheControl:
      type: object
      properties:
        type:
          $ref: >-
            #/components/schemas/AnthropicMessagesRequestSystemOneOf1ItemsCacheControlType
        ttl:
          $ref: >-
            #/components/schemas/AnthropicMessagesRequestSystemOneOf1ItemsCacheControlTtl
      required:
        - type
      title: AnthropicMessagesRequestSystemOneOf1ItemsCacheControl
    AnthropicMessagesRequestSystemOneOf1Items:
      type: object
      properties:
        type:
          $ref: "#/components/schemas/AnthropicMessagesRequestSystemOneOf1ItemsType"
        text:
          type: string
        citations:
          type:
            - array
            - "null"
          items:
            $ref: >-
              #/components/schemas/AnthropicMessagesRequestSystemOneOf1ItemsCitationsItems
        cache_control:
          $ref: >-
            #/components/schemas/AnthropicMessagesRequestSystemOneOf1ItemsCacheControl
      required:
        - type
        - text
      title: AnthropicMessagesRequestSystemOneOf1Items
    AnthropicMessagesRequestSystem1:
      type: array
      items:
        $ref: "#/components/schemas/AnthropicMessagesRequestSystemOneOf1Items"
      title: AnthropicMessagesRequestSystem1
    AnthropicMessagesRequestSystem:
      oneOf:
        - type: string
        - $ref: "#/components/schemas/AnthropicMessagesRequestSystem1"
      title: AnthropicMessagesRequestSystem
    AnthropicMessagesRequestMetadata:
      type: object
      properties:
        user_id:
          type:
            - string
            - "null"
      title: AnthropicMessagesRequestMetadata
    AnthropicMessagesRequestToolsItemsOneOf0InputSchema:
      type: object
      properties:
        type:
          type: string
          default: object
        properties:
          oneOf:
            - description: Any type
            - type: "null"
        required:
          type:
            - array
            - "null"
          items:
            type: string
      title: AnthropicMessagesRequestToolsItemsOneOf0InputSchema
    AnthropicMessagesRequestToolsItemsOneOf0Type:
      type: string
      enum:
        - custom
      title: AnthropicMessagesRequestToolsItemsOneOf0Type
    AnthropicMessagesRequestToolsItemsOneOf0CacheControlType:
      type: string
      enum:
        - ephemeral
      title: AnthropicMessagesRequestToolsItemsOneOf0CacheControlType
    AnthropicMessagesRequestToolsItemsOneOf0CacheControlTtl:
      type: string
      enum:
        - 5m
        - 1h
      title: AnthropicMessagesRequestToolsItemsOneOf0CacheControlTtl
    AnthropicMessagesRequestToolsItemsOneOf0CacheControl:
      type: object
      properties:
        type:
          $ref: >-
            #/components/schemas/AnthropicMessagesRequestToolsItemsOneOf0CacheControlType
        ttl:
          $ref: >-
            #/components/schemas/AnthropicMessagesRequestToolsItemsOneOf0CacheControlTtl
      required:
        - type
      title: AnthropicMessagesRequestToolsItemsOneOf0CacheControl
    AnthropicMessagesRequestToolsItems0:
      type: object
      properties:
        name:
          type: string
        description:
          type: string
        input_schema:
          $ref: >-
            #/components/schemas/AnthropicMessagesRequestToolsItemsOneOf0InputSchema
        type:
          $ref: "#/components/schemas/AnthropicMessagesRequestToolsItemsOneOf0Type"
        cache_control:
          $ref: >-
            #/components/schemas/AnthropicMessagesRequestToolsItemsOneOf0CacheControl
      required:
        - name
        - input_schema
      title: AnthropicMessagesRequestToolsItems0
    AnthropicMessagesRequestToolsItemsOneOf1Type:
      type: string
      enum:
        - bash_20250124
      title: AnthropicMessagesRequestToolsItemsOneOf1Type
    AnthropicMessagesRequestToolsItemsOneOf1Name:
      type: string
      enum:
        - bash
      title: AnthropicMessagesRequestToolsItemsOneOf1Name
    AnthropicMessagesRequestToolsItemsOneOf1CacheControlType:
      type: string
      enum:
        - ephemeral
      title: AnthropicMessagesRequestToolsItemsOneOf1CacheControlType
    AnthropicMessagesRequestToolsItemsOneOf1CacheControlTtl:
      type: string
      enum:
        - 5m
        - 1h
      title: AnthropicMessagesRequestToolsItemsOneOf1CacheControlTtl
    AnthropicMessagesRequestToolsItemsOneOf1CacheControl:
      type: object
      properties:
        type:
          $ref: >-
            #/components/schemas/AnthropicMessagesRequestToolsItemsOneOf1CacheControlType
        ttl:
          $ref: >-
            #/components/schemas/AnthropicMessagesRequestToolsItemsOneOf1CacheControlTtl
      required:
        - type
      title: AnthropicMessagesRequestToolsItemsOneOf1CacheControl
    AnthropicMessagesRequestToolsItems1:
      type: object
      properties:
        type:
          $ref: "#/components/schemas/AnthropicMessagesRequestToolsItemsOneOf1Type"
        name:
          $ref: "#/components/schemas/AnthropicMessagesRequestToolsItemsOneOf1Name"
        cache_control:
          $ref: >-
            #/components/schemas/AnthropicMessagesRequestToolsItemsOneOf1CacheControl
      required:
        - type
        - name
      title: AnthropicMessagesRequestToolsItems1
    AnthropicMessagesRequestToolsItemsOneOf2Type:
      type: string
      enum:
        - text_editor_20250124
      title: AnthropicMessagesRequestToolsItemsOneOf2Type
    AnthropicMessagesRequestToolsItemsOneOf2Name:
      type: string
      enum:
        - str_replace_editor
      title: AnthropicMessagesRequestToolsItemsOneOf2Name
    AnthropicMessagesRequestToolsItemsOneOf2CacheControlType:
      type: string
      enum:
        - ephemeral
      title: AnthropicMessagesRequestToolsItemsOneOf2CacheControlType
    AnthropicMessagesRequestToolsItemsOneOf2CacheControlTtl:
      type: string
      enum:
        - 5m
        - 1h
      title: AnthropicMessagesRequestToolsItemsOneOf2CacheControlTtl
    AnthropicMessagesRequestToolsItemsOneOf2CacheControl:
      type: object
      properties:
        type:
          $ref: >-
            #/components/schemas/AnthropicMessagesRequestToolsItemsOneOf2CacheControlType
        ttl:
          $ref: >-
            #/components/schemas/AnthropicMessagesRequestToolsItemsOneOf2CacheControlTtl
      required:
        - type
      title: AnthropicMessagesRequestToolsItemsOneOf2CacheControl
    AnthropicMessagesRequestToolsItems2:
      type: object
      properties:
        type:
          $ref: "#/components/schemas/AnthropicMessagesRequestToolsItemsOneOf2Type"
        name:
          $ref: "#/components/schemas/AnthropicMessagesRequestToolsItemsOneOf2Name"
        cache_control:
          $ref: >-
            #/components/schemas/AnthropicMessagesRequestToolsItemsOneOf2CacheControl
      required:
        - type
        - name
      title: AnthropicMessagesRequestToolsItems2
    AnthropicMessagesRequestToolsItemsOneOf3Type:
      type: string
      enum:
        - web_search_20250305
      title: AnthropicMessagesRequestToolsItemsOneOf3Type
    AnthropicMessagesRequestToolsItemsOneOf3Name:
      type: string
      enum:
        - web_search
      title: AnthropicMessagesRequestToolsItemsOneOf3Name
    AnthropicMessagesRequestToolsItemsOneOf3UserLocationType:
      type: string
      enum:
        - approximate
      title: AnthropicMessagesRequestToolsItemsOneOf3UserLocationType
    AnthropicMessagesRequestToolsItemsOneOf3UserLocation:
      type: object
      properties:
        type:
          $ref: >-
            #/components/schemas/AnthropicMessagesRequestToolsItemsOneOf3UserLocationType
        city:
          type:
            - string
            - "null"
        country:
          type:
            - string
            - "null"
        region:
          type:
            - string
            - "null"
        timezone:
          type:
            - string
            - "null"
      required:
        - type
      title: AnthropicMessagesRequestToolsItemsOneOf3UserLocation
    AnthropicMessagesRequestToolsItemsOneOf3CacheControlType:
      type: string
      enum:
        - ephemeral
      title: AnthropicMessagesRequestToolsItemsOneOf3CacheControlType
    AnthropicMessagesRequestToolsItemsOneOf3CacheControlTtl:
      type: string
      enum:
        - 5m
        - 1h
      title: AnthropicMessagesRequestToolsItemsOneOf3CacheControlTtl
    AnthropicMessagesRequestToolsItemsOneOf3CacheControl:
      type: object
      properties:
        type:
          $ref: >-
            #/components/schemas/AnthropicMessagesRequestToolsItemsOneOf3CacheControlType
        ttl:
          $ref: >-
            #/components/schemas/AnthropicMessagesRequestToolsItemsOneOf3CacheControlTtl
      required:
        - type
      title: AnthropicMessagesRequestToolsItemsOneOf3CacheControl
    AnthropicMessagesRequestToolsItems3:
      type: object
      properties:
        type:
          $ref: "#/components/schemas/AnthropicMessagesRequestToolsItemsOneOf3Type"
        name:
          $ref: "#/components/schemas/AnthropicMessagesRequestToolsItemsOneOf3Name"
        allowed_domains:
          type:
            - array
            - "null"
          items:
            type: string
        blocked_domains:
          type:
            - array
            - "null"
          items:
            type: string
        max_uses:
          type:
            - number
            - "null"
          format: double
        user_location:
          oneOf:
            - $ref: >-
                #/components/schemas/AnthropicMessagesRequestToolsItemsOneOf3UserLocation
            - type: "null"
        cache_control:
          $ref: >-
            #/components/schemas/AnthropicMessagesRequestToolsItemsOneOf3CacheControl
      required:
        - type
        - name
      title: AnthropicMessagesRequestToolsItems3
    AnthropicMessagesRequestToolsItems:
      oneOf:
        - $ref: "#/components/schemas/AnthropicMessagesRequestToolsItems0"
        - $ref: "#/components/schemas/AnthropicMessagesRequestToolsItems1"
        - $ref: "#/components/schemas/AnthropicMessagesRequestToolsItems2"
        - $ref: "#/components/schemas/AnthropicMessagesRequestToolsItems3"
      title: AnthropicMessagesRequestToolsItems
    AnthropicMessagesRequestToolChoiceOneOf0Type:
      type: string
      enum:
        - auto
      title: AnthropicMessagesRequestToolChoiceOneOf0Type
    AnthropicMessagesRequestToolChoice0:
      type: object
      properties:
        type:
          $ref: "#/components/schemas/AnthropicMessagesRequestToolChoiceOneOf0Type"
        disable_parallel_tool_use:
          type: boolean
      required:
        - type
      title: AnthropicMessagesRequestToolChoice0
    AnthropicMessagesRequestToolChoiceOneOf1Type:
      type: string
      enum:
        - any
      title: AnthropicMessagesRequestToolChoiceOneOf1Type
    AnthropicMessagesRequestToolChoice1:
      type: object
      properties:
        type:
          $ref: "#/components/schemas/AnthropicMessagesRequestToolChoiceOneOf1Type"
        disable_parallel_tool_use:
          type: boolean
      required:
        - type
      title: AnthropicMessagesRequestToolChoice1
    AnthropicMessagesRequestToolChoiceOneOf2Type:
      type: string
      enum:
        - none
      title: AnthropicMessagesRequestToolChoiceOneOf2Type
    AnthropicMessagesRequestToolChoice2:
      type: object
      properties:
        type:
          $ref: "#/components/schemas/AnthropicMessagesRequestToolChoiceOneOf2Type"
      required:
        - type
      title: AnthropicMessagesRequestToolChoice2
    AnthropicMessagesRequestToolChoiceOneOf3Type:
      type: string
      enum:
        - tool
      title: AnthropicMessagesRequestToolChoiceOneOf3Type
    AnthropicMessagesRequestToolChoice3:
      type: object
      properties:
        type:
          $ref: "#/components/schemas/AnthropicMessagesRequestToolChoiceOneOf3Type"
        name:
          type: string
        disable_parallel_tool_use:
          type: boolean
      required:
        - type
        - name
      title: AnthropicMessagesRequestToolChoice3
    AnthropicMessagesRequestToolChoice:
      oneOf:
        - $ref: "#/components/schemas/AnthropicMessagesRequestToolChoice0"
        - $ref: "#/components/schemas/AnthropicMessagesRequestToolChoice1"
        - $ref: "#/components/schemas/AnthropicMessagesRequestToolChoice2"
        - $ref: "#/components/schemas/AnthropicMessagesRequestToolChoice3"
      title: AnthropicMessagesRequestToolChoice
    AnthropicMessagesRequestThinkingOneOf0Type:
      type: string
      enum:
        - enabled
      title: AnthropicMessagesRequestThinkingOneOf0Type
    AnthropicMessagesRequestThinking0:
      type: object
      properties:
        type:
          $ref: "#/components/schemas/AnthropicMessagesRequestThinkingOneOf0Type"
        budget_tokens:
          type: number
          format: double
      required:
        - type
        - budget_tokens
      title: AnthropicMessagesRequestThinking0
    AnthropicMessagesRequestThinkingOneOf1Type:
      type: string
      enum:
        - disabled
      title: AnthropicMessagesRequestThinkingOneOf1Type
    AnthropicMessagesRequestThinking1:
      type: object
      properties:
        type:
          $ref: "#/components/schemas/AnthropicMessagesRequestThinkingOneOf1Type"
      required:
        - type
      title: AnthropicMessagesRequestThinking1
    AnthropicMessagesRequestThinkingOneOf2Type:
      type: string
      enum:
        - adaptive
      title: AnthropicMessagesRequestThinkingOneOf2Type
    AnthropicMessagesRequestThinking2:
      type: object
      properties:
        type:
          $ref: "#/components/schemas/AnthropicMessagesRequestThinkingOneOf2Type"
      required:
        - type
      title: AnthropicMessagesRequestThinking2
    AnthropicMessagesRequestThinking:
      oneOf:
        - $ref: "#/components/schemas/AnthropicMessagesRequestThinking0"
        - $ref: "#/components/schemas/AnthropicMessagesRequestThinking1"
        - $ref: "#/components/schemas/AnthropicMessagesRequestThinking2"
      title: AnthropicMessagesRequestThinking
    AnthropicMessagesRequestServiceTier:
      type: string
      enum:
        - auto
        - standard_only
      title: AnthropicMessagesRequestServiceTier
    AnthropicOutputConfigEffort:
      type: string
      enum:
        - low
        - medium
        - high
        - max
      description: >-
        How much effort the model should put into its response. Higher effort
        levels may result in more thorough analysis but take longer. Valid
        values are `low`, `medium`, `high`, or `max`.
      title: AnthropicOutputConfigEffort
    AnthropicOutputConfigFormatType:
      type: string
      enum:
        - json_schema
      title: AnthropicOutputConfigFormatType
    AnthropicOutputConfigFormat:
      type: object
      properties:
        type:
          $ref: "#/components/schemas/AnthropicOutputConfigFormatType"
        schema:
          type: object
          additionalProperties:
            description: Any type
      required:
        - type
        - schema
      description: >-
        A schema to specify Claude's output format in responses. See [structured
        outputs](https://platform.claude.com/docs/en/build-with-claude/structured-outputs).
      title: AnthropicOutputConfigFormat
    AnthropicOutputConfig:
      type: object
      properties:
        effort:
          oneOf:
            - $ref: "#/components/schemas/AnthropicOutputConfigEffort"
            - type: "null"
          description: >-
            How much effort the model should put into its response. Higher
            effort levels may result in more thorough analysis but take longer.
            Valid values are `low`, `medium`, `high`, or `max`.
        format:
          oneOf:
            - $ref: "#/components/schemas/AnthropicOutputConfigFormat"
            - type: "null"
          description: >-
            A schema to specify Claude's output format in responses. See
            [structured
            outputs](https://platform.claude.com/docs/en/build-with-claude/structured-outputs).
      description: >-
        Configuration for controlling output behavior. Supports the effort
        parameter and structured output format.
      title: AnthropicOutputConfig
    AnthropicMessagesRequestCacheControlType:
      type: string
      enum:
        - ephemeral
      title: AnthropicMessagesRequestCacheControlType
    AnthropicMessagesRequestCacheControlTtl:
      type: string
      enum:
        - 5m
        - 1h
      title: AnthropicMessagesRequestCacheControlTtl
    AnthropicMessagesRequestCacheControl:
      type: object
      properties:
        type:
          $ref: "#/components/schemas/AnthropicMessagesRequestCacheControlType"
        ttl:
          $ref: "#/components/schemas/AnthropicMessagesRequestCacheControlTtl"
      required:
        - type
      title: AnthropicMessagesRequestCacheControl
    AnthropicMessagesRequestContextManagementEditsItemsOneOf0Type:
      type: string
      enum:
        - clear_tool_uses_20250919
      title: AnthropicMessagesRequestContextManagementEditsItemsOneOf0Type
    AnthropicMessagesRequestContextManagementEditsItemsOneOf0ClearAtLeastType:
      type: string
      enum:
        - input_tokens
      title: >-
        AnthropicMessagesRequestContextManagementEditsItemsOneOf0ClearAtLeastType
    AnthropicMessagesRequestContextManagementEditsItemsOneOf0ClearAtLeast:
      type: object
      properties:
        type:
          $ref: >-
            #/components/schemas/AnthropicMessagesRequestContextManagementEditsItemsOneOf0ClearAtLeastType
        value:
          type: number
          format: double
      required:
        - type
        - value
      title: AnthropicMessagesRequestContextManagementEditsItemsOneOf0ClearAtLeast
    AnthropicMessagesRequestContextManagementEditsItemsOneOf0ClearToolInputs:
      oneOf:
        - type: boolean
        - type: array
          items:
            type: string
        - description: Any type
      title: AnthropicMessagesRequestContextManagementEditsItemsOneOf0ClearToolInputs
    AnthropicMessagesRequestContextManagementEditsItemsOneOf0KeepType:
      type: string
      enum:
        - tool_uses
      title: AnthropicMessagesRequestContextManagementEditsItemsOneOf0KeepType
    AnthropicMessagesRequestContextManagementEditsItemsOneOf0Keep:
      type: object
      properties:
        type:
          $ref: >-
            #/components/schemas/AnthropicMessagesRequestContextManagementEditsItemsOneOf0KeepType
        value:
          type: number
          format: double
      required:
        - type
        - value
      title: AnthropicMessagesRequestContextManagementEditsItemsOneOf0Keep
    AnthropicMessagesRequestContextManagementEditsItemsOneOf0TriggerOneOf0Type:
      type: string
      enum:
        - input_tokens
      title: >-
        AnthropicMessagesRequestContextManagementEditsItemsOneOf0TriggerOneOf0Type
    AnthropicMessagesRequestContextManagementEditsItemsOneOf0Trigger0:
      type: object
      properties:
        type:
          $ref: >-
            #/components/schemas/AnthropicMessagesRequestContextManagementEditsItemsOneOf0TriggerOneOf0Type
        value:
          type: number
          format: double
      required:
        - type
        - value
      title: AnthropicMessagesRequestContextManagementEditsItemsOneOf0Trigger0
    AnthropicMessagesRequestContextManagementEditsItemsOneOf0TriggerOneOf1Type:
      type: string
      enum:
        - tool_uses
      title: >-
        AnthropicMessagesRequestContextManagementEditsItemsOneOf0TriggerOneOf1Type
    AnthropicMessagesRequestContextManagementEditsItemsOneOf0Trigger1:
      type: object
      properties:
        type:
          $ref: >-
            #/components/schemas/AnthropicMessagesRequestContextManagementEditsItemsOneOf0TriggerOneOf1Type
        value:
          type: number
          format: double
      required:
        - type
        - value
      title: AnthropicMessagesRequestContextManagementEditsItemsOneOf0Trigger1
    AnthropicMessagesRequestContextManagementEditsItemsOneOf0Trigger:
      oneOf:
        - $ref: >-
            #/components/schemas/AnthropicMessagesRequestContextManagementEditsItemsOneOf0Trigger0
        - $ref: >-
            #/components/schemas/AnthropicMessagesRequestContextManagementEditsItemsOneOf0Trigger1
      title: AnthropicMessagesRequestContextManagementEditsItemsOneOf0Trigger
    AnthropicMessagesRequestContextManagementEditsItems0:
      type: object
      properties:
        type:
          $ref: >-
            #/components/schemas/AnthropicMessagesRequestContextManagementEditsItemsOneOf0Type
        clear_at_least:
          oneOf:
            - $ref: >-
                #/components/schemas/AnthropicMessagesRequestContextManagementEditsItemsOneOf0ClearAtLeast
            - type: "null"
        clear_tool_inputs:
          $ref: >-
            #/components/schemas/AnthropicMessagesRequestContextManagementEditsItemsOneOf0ClearToolInputs
        exclude_tools:
          type:
            - array
            - "null"
          items:
            type: string
        keep:
          $ref: >-
            #/components/schemas/AnthropicMessagesRequestContextManagementEditsItemsOneOf0Keep
        trigger:
          $ref: >-
            #/components/schemas/AnthropicMessagesRequestContextManagementEditsItemsOneOf0Trigger
      required:
        - type
      title: AnthropicMessagesRequestContextManagementEditsItems0
    AnthropicMessagesRequestContextManagementEditsItemsOneOf1Type:
      type: string
      enum:
        - clear_thinking_20251015
      title: AnthropicMessagesRequestContextManagementEditsItemsOneOf1Type
    AnthropicMessagesRequestContextManagementEditsItemsOneOf1KeepOneOf0Type:
      type: string
      enum:
        - thinking_turns
      title: AnthropicMessagesRequestContextManagementEditsItemsOneOf1KeepOneOf0Type
    AnthropicMessagesRequestContextManagementEditsItemsOneOf1Keep0:
      type: object
      properties:
        type:
          $ref: >-
            #/components/schemas/AnthropicMessagesRequestContextManagementEditsItemsOneOf1KeepOneOf0Type
        value:
          type: number
          format: double
      required:
        - type
        - value
      title: AnthropicMessagesRequestContextManagementEditsItemsOneOf1Keep0
    AnthropicMessagesRequestContextManagementEditsItemsOneOf1KeepOneOf1Type:
      type: string
      enum:
        - all
      title: AnthropicMessagesRequestContextManagementEditsItemsOneOf1KeepOneOf1Type
    AnthropicMessagesRequestContextManagementEditsItemsOneOf1Keep1:
      type: object
      properties:
        type:
          $ref: >-
            #/components/schemas/AnthropicMessagesRequestContextManagementEditsItemsOneOf1KeepOneOf1Type
      required:
        - type
      title: AnthropicMessagesRequestContextManagementEditsItemsOneOf1Keep1
    AnthropicMessagesRequestContextManagementEditsItemsOneOf1Keep2:
      type: string
      enum:
        - all
      title: AnthropicMessagesRequestContextManagementEditsItemsOneOf1Keep2
    AnthropicMessagesRequestContextManagementEditsItemsOneOf1Keep:
      oneOf:
        - $ref: >-
            #/components/schemas/AnthropicMessagesRequestContextManagementEditsItemsOneOf1Keep0
        - $ref: >-
            #/components/schemas/AnthropicMessagesRequestContextManagementEditsItemsOneOf1Keep1
        - $ref: >-
            #/components/schemas/AnthropicMessagesRequestContextManagementEditsItemsOneOf1Keep2
      title: AnthropicMessagesRequestContextManagementEditsItemsOneOf1Keep
    AnthropicMessagesRequestContextManagementEditsItems1:
      type: object
      properties:
        type:
          $ref: >-
            #/components/schemas/AnthropicMessagesRequestContextManagementEditsItemsOneOf1Type
        keep:
          $ref: >-
            #/components/schemas/AnthropicMessagesRequestContextManagementEditsItemsOneOf1Keep
      required:
        - type
      title: AnthropicMessagesRequestContextManagementEditsItems1
    AnthropicMessagesRequestContextManagementEditsItemsOneOf2Type:
      type: string
      enum:
        - compact_20260112
      title: AnthropicMessagesRequestContextManagementEditsItemsOneOf2Type
    AnthropicMessagesRequestContextManagementEditsItemsOneOf2TriggerType:
      type: string
      enum:
        - input_tokens
      title: AnthropicMessagesRequestContextManagementEditsItemsOneOf2TriggerType
    AnthropicMessagesRequestContextManagementEditsItemsOneOf2Trigger:
      type: object
      properties:
        type:
          $ref: >-
            #/components/schemas/AnthropicMessagesRequestContextManagementEditsItemsOneOf2TriggerType
        value:
          type: number
          format: double
      required:
        - type
        - value
      title: AnthropicMessagesRequestContextManagementEditsItemsOneOf2Trigger
    AnthropicMessagesRequestContextManagementEditsItems2:
      type: object
      properties:
        type:
          $ref: >-
            #/components/schemas/AnthropicMessagesRequestContextManagementEditsItemsOneOf2Type
        instructions:
          type:
            - string
            - "null"
        pause_after_compaction:
          type: boolean
        trigger:
          oneOf:
            - $ref: >-
                #/components/schemas/AnthropicMessagesRequestContextManagementEditsItemsOneOf2Trigger
            - type: "null"
      required:
        - type
      title: AnthropicMessagesRequestContextManagementEditsItems2
    AnthropicMessagesRequestContextManagementEditsItems:
      oneOf:
        - $ref: >-
            #/components/schemas/AnthropicMessagesRequestContextManagementEditsItems0
        - $ref: >-
            #/components/schemas/AnthropicMessagesRequestContextManagementEditsItems1
        - $ref: >-
            #/components/schemas/AnthropicMessagesRequestContextManagementEditsItems2
      title: AnthropicMessagesRequestContextManagementEditsItems
    AnthropicMessagesRequestContextManagement:
      type: object
      properties:
        edits:
          type: array
          items:
            $ref: >-
              #/components/schemas/AnthropicMessagesRequestContextManagementEditsItems
      title: AnthropicMessagesRequestContextManagement
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
    AnthropicMessagesRequestProviderOrderItems:
      oneOf:
        - $ref: "#/components/schemas/ProviderName"
        - type: string
      title: AnthropicMessagesRequestProviderOrderItems
    AnthropicMessagesRequestProviderOnlyItems:
      oneOf:
        - $ref: "#/components/schemas/ProviderName"
        - type: string
      title: AnthropicMessagesRequestProviderOnlyItems
    AnthropicMessagesRequestProviderIgnoreItems:
      oneOf:
        - $ref: "#/components/schemas/ProviderName"
        - type: string
      title: AnthropicMessagesRequestProviderIgnoreItems
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
    AnthropicMessagesRequestProviderSort:
      type: object
      properties: {}
      title: AnthropicMessagesRequestProviderSort
    BigNumberUnion:
      type: string
      description: Price per million prompt tokens
      title: BigNumberUnion
    AnthropicMessagesRequestProviderMaxPriceCompletion:
      type: object
      properties: {}
      title: AnthropicMessagesRequestProviderMaxPriceCompletion
    AnthropicMessagesRequestProviderMaxPriceImage:
      type: object
      properties: {}
      title: AnthropicMessagesRequestProviderMaxPriceImage
    AnthropicMessagesRequestProviderMaxPriceAudio:
      type: object
      properties: {}
      title: AnthropicMessagesRequestProviderMaxPriceAudio
    AnthropicMessagesRequestProviderMaxPriceRequest:
      type: object
      properties: {}
      title: AnthropicMessagesRequestProviderMaxPriceRequest
    AnthropicMessagesRequestProviderMaxPrice:
      type: object
      properties:
        prompt:
          $ref: "#/components/schemas/BigNumberUnion"
        completion:
          $ref: >-
            #/components/schemas/AnthropicMessagesRequestProviderMaxPriceCompletion
        image:
          $ref: "#/components/schemas/AnthropicMessagesRequestProviderMaxPriceImage"
        audio:
          $ref: "#/components/schemas/AnthropicMessagesRequestProviderMaxPriceAudio"
        request:
          $ref: "#/components/schemas/AnthropicMessagesRequestProviderMaxPriceRequest"
      description: >-
        The object specifying the maximum price you want to pay for this
        request. USD price per million tokens, for prompt and completion.
      title: AnthropicMessagesRequestProviderMaxPrice
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
    AnthropicMessagesRequestProvider:
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
            $ref: "#/components/schemas/AnthropicMessagesRequestProviderOrderItems"
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
            $ref: "#/components/schemas/AnthropicMessagesRequestProviderOnlyItems"
          description: >-
            List of provider slugs to allow. If provided, this list is merged
            with your account-wide allowed provider settings for this request.
        ignore:
          type:
            - array
            - "null"
          items:
            $ref: "#/components/schemas/AnthropicMessagesRequestProviderIgnoreItems"
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
          $ref: "#/components/schemas/AnthropicMessagesRequestProviderSort"
        max_price:
          $ref: "#/components/schemas/AnthropicMessagesRequestProviderMaxPrice"
          description: >-
            The object specifying the maximum price you want to pay for this
            request. USD price per million tokens, for prompt and completion.
        preferred_min_throughput:
          $ref: "#/components/schemas/PreferredMinThroughput"
        preferred_max_latency:
          $ref: "#/components/schemas/PreferredMaxLatency"
      description: >-
        When multiple model providers are available, optionally indicate your
        routing preference.
      title: AnthropicMessagesRequestProvider
    AnthropicMessagesRequestPluginsItemsOneOf0Id:
      type: string
      enum:
        - auto-router
      title: AnthropicMessagesRequestPluginsItemsOneOf0Id
    AnthropicMessagesRequestPluginsItems0:
      type: object
      properties:
        id:
          $ref: "#/components/schemas/AnthropicMessagesRequestPluginsItemsOneOf0Id"
        enabled:
          type: boolean
          description: >-
            Set to false to disable the auto-router plugin for this request.
            Defaults to true.
        allowed_models:
          type: array
          items:
            type: string
          description: >-
            List of model patterns to filter which models the auto-router can
            route between. Supports wildcards (e.g., "anthropic/*" matches all
            Anthropic models). When not specified, uses the default supported
            models list.
      required:
        - id
      title: AnthropicMessagesRequestPluginsItems0
    AnthropicMessagesRequestPluginsItemsOneOf1Id:
      type: string
      enum:
        - moderation
      title: AnthropicMessagesRequestPluginsItemsOneOf1Id
    AnthropicMessagesRequestPluginsItems1:
      type: object
      properties:
        id:
          $ref: "#/components/schemas/AnthropicMessagesRequestPluginsItemsOneOf1Id"
      required:
        - id
      title: AnthropicMessagesRequestPluginsItems1
    AnthropicMessagesRequestPluginsItemsOneOf2Id:
      type: string
      enum:
        - web
      title: AnthropicMessagesRequestPluginsItemsOneOf2Id
    WebSearchEngine:
      type: string
      enum:
        - native
        - exa
      description: The search engine to use for web search.
      title: WebSearchEngine
    AnthropicMessagesRequestPluginsItems2:
      type: object
      properties:
        id:
          $ref: "#/components/schemas/AnthropicMessagesRequestPluginsItemsOneOf2Id"
        enabled:
          type: boolean
          description: >-
            Set to false to disable the web-search plugin for this request.
            Defaults to true.
        max_results:
          type: number
          format: double
        search_prompt:
          type: string
        engine:
          $ref: "#/components/schemas/WebSearchEngine"
        include_domains:
          type: array
          items:
            type: string
          description: >-
            A list of domains to restrict web search results to. Supports
            wildcards (e.g. "*.substack.com") and path filtering (e.g.
            "openai.com/blog").
        exclude_domains:
          type: array
          items:
            type: string
          description: >-
            A list of domains to exclude from web search results. Supports
            wildcards (e.g. "*.substack.com") and path filtering (e.g.
            "openai.com/blog").
      required:
        - id
      title: AnthropicMessagesRequestPluginsItems2
    AnthropicMessagesRequestPluginsItemsOneOf3Id:
      type: string
      enum:
        - file-parser
      title: AnthropicMessagesRequestPluginsItemsOneOf3Id
    PDFParserEngine:
      type: string
      enum:
        - mistral-ocr
        - pdf-text
        - native
      description: The engine to use for parsing PDF files.
      title: PDFParserEngine
    PDFParserOptions:
      type: object
      properties:
        engine:
          $ref: "#/components/schemas/PDFParserEngine"
      description: Options for PDF parsing.
      title: PDFParserOptions
    AnthropicMessagesRequestPluginsItems3:
      type: object
      properties:
        id:
          $ref: "#/components/schemas/AnthropicMessagesRequestPluginsItemsOneOf3Id"
        enabled:
          type: boolean
          description: >-
            Set to false to disable the file-parser plugin for this request.
            Defaults to true.
        pdf:
          $ref: "#/components/schemas/PDFParserOptions"
      required:
        - id
      title: AnthropicMessagesRequestPluginsItems3
    AnthropicMessagesRequestPluginsItemsOneOf4Id:
      type: string
      enum:
        - response-healing
      title: AnthropicMessagesRequestPluginsItemsOneOf4Id
    AnthropicMessagesRequestPluginsItems4:
      type: object
      properties:
        id:
          $ref: "#/components/schemas/AnthropicMessagesRequestPluginsItemsOneOf4Id"
        enabled:
          type: boolean
          description: >-
            Set to false to disable the response-healing plugin for this
            request. Defaults to true.
      required:
        - id
      title: AnthropicMessagesRequestPluginsItems4
    AnthropicMessagesRequestPluginsItems:
      oneOf:
        - $ref: "#/components/schemas/AnthropicMessagesRequestPluginsItems0"
        - $ref: "#/components/schemas/AnthropicMessagesRequestPluginsItems1"
        - $ref: "#/components/schemas/AnthropicMessagesRequestPluginsItems2"
        - $ref: "#/components/schemas/AnthropicMessagesRequestPluginsItems3"
        - $ref: "#/components/schemas/AnthropicMessagesRequestPluginsItems4"
      title: AnthropicMessagesRequestPluginsItems
    AnthropicMessagesRequestTrace:
      type: object
      properties:
        trace_id:
          type: string
        trace_name:
          type: string
        span_name:
          type: string
        generation_name:
          type: string
        parent_span_id:
          type: string
      description: >-
        Metadata for observability and tracing. Known keys (trace_id,
        trace_name, span_name, generation_name, parent_span_id) have special
        handling. Additional keys are passed through as custom metadata to
        configured broadcast destinations.
      title: AnthropicMessagesRequestTrace
    AnthropicMessagesRequest:
      type: object
      properties:
        model:
          type: string
        max_tokens:
          type: number
          format: double
        messages:
          type:
            - array
            - "null"
          items:
            $ref: "#/components/schemas/OpenRouterAnthropicMessageParam"
        system:
          $ref: "#/components/schemas/AnthropicMessagesRequestSystem"
        metadata:
          $ref: "#/components/schemas/AnthropicMessagesRequestMetadata"
        stop_sequences:
          type: array
          items:
            type: string
        temperature:
          type: number
          format: double
        top_p:
          type: number
          format: double
        top_k:
          type: number
          format: double
        tools:
          type: array
          items:
            $ref: "#/components/schemas/AnthropicMessagesRequestToolsItems"
        tool_choice:
          $ref: "#/components/schemas/AnthropicMessagesRequestToolChoice"
        thinking:
          $ref: "#/components/schemas/AnthropicMessagesRequestThinking"
        service_tier:
          $ref: "#/components/schemas/AnthropicMessagesRequestServiceTier"
        output_config:
          $ref: "#/components/schemas/AnthropicOutputConfig"
        cache_control:
          $ref: "#/components/schemas/AnthropicMessagesRequestCacheControl"
        stream:
          type: boolean
        context_management:
          oneOf:
            - $ref: "#/components/schemas/AnthropicMessagesRequestContextManagement"
            - type: "null"
        provider:
          oneOf:
            - $ref: "#/components/schemas/AnthropicMessagesRequestProvider"
            - type: "null"
          description: >-
            When multiple model providers are available, optionally indicate
            your routing preference.
        plugins:
          type: array
          items:
            $ref: "#/components/schemas/AnthropicMessagesRequestPluginsItems"
          description: >-
            Plugins you want to enable for this request, including their
            settings.
        user:
          type: string
          description: >-
            A unique identifier representing your end-user, which helps
            distinguish between different users of your app. This allows your
            app to identify specific users in case of abuse reports, preventing
            your entire app from being affected by the actions of individual
            users. Maximum of 128 characters.
        session_id:
          type: string
          description: >-
            A unique identifier for grouping related requests (e.g., a
            conversation or agent workflow) for observability. If provided in
            both the request body and the x-session-id header, the body value
            takes precedence. Maximum of 128 characters.
        trace:
          $ref: "#/components/schemas/AnthropicMessagesRequestTrace"
          description: >-
            Metadata for observability and tracing. Known keys (trace_id,
            trace_name, span_name, generation_name, parent_span_id) have special
            handling. Additional keys are passed through as custom metadata to
            configured broadcast destinations.
        models:
          type: array
          items:
            type: string
      required:
        - model
        - messages
      description: Request schema for Anthropic Messages API endpoint
      title: AnthropicMessagesRequest
    BaseAnthropicMessagesResponseType:
      type: string
      enum:
        - message
      title: BaseAnthropicMessagesResponseType
    BaseAnthropicMessagesResponseRole:
      type: string
      enum:
        - assistant
      title: BaseAnthropicMessagesResponseRole
    BaseAnthropicMessagesResponseContainer:
      type: object
      properties:
        id:
          type: string
        expires_at:
          type: string
      required:
        - id
        - expires_at
      title: BaseAnthropicMessagesResponseContainer
    BaseAnthropicMessagesResponseContentItemsOneOf0Type:
      type: string
      enum:
        - text
      title: BaseAnthropicMessagesResponseContentItemsOneOf0Type
    BaseAnthropicMessagesResponseContentItemsOneOf0CitationsItemsOneOf0Type:
      type: string
      enum:
        - char_location
      title: BaseAnthropicMessagesResponseContentItemsOneOf0CitationsItemsOneOf0Type
    BaseAnthropicMessagesResponseContentItemsOneOf0CitationsItems0:
      type: object
      properties:
        type:
          $ref: >-
            #/components/schemas/BaseAnthropicMessagesResponseContentItemsOneOf0CitationsItemsOneOf0Type
        cited_text:
          type: string
        document_index:
          type: number
          format: double
        document_title:
          type:
            - string
            - "null"
        start_char_index:
          type: number
          format: double
        end_char_index:
          type: number
          format: double
        file_id:
          type:
            - string
            - "null"
      required:
        - type
        - cited_text
        - document_index
        - document_title
        - start_char_index
        - end_char_index
        - file_id
      title: BaseAnthropicMessagesResponseContentItemsOneOf0CitationsItems0
    BaseAnthropicMessagesResponseContentItemsOneOf0CitationsItemsOneOf1Type:
      type: string
      enum:
        - page_location
      title: BaseAnthropicMessagesResponseContentItemsOneOf0CitationsItemsOneOf1Type
    BaseAnthropicMessagesResponseContentItemsOneOf0CitationsItems1:
      type: object
      properties:
        type:
          $ref: >-
            #/components/schemas/BaseAnthropicMessagesResponseContentItemsOneOf0CitationsItemsOneOf1Type
        cited_text:
          type: string
        document_index:
          type: number
          format: double
        document_title:
          type:
            - string
            - "null"
        start_page_number:
          type: number
          format: double
        end_page_number:
          type: number
          format: double
        file_id:
          type:
            - string
            - "null"
      required:
        - type
        - cited_text
        - document_index
        - document_title
        - start_page_number
        - end_page_number
        - file_id
      title: BaseAnthropicMessagesResponseContentItemsOneOf0CitationsItems1
    BaseAnthropicMessagesResponseContentItemsOneOf0CitationsItemsOneOf2Type:
      type: string
      enum:
        - content_block_location
      title: BaseAnthropicMessagesResponseContentItemsOneOf0CitationsItemsOneOf2Type
    BaseAnthropicMessagesResponseContentItemsOneOf0CitationsItems2:
      type: object
      properties:
        type:
          $ref: >-
            #/components/schemas/BaseAnthropicMessagesResponseContentItemsOneOf0CitationsItemsOneOf2Type
        cited_text:
          type: string
        document_index:
          type: number
          format: double
        document_title:
          type:
            - string
            - "null"
        start_block_index:
          type: number
          format: double
        end_block_index:
          type: number
          format: double
        file_id:
          type:
            - string
            - "null"
      required:
        - type
        - cited_text
        - document_index
        - document_title
        - start_block_index
        - end_block_index
        - file_id
      title: BaseAnthropicMessagesResponseContentItemsOneOf0CitationsItems2
    BaseAnthropicMessagesResponseContentItemsOneOf0CitationsItemsOneOf3Type:
      type: string
      enum:
        - web_search_result_location
      title: BaseAnthropicMessagesResponseContentItemsOneOf0CitationsItemsOneOf3Type
    BaseAnthropicMessagesResponseContentItemsOneOf0CitationsItems3:
      type: object
      properties:
        type:
          $ref: >-
            #/components/schemas/BaseAnthropicMessagesResponseContentItemsOneOf0CitationsItemsOneOf3Type
        cited_text:
          type: string
        encrypted_index:
          type: string
        title:
          type:
            - string
            - "null"
        url:
          type: string
      required:
        - type
        - cited_text
        - encrypted_index
        - title
        - url
      title: BaseAnthropicMessagesResponseContentItemsOneOf0CitationsItems3
    BaseAnthropicMessagesResponseContentItemsOneOf0CitationsItemsOneOf4Type:
      type: string
      enum:
        - search_result_location
      title: BaseAnthropicMessagesResponseContentItemsOneOf0CitationsItemsOneOf4Type
    BaseAnthropicMessagesResponseContentItemsOneOf0CitationsItems4:
      type: object
      properties:
        type:
          $ref: >-
            #/components/schemas/BaseAnthropicMessagesResponseContentItemsOneOf0CitationsItemsOneOf4Type
        cited_text:
          type: string
        search_result_index:
          type: number
          format: double
        source:
          type: string
        title:
          type:
            - string
            - "null"
        start_block_index:
          type: number
          format: double
        end_block_index:
          type: number
          format: double
      required:
        - type
        - cited_text
        - search_result_index
        - source
        - title
        - start_block_index
        - end_block_index
      title: BaseAnthropicMessagesResponseContentItemsOneOf0CitationsItems4
    BaseAnthropicMessagesResponseContentItemsOneOf0CitationsItems:
      oneOf:
        - $ref: >-
            #/components/schemas/BaseAnthropicMessagesResponseContentItemsOneOf0CitationsItems0
        - $ref: >-
            #/components/schemas/BaseAnthropicMessagesResponseContentItemsOneOf0CitationsItems1
        - $ref: >-
            #/components/schemas/BaseAnthropicMessagesResponseContentItemsOneOf0CitationsItems2
        - $ref: >-
            #/components/schemas/BaseAnthropicMessagesResponseContentItemsOneOf0CitationsItems3
        - $ref: >-
            #/components/schemas/BaseAnthropicMessagesResponseContentItemsOneOf0CitationsItems4
      title: BaseAnthropicMessagesResponseContentItemsOneOf0CitationsItems
    BaseAnthropicMessagesResponseContentItems0:
      type: object
      properties:
        type:
          $ref: >-
            #/components/schemas/BaseAnthropicMessagesResponseContentItemsOneOf0Type
        text:
          type: string
        citations:
          type:
            - array
            - "null"
          items:
            $ref: >-
              #/components/schemas/BaseAnthropicMessagesResponseContentItemsOneOf0CitationsItems
      required:
        - type
        - text
        - citations
      title: BaseAnthropicMessagesResponseContentItems0
    BaseAnthropicMessagesResponseContentItemsOneOf1Type:
      type: string
      enum:
        - tool_use
      title: BaseAnthropicMessagesResponseContentItemsOneOf1Type
    BaseAnthropicMessagesResponseContentItemsOneOf1CallerOneOf0Type:
      type: string
      enum:
        - direct
      title: BaseAnthropicMessagesResponseContentItemsOneOf1CallerOneOf0Type
    BaseAnthropicMessagesResponseContentItemsOneOf1Caller0:
      type: object
      properties:
        type:
          $ref: >-
            #/components/schemas/BaseAnthropicMessagesResponseContentItemsOneOf1CallerOneOf0Type
      required:
        - type
      title: BaseAnthropicMessagesResponseContentItemsOneOf1Caller0
    BaseAnthropicMessagesResponseContentItemsOneOf1CallerOneOf1Type:
      type: string
      enum:
        - code_execution_20250825
      title: BaseAnthropicMessagesResponseContentItemsOneOf1CallerOneOf1Type
    BaseAnthropicMessagesResponseContentItemsOneOf1Caller1:
      type: object
      properties:
        type:
          $ref: >-
            #/components/schemas/BaseAnthropicMessagesResponseContentItemsOneOf1CallerOneOf1Type
        tool_id:
          type: string
      required:
        - type
        - tool_id
      title: BaseAnthropicMessagesResponseContentItemsOneOf1Caller1
    BaseAnthropicMessagesResponseContentItemsOneOf1CallerOneOf2Type:
      type: string
      enum:
        - code_execution_20260120
      title: BaseAnthropicMessagesResponseContentItemsOneOf1CallerOneOf2Type
    BaseAnthropicMessagesResponseContentItemsOneOf1Caller2:
      type: object
      properties:
        type:
          $ref: >-
            #/components/schemas/BaseAnthropicMessagesResponseContentItemsOneOf1CallerOneOf2Type
        tool_id:
          type: string
      required:
        - type
        - tool_id
      title: BaseAnthropicMessagesResponseContentItemsOneOf1Caller2
    BaseAnthropicMessagesResponseContentItemsOneOf1Caller:
      oneOf:
        - $ref: >-
            #/components/schemas/BaseAnthropicMessagesResponseContentItemsOneOf1Caller0
        - $ref: >-
            #/components/schemas/BaseAnthropicMessagesResponseContentItemsOneOf1Caller1
        - $ref: >-
            #/components/schemas/BaseAnthropicMessagesResponseContentItemsOneOf1Caller2
      title: BaseAnthropicMessagesResponseContentItemsOneOf1Caller
    BaseAnthropicMessagesResponseContentItems1:
      type: object
      properties:
        type:
          $ref: >-
            #/components/schemas/BaseAnthropicMessagesResponseContentItemsOneOf1Type
        id:
          type: string
        caller:
          $ref: >-
            #/components/schemas/BaseAnthropicMessagesResponseContentItemsOneOf1Caller
        name:
          type: string
        input:
          oneOf:
            - description: Any type
            - type: "null"
      required:
        - type
        - id
        - caller
        - name
      title: BaseAnthropicMessagesResponseContentItems1
    BaseAnthropicMessagesResponseContentItemsOneOf2Type:
      type: string
      enum:
        - thinking
      title: BaseAnthropicMessagesResponseContentItemsOneOf2Type
    BaseAnthropicMessagesResponseContentItems2:
      type: object
      properties:
        type:
          $ref: >-
            #/components/schemas/BaseAnthropicMessagesResponseContentItemsOneOf2Type
        thinking:
          type: string
        signature:
          type: string
      required:
        - type
        - thinking
        - signature
      title: BaseAnthropicMessagesResponseContentItems2
    BaseAnthropicMessagesResponseContentItemsOneOf3Type:
      type: string
      enum:
        - redacted_thinking
      title: BaseAnthropicMessagesResponseContentItemsOneOf3Type
    BaseAnthropicMessagesResponseContentItems3:
      type: object
      properties:
        type:
          $ref: >-
            #/components/schemas/BaseAnthropicMessagesResponseContentItemsOneOf3Type
        data:
          type: string
      required:
        - type
        - data
      title: BaseAnthropicMessagesResponseContentItems3
    BaseAnthropicMessagesResponseContentItemsOneOf4Type:
      type: string
      enum:
        - server_tool_use
      title: BaseAnthropicMessagesResponseContentItemsOneOf4Type
    BaseAnthropicMessagesResponseContentItemsOneOf4CallerOneOf0Type:
      type: string
      enum:
        - direct
      title: BaseAnthropicMessagesResponseContentItemsOneOf4CallerOneOf0Type
    BaseAnthropicMessagesResponseContentItemsOneOf4Caller0:
      type: object
      properties:
        type:
          $ref: >-
            #/components/schemas/BaseAnthropicMessagesResponseContentItemsOneOf4CallerOneOf0Type
      required:
        - type
      title: BaseAnthropicMessagesResponseContentItemsOneOf4Caller0
    BaseAnthropicMessagesResponseContentItemsOneOf4CallerOneOf1Type:
      type: string
      enum:
        - code_execution_20250825
      title: BaseAnthropicMessagesResponseContentItemsOneOf4CallerOneOf1Type
    BaseAnthropicMessagesResponseContentItemsOneOf4Caller1:
      type: object
      properties:
        type:
          $ref: >-
            #/components/schemas/BaseAnthropicMessagesResponseContentItemsOneOf4CallerOneOf1Type
        tool_id:
          type: string
      required:
        - type
        - tool_id
      title: BaseAnthropicMessagesResponseContentItemsOneOf4Caller1
    BaseAnthropicMessagesResponseContentItemsOneOf4CallerOneOf2Type:
      type: string
      enum:
        - code_execution_20260120
      title: BaseAnthropicMessagesResponseContentItemsOneOf4CallerOneOf2Type
    BaseAnthropicMessagesResponseContentItemsOneOf4Caller2:
      type: object
      properties:
        type:
          $ref: >-
            #/components/schemas/BaseAnthropicMessagesResponseContentItemsOneOf4CallerOneOf2Type
        tool_id:
          type: string
      required:
        - type
        - tool_id
      title: BaseAnthropicMessagesResponseContentItemsOneOf4Caller2
    BaseAnthropicMessagesResponseContentItemsOneOf4Caller:
      oneOf:
        - $ref: >-
            #/components/schemas/BaseAnthropicMessagesResponseContentItemsOneOf4Caller0
        - $ref: >-
            #/components/schemas/BaseAnthropicMessagesResponseContentItemsOneOf4Caller1
        - $ref: >-
            #/components/schemas/BaseAnthropicMessagesResponseContentItemsOneOf4Caller2
      title: BaseAnthropicMessagesResponseContentItemsOneOf4Caller
    BaseAnthropicMessagesResponseContentItemsOneOf4Name:
      type: string
      enum:
        - web_search
        - web_fetch
        - code_execution
        - bash_code_execution
        - text_editor_code_execution
        - tool_search_tool_regex
        - tool_search_tool_bm25
      title: BaseAnthropicMessagesResponseContentItemsOneOf4Name
    BaseAnthropicMessagesResponseContentItems4:
      type: object
      properties:
        type:
          $ref: >-
            #/components/schemas/BaseAnthropicMessagesResponseContentItemsOneOf4Type
        id:
          type: string
        caller:
          $ref: >-
            #/components/schemas/BaseAnthropicMessagesResponseContentItemsOneOf4Caller
        name:
          $ref: >-
            #/components/schemas/BaseAnthropicMessagesResponseContentItemsOneOf4Name
        input:
          oneOf:
            - description: Any type
            - type: "null"
      required:
        - type
        - id
        - caller
        - name
      title: BaseAnthropicMessagesResponseContentItems4
    BaseAnthropicMessagesResponseContentItemsOneOf5Type:
      type: string
      enum:
        - web_search_tool_result
      title: BaseAnthropicMessagesResponseContentItemsOneOf5Type
    BaseAnthropicMessagesResponseContentItemsOneOf5CallerOneOf0Type:
      type: string
      enum:
        - direct
      title: BaseAnthropicMessagesResponseContentItemsOneOf5CallerOneOf0Type
    BaseAnthropicMessagesResponseContentItemsOneOf5Caller0:
      type: object
      properties:
        type:
          $ref: >-
            #/components/schemas/BaseAnthropicMessagesResponseContentItemsOneOf5CallerOneOf0Type
      required:
        - type
      title: BaseAnthropicMessagesResponseContentItemsOneOf5Caller0
    BaseAnthropicMessagesResponseContentItemsOneOf5CallerOneOf1Type:
      type: string
      enum:
        - code_execution_20250825
      title: BaseAnthropicMessagesResponseContentItemsOneOf5CallerOneOf1Type
    BaseAnthropicMessagesResponseContentItemsOneOf5Caller1:
      type: object
      properties:
        type:
          $ref: >-
            #/components/schemas/BaseAnthropicMessagesResponseContentItemsOneOf5CallerOneOf1Type
        tool_id:
          type: string
      required:
        - type
        - tool_id
      title: BaseAnthropicMessagesResponseContentItemsOneOf5Caller1
    BaseAnthropicMessagesResponseContentItemsOneOf5CallerOneOf2Type:
      type: string
      enum:
        - code_execution_20260120
      title: BaseAnthropicMessagesResponseContentItemsOneOf5CallerOneOf2Type
    BaseAnthropicMessagesResponseContentItemsOneOf5Caller2:
      type: object
      properties:
        type:
          $ref: >-
            #/components/schemas/BaseAnthropicMessagesResponseContentItemsOneOf5CallerOneOf2Type
        tool_id:
          type: string
      required:
        - type
        - tool_id
      title: BaseAnthropicMessagesResponseContentItemsOneOf5Caller2
    BaseAnthropicMessagesResponseContentItemsOneOf5Caller:
      oneOf:
        - $ref: >-
            #/components/schemas/BaseAnthropicMessagesResponseContentItemsOneOf5Caller0
        - $ref: >-
            #/components/schemas/BaseAnthropicMessagesResponseContentItemsOneOf5Caller1
        - $ref: >-
            #/components/schemas/BaseAnthropicMessagesResponseContentItemsOneOf5Caller2
      title: BaseAnthropicMessagesResponseContentItemsOneOf5Caller
    BaseAnthropicMessagesResponseContentItemsOneOf5ContentOneOf0ItemsType:
      type: string
      enum:
        - web_search_result
      title: BaseAnthropicMessagesResponseContentItemsOneOf5ContentOneOf0ItemsType
    BaseAnthropicMessagesResponseContentItemsOneOf5ContentOneOf0Items:
      type: object
      properties:
        type:
          $ref: >-
            #/components/schemas/BaseAnthropicMessagesResponseContentItemsOneOf5ContentOneOf0ItemsType
        encrypted_content:
          type: string
        page_age:
          type:
            - string
            - "null"
        title:
          type: string
        url:
          type: string
      required:
        - type
        - encrypted_content
        - page_age
        - title
        - url
      title: BaseAnthropicMessagesResponseContentItemsOneOf5ContentOneOf0Items
    BaseAnthropicMessagesResponseContentItemsOneOf5Content0:
      type: array
      items:
        $ref: >-
          #/components/schemas/BaseAnthropicMessagesResponseContentItemsOneOf5ContentOneOf0Items
      title: BaseAnthropicMessagesResponseContentItemsOneOf5Content0
    BaseAnthropicMessagesResponseContentItemsOneOf5ContentOneOf1Type:
      type: string
      enum:
        - web_search_tool_result_error
      title: BaseAnthropicMessagesResponseContentItemsOneOf5ContentOneOf1Type
    BaseAnthropicMessagesResponseContentItemsOneOf5ContentOneOf1ErrorCode:
      type: string
      enum:
        - invalid_tool_input
        - unavailable
        - max_uses_exceeded
        - too_many_requests
        - query_too_long
        - request_too_large
      title: BaseAnthropicMessagesResponseContentItemsOneOf5ContentOneOf1ErrorCode
    BaseAnthropicMessagesResponseContentItemsOneOf5Content1:
      type: object
      properties:
        type:
          $ref: >-
            #/components/schemas/BaseAnthropicMessagesResponseContentItemsOneOf5ContentOneOf1Type
        error_code:
          $ref: >-
            #/components/schemas/BaseAnthropicMessagesResponseContentItemsOneOf5ContentOneOf1ErrorCode
      required:
        - type
        - error_code
      title: BaseAnthropicMessagesResponseContentItemsOneOf5Content1
    BaseAnthropicMessagesResponseContentItemsOneOf5Content:
      oneOf:
        - $ref: >-
            #/components/schemas/BaseAnthropicMessagesResponseContentItemsOneOf5Content0
        - $ref: >-
            #/components/schemas/BaseAnthropicMessagesResponseContentItemsOneOf5Content1
      title: BaseAnthropicMessagesResponseContentItemsOneOf5Content
    BaseAnthropicMessagesResponseContentItems5:
      type: object
      properties:
        type:
          $ref: >-
            #/components/schemas/BaseAnthropicMessagesResponseContentItemsOneOf5Type
        caller:
          $ref: >-
            #/components/schemas/BaseAnthropicMessagesResponseContentItemsOneOf5Caller
        tool_use_id:
          type: string
        content:
          $ref: >-
            #/components/schemas/BaseAnthropicMessagesResponseContentItemsOneOf5Content
      required:
        - type
        - caller
        - tool_use_id
        - content
      title: BaseAnthropicMessagesResponseContentItems5
    BaseAnthropicMessagesResponseContentItemsOneOf6Type:
      type: string
      enum:
        - web_fetch_tool_result
      title: BaseAnthropicMessagesResponseContentItemsOneOf6Type
    BaseAnthropicMessagesResponseContentItemsOneOf6CallerOneOf0Type:
      type: string
      enum:
        - direct
      title: BaseAnthropicMessagesResponseContentItemsOneOf6CallerOneOf0Type
    BaseAnthropicMessagesResponseContentItemsOneOf6Caller0:
      type: object
      properties:
        type:
          $ref: >-
            #/components/schemas/BaseAnthropicMessagesResponseContentItemsOneOf6CallerOneOf0Type
      required:
        - type
      title: BaseAnthropicMessagesResponseContentItemsOneOf6Caller0
    BaseAnthropicMessagesResponseContentItemsOneOf6CallerOneOf1Type:
      type: string
      enum:
        - code_execution_20250825
      title: BaseAnthropicMessagesResponseContentItemsOneOf6CallerOneOf1Type
    BaseAnthropicMessagesResponseContentItemsOneOf6Caller1:
      type: object
      properties:
        type:
          $ref: >-
            #/components/schemas/BaseAnthropicMessagesResponseContentItemsOneOf6CallerOneOf1Type
        tool_id:
          type: string
      required:
        - type
        - tool_id
      title: BaseAnthropicMessagesResponseContentItemsOneOf6Caller1
    BaseAnthropicMessagesResponseContentItemsOneOf6CallerOneOf2Type:
      type: string
      enum:
        - code_execution_20260120
      title: BaseAnthropicMessagesResponseContentItemsOneOf6CallerOneOf2Type
    BaseAnthropicMessagesResponseContentItemsOneOf6Caller2:
      type: object
      properties:
        type:
          $ref: >-
            #/components/schemas/BaseAnthropicMessagesResponseContentItemsOneOf6CallerOneOf2Type
        tool_id:
          type: string
      required:
        - type
        - tool_id
      title: BaseAnthropicMessagesResponseContentItemsOneOf6Caller2
    BaseAnthropicMessagesResponseContentItemsOneOf6Caller:
      oneOf:
        - $ref: >-
            #/components/schemas/BaseAnthropicMessagesResponseContentItemsOneOf6Caller0
        - $ref: >-
            #/components/schemas/BaseAnthropicMessagesResponseContentItemsOneOf6Caller1
        - $ref: >-
            #/components/schemas/BaseAnthropicMessagesResponseContentItemsOneOf6Caller2
      title: BaseAnthropicMessagesResponseContentItemsOneOf6Caller
    BaseAnthropicMessagesResponseContentItemsOneOf6ContentOneOf0Type:
      type: string
      enum:
        - web_fetch_tool_result_error
      title: BaseAnthropicMessagesResponseContentItemsOneOf6ContentOneOf0Type
    BaseAnthropicMessagesResponseContentItemsOneOf6ContentOneOf0ErrorCode:
      type: string
      enum:
        - invalid_tool_input
        - url_too_long
        - url_not_allowed
        - url_not_accessible
        - unsupported_content_type
        - too_many_requests
        - max_uses_exceeded
        - unavailable
      title: BaseAnthropicMessagesResponseContentItemsOneOf6ContentOneOf0ErrorCode
    BaseAnthropicMessagesResponseContentItemsOneOf6Content0:
      type: object
      properties:
        type:
          $ref: >-
            #/components/schemas/BaseAnthropicMessagesResponseContentItemsOneOf6ContentOneOf0Type
        error_code:
          $ref: >-
            #/components/schemas/BaseAnthropicMessagesResponseContentItemsOneOf6ContentOneOf0ErrorCode
      required:
        - type
        - error_code
      title: BaseAnthropicMessagesResponseContentItemsOneOf6Content0
    BaseAnthropicMessagesResponseContentItemsOneOf6ContentOneOf1ContentCitations:
      type: object
      properties:
        enabled:
          type: boolean
      required:
        - enabled
      title: >-
        BaseAnthropicMessagesResponseContentItemsOneOf6ContentOneOf1ContentCitations
    BaseAnthropicMessagesResponseContentItemsOneOf6ContentOneOf1ContentSourceOneOf0MediaType:
      type: string
      enum:
        - application/pdf
      title: >-
        BaseAnthropicMessagesResponseContentItemsOneOf6ContentOneOf1ContentSourceOneOf0MediaType
    BaseAnthropicMessagesResponseContentItemsOneOf6ContentOneOf1ContentSourceOneOf0Type:
      type: string
      enum:
        - base64
      title: >-
        BaseAnthropicMessagesResponseContentItemsOneOf6ContentOneOf1ContentSourceOneOf0Type
    BaseAnthropicMessagesResponseContentItemsOneOf6ContentOneOf1ContentSource0:
      type: object
      properties:
        data:
          type: string
        media_type:
          $ref: >-
            #/components/schemas/BaseAnthropicMessagesResponseContentItemsOneOf6ContentOneOf1ContentSourceOneOf0MediaType
        type:
          $ref: >-
            #/components/schemas/BaseAnthropicMessagesResponseContentItemsOneOf6ContentOneOf1ContentSourceOneOf0Type
      required:
        - data
        - media_type
        - type
      title: >-
        BaseAnthropicMessagesResponseContentItemsOneOf6ContentOneOf1ContentSource0
    BaseAnthropicMessagesResponseContentItemsOneOf6ContentOneOf1ContentSourceOneOf1MediaType:
      type: string
      enum:
        - text/plain
      title: >-
        BaseAnthropicMessagesResponseContentItemsOneOf6ContentOneOf1ContentSourceOneOf1MediaType
    BaseAnthropicMessagesResponseContentItemsOneOf6ContentOneOf1ContentSourceOneOf1Type:
      type: string
      enum:
        - text
      title: >-
        BaseAnthropicMessagesResponseContentItemsOneOf6ContentOneOf1ContentSourceOneOf1Type
    BaseAnthropicMessagesResponseContentItemsOneOf6ContentOneOf1ContentSource1:
      type: object
      properties:
        data:
          type: string
        media_type:
          $ref: >-
            #/components/schemas/BaseAnthropicMessagesResponseContentItemsOneOf6ContentOneOf1ContentSourceOneOf1MediaType
        type:
          $ref: >-
            #/components/schemas/BaseAnthropicMessagesResponseContentItemsOneOf6ContentOneOf1ContentSourceOneOf1Type
      required:
        - data
        - media_type
        - type
      title: >-
        BaseAnthropicMessagesResponseContentItemsOneOf6ContentOneOf1ContentSource1
    BaseAnthropicMessagesResponseContentItemsOneOf6ContentOneOf1ContentSource:
      oneOf:
        - $ref: >-
            #/components/schemas/BaseAnthropicMessagesResponseContentItemsOneOf6ContentOneOf1ContentSource0
        - $ref: >-
            #/components/schemas/BaseAnthropicMessagesResponseContentItemsOneOf6ContentOneOf1ContentSource1
      title: >-
        BaseAnthropicMessagesResponseContentItemsOneOf6ContentOneOf1ContentSource
    BaseAnthropicMessagesResponseContentItemsOneOf6ContentOneOf1ContentType:
      type: string
      enum:
        - document
      title: BaseAnthropicMessagesResponseContentItemsOneOf6ContentOneOf1ContentType
    BaseAnthropicMessagesResponseContentItemsOneOf6ContentOneOf1Content:
      type: object
      properties:
        citations:
          oneOf:
            - $ref: >-
                #/components/schemas/BaseAnthropicMessagesResponseContentItemsOneOf6ContentOneOf1ContentCitations
            - type: "null"
        source:
          $ref: >-
            #/components/schemas/BaseAnthropicMessagesResponseContentItemsOneOf6ContentOneOf1ContentSource
        title:
          type:
            - string
            - "null"
        type:
          $ref: >-
            #/components/schemas/BaseAnthropicMessagesResponseContentItemsOneOf6ContentOneOf1ContentType
      required:
        - citations
        - source
        - title
        - type
      title: BaseAnthropicMessagesResponseContentItemsOneOf6ContentOneOf1Content
    BaseAnthropicMessagesResponseContentItemsOneOf6ContentOneOf1Type:
      type: string
      enum:
        - web_fetch_result
      title: BaseAnthropicMessagesResponseContentItemsOneOf6ContentOneOf1Type
    BaseAnthropicMessagesResponseContentItemsOneOf6Content1:
      type: object
      properties:
        content:
          $ref: >-
            #/components/schemas/BaseAnthropicMessagesResponseContentItemsOneOf6ContentOneOf1Content
        retrieved_at:
          type:
            - string
            - "null"
        type:
          $ref: >-
            #/components/schemas/BaseAnthropicMessagesResponseContentItemsOneOf6ContentOneOf1Type
        url:
          type: string
      required:
        - content
        - retrieved_at
        - type
        - url
      title: BaseAnthropicMessagesResponseContentItemsOneOf6Content1
    BaseAnthropicMessagesResponseContentItemsOneOf6Content:
      oneOf:
        - $ref: >-
            #/components/schemas/BaseAnthropicMessagesResponseContentItemsOneOf6Content0
        - $ref: >-
            #/components/schemas/BaseAnthropicMessagesResponseContentItemsOneOf6Content1
      title: BaseAnthropicMessagesResponseContentItemsOneOf6Content
    BaseAnthropicMessagesResponseContentItems6:
      type: object
      properties:
        type:
          $ref: >-
            #/components/schemas/BaseAnthropicMessagesResponseContentItemsOneOf6Type
        caller:
          $ref: >-
            #/components/schemas/BaseAnthropicMessagesResponseContentItemsOneOf6Caller
        content:
          $ref: >-
            #/components/schemas/BaseAnthropicMessagesResponseContentItemsOneOf6Content
        tool_use_id:
          type: string
      required:
        - type
        - caller
        - content
        - tool_use_id
      title: BaseAnthropicMessagesResponseContentItems6
    BaseAnthropicMessagesResponseContentItemsOneOf7Type:
      type: string
      enum:
        - code_execution_tool_result
      title: BaseAnthropicMessagesResponseContentItemsOneOf7Type
    BaseAnthropicMessagesResponseContentItemsOneOf7ContentOneOf0ErrorCode:
      type: string
      enum:
        - invalid_tool_input
        - unavailable
        - too_many_requests
        - execution_time_exceeded
      title: BaseAnthropicMessagesResponseContentItemsOneOf7ContentOneOf0ErrorCode
    BaseAnthropicMessagesResponseContentItemsOneOf7ContentOneOf0Type:
      type: string
      enum:
        - code_execution_tool_result_error
      title: BaseAnthropicMessagesResponseContentItemsOneOf7ContentOneOf0Type
    BaseAnthropicMessagesResponseContentItemsOneOf7Content0:
      type: object
      properties:
        error_code:
          $ref: >-
            #/components/schemas/BaseAnthropicMessagesResponseContentItemsOneOf7ContentOneOf0ErrorCode
        type:
          $ref: >-
            #/components/schemas/BaseAnthropicMessagesResponseContentItemsOneOf7ContentOneOf0Type
      required:
        - error_code
        - type
      title: BaseAnthropicMessagesResponseContentItemsOneOf7Content0
    BaseAnthropicMessagesResponseContentItemsOneOf7ContentOneOf1ContentItemsType:
      type: string
      enum:
        - code_execution_output
      title: >-
        BaseAnthropicMessagesResponseContentItemsOneOf7ContentOneOf1ContentItemsType
    BaseAnthropicMessagesResponseContentItemsOneOf7ContentOneOf1ContentItems:
      type: object
      properties:
        file_id:
          type: string
        type:
          $ref: >-
            #/components/schemas/BaseAnthropicMessagesResponseContentItemsOneOf7ContentOneOf1ContentItemsType
      required:
        - file_id
        - type
      title: BaseAnthropicMessagesResponseContentItemsOneOf7ContentOneOf1ContentItems
    BaseAnthropicMessagesResponseContentItemsOneOf7ContentOneOf1Type:
      type: string
      enum:
        - code_execution_result
      title: BaseAnthropicMessagesResponseContentItemsOneOf7ContentOneOf1Type
    BaseAnthropicMessagesResponseContentItemsOneOf7Content1:
      type: object
      properties:
        content:
          type: array
          items:
            $ref: >-
              #/components/schemas/BaseAnthropicMessagesResponseContentItemsOneOf7ContentOneOf1ContentItems
        return_code:
          type: number
          format: double
        stderr:
          type: string
        stdout:
          type: string
        type:
          $ref: >-
            #/components/schemas/BaseAnthropicMessagesResponseContentItemsOneOf7ContentOneOf1Type
      required:
        - content
        - return_code
        - stderr
        - stdout
        - type
      title: BaseAnthropicMessagesResponseContentItemsOneOf7Content1
    BaseAnthropicMessagesResponseContentItemsOneOf7ContentOneOf2ContentItemsType:
      type: string
      enum:
        - code_execution_output
      title: >-
        BaseAnthropicMessagesResponseContentItemsOneOf7ContentOneOf2ContentItemsType
    BaseAnthropicMessagesResponseContentItemsOneOf7ContentOneOf2ContentItems:
      type: object
      properties:
        file_id:
          type: string
        type:
          $ref: >-
            #/components/schemas/BaseAnthropicMessagesResponseContentItemsOneOf7ContentOneOf2ContentItemsType
      required:
        - file_id
        - type
      title: BaseAnthropicMessagesResponseContentItemsOneOf7ContentOneOf2ContentItems
    BaseAnthropicMessagesResponseContentItemsOneOf7ContentOneOf2Type:
      type: string
      enum:
        - encrypted_code_execution_result
      title: BaseAnthropicMessagesResponseContentItemsOneOf7ContentOneOf2Type
    BaseAnthropicMessagesResponseContentItemsOneOf7Content2:
      type: object
      properties:
        content:
          type: array
          items:
            $ref: >-
              #/components/schemas/BaseAnthropicMessagesResponseContentItemsOneOf7ContentOneOf2ContentItems
        encrypted_stdout:
          type: string
        return_code:
          type: number
          format: double
        stderr:
          type: string
        type:
          $ref: >-
            #/components/schemas/BaseAnthropicMessagesResponseContentItemsOneOf7ContentOneOf2Type
      required:
        - content
        - encrypted_stdout
        - return_code
        - stderr
        - type
      title: BaseAnthropicMessagesResponseContentItemsOneOf7Content2
    BaseAnthropicMessagesResponseContentItemsOneOf7Content:
      oneOf:
        - $ref: >-
            #/components/schemas/BaseAnthropicMessagesResponseContentItemsOneOf7Content0
        - $ref: >-
            #/components/schemas/BaseAnthropicMessagesResponseContentItemsOneOf7Content1
        - $ref: >-
            #/components/schemas/BaseAnthropicMessagesResponseContentItemsOneOf7Content2
      title: BaseAnthropicMessagesResponseContentItemsOneOf7Content
    BaseAnthropicMessagesResponseContentItems7:
      type: object
      properties:
        type:
          $ref: >-
            #/components/schemas/BaseAnthropicMessagesResponseContentItemsOneOf7Type
        content:
          $ref: >-
            #/components/schemas/BaseAnthropicMessagesResponseContentItemsOneOf7Content
        tool_use_id:
          type: string
      required:
        - type
        - content
        - tool_use_id
      title: BaseAnthropicMessagesResponseContentItems7
    BaseAnthropicMessagesResponseContentItemsOneOf8Type:
      type: string
      enum:
        - bash_code_execution_tool_result
      title: BaseAnthropicMessagesResponseContentItemsOneOf8Type
    BaseAnthropicMessagesResponseContentItemsOneOf8ContentOneOf0ErrorCode:
      type: string
      enum:
        - invalid_tool_input
        - unavailable
        - too_many_requests
        - execution_time_exceeded
        - output_file_too_large
      title: BaseAnthropicMessagesResponseContentItemsOneOf8ContentOneOf0ErrorCode
    BaseAnthropicMessagesResponseContentItemsOneOf8ContentOneOf0Type:
      type: string
      enum:
        - bash_code_execution_tool_result_error
      title: BaseAnthropicMessagesResponseContentItemsOneOf8ContentOneOf0Type
    BaseAnthropicMessagesResponseContentItemsOneOf8Content0:
      type: object
      properties:
        error_code:
          $ref: >-
            #/components/schemas/BaseAnthropicMessagesResponseContentItemsOneOf8ContentOneOf0ErrorCode
        type:
          $ref: >-
            #/components/schemas/BaseAnthropicMessagesResponseContentItemsOneOf8ContentOneOf0Type
      required:
        - error_code
        - type
      title: BaseAnthropicMessagesResponseContentItemsOneOf8Content0
    BaseAnthropicMessagesResponseContentItemsOneOf8ContentOneOf1ContentItemsType:
      type: string
      enum:
        - bash_code_execution_output
      title: >-
        BaseAnthropicMessagesResponseContentItemsOneOf8ContentOneOf1ContentItemsType
    BaseAnthropicMessagesResponseContentItemsOneOf8ContentOneOf1ContentItems:
      type: object
      properties:
        file_id:
          type: string
        type:
          $ref: >-
            #/components/schemas/BaseAnthropicMessagesResponseContentItemsOneOf8ContentOneOf1ContentItemsType
      required:
        - file_id
        - type
      title: BaseAnthropicMessagesResponseContentItemsOneOf8ContentOneOf1ContentItems
    BaseAnthropicMessagesResponseContentItemsOneOf8ContentOneOf1Type:
      type: string
      enum:
        - bash_code_execution_result
      title: BaseAnthropicMessagesResponseContentItemsOneOf8ContentOneOf1Type
    BaseAnthropicMessagesResponseContentItemsOneOf8Content1:
      type: object
      properties:
        content:
          type: array
          items:
            $ref: >-
              #/components/schemas/BaseAnthropicMessagesResponseContentItemsOneOf8ContentOneOf1ContentItems
        return_code:
          type: number
          format: double
        stderr:
          type: string
        stdout:
          type: string
        type:
          $ref: >-
            #/components/schemas/BaseAnthropicMessagesResponseContentItemsOneOf8ContentOneOf1Type
      required:
        - content
        - return_code
        - stderr
        - stdout
        - type
      title: BaseAnthropicMessagesResponseContentItemsOneOf8Content1
    BaseAnthropicMessagesResponseContentItemsOneOf8Content:
      oneOf:
        - $ref: >-
            #/components/schemas/BaseAnthropicMessagesResponseContentItemsOneOf8Content0
        - $ref: >-
            #/components/schemas/BaseAnthropicMessagesResponseContentItemsOneOf8Content1
      title: BaseAnthropicMessagesResponseContentItemsOneOf8Content
    BaseAnthropicMessagesResponseContentItems8:
      type: object
      properties:
        type:
          $ref: >-
            #/components/schemas/BaseAnthropicMessagesResponseContentItemsOneOf8Type
        content:
          $ref: >-
            #/components/schemas/BaseAnthropicMessagesResponseContentItemsOneOf8Content
        tool_use_id:
          type: string
      required:
        - type
        - content
        - tool_use_id
      title: BaseAnthropicMessagesResponseContentItems8
    BaseAnthropicMessagesResponseContentItemsOneOf9Type:
      type: string
      enum:
        - text_editor_code_execution_tool_result
      title: BaseAnthropicMessagesResponseContentItemsOneOf9Type
    BaseAnthropicMessagesResponseContentItemsOneOf9ContentOneOf0ErrorCode:
      type: string
      enum:
        - invalid_tool_input
        - unavailable
        - too_many_requests
        - execution_time_exceeded
        - file_not_found
      title: BaseAnthropicMessagesResponseContentItemsOneOf9ContentOneOf0ErrorCode
    BaseAnthropicMessagesResponseContentItemsOneOf9ContentOneOf0Type:
      type: string
      enum:
        - text_editor_code_execution_tool_result_error
      title: BaseAnthropicMessagesResponseContentItemsOneOf9ContentOneOf0Type
    BaseAnthropicMessagesResponseContentItemsOneOf9Content0:
      type: object
      properties:
        error_code:
          $ref: >-
            #/components/schemas/BaseAnthropicMessagesResponseContentItemsOneOf9ContentOneOf0ErrorCode
        error_message:
          type:
            - string
            - "null"
        type:
          $ref: >-
            #/components/schemas/BaseAnthropicMessagesResponseContentItemsOneOf9ContentOneOf0Type
      required:
        - error_code
        - error_message
        - type
      title: BaseAnthropicMessagesResponseContentItemsOneOf9Content0
    BaseAnthropicMessagesResponseContentItemsOneOf9ContentOneOf1FileType:
      type: string
      enum:
        - text
        - image
        - pdf
      title: BaseAnthropicMessagesResponseContentItemsOneOf9ContentOneOf1FileType
    BaseAnthropicMessagesResponseContentItemsOneOf9ContentOneOf1Type:
      type: string
      enum:
        - text_editor_code_execution_view_result
      title: BaseAnthropicMessagesResponseContentItemsOneOf9ContentOneOf1Type
    BaseAnthropicMessagesResponseContentItemsOneOf9Content1:
      type: object
      properties:
        content:
          type: string
        file_type:
          $ref: >-
            #/components/schemas/BaseAnthropicMessagesResponseContentItemsOneOf9ContentOneOf1FileType
        num_lines:
          type:
            - number
            - "null"
          format: double
        start_line:
          type:
            - number
            - "null"
          format: double
        total_lines:
          type:
            - number
            - "null"
          format: double
        type:
          $ref: >-
            #/components/schemas/BaseAnthropicMessagesResponseContentItemsOneOf9ContentOneOf1Type
      required:
        - content
        - file_type
        - num_lines
        - start_line
        - total_lines
        - type
      title: BaseAnthropicMessagesResponseContentItemsOneOf9Content1
    BaseAnthropicMessagesResponseContentItemsOneOf9ContentOneOf2Type:
      type: string
      enum:
        - text_editor_code_execution_create_result
      title: BaseAnthropicMessagesResponseContentItemsOneOf9ContentOneOf2Type
    BaseAnthropicMessagesResponseContentItemsOneOf9Content2:
      type: object
      properties:
        is_file_update:
          type: boolean
        type:
          $ref: >-
            #/components/schemas/BaseAnthropicMessagesResponseContentItemsOneOf9ContentOneOf2Type
      required:
        - is_file_update
        - type
      title: BaseAnthropicMessagesResponseContentItemsOneOf9Content2
    BaseAnthropicMessagesResponseContentItemsOneOf9ContentOneOf3Type:
      type: string
      enum:
        - text_editor_code_execution_str_replace_result
      title: BaseAnthropicMessagesResponseContentItemsOneOf9ContentOneOf3Type
    BaseAnthropicMessagesResponseContentItemsOneOf9Content3:
      type: object
      properties:
        lines:
          type:
            - array
            - "null"
          items:
            type: string
        new_lines:
          type:
            - number
            - "null"
          format: double
        new_start:
          type:
            - number
            - "null"
          format: double
        old_lines:
          type:
            - number
            - "null"
          format: double
        old_start:
          type:
            - number
            - "null"
          format: double
        type:
          $ref: >-
            #/components/schemas/BaseAnthropicMessagesResponseContentItemsOneOf9ContentOneOf3Type
      required:
        - lines
        - new_lines
        - new_start
        - old_lines
        - old_start
        - type
      title: BaseAnthropicMessagesResponseContentItemsOneOf9Content3
    BaseAnthropicMessagesResponseContentItemsOneOf9Content:
      oneOf:
        - $ref: >-
            #/components/schemas/BaseAnthropicMessagesResponseContentItemsOneOf9Content0
        - $ref: >-
            #/components/schemas/BaseAnthropicMessagesResponseContentItemsOneOf9Content1
        - $ref: >-
            #/components/schemas/BaseAnthropicMessagesResponseContentItemsOneOf9Content2
        - $ref: >-
            #/components/schemas/BaseAnthropicMessagesResponseContentItemsOneOf9Content3
      title: BaseAnthropicMessagesResponseContentItemsOneOf9Content
    BaseAnthropicMessagesResponseContentItems9:
      type: object
      properties:
        type:
          $ref: >-
            #/components/schemas/BaseAnthropicMessagesResponseContentItemsOneOf9Type
        content:
          $ref: >-
            #/components/schemas/BaseAnthropicMessagesResponseContentItemsOneOf9Content
        tool_use_id:
          type: string
      required:
        - type
        - content
        - tool_use_id
      title: BaseAnthropicMessagesResponseContentItems9
    BaseAnthropicMessagesResponseContentItemsOneOf10Type:
      type: string
      enum:
        - tool_search_tool_result
      title: BaseAnthropicMessagesResponseContentItemsOneOf10Type
    BaseAnthropicMessagesResponseContentItemsOneOf10ContentOneOf0ErrorCode:
      type: string
      enum:
        - invalid_tool_input
        - unavailable
        - too_many_requests
        - execution_time_exceeded
      title: BaseAnthropicMessagesResponseContentItemsOneOf10ContentOneOf0ErrorCode
    BaseAnthropicMessagesResponseContentItemsOneOf10ContentOneOf0Type:
      type: string
      enum:
        - tool_search_tool_result_error
      title: BaseAnthropicMessagesResponseContentItemsOneOf10ContentOneOf0Type
    BaseAnthropicMessagesResponseContentItemsOneOf10Content0:
      type: object
      properties:
        error_code:
          $ref: >-
            #/components/schemas/BaseAnthropicMessagesResponseContentItemsOneOf10ContentOneOf0ErrorCode
        error_message:
          type:
            - string
            - "null"
        type:
          $ref: >-
            #/components/schemas/BaseAnthropicMessagesResponseContentItemsOneOf10ContentOneOf0Type
      required:
        - error_code
        - error_message
        - type
      title: BaseAnthropicMessagesResponseContentItemsOneOf10Content0
    BaseAnthropicMessagesResponseContentItemsOneOf10ContentOneOf1ToolReferencesItemsType:
      type: string
      enum:
        - tool_reference
      title: >-
        BaseAnthropicMessagesResponseContentItemsOneOf10ContentOneOf1ToolReferencesItemsType
    BaseAnthropicMessagesResponseContentItemsOneOf10ContentOneOf1ToolReferencesItems:
      type: object
      properties:
        tool_name:
          type: string
        type:
          $ref: >-
            #/components/schemas/BaseAnthropicMessagesResponseContentItemsOneOf10ContentOneOf1ToolReferencesItemsType
      required:
        - tool_name
        - type
      title: >-
        BaseAnthropicMessagesResponseContentItemsOneOf10ContentOneOf1ToolReferencesItems
    BaseAnthropicMessagesResponseContentItemsOneOf10ContentOneOf1Type:
      type: string
      enum:
        - tool_search_tool_search_result
      title: BaseAnthropicMessagesResponseContentItemsOneOf10ContentOneOf1Type
    BaseAnthropicMessagesResponseContentItemsOneOf10Content1:
      type: object
      properties:
        tool_references:
          type: array
          items:
            $ref: >-
              #/components/schemas/BaseAnthropicMessagesResponseContentItemsOneOf10ContentOneOf1ToolReferencesItems
        type:
          $ref: >-
            #/components/schemas/BaseAnthropicMessagesResponseContentItemsOneOf10ContentOneOf1Type
      required:
        - tool_references
        - type
      title: BaseAnthropicMessagesResponseContentItemsOneOf10Content1
    BaseAnthropicMessagesResponseContentItemsOneOf10Content:
      oneOf:
        - $ref: >-
            #/components/schemas/BaseAnthropicMessagesResponseContentItemsOneOf10Content0
        - $ref: >-
            #/components/schemas/BaseAnthropicMessagesResponseContentItemsOneOf10Content1
      title: BaseAnthropicMessagesResponseContentItemsOneOf10Content
    BaseAnthropicMessagesResponseContentItems10:
      type: object
      properties:
        type:
          $ref: >-
            #/components/schemas/BaseAnthropicMessagesResponseContentItemsOneOf10Type
        content:
          $ref: >-
            #/components/schemas/BaseAnthropicMessagesResponseContentItemsOneOf10Content
        tool_use_id:
          type: string
      required:
        - type
        - content
        - tool_use_id
      title: BaseAnthropicMessagesResponseContentItems10
    BaseAnthropicMessagesResponseContentItemsOneOf11Type:
      type: string
      enum:
        - container_upload
      title: BaseAnthropicMessagesResponseContentItemsOneOf11Type
    BaseAnthropicMessagesResponseContentItems11:
      type: object
      properties:
        type:
          $ref: >-
            #/components/schemas/BaseAnthropicMessagesResponseContentItemsOneOf11Type
        file_id:
          type: string
      required:
        - type
        - file_id
      title: BaseAnthropicMessagesResponseContentItems11
    BaseAnthropicMessagesResponseContentItems:
      oneOf:
        - $ref: "#/components/schemas/BaseAnthropicMessagesResponseContentItems0"
        - $ref: "#/components/schemas/BaseAnthropicMessagesResponseContentItems1"
        - $ref: "#/components/schemas/BaseAnthropicMessagesResponseContentItems2"
        - $ref: "#/components/schemas/BaseAnthropicMessagesResponseContentItems3"
        - $ref: "#/components/schemas/BaseAnthropicMessagesResponseContentItems4"
        - $ref: "#/components/schemas/BaseAnthropicMessagesResponseContentItems5"
        - $ref: "#/components/schemas/BaseAnthropicMessagesResponseContentItems6"
        - $ref: "#/components/schemas/BaseAnthropicMessagesResponseContentItems7"
        - $ref: "#/components/schemas/BaseAnthropicMessagesResponseContentItems8"
        - $ref: "#/components/schemas/BaseAnthropicMessagesResponseContentItems9"
        - $ref: "#/components/schemas/BaseAnthropicMessagesResponseContentItems10"
        - $ref: "#/components/schemas/BaseAnthropicMessagesResponseContentItems11"
      title: BaseAnthropicMessagesResponseContentItems
    BaseAnthropicMessagesResponseStopReason:
      type: string
      enum:
        - end_turn
        - max_tokens
        - stop_sequence
        - tool_use
        - pause_turn
        - refusal
      title: BaseAnthropicMessagesResponseStopReason
    BaseAnthropicMessagesResponseUsageCacheCreation:
      type: object
      properties:
        ephemeral_5m_input_tokens:
          type: number
          format: double
        ephemeral_1h_input_tokens:
          type: number
          format: double
      required:
        - ephemeral_5m_input_tokens
        - ephemeral_1h_input_tokens
      title: BaseAnthropicMessagesResponseUsageCacheCreation
    BaseAnthropicMessagesResponseUsageServerToolUse:
      type: object
      properties:
        web_search_requests:
          type: number
          format: double
        web_fetch_requests:
          type: number
          format: double
      required:
        - web_search_requests
        - web_fetch_requests
      title: BaseAnthropicMessagesResponseUsageServerToolUse
    BaseAnthropicMessagesResponseUsageServiceTier:
      type: string
      enum:
        - standard
        - priority
        - batch
      title: BaseAnthropicMessagesResponseUsageServiceTier
    BaseAnthropicMessagesResponseUsage:
      type: object
      properties:
        input_tokens:
          type: number
          format: double
        output_tokens:
          type: number
          format: double
        cache_creation_input_tokens:
          type:
            - number
            - "null"
          format: double
        cache_read_input_tokens:
          type:
            - number
            - "null"
          format: double
        cache_creation:
          oneOf:
            - $ref: >-
                #/components/schemas/BaseAnthropicMessagesResponseUsageCacheCreation
            - type: "null"
        inference_geo:
          type:
            - string
            - "null"
        server_tool_use:
          oneOf:
            - $ref: >-
                #/components/schemas/BaseAnthropicMessagesResponseUsageServerToolUse
            - type: "null"
        service_tier:
          oneOf:
            - $ref: >-
                #/components/schemas/BaseAnthropicMessagesResponseUsageServiceTier
            - type: "null"
      required:
        - input_tokens
        - output_tokens
        - cache_creation_input_tokens
        - cache_read_input_tokens
        - cache_creation
        - inference_geo
        - server_tool_use
        - service_tier
      title: BaseAnthropicMessagesResponseUsage
    AnthropicMessagesResponseProvider:
      type: string
      enum:
        - AnyScale
        - Atoma
        - Cent-ML
        - CrofAI
        - Enfer
        - GoPomelo
        - HuggingFace
        - Hyperbolic 2
        - InoCloud
        - Kluster
        - Lambda
        - Lepton
        - Lynn 2
        - Lynn
        - Mancer
        - Meta
        - Modal
        - Nineteen
        - OctoAI
        - Recursal
        - Reflection
        - Replicate
        - SambaNova 2
        - SF Compute
        - Targon
        - Together 2
        - Ubicloud
        - 01.AI
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
      title: AnthropicMessagesResponseProvider
    AnthropicMessagesResponse:
      type: object
      properties:
        id:
          type: string
        type:
          $ref: "#/components/schemas/BaseAnthropicMessagesResponseType"
        role:
          $ref: "#/components/schemas/BaseAnthropicMessagesResponseRole"
        container:
          oneOf:
            - $ref: "#/components/schemas/BaseAnthropicMessagesResponseContainer"
            - type: "null"
        content:
          type: array
          items:
            $ref: "#/components/schemas/BaseAnthropicMessagesResponseContentItems"
        model:
          type: string
        stop_reason:
          oneOf:
            - $ref: "#/components/schemas/BaseAnthropicMessagesResponseStopReason"
            - type: "null"
        stop_sequence:
          type:
            - string
            - "null"
        usage:
          $ref: "#/components/schemas/BaseAnthropicMessagesResponseUsage"
        provider:
          $ref: "#/components/schemas/AnthropicMessagesResponseProvider"
      required:
        - id
        - type
        - role
        - container
        - content
        - model
        - stop_reason
        - stop_sequence
        - usage
      description: >-
        Non-streaming response from the Anthropic Messages API with OpenRouter
        extensions
      title: AnthropicMessagesResponse
    MessagesPostResponsesContentApplicationJsonSchemaType:
      type: string
      enum:
        - error
      title: MessagesPostResponsesContentApplicationJsonSchemaType
    MessagesPostResponsesContentApplicationJsonSchemaError:
      type: object
      properties:
        type:
          type: string
        message:
          type: string
      required:
        - type
        - message
      title: MessagesPostResponsesContentApplicationJsonSchemaError
    CreateMessagesRequestBadRequestError:
      type: object
      properties:
        type:
          $ref: >-
            #/components/schemas/MessagesPostResponsesContentApplicationJsonSchemaType
        error:
          $ref: >-
            #/components/schemas/MessagesPostResponsesContentApplicationJsonSchemaError
      required:
        - type
        - error
      title: CreateMessagesRequestBadRequestError
    CreateMessagesRequestUnauthorizedError:
      type: object
      properties:
        type:
          $ref: >-
            #/components/schemas/MessagesPostResponsesContentApplicationJsonSchemaType
        error:
          $ref: >-
            #/components/schemas/MessagesPostResponsesContentApplicationJsonSchemaError
      required:
        - type
        - error
      title: CreateMessagesRequestUnauthorizedError
    CreateMessagesRequestForbiddenError:
      type: object
      properties:
        type:
          $ref: >-
            #/components/schemas/MessagesPostResponsesContentApplicationJsonSchemaType
        error:
          $ref: >-
            #/components/schemas/MessagesPostResponsesContentApplicationJsonSchemaError
      required:
        - type
        - error
      title: CreateMessagesRequestForbiddenError
    CreateMessagesRequestNotFoundError:
      type: object
      properties:
        type:
          $ref: >-
            #/components/schemas/MessagesPostResponsesContentApplicationJsonSchemaType
        error:
          $ref: >-
            #/components/schemas/MessagesPostResponsesContentApplicationJsonSchemaError
      required:
        - type
        - error
      title: CreateMessagesRequestNotFoundError
    CreateMessagesRequestTooManyRequestsError:
      type: object
      properties:
        type:
          $ref: >-
            #/components/schemas/MessagesPostResponsesContentApplicationJsonSchemaType
        error:
          $ref: >-
            #/components/schemas/MessagesPostResponsesContentApplicationJsonSchemaError
      required:
        - type
        - error
      title: CreateMessagesRequestTooManyRequestsError
    CreateMessagesRequestInternalServerError:
      type: object
      properties:
        type:
          $ref: >-
            #/components/schemas/MessagesPostResponsesContentApplicationJsonSchemaType
        error:
          $ref: >-
            #/components/schemas/MessagesPostResponsesContentApplicationJsonSchemaError
      required:
        - type
        - error
      title: CreateMessagesRequestInternalServerError
    CreateMessagesRequestServiceUnavailableError:
      type: object
      properties:
        type:
          $ref: >-
            #/components/schemas/MessagesPostResponsesContentApplicationJsonSchemaType
        error:
          $ref: >-
            #/components/schemas/MessagesPostResponsesContentApplicationJsonSchemaError
      required:
        - type
        - error
      title: CreateMessagesRequestServiceUnavailableError
  securitySchemes:
    apiKey:
      type: http
      scheme: bearer
      description: API key as bearer token in Authorization header
```

## SDK Code Examples

```python
import requests

url = "https://openrouter.ai/api/v1/messages"

payload = {
    "model": "anthropic/claude-4.5-sonnet-20250929",
    "messages": [
        {
            "role": "user",
            "content": "Hello, how are you?"
        }
    ],
    "max_tokens": 1024,
    "temperature": 0.7
}
headers = {
    "Authorization": "Bearer <token>",
    "Content-Type": "application/json"
}

response = requests.post(url, json=payload, headers=headers)

print(response.json())
```

```javascript
const url = "https://openrouter.ai/api/v1/messages";
const options = {
  method: "POST",
  headers: {
    Authorization: "Bearer <token>",
    "Content-Type": "application/json",
  },
  body: '{"model":"anthropic/claude-4.5-sonnet-20250929","messages":[{"role":"user","content":"Hello, how are you?"}],"max_tokens":1024,"temperature":0.7}',
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

	url := "https://openrouter.ai/api/v1/messages"

	payload := strings.NewReader("{\n  \"model\": \"anthropic/claude-4.5-sonnet-20250929\",\n  \"messages\": [\n    {\n      \"role\": \"user\",\n      \"content\": \"Hello, how are you?\"\n    }\n  ],\n  \"max_tokens\": 1024,\n  \"temperature\": 0.7\n}")

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

url = URI("https://openrouter.ai/api/v1/messages")

http = Net::HTTP.new(url.host, url.port)
http.use_ssl = true

request = Net::HTTP::Post.new(url)
request["Authorization"] = 'Bearer <token>'
request["Content-Type"] = 'application/json'
request.body = "{\n  \"model\": \"anthropic/claude-4.5-sonnet-20250929\",\n  \"messages\": [\n    {\n      \"role\": \"user\",\n      \"content\": \"Hello, how are you?\"\n    }\n  ],\n  \"max_tokens\": 1024,\n  \"temperature\": 0.7\n}"

response = http.request(request)
puts response.read_body
```

```java
import com.mashape.unirest.http.HttpResponse;
import com.mashape.unirest.http.Unirest;

HttpResponse<String> response = Unirest.post("https://openrouter.ai/api/v1/messages")
  .header("Authorization", "Bearer <token>")
  .header("Content-Type", "application/json")
  .body("{\n  \"model\": \"anthropic/claude-4.5-sonnet-20250929\",\n  \"messages\": [\n    {\n      \"role\": \"user\",\n      \"content\": \"Hello, how are you?\"\n    }\n  ],\n  \"max_tokens\": 1024,\n  \"temperature\": 0.7\n}")
  .asString();
```

```php
<?php
require_once('vendor/autoload.php');

$client = new \GuzzleHttp\Client();

$response = $client->request('POST', 'https://openrouter.ai/api/v1/messages', [
  'body' => '{
  "model": "anthropic/claude-4.5-sonnet-20250929",
  "messages": [
    {
      "role": "user",
      "content": "Hello, how are you?"
    }
  ],
  "max_tokens": 1024,
  "temperature": 0.7
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

var client = new RestClient("https://openrouter.ai/api/v1/messages");
var request = new RestRequest(Method.POST);
request.AddHeader("Authorization", "Bearer <token>");
request.AddHeader("Content-Type", "application/json");
request.AddParameter("application/json", "{\n  \"model\": \"anthropic/claude-4.5-sonnet-20250929\",\n  \"messages\": [\n    {\n      \"role\": \"user\",\n      \"content\": \"Hello, how are you?\"\n    }\n  ],\n  \"max_tokens\": 1024,\n  \"temperature\": 0.7\n}", ParameterType.RequestBody);
IRestResponse response = client.Execute(request);
```

```swift
import Foundation

let headers = [
  "Authorization": "Bearer <token>",
  "Content-Type": "application/json"
]
let parameters = [
  "model": "anthropic/claude-4.5-sonnet-20250929",
  "messages": [
    [
      "role": "user",
      "content": "Hello, how are you?"
    ]
  ],
  "max_tokens": 1024,
  "temperature": 0.7
] as [String : Any]

let postData = JSONSerialization.data(withJSONObject: parameters, options: [])

let request = NSMutableURLRequest(url: NSURL(string: "https://openrouter.ai/api/v1/messages")! as URL,
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
