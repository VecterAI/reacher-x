> ## Documentation Index
>
> Fetch the complete documentation index at: https://developer.happenstance.ai/llms.txt
> Use this file to discover all available pages before exploring further.

# Get Group

> Get details of a specific group including its members.

Member names can be used as @mentions in search queries to filter results
to that person's connections (e.g., "engineers @Jane Smith knows").

## OpenAPI

````yaml /openapi.json get /v1/groups/{group_id}
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
  /v1/groups/{group_id}:
    get:
      summary: Get Group
      description: >-
        Get details of a specific group including its members.


        Member names can be used as @mentions in search queries to filter
        results

        to that person's connections (e.g., "engineers @Jane Smith knows").
      operationId: get_group_v1_groups__group_id__get
      parameters:
        - name: group_id
          in: path
          required: true
          schema:
            type: string
            title: Group Id
      responses:
        "200":
          description: Successful Response
          content:
            application/json:
              schema:
                $ref: "#/components/schemas/GetGroupResponseV1"
          headers:
            Link:
              description: >-
                RFC 8288 Web Linking header for HATEOAS. Contains URIs to
                related resources.
              schema:
                type: string
              example: </v1/research/abc123>; rel="self"
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
    GetGroupResponseV1:
      properties:
        id:
          type: string
          title: Id
          description: Unique identifier for the group
        name:
          type: string
          title: Name
          description: Name of the group
        slug:
          anyOf:
            - type: string
            - type: "null"
          title: Slug
          description: URL slug for the group
        member_count:
          type: integer
          title: Member Count
          description: Number of members in the group
        members:
          items:
            $ref: "#/components/schemas/GroupMemberV1"
          type: array
          title: Members
          description: List of group members
      additionalProperties: false
      type: object
      required:
        - id
        - name
        - member_count
        - members
      title: GetGroupResponseV1
      description: Response from GET /v1/groups/{group_id} - retrieving group details.
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
    GroupMemberV1:
      properties:
        name:
          type: string
          title: Name
          description: Member's name
        connections_count:
          type: integer
          title: Connections Count
          description: >-
            How many connections the member has added (refreshed every few
            minutes). A member with none adds nobody to group searches.
          default: 0
      additionalProperties: false
      type: object
      required:
        - name
      title: GroupMemberV1
      description: >-
        A member of a group. Use member names as @mentions in search queries to
        filter results to their connections.
  securitySchemes:
    HTTPBearer:
      type: http
      scheme: bearer
````

This documentation is built and hosted on [Mintlify](https://mintlify.com), a developer documentation platform.
