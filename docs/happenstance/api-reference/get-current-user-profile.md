> ## Documentation Index
>
> Fetch the complete documentation index at: https://developer.happenstance.ai/llms.txt
> Use this file to discover all available pages before exploring further.

# Get Current User Profile

> Get the current user's profile.

## OpenAPI

````yaml /openapi.json get /v1/users/me
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
  /v1/users/me:
    get:
      summary: Get Current User Profile
      description: Get the current user's profile.
      operationId: get_current_user_profile_v1_users_me_get
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
                $ref: "#/components/schemas/UserV1"
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
    UserV1:
      properties:
        email:
          type: string
          title: Email
          description: User's email address
        name:
          type: string
          title: Name
          description: User's name
        friends:
          items:
            $ref: "#/components/schemas/FriendV1"
          type: array
          title: Friends
          description: List of the user's friends
        friends_count:
          type: integer
          title: Friends Count
          description: How many Happenstance friends the user has
          default: 0
        connections_count:
          type: integer
          title: Connections Count
          description: >-
            How many people the user's own connected sources hold (their own
            connections, searchable by them and their friends)
          default: 0
        sources:
          items:
            $ref: "#/components/schemas/UserSourceV1"
          type: array
          title: Sources
          description: >-
            The user's connected sources, newest activity first. Empty means the
            user hasn't added their own connections, so searches cover only
            friends' and groups'.
      additionalProperties: false
      type: object
      required:
        - email
        - name
        - friends
      title: UserV1
      description: Response from GET /v1/users/me - retrieving the current user's profile.
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
    FriendV1:
      properties:
        name:
          type: string
          title: Name
          description: Friend's name
      additionalProperties: false
      type: object
      required:
        - name
      title: FriendV1
      description: A friend of the current user.
    UserSourceV1:
      properties:
        source:
          type: string
          title: Source
          description: >-
            LinkedIn, Gmail, Google Contacts, Google Calendar, Outlook, Apple
            Contacts, Instagram or Twitter
        account:
          anyOf:
            - type: string
            - type: "null"
          title: Account
          description: The connected account (an email), for sign-in sources
        stage:
          type: string
          title: Stage
          description: >-
            ready, importing (first import), refreshing, uploading,
            needs_reconnect, failed, ...
        connections:
          type: integer
          title: Connections
          description: People this source brought into the network
        last_synced_at:
          anyOf:
            - type: string
            - type: "null"
          title: Last Synced At
          description: When its connections last finished importing (ISO 8601)
      additionalProperties: false
      type: object
      required:
        - source
        - stage
        - connections
      title: UserSourceV1
      description: A data source the user connected, whose people are searchable.
  securitySchemes:
    HTTPBearer:
      type: http
      scheme: bearer
````

This documentation is built and hosted on [Mintlify](https://mintlify.com), a developer documentation platform.
