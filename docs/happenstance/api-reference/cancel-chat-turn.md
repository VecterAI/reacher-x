> ## Documentation Index
>
> Fetch the complete documentation index at: https://developer.happenstance.ai/llms.txt
> Use this file to discover all available pages before exploring further.

# Cancel Chat Turn

> Stop a running turn, as the Stop button in the app does. Chat keeps what it wrote, its
> searches stop, and the turn ends cancelled, charged for the work done. A finished turn is
> returned as it is. `latest` stops whatever the chat is working on.

## OpenAPI

````yaml /openapi.json post /v1/chat/{chat_id}/turns/{turn_id}/cancel
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
  /v1/chat/{chat_id}/turns/{turn_id}/cancel:
    post:
      summary: Cancel Chat Turn
      description: >-
        Stop a running turn, as the Stop button in the app does. Chat keeps what
        it wrote, its

        searches stop, and the turn ends cancelled, charged for the work done. A
        finished turn is

        returned as it is. `latest` stops whatever the chat is working on.
      operationId: cancel_chat_turn_v1_chat__chat_id__turns__turn_id__cancel_post
      parameters:
        - name: chat_id
          in: path
          required: true
          schema:
            type: string
            title: Chat Id
        - name: turn_id
          in: path
          required: true
          schema:
            type: string
            description: >-
              A turn ID from POST /v1/chat or /messages, or `latest` for the
              chat's newest turn
            title: Turn Id
          description: >-
            A turn ID from POST /v1/chat or /messages, or `latest` for the
            chat's newest turn
      responses:
        "200":
          description: Successful Response
          content:
            application/json:
              schema:
                $ref: "#/components/schemas/ChatTurnV1"
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
    ChatTurnV1:
      properties:
        id:
          type: string
          title: Id
          description: The turn's id
        chat_id:
          type: string
          title: Chat Id
          description: The chat's id
        status:
          type: string
          enum:
            - queued
            - running
            - completed
            - failed
            - cancelled
          title: Status
          description: >-
            queued (not started), running, completed, failed (not charged) or
            cancelled
        stop_reason:
          anyOf:
            - type: string
              enum:
                - done
                - needs_input
                - stopped
                - error
            - type: "null"
          title: Stop Reason
          description: >-
            Why a finished turn ended: done; needs_input (Chat asked questions
            and waits for the answers, see reply.questions); stopped
            (cancelled); error. Null while running.
        started_by:
          type: string
          enum:
            - message
            - schedule
          title: Started By
          description: >-
            message: a message or answers started the turn. schedule: one of the
            chat's scheduled tasks ran, and nobody sent a message (only a chat
            started in the app has scheduled tasks).
          default: message
        message:
          type: string
          title: Message
          description: >-
            The message that started the turn, or for a scheduled run the task's
            instruction
        messages:
          items:
            type: string
          type: array
          title: Messages
          description: >-
            Every message in the turn: the first started it, any later one was
            sent while it ran and joined it. A scheduled run's turn has none.
        reply:
          $ref: "#/components/schemas/ChatReplyV1"
        usage:
          $ref: "#/components/schemas/ChatTurnUsageV1"
        created_at:
          type: string
          title: Created At
          description: When the turn started (ISO 8601)
        completed_at:
          anyOf:
            - type: string
            - type: "null"
          title: Completed At
          description: When the turn finished (ISO 8601)
        last_activity_at:
          anyOf:
            - type: string
            - type: "null"
          title: Last Activity At
          description: >-
            When Chat last made progress on the turn (a reply, a search starting
            or finishing). A running turn with no progress for several minutes
            is stuck or slow and can be cancelled.
        elapsed_seconds:
          type: integer
          title: Elapsed Seconds
          description: Seconds since the turn started, or how long it took once finished
        next_turn_id:
          anyOf:
            - type: string
            - type: "null"
          title: Next Turn Id
          description: The chat's next turn, once one was started
      additionalProperties: false
      type: object
      required:
        - id
        - chat_id
        - status
        - message
        - messages
        - reply
        - usage
        - created_at
        - elapsed_seconds
      title: ChatTurnV1
      description: >-
        Response from GET /v1/chat/{chat_id}/turns/{turn_id}: a message and
        Chat's work on it.
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
    ChatReplyV1:
      properties:
        markdown:
          type: string
          title: Markdown
          description: >-
            Chat's reply, as markdown with absolute links: its latest message,
            and every message with people or drafts. People appear as list items
            and drafts as quoted blocks; read them as data with /people and
            /drafts. Grows while the turn runs.
        updates:
          items:
            type: string
          type: array
          title: Updates
          description: >-
            Chat's earlier notes in this turn that hold no people or drafts,
            such as 'searching now' or a reply to a message that joined the
            turn. Not part of the answer.
        people_count:
          type: integer
          title: People Count
          description: People shown in this turn
        people_new_count:
          type: integer
          title: People New Count
          description: People shown in this turn who weren't shown in an earlier one
        drafts_count:
          type: integer
          title: Drafts Count
          description: Message drafts written in this turn
        searches:
          items:
            $ref: "#/components/schemas/ChatSearchV1"
          type: array
          title: Searches
          description: People searches run in this turn
        suggested_followup:
          anyOf:
            - type: string
            - type: "null"
          title: Suggested Followup
          description: >-
            A next message Chat suggests, in the user's voice, when it offers
            one
        questions:
          items:
            $ref: "#/components/schemas/ChatQuestionV1"
          type: array
          title: Questions
          description: >-
            The last questions Chat asked the user in this turn. When the turn
            ends with stop_reason needs_input, Chat waits for their answers:
            send them with POST /v1/chat/{chat_id}/messages (answers, or a
            message). Answer from what you know of the user's goal; ask the user
            when you don't know.
      additionalProperties: false
      type: object
      required:
        - markdown
        - people_count
        - people_new_count
        - drafts_count
      title: ChatReplyV1
    ChatTurnUsageV1:
      properties:
        credits_charged:
          anyOf:
            - type: number
            - type: "null"
          title: Credits Charged
          description: >-
            Credits charged for the turn, to two decimal places. Null while the
            turn runs, for a few seconds after it finishes until billing records
            the charge, and for chats started in the Happenstance app.
        searches:
          type: integer
          title: Searches
          description: People searches Chat ran
        web_searches:
          type: integer
          title: Web Searches
          description: Web searches and page reads Chat ran
        model_calls:
          type: integer
          title: Model Calls
          description: Model calls Chat made
        people_reviewed:
          type: integer
          title: People Reviewed
          description: People the searches returned for Chat to review
        scope:
          anyOf:
            - $ref: "#/components/schemas/ChatScopeV1"
            - type: "null"
          description: Whose networks were searched; null when nothing was
      additionalProperties: false
      type: object
      required:
        - searches
        - web_searches
        - model_calls
        - people_reviewed
      title: ChatTurnUsageV1
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
    ChatQuestionV1:
      properties:
        index:
          type: integer
          title: Index
          description: Its index, as answers[].question_index takes it
        header:
          type: string
          title: Header
          description: A one to three word label
        question:
          type: string
          title: Question
        options:
          items:
            $ref: "#/components/schemas/ChatQuestionOptionV1"
          type: array
          title: Options
        multi_select:
          type: boolean
          title: Multi Select
          description: Whether more than one option may be chosen
      additionalProperties: false
      type: object
      required:
        - index
        - header
        - question
        - options
        - multi_select
      title: ChatQuestionV1
      description: A question Chat asked the user, with options to choose from.
    ChatScopeV1:
      properties:
        my_connections:
          type: boolean
          title: My Connections
          description: The user's own connections
        friends_connections:
          type: boolean
          title: Friends Connections
          description: The user's friends' connections
        all_groups:
          type: boolean
          title: All Groups
          description: Every group the user is in
        group_ids:
          items:
            type: string
          type: array
          title: Group Ids
          description: Specific groups searched, when not all
      additionalProperties: false
      type: object
      required:
        - my_connections
        - friends_connections
        - all_groups
      title: ChatScopeV1
      description: >-
        Whose networks the turn's searches covered (the union across its
        searches).
    ChatQuestionOptionV1:
      properties:
        label:
          type: string
          title: Label
          description: The option, as answers[].selected takes it
        description:
          type: string
          title: Description
          description: What choosing it means
      additionalProperties: false
      type: object
      required:
        - label
        - description
      title: ChatQuestionOptionV1
  securitySchemes:
    HTTPBearer:
      type: http
      scheme: bearer
````

This documentation is built and hosted on [Mintlify](https://mintlify.com), a developer documentation platform.
