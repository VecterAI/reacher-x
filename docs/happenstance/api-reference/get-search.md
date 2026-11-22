> ## Documentation Index
>
> Fetch the complete documentation index at: https://developer.happenstance.ai/llms.txt
> Use this file to discover all available pages before exploring further.

# Get Search

> Get search results.

Returns the status and results of a search request.
Optionally provide a page_id to retrieve a specific page of results.

## OpenAPI

````yaml /openapi.json get /v1/search/{search_id}
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
  /v1/search/{search_id}:
    get:
      summary: Get Search
      description: |-
        Get search results.

        Returns the status and results of a search request.
        Optionally provide a page_id to retrieve a specific page of results.
      operationId: get_search_v1_search__search_id__get
      parameters:
        - name: search_id
          in: path
          required: true
          schema:
            type: string
            title: Search Id
        - name: page_id
          in: query
          required: false
          schema:
            anyOf:
              - type: string
              - type: "null"
            title: Page Id
      responses:
        "200":
          description: Successful Response
          content:
            application/json:
              schema:
                $ref: "#/components/schemas/GetSearchResponseV1"
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
    GetSearchResponseV1:
      properties:
        id:
          type: string
          title: Id
          description: Unique identifier for the search request
        url:
          type: string
          title: Url
          description: >-
            URL to view the search results on Happenstance (points to parent
            search for continued searches)
        status:
          type: string
          title: Status
          description: Status of the search (RUNNING, COMPLETED, FAILED)
        text:
          type: string
          title: Text
          description: Original search query text
        created_at:
          type: string
          title: Created At
          description: Timestamp when search was created (ISO 8601 format)
        updated_at:
          type: string
          title: Updated At
          description: Timestamp when search was last updated (ISO 8601 format)
        group_ids:
          items:
            type: string
          type: array
          title: Group Ids
          description: List of group IDs that were searched
        include_friends_connections:
          type: boolean
          title: Include Friends Connections
          description: Whether the search included friends' connections
          default: false
        include_my_connections:
          type: boolean
          title: Include My Connections
          description: Whether the search included the user's own connections
          default: false
        mutuals:
          anyOf:
            - items:
                $ref: "#/components/schemas/SearchMutualV1"
              type: array
            - type: "null"
          title: Mutuals
          description: >-
            All unique mutual connections across results. Results reference
            these by index.
        traits:
          anyOf:
            - items:
                $ref: "#/components/schemas/SearchTraitV1"
              type: array
            - type: "null"
          title: Traits
          description: >-
            All trait definitions for this search. Results reference these by
            index.
        results:
          anyOf:
            - items:
                $ref: "#/components/schemas/SearchPersonV1"
              type: array
            - type: "null"
          title: Results
          description: Search results (only populated when status is COMPLETED)
        page_id:
          anyOf:
            - type: string
            - type: "null"
          title: Page Id
          description: >-
            Page identifier for the current result page. Null for the first page
            (the parent search itself). For subsequent pages, this is the
            page_id returned by POST /v1/search/{id}/find-more.
        next_page:
          anyOf:
            - type: string
            - type: "null"
          title: Next Page
          description: >-
            Page identifier for the next result page. Use as the page_id query
            parameter on GET /v1/search/{id}?page_id={next_page} to retrieve the
            next page. Null if no next page exists.
        has_more:
          type: boolean
          title: Has More
          description: >-
            Whether more results may be available via POST
            /v1/search/{id}/find-more. Searches return up to 30 results at a
            time.
          default: false
      additionalProperties: false
      type: object
      required:
        - id
        - url
        - status
        - text
        - created_at
        - updated_at
      title: GetSearchResponseV1
      description: >-
        Response from GET /v1/search/{id} - retrieving search status and
        results.
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
    SearchMutualV1:
      properties:
        index:
          type: integer
          title: Index
          description: Index of this mutual in the mutuals array
        id:
          type: string
          title: Id
          description: Unique identifier for the mutual connection
        name:
          type: string
          title: Name
          description: Name of the mutual connection
        happenstance_url:
          type: string
          title: Happenstance Url
          description: URL to the mutual's Happenstance profile
      additionalProperties: false
      type: object
      required:
        - index
        - id
        - name
        - happenstance_url
      title: SearchMutualV1
      description: >-
        A mutual connection who can introduce you to search results (normalized,
        top-level)
    SearchTraitV1:
      properties:
        index:
          type: integer
          title: Index
          description: Index of this trait in the traits array
        header:
          type: string
          title: Header
          description: Short label for the trait (e.g., 'Undergrad')
        description:
          anyOf:
            - type: string
            - type: "null"
          title: Description
          description: Full trait description explaining what was evaluated
      additionalProperties: false
      type: object
      required:
        - index
        - header
      title: SearchTraitV1
      description: A trait definition (normalized, top-level)
    SearchPersonV1:
      properties:
        id:
          type: string
          title: Id
          description: Unique identifier for the person
        name:
          type: string
          title: Name
          description: Person's name
        weighted_traits_score:
          type: number
          title: Weighted Traits Score
          description: >-
            Overall relevance score based on trait evaluations. Calculated as
            sum of trait scores minus penalties for traits scored zero. Can be
            negative.
        current_title:
          anyOf:
            - type: string
            - type: "null"
          title: Current Title
          description: Current job title
        current_company:
          anyOf:
            - type: string
            - type: "null"
          title: Current Company
          description: Current company
        summary:
          anyOf:
            - type: string
            - type: "null"
          title: Summary
          description: AI-generated summary of why this person matches
        socials:
          $ref: "#/components/schemas/SocialsV1"
          description: Profile URLs
        mutuals:
          anyOf:
            - items:
                $ref: "#/components/schemas/SearchMutualRefV1"
              type: array
            - type: "null"
          title: Mutuals
          description: >-
            References to mutual connections (indices into top-level mutuals
            array)
        traits:
          anyOf:
            - items:
                $ref: "#/components/schemas/SearchTraitScoreV1"
              type: array
            - type: "null"
          title: Traits
          description: Trait scores for this person (indices into top-level traits array)
      additionalProperties: false
      type: object
      required:
        - id
        - name
        - weighted_traits_score
        - socials
      title: SearchPersonV1
      description: Individual search result representing a person
    SocialsV1:
      properties:
        happenstance_url:
          type: string
          title: Happenstance Url
          description: URL to the person's Happenstance profile
        linkedin_url:
          anyOf:
            - type: string
            - type: "null"
          title: Linkedin Url
          description: LinkedIn profile URL
        twitter_url:
          anyOf:
            - type: string
            - type: "null"
          title: Twitter Url
          description: Twitter/X profile URL
        instagram_url:
          anyOf:
            - type: string
            - type: "null"
          title: Instagram Url
          description: Instagram profile URL
      additionalProperties: false
      type: object
      required:
        - happenstance_url
      title: SocialsV1
      description: Profile URLs for a person
    SearchMutualRefV1:
      properties:
        index:
          type: integer
          title: Index
          description: Index into the top-level mutuals array
        affinity_score:
          anyOf:
            - type: number
            - type: "null"
          title: Affinity Score
          description: >-
            Affinity score indicating connection strength between the mutual and
            this person. Higher values indicate stronger connections.
      additionalProperties: false
      type: object
      required:
        - index
      title: SearchMutualRefV1
      description: Reference to a mutual with result-specific affinity score
    SearchTraitScoreV1:
      properties:
        index:
          type: integer
          title: Index
          description: Index into the top-level traits array
        score:
          type: number
          title: Score
          description: Score for this trait (0, 0.5, or 1)
        evidence:
          anyOf:
            - type: string
            - type: "null"
          title: Evidence
          description: Supporting quote or citation from the person's profile
      additionalProperties: false
      type: object
      required:
        - index
        - score
      title: SearchTraitScoreV1
      description: Reference to a trait with result-specific score and evidence
  securitySchemes:
    HTTPBearer:
      type: http
      scheme: bearer
````

This documentation is built and hosted on [Mintlify](https://mintlify.com), a developer documentation platform.
