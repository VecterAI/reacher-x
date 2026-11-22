> ## Documentation Index
>
> Fetch the complete documentation index at: https://developer.happenstance.ai/llms.txt
> Use this file to discover all available pages before exploring further.

# Send Chat Message

> Send a message to a chat started through the API. Returns at once with the turn to poll. A
> message sent while a turn is still working joins that turn (joined: true): Chat takes it
> into the work in progress, and the turn's reply and charge cover both messages.

When a turn ends with stop_reason needs_input, Chat waits on the questions in its
reply.questions: send answers (by question index and option label), a message that answers
them in words, or both. The answer starts the next turn (answered: true).

Returns 402 when the balance is below 3 credits for this message and for each turn still
running, 409 for a chat started in the app.

## OpenAPI

````yaml /openapi.json post /v1/chat/{chat_id}/messages
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
  /v1/chat/{chat_id}/messages:
    post:
      summary: Send Chat Message
      description: >-
        Send a message to a chat started through the API. Returns at once with
        the turn to poll. A

        message sent while a turn is still working joins that turn (joined:
        true): Chat takes it

        into the work in progress, and the turn's reply and charge cover both
        messages.


        When a turn ends with stop_reason needs_input, Chat waits on the
        questions in its

        reply.questions: send answers (by question index and option label), a
        message that answers

        them in words, or both. The answer starts the next turn (answered:
        true).


        Returns 402 when the balance is below 3 credits for this message and for
        each turn still

        running, 409 for a chat started in the app.
      operationId: send_chat_message_v1_chat__chat_id__messages_post
      parameters:
        - name: chat_id
          in: path
          required: true
          schema:
            type: string
            title: Chat Id
      requestBody:
        required: true
        content:
          application/json:
            schema:
              $ref: "#/components/schemas/SendChatMessageRequestV1"
      responses:
        "200":
          description: Successful Response
          content:
            application/json:
              schema:
                $ref: "#/components/schemas/SendChatMessageResponseV1"
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
    SendChatMessageRequestV1:
      properties:
        message:
          anyOf:
            - type: string
            - type: "null"
          title: Message
          description: >-
            The message to send, in plain text. While Chat waits on its
            questions (a turn with stop_reason needs_input), a message answers
            them in words.
        answers:
          anyOf:
            - items:
                $ref: "#/components/schemas/ChatAnswerV1"
              type: array
            - type: "null"
          title: Answers
          description: >-
            Answers to Chat's open questions, one per question you answer. Send
            answers, a message, or both (the message then adds to the answers).
      additionalProperties: false
      type: object
      title: SendChatMessageRequestV1
    SendChatMessageResponseV1:
      properties:
        chat_id:
          type: string
          title: Chat Id
          description: The chat's id
        url:
          type: string
          title: Url
          description: The chat in the Happenstance app
        turn_id:
          type: string
          title: Turn Id
          description: >-
            The turn to poll: the one this message started, or the running turn
            it joined
        status:
          type: string
          enum:
            - queued
            - running
            - completed
            - failed
            - cancelled
          title: Status
          description: The turn's status
        joined:
          type: boolean
          title: Joined
          description: >-
            True when the message joined the turn that was still running: Chat
            takes it into that turn's work, and the turn's reply and charge
            cover both messages
          default: false
        answered:
          type: boolean
          title: Answered
          description: True when the message or answers answered Chat's open questions
          default: false
        warning:
          anyOf:
            - type: string
            - type: "null"
          title: Warning
          description: Warning message when credit balance is low
      additionalProperties: false
      type: object
      required:
        - chat_id
        - url
        - turn_id
        - status
      title: SendChatMessageResponseV1
      description: Response from POST /v1/chat/{chat_id}/messages.
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
    ChatAnswerV1:
      properties:
        question_index:
          type: integer
          minimum: 0
          title: Question Index
          description: The question's index, from 0
        selected:
          items:
            type: string
          type: array
          maxItems: 4
          title: Selected
          description: >-
            The chosen option labels, exactly as given (several only for a
            multi_select question)
        other:
          anyOf:
            - type: string
              maxLength: 32000
            - type: "null"
          title: Other
          description: A free-text answer instead of or beside the options
      additionalProperties: false
      type: object
      required:
        - question_index
      title: ChatAnswerV1
      description: >-
        An answer to one of Chat's questions (reply.questions of a needs_input
        turn).
  securitySchemes:
    HTTPBearer:
      type: http
      scheme: bearer
````

This documentation is built and hosted on [Mintlify](https://mintlify.com), a developer documentation platform.
