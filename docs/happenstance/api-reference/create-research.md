> ## Documentation Index
>
> Fetch the complete documentation index at: https://developer.happenstance.ai/llms.txt
> Use this file to discover all available pages before exploring further.

# Create Research

> Start a new person research request.

Include as many details as possible about the person in the description field
(full name, company, title, location, social media handles, etc.) for best results.

Requires sufficient credits. Returns 402 Payment Required if not enough credits.
Returns 429 Too Many Requests if you have 10 or more research requests currently running.

## OpenAPI

````yaml /openapi.json post /v1/research
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
  /v1/research:
    post:
      summary: Create Research
      description: >-
        Start a new person research request.


        Include as many details as possible about the person in the description
        field

        (full name, company, title, location, social media handles, etc.) for
        best results.


        Requires sufficient credits. Returns 402 Payment Required if not enough
        credits.

        Returns 429 Too Many Requests if you have 10 or more research requests
        currently running.
      operationId: create_research_v1_research_post
      requestBody:
        content:
          application/json:
            schema:
              $ref: "#/components/schemas/ResearchRequestV1"
        required: true
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
                $ref: "#/components/schemas/CreateResearchResponseV1"
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
    ResearchRequestV1:
      properties:
        description:
          type: string
          title: Description
          description: Description of the person to research
      additionalProperties: false
      type: object
      required:
        - description
      title: ResearchRequestV1
    CreateResearchResponseV1:
      properties:
        id:
          type: string
          title: Id
          description: Unique identifier for the research job
        url:
          type: string
          title: Url
          description: URL to view the research profile on Happenstance
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
      title: CreateResearchResponseV1
      description: Response from POST /v1/research - creating a new research request.
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
