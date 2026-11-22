> ## Documentation Index
>
> Fetch the complete documentation index at: https://developer.happenstance.ai/llms.txt
> Use this file to discover all available pages before exploring further.

# Get Chat People

> Everyone Chat showed in the chat, one row per person with their cards merged: title,
> company, location, LinkedIn, how the user is connected (directly, and through which
> mutuals, with connection strength), and why Chat picked them. In order of first
> appearance; with turn_id, the people of that turn.

## OpenAPI

````yaml /openapi.json get /v1/chat/{chat_id}/people
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
  /v1/chat/{chat_id}/people:
    get:
      summary: Get Chat People
      description: >-
        Everyone Chat showed in the chat, one row per person with their cards
        merged: title,

        company, location, LinkedIn, how the user is connected (directly, and
        through which

        mutuals, with connection strength), and why Chat picked them. In order
        of first

        appearance; with turn_id, the people of that turn.
      operationId: get_chat_people_v1_chat__chat_id__people_get
      parameters:
        - name: chat_id
          in: path
          required: true
          schema:
            type: string
            title: Chat Id
        - name: turn_id
          in: query
          required: false
          schema:
            anyOf:
              - type: string
              - type: "null"
            description: >-
              Only the people this turn showed, in its order; `latest` for the
              newest turn
            title: Turn Id
          description: >-
            Only the people this turn showed, in its order; `latest` for the
            newest turn
        - name: page
          in: query
          required: false
          schema:
            type: integer
            minimum: 0
            description: Page, starting at 0 (100 people a page)
            default: 0
            title: Page
          description: Page, starting at 0 (100 people a page)
      responses:
        "200":
          description: Successful Response
          content:
            application/json:
              schema:
                $ref: "#/components/schemas/GetChatPeopleResponseV1"
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
    GetChatPeopleResponseV1:
      properties:
        chat_id:
          type: string
          title: Chat Id
        turn_id:
          anyOf:
            - type: string
            - type: "null"
          title: Turn Id
          description: The turn the list is limited to, when one was given
        page:
          type: integer
          title: Page
          description: This page, starting at 0
        page_size:
          type: integer
          title: Page Size
        total:
          type: integer
          title: Total
          description: People in the whole list
        has_more:
          type: boolean
          title: Has More
        people:
          items:
            $ref: "#/components/schemas/ChatPersonV1"
          type: array
          title: People
      additionalProperties: false
      type: object
      required:
        - chat_id
        - page
        - page_size
        - total
        - has_more
        - people
      title: GetChatPeopleResponseV1
      description: Response from GET /v1/chat/{chat_id}/people.
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
    ChatPersonV1:
      properties:
        person_id:
          type: string
          title: Person Id
          description: The person's id (stable across chats and searches)
        name:
          type: string
          title: Name
        headline:
          anyOf:
            - type: string
            - type: "null"
          title: Headline
          description: Title and company, as shown
        current_title:
          anyOf:
            - type: string
            - type: "null"
          title: Current Title
        current_company:
          anyOf:
            - type: string
            - type: "null"
          title: Current Company
        location:
          anyOf:
            - type: string
            - type: "null"
          title: Location
        linkedin_url:
          anyOf:
            - type: string
            - type: "null"
          title: Linkedin Url
        happenstance_url:
          type: string
          title: Happenstance Url
          description: The person's page on Happenstance
        relationship:
          $ref: "#/components/schemas/ChatPersonRelationshipV1"
        mutuals:
          items:
            $ref: "#/components/schemas/ChatPersonMutualV1"
          type: array
          title: Mutuals
          description: People who can introduce the user, strongest first (at most 20)
        rationale_markdown:
          type: string
          title: Rationale Markdown
          description: >-
            Why Chat picked them: the card's text from the latest turn that
            showed them, with its links
        links:
          items:
            $ref: "#/components/schemas/ChatLinkV1"
          type: array
          title: Links
          description: The links in the rationale (posts, pages)
        columns:
          items:
            $ref: "#/components/schemas/ChatPersonColumnV1"
          type: array
          title: Columns
          description: >-
            The extra columns of the table that showed them (from the latest
            card that had any, with an earlier card's value for a column it left
            blank), in the table's order: values the user asked Chat for, such
            as priority or best role. Empty when the table had none.
        section:
          anyOf:
            - type: string
            - type: "null"
          title: Section
          description: >-
            The heading the card was under, when Chat grouped the people
            ("Investors", "Tier 1")
        search_id:
          anyOf:
            - type: string
            - type: "null"
          title: Search Id
          description: The search that found them, when one did
        turn_ids:
          items:
            type: string
          type: array
          title: Turn Ids
          description: The turns that showed them, oldest first
      additionalProperties: false
      type: object
      required:
        - person_id
        - name
        - happenstance_url
        - relationship
        - rationale_markdown
        - turn_ids
      title: ChatPersonV1
      description: >-
        A person Chat showed, across the chat's turns (one row per person: their
        latest card,

        with what earlier cards said where the latest one is shorter or leaves
        it out).
    ChatPersonRelationshipV1:
      properties:
        you_know_them:
          type: boolean
          title: You Know Them
          description: Whether the user is directly connected to them
        sources:
          items:
            type: string
          type: array
          title: Sources
          description: >-
            Where the user's own connection comes from (linkedin, gmail,
            google_calendar, google_contacts, ...). Empty when they aren't
            directly connected.
        affinity:
          anyOf:
            - type: number
            - type: "null"
          title: Affinity
          description: >-
            How strong the user's own connection is, as a score: 0 means we have
            no evidence beyond the connection itself; 45 and up is medium, 75
            strong, 100 very strong. Null when not directly connected.
        affinity_level:
          anyOf:
            - type: string
              enum:
                - very_strong
                - strong
                - medium
                - weak
            - type: "null"
          title: Affinity Level
          description: The same as a level, as the Happenstance app shows it
      additionalProperties: false
      type: object
      required:
        - you_know_them
      title: ChatPersonRelationshipV1
    ChatPersonMutualV1:
      properties:
        user_id:
          type: string
          title: User Id
          description: The mutual's user id
        name:
          type: string
          title: Name
          description: The mutual's name
        happenstance_url:
          type: string
          title: Happenstance Url
          description: The mutual's Happenstance profile
        via:
          anyOf:
            - type: string
              enum:
                - friend
                - group
            - type: "null"
          title: Via
          description: >-
            How the user reaches the mutual: a Happenstance friend, or a member
            of a shared group
        affinity:
          anyOf:
            - type: number
            - type: "null"
          title: Affinity
          description: >-
            How well the mutual knows the person, as a score: 0 means we have no
            evidence beyond the connection itself; 45 and up is medium, 75
            strong, 100 very strong.
        affinity_level:
          anyOf:
            - type: string
              enum:
                - very_strong
                - strong
                - medium
                - weak
            - type: "null"
          title: Affinity Level
          description: The same as a level, as the Happenstance app shows it
        sources:
          items:
            type: string
          type: array
          title: Sources
          description: >-
            How the mutual is connected to the person, when that's public:
            linkedin, instagram, twitter, in that order. Email, calendar and
            contact-book connections are the mutual's own and are left out, so
            this is empty when those are all there is
      additionalProperties: false
      type: object
      required:
        - user_id
        - name
        - happenstance_url
      title: ChatPersonMutualV1
      description: A Happenstance user who knows the person and could introduce the user.
    ChatLinkV1:
      properties:
        url:
          type: string
          title: Url
        text:
          type: string
          title: Text
      additionalProperties: false
      type: object
      required:
        - url
        - text
      title: ChatLinkV1
    ChatPersonColumnV1:
      properties:
        column:
          type: string
          title: Column
          description: The column's label, as the table's header shows it
        value:
          type: string
          title: Value
          description: The person's value; empty when Chat didn't know it
      additionalProperties: false
      type: object
      required:
        - column
        - value
      title: ChatPersonColumnV1
  securitySchemes:
    HTTPBearer:
      type: http
      scheme: bearer
````

This documentation is built and hosted on [Mintlify](https://mintlify.com), a developer documentation platform.
