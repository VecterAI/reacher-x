> ## Documentation Index
>
> Fetch the complete documentation index at: https://developer.happenstance.ai/llms.txt
> Use this file to discover all available pages before exploring further.

# List Chats

> The user's chats, most recently active first: the ones started through the API, which
> take messages, and the ones started in the Happenstance app, which can be read.

## OpenAPI

````yaml /openapi.json get /v1/chat
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
  /v1/chat:
    get:
      summary: List Chats
      description: >-
        The user's chats, most recently active first: the ones started through
        the API, which

        take messages, and the ones started in the Happenstance app, which can
        be read.
      operationId: list_chats_v1_chat_get
      parameters:
        - name: page
          in: query
          required: false
          schema:
            type: integer
            minimum: 0
            description: Page, starting at 0 (50 chats a page)
            default: 0
            title: Page
          description: Page, starting at 0 (50 chats a page)
      responses:
        "200":
          description: Successful Response
          content:
            application/json:
              schema:
                $ref: "#/components/schemas/GetChatsResponseV1"
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
    GetChatsResponseV1:
      properties:
        chats:
          items:
            $ref: "#/components/schemas/ChatV1"
          type: array
          title: Chats
        page:
          type: integer
          title: Page
        has_more:
          type: boolean
          title: Has More
      additionalProperties: false
      type: object
      required:
        - chats
        - page
        - has_more
      title: GetChatsResponseV1
      description: Response from GET /v1/chat.
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
    ChatV1:
      properties:
        id:
          type: string
          title: Id
        title:
          anyOf:
            - type: string
            - type: "null"
          title: Title
        source:
          type: string
          enum:
            - api
            - app
          title: Source
          description: >-
            api: started through the API (you can send messages); app: started
            in the Happenstance app (read only here)
        url:
          type: string
          title: Url
          description: The chat in the Happenstance app
        status:
          type: string
          enum:
            - idle
            - running
          title: Status
        turn_count:
          type: integer
          title: Turn Count
        schedule_count:
          type: integer
          title: Schedule Count
          description: >-
            The chat's scheduled tasks (only a chat started in the app has
            them); read them with GET /v1/chat/{chat_id}
          default: 0
        created_at:
          type: string
          title: Created At
        last_activity_at:
          anyOf:
            - type: string
            - type: "null"
          title: Last Activity At
      additionalProperties: false
      type: object
      required:
        - id
        - source
        - url
        - status
        - turn_count
        - created_at
      title: ChatV1
      description: A chat in GET /v1/chat.
  securitySchemes:
    HTTPBearer:
      type: http
      scheme: bearer
````

This documentation is built and hosted on [Mintlify](https://mintlify.com), a developer documentation platform.
