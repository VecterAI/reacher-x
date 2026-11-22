> ## Documentation Index
>
> Fetch the complete documentation index at: https://developer.happenstance.ai/llms.txt
> Use this file to discover all available pages before exploring further.

# Get Usage

> Get credit balance, purchase history, usage history, and Auto Reload settings for the authenticated user.

## OpenAPI

````yaml /openapi.json get /v1/usage
openapi: 3.1.0
info:
  title: Happenstance API
  description: >

    The Happenstance API provides programmatic access to network search, person
    research and Happenstance Chat.


    ## Authentication


    All API endpoints require authentication using an API key. Include your API
    key in the `Authorization` header:


    ```

    Authorization: Bearer YOUR_API_KEY

    ```


    ## Error Responses


    All errors follow RFC 7807 Problem Details format with
    `application/problem+json` content type.


    Example error response:

    ```json

    {
      "type": "https://developer.happenstance.ai/errors/empty-field",
      "title": "Bad Request",
      "status": 400,
      "detail": "Description must not be empty",
      "instance": "/v1/research"
    }

    ```
  version: 0.1.0
servers:
  - url: https://api.happenstance.ai
    description: Production
security: []
paths:
  /v1/usage:
    get:
      summary: Get Usage
      description: >-
        Get credit balance, purchase history, usage history, and Auto Reload
        settings for the authenticated user.
      operationId: get_usage_v1_usage_get
      responses:
        "200":
          description: Successful Response
          headers:
            Link:
              description: >-
                RFC 8288 Web Linking header for HATEOAS. Contains URIs to
                related resources.
              schema:
                type: string
              example: </v1/research/abc123>; rel="self"
          content:
            application/json:
              schema:
                $ref: "#/components/schemas/GetUsageResponseV1"
        "400":
          description: Bad Request
          content:
            application/json:
              schema:
                $ref: "#/components/schemas/ProblemDetailV1"
        "401":
          description: Unauthorized
          content:
            application/json:
              schema:
                $ref: "#/components/schemas/ProblemDetailV1"
        "402":
          description: Payment Required
          content:
            application/json:
              schema:
                $ref: "#/components/schemas/ProblemDetailV1"
        "403":
          description: Forbidden
          content:
            application/json:
              schema:
                $ref: "#/components/schemas/ProblemDetailV1"
        "404":
          description: Not Found
          content:
            application/json:
              schema:
                $ref: "#/components/schemas/ProblemDetailV1"
        "410":
          description: Gone
          content:
            application/json:
              schema:
                $ref: "#/components/schemas/ProblemDetailV1"
        "422":
          description: Validation Error
          content:
            application/json:
              schema:
                $ref: "#/components/schemas/ProblemDetailV1"
        "500":
          description: Internal Server Error
          content:
            application/json:
              schema:
                $ref: "#/components/schemas/ProblemDetailV1"
        "503":
          description: Service Unavailable
          content:
            application/json:
              schema:
                $ref: "#/components/schemas/ProblemDetailV1"
      security:
        - HTTPBearer: []
components:
  schemas:
    GetUsageResponseV1:
      properties:
        balance_credits:
          type: number
          title: Balance Credits
          description: >-
            Current credit balance, to two decimal places (can be negative if
            credits consumed without sufficient balance)
        has_credits:
          type: boolean
          title: Has Credits
          description: Whether the user has credits available (balance > 0)
        purchases:
          items:
            $ref: "#/components/schemas/ApiPurchaseV1"
          type: array
          title: Purchases
          description: List of credit purchases, most recent first
        usage:
          items:
            $ref: "#/components/schemas/ApiUsageV1"
          type: array
          title: Usage
          description: >-
            List of credit usage records, most recent first. Limited to the 500
            most recent records.
        auto_reload:
          anyOf:
            - $ref: "#/components/schemas/AutoReloadSettingsV1"
            - type: "null"
          description: Auto Reload settings if configured
        top_up_url:
          type: string
          title: Top Up Url
          description: URL to purchase more credits
          default: https://happenstance.ai/integrations/keys
      additionalProperties: false
      type: object
      required:
        - balance_credits
        - has_credits
        - purchases
        - usage
      title: GetUsageResponseV1
      description: >-
        Response from GET /v1/usage - retrieving user's credit purchases and
        usage history.
    ProblemDetailV1:
      properties:
        type:
          type: string
          title: Type
          description: A URI reference that identifies the problem type
          default: >-
            https://developer.happenstance.ai/api-reference/introduction#error-response-format
        title:
          type: string
          title: Title
          description: A short, human-readable summary of the problem
        status:
          type: integer
          title: Status
          description: The HTTP status code
        detail:
          anyOf:
            - type: string
            - type: "null"
          title: Detail
          description: A human-readable explanation specific to this occurrence
        instance:
          anyOf:
            - type: string
            - type: "null"
          title: Instance
          description: >-
            A URI reference that identifies the specific occurrence of the
            problem
      additionalProperties: false
      type: object
      required:
        - title
        - status
      title: ProblemDetailV1
      description: RFC 7807 Problem Details for HTTP APIs
    ApiPurchaseV1:
      properties:
        id:
          type: string
          title: Id
          description: Unique identifier for the purchase
        credits:
          type: integer
          title: Credits
          description: Number of credits purchased
        purchased_at:
          type: string
          title: Purchased At
          description: When the purchase was made (ISO 8601 format)
      additionalProperties: false
      type: object
      required:
        - id
        - credits
        - purchased_at
      title: ApiPurchaseV1
      description: A credit purchase record
    ApiUsageV1:
      properties:
        id:
          type: string
          title: Id
          description: Unique identifier for the usage
        credit_used:
          type: number
          title: Credit Used
          description: Credits consumed, to two decimal places
        created_at:
          type: string
          title: Created At
          description: When the usage was recorded (ISO 8601 format)
        resource_id:
          anyOf:
            - type: string
            - type: "null"
          title: Resource Id
          description: >-
            ID of the resource that consumed the credits (search ID, research
            ID, or chat turn ID)
        resource_type:
          anyOf:
            - type: string
            - type: "null"
          title: Resource Type
          description: "Type of resource: 'search', 'research' or 'chat_turn'"
      additionalProperties: false
      type: object
      required:
        - id
        - credit_used
        - created_at
      title: ApiUsageV1
      description: A credit usage record
    AutoReloadSettingsV1:
      properties:
        enabled:
          type: boolean
          title: Enabled
          description: Whether Auto Reload is enabled
        threshold_credits:
          type: integer
          title: Threshold Credits
          description: Credits threshold that triggers Auto Reload
        reload_credit_amount:
          type: integer
          title: Reload Credit Amount
          description: Number of credits to purchase on Auto Reload
        last_reload_at:
          anyOf:
            - type: string
            - type: "null"
          title: Last Reload At
          description: Last Auto Reload timestamp (ISO 8601 format)
      additionalProperties: false
      type: object
      required:
        - enabled
        - threshold_credits
        - reload_credit_amount
      title: AutoReloadSettingsV1
      description: Auto Reload configuration
  securitySchemes:
    HTTPBearer:
      type: http
      scheme: bearer
````

This documentation is built and hosted on [Mintlify](https://mintlify.com), a developer documentation platform.
