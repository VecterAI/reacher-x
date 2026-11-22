> ## Documentation Index
>
> Fetch the complete documentation index at: https://developer.happenstance.ai/llms.txt
> Use this file to discover all available pages before exploring further.

# Find More Search

> Find more results for a search.

Creates a new search that excludes all people from previous results in the search chain.
Uses the same query and settings as the original search.
Can only be called on the parent search (searches without a parent_search_id).

Requires sufficient credits. Returns 402 Payment Required if not enough credits.
Returns 429 Too Many Requests if you have 10 or more search requests currently running.

## OpenAPI

````yaml /openapi.json post /v1/search/{search_id}/find-more
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
  /v1/search/{search_id}/find-more:
    post:
      summary: Find More Search
      description: >-
        Find more results for a search.


        Creates a new search that excludes all people from previous results in
        the search chain.

        Uses the same query and settings as the original search.

        Can only be called on the parent search (searches without a
        parent_search_id).


        Requires sufficient credits. Returns 402 Payment Required if not enough
        credits.

        Returns 429 Too Many Requests if you have 10 or more search requests
        currently running.
      operationId: find_more_search_v1_search__search_id__find_more_post
      parameters:
        - name: search_id
          in: path
          required: true
          schema:
            type: string
            title: Search Id
      responses:
        "200":
          description: Successful Response
          content:
            application/json:
              schema:
                $ref: "#/components/schemas/FindMoreSearchResponseV1"
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
    FindMoreSearchResponseV1:
      properties:
        page_id:
          type: string
          title: Page Id
          description: >-
            Page identifier for the new result page. Use as the page_id query
            parameter on GET /v1/search/{id}?page_id={page_id} to retrieve
            results.
        parent_search_id:
          type: string
          title: Parent Search Id
          description: ID of the original parent search
        warning:
          anyOf:
            - type: string
            - type: "null"
          title: Warning
          description: Warning message when credit balance is low
      additionalProperties: false
      type: object
      required:
        - page_id
        - parent_search_id
      title: FindMoreSearchResponseV1
      description: >-
        Response from POST /v1/search/{id}/find-more - finding more results for
        a search.
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
