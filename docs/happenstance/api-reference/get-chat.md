> ## Documentation Index
>
> Fetch the complete documentation index at: https://developer.happenstance.ai/llms.txt
> Use this file to discover all available pages before exploring further.

# Get Chat

> The whole chat: its messages (Chat's as markdown), its turns, the searches it ran, and
> the notes Chat keeps on the user's goal and preferences (memory) and on older turns.

## OpenAPI

````yaml /openapi.json get /v1/chat/{chat_id}
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
  /v1/chat/{chat_id}:
    get:
      summary: Get Chat
      description: >-
        The whole chat: its messages (Chat's as markdown), its turns, the
        searches it ran, and

        the notes Chat keeps on the user's goal and preferences (memory) and on
        older turns.
      operationId: get_chat_v1_chat__chat_id__get
      parameters:
        - name: chat_id
          in: path
          required: true
          schema:
            type: string
            title: Chat Id
      responses:
        "200":
          description: Successful Response
          content:
            application/json:
              schema:
                $ref: "#/components/schemas/GetChatResponseV1"
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
    GetChatResponseV1:
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
        url:
          type: string
          title: Url
        status:
          type: string
          enum:
            - idle
            - running
          title: Status
        created_at:
          type: string
          title: Created At
        memory:
          anyOf:
            - type: string
            - type: "null"
          title: Memory
          description: >-
            Chat's notes on the user and the goal (preferences, exclusions,
            style), kept across turns
        history_summary:
          anyOf:
            - type: string
            - type: "null"
          title: History Summary
          description: Chat's summary of the older part of a long conversation
        credits_charged:
          type: number
          title: Credits Charged
          description: Credits charged for the chat's turns so far
        turns:
          items:
            $ref: "#/components/schemas/ChatTurnSummaryV1"
          type: array
          title: Turns
        messages:
          items:
            $ref: "#/components/schemas/ChatMessageV1"
          type: array
          title: Messages
        searches:
          items:
            $ref: "#/components/schemas/ChatSearchV1"
          type: array
          title: Searches
        schedules:
          items:
            $ref: "#/components/schemas/ChatScheduleV1"
          type: array
          title: Schedules
          description: >-
            The chat's scheduled tasks. Only a chat started in the app has them.
            A chat started through the API has none: to run it on a schedule,
            send it a message on yours.
      additionalProperties: false
      type: object
      required:
        - id
        - source
        - url
        - status
        - created_at
        - credits_charged
        - turns
        - messages
        - searches
      title: GetChatResponseV1
      description: >-
        Response from GET /v1/chat/{chat_id}: the conversation and what Chat
        keeps about it.
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
    ChatTurnSummaryV1:
      properties:
        id:
          type: string
          title: Id
        started_by:
          type: string
          enum:
            - message
            - schedule
          title: Started By
          default: message
        status:
          type: string
          enum:
            - queued
            - running
            - completed
            - failed
            - cancelled
          title: Status
        created_at:
          type: string
          title: Created At
        completed_at:
          anyOf:
            - type: string
            - type: "null"
          title: Completed At
        credits_charged:
          anyOf:
            - type: number
            - type: "null"
          title: Credits Charged
          description: Credits charged for the turn, once billed
      additionalProperties: false
      type: object
      required:
        - id
        - status
        - created_at
      title: ChatTurnSummaryV1
    ChatMessageV1:
      properties:
        role:
          type: string
          enum:
            - user
            - assistant
            - schedule
          title: Role
          description: >-
            user: a message to Chat. assistant: Chat's reply. schedule: a
            scheduled task ran; the markdown is its instruction.
        turn_id:
          anyOf:
            - type: string
            - type: "null"
          title: Turn Id
          description: The turn the message belongs to
        markdown:
          type: string
          title: Markdown
        created_at:
          type: string
          title: Created At
      additionalProperties: false
      type: object
      required:
        - role
        - markdown
        - created_at
      title: ChatMessageV1
    ChatSearchV1:
      properties:
        search_id:
          type: string
          title: Search Id
          description: The search's id, for GET /v1/search/{search_id}
        page_id:
          anyOf:
            - type: string
            - type: "null"
          title: Page Id
          description: The find-more page of that search, when this was one
        turn_id:
          anyOf:
            - type: string
            - type: "null"
          title: Turn Id
          description: The turn that ran it
        query:
          anyOf:
            - type: string
            - type: "null"
          title: Query
          description: What Chat searched for
        status:
          type: string
          enum:
            - running
            - completed
            - failed
            - stopped
          title: Status
          description: The search's status
        results_count:
          anyOf:
            - type: integer
            - type: "null"
          title: Results Count
          description: How many people the search returned, once completed
      additionalProperties: false
      type: object
      required:
        - search_id
        - status
      title: ChatSearchV1
      description: >-
        A people search Chat ran. Read all its results with GET
        /v1/search/{search_id} (with

        page_id for a find-more page).
    ChatScheduleV1:
      properties:
        id:
          type: string
          title: Id
        instruction:
          type: string
          title: Instruction
          description: What Chat does on each run
        cron:
          type: string
          title: Cron
          description: 5-field cron expression (minute hour day-of-month month day-of-week)
        timezone:
          type: string
          title: Timezone
          description: IANA timezone the cron is read in
        next_run_at:
          type: string
          title: Next Run At
          description: >-
            When it next comes due (ISO 8601, UTC like every time in this API).
            A paused task does not run.
        paused:
          type: boolean
          title: Paused
        paused_reason:
          anyOf:
            - type: string
              enum:
                - inactive
                - by_user
            - type: "null"
          title: Paused Reason
          description: >-
            Why it is paused: inactive (no message to the chat for 8 of its
            periods; a message re-arms it) or by_user
        email_enabled:
          type: boolean
          title: Email Enabled
          description: Whether each finished run also emails the user a link to the chat
        push_enabled:
          type: boolean
          title: Push Enabled
          description: >-
            Whether each finished run also notifies the user's Happenstance
            phone app
        created_at:
          type: string
          title: Created At
      additionalProperties: false
      type: object
      required:
        - id
        - instruction
        - cron
        - timezone
        - next_run_at
        - paused
        - email_enabled
        - push_enabled
        - created_at
      title: ChatScheduleV1
      description: >-
        A scheduled task of a chat started in the app: Chat runs its instruction
        in the chat on a

        cron schedule. Tasks are set up and changed in the app.
  securitySchemes:
    HTTPBearer:
      type: http
      scheme: bearer
````

This documentation is built and hosted on [Mintlify](https://mintlify.com), a developer documentation platform.
