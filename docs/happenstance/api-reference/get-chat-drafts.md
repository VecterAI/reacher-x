> ## Documentation Index
>
> Fetch the complete documentation index at: https://developer.happenstance.ai/llms.txt
> Use this file to discover all available pages before exploring further.

# Get Chat Drafts

> The message drafts Chat wrote in the chat. Happenstance never sends them; the caller
> may, with the user's own email, LinkedIn or other tools.

## OpenAPI

````yaml /openapi.json get /v1/chat/{chat_id}/drafts
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
  /v1/chat/{chat_id}/drafts:
    get:
      summary: Get Chat Drafts
      description: >-
        The message drafts Chat wrote in the chat. Happenstance never sends
        them; the caller

        may, with the user's own email, LinkedIn or other tools.
      operationId: get_chat_drafts_v1_chat__chat_id__drafts_get
      parameters:
        - name: chat_id
          in: path
          required: true
          schema:
            type: string
            title: Chat Id
        - name: latest_per_person
          in: query
          required: false
          schema:
            type: boolean
            description: >-
              Only the latest draft for each recipient (false: every version, in
              order)
            default: true
            title: Latest Per Person
          description: >-
            Only the latest draft for each recipient (false: every version, in
            order)
      responses:
        "200":
          description: Successful Response
          content:
            application/json:
              schema:
                $ref: "#/components/schemas/GetChatDraftsResponseV1"
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
    GetChatDraftsResponseV1:
      properties:
        chat_id:
          type: string
          title: Chat Id
        total:
          type: integer
          title: Total
        drafts:
          items:
            $ref: "#/components/schemas/ChatDraftV1"
          type: array
          title: Drafts
      additionalProperties: false
      type: object
      required:
        - chat_id
        - total
        - drafts
      title: GetChatDraftsResponseV1
      description: Response from GET /v1/chat/{chat_id}/drafts.
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
    ChatDraftV1:
      properties:
        id:
          type: string
          title: Id
          description: The draft's id, unique in the chat
        turn_id:
          anyOf:
            - type: string
            - type: "null"
          title: Turn Id
          description: The turn that wrote it
        group_id:
          anyOf:
            - type: string
            - type: "null"
          title: Group Id
          description: >-
            The id of the set of drafts it was written with, when Chat wrote
            several together
        recipient_name:
          anyOf:
            - type: string
            - type: "null"
          title: Recipient Name
        person_id:
          anyOf:
            - type: string
            - type: "null"
          title: Person Id
          description: >-
            The recipient's person id; null for templates, posts and recipients
            Chat didn't identify
        kind:
          type: string
          enum:
            - outreach
            - intro_request
            - forwardable
            - template
            - post
            - email
          title: Kind
          description: What the draft is, guessed from how Chat named it
        body_markdown:
          type: string
          title: Body Markdown
          description: The text to send; links are markdown links
        body_text:
          type: string
          title: Body Text
          description: >-
            The same text in plain form for channels without markdown (LinkedIn,
            plain email): each link written as its text followed by the URL in
            parentheses
        characters:
          type: integer
          title: Characters
          description: Length of body_text, in characters
        supersedes:
          anyOf:
            - type: string
            - type: "null"
          title: Supersedes
          description: The earlier draft for the same recipient this one revises
        created_at:
          type: string
          title: Created At
          description: When it was written (ISO 8601)
      additionalProperties: false
      type: object
      required:
        - id
        - kind
        - body_markdown
        - body_text
        - characters
        - created_at
      title: ChatDraftV1
      description: A message draft Chat wrote. Happenstance never sends it; the caller may.
  securitySchemes:
    HTTPBearer:
      type: http
      scheme: bearer
````

This documentation is built and hosted on [Mintlify](https://mintlify.com), a developer documentation platform.
