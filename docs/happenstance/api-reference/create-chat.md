> ## Documentation Index
>
> Fetch the complete documentation index at: https://developer.happenstance.ai/llms.txt
> Use this file to discover all available pages before exploring further.

# Create Chat

> Start a chat with Happenstance Chat, optionally with its first message.

Chat searches the user's network (their connections, their friends' and their groups'),
researches people and drafts outreach, over as many turns as the conversation needs. A
message returns at once with a turn id: poll GET /v1/chat/{chat_id}/turns/{turn_id} until
the turn's status is completed, then read the people and drafts.

Each turn is charged when it finishes. Returns 402 when the balance is below 3 credits.

## OpenAPI

````yaml /openapi.json post /v1/chat
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
    post:
      summary: Create Chat
      description: >-
        Start a chat with Happenstance Chat, optionally with its first message.


        Chat searches the user's network (their connections, their friends' and
        their groups'),

        researches people and drafts outreach, over as many turns as the
        conversation needs. A

        message returns at once with a turn id: poll GET
        /v1/chat/{chat_id}/turns/{turn_id} until

        the turn's status is completed, then read the people and drafts.


        Each turn is charged when it finishes. Returns 402 when the balance is
        below 3 credits.
      operationId: create_chat_v1_chat_post
      requestBody:
        required: true
        content:
          application/json:
            schema:
              $ref: "#/components/schemas/CreateChatRequestV1"
      responses:
        "200":
          description: Successful Response
          content:
            application/json:
              schema:
                $ref: "#/components/schemas/CreateChatResponseV1"
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
    CreateChatRequestV1:
      properties:
        message:
          anyOf:
            - type: string
            - type: "null"
          title: Message
          description: >-
            The first message. Omit it to create an empty chat and send messages
            with POST /v1/chat/{chat_id}/messages.
      additionalProperties: false
      type: object
      title: CreateChatRequestV1
    CreateChatResponseV1:
      properties:
        id:
          type: string
          title: Id
          description: The chat's id
        url:
          type: string
          title: Url
          description: The chat in the Happenstance app
        turn_id:
          anyOf:
            - type: string
            - type: "null"
          title: Turn Id
          description: The first message's turn, when a message was sent
        status:
          anyOf:
            - type: string
              enum:
                - queued
                - running
                - completed
                - failed
                - cancelled
            - type: "null"
          title: Status
          description: The turn's status, when a message was sent
        warning:
          anyOf:
            - type: string
            - type: "null"
          title: Warning
          description: Warning message when credit balance is low
      additionalProperties: false
      type: object
      required:
        - id
        - url
      title: CreateChatResponseV1
      description: Response from POST /v1/chat.
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
  securitySchemes:
    HTTPBearer:
      type: http
      scheme: bearer
````

This documentation is built and hosted on [Mintlify](https://mintlify.com), a developer documentation platform.
