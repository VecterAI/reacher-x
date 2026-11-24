> ## Documentation Index
>
> Fetch the complete documentation index at: https://developer.happenstance.ai/llms.txt
> Use this file to discover all available pages before exploring further.

# Get Research

> Get the status of a research request.

## OpenAPI

````yaml /openapi.json get /v1/research/{research_id}
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
  /v1/research/{research_id}:
    get:
      summary: Get Research
      description: Get the status of a research request.
      operationId: get_research_v1_research__research_id__get
      parameters:
        - name: research_id
          in: path
          required: true
          schema:
            type: string
            title: Research Id
      responses:
        "200":
          description: Successful Response
          content:
            application/json:
              schema:
                $ref: "#/components/schemas/GetResearchResponseV1"
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
    GetResearchResponseV1:
      properties:
        id:
          type: string
          title: Id
          description: Unique identifier for the research job
        status:
          type: string
          title: Status
          description: >-
            Status of the research job (RUNNING, COMPLETED, FAILED,
            FAILED_AMBIGUOUS)
        query:
          type: string
          title: Query
          description: Original research query
        created_at:
          type: string
          title: Created At
          description: Timestamp when research was created (ISO 8601 format)
        updated_at:
          type: string
          title: Updated At
          description: Timestamp when research was last updated (ISO 8601 format)
        profile:
          anyOf:
            - $ref: "#/components/schemas/ProfileV1"
            - type: "null"
          description: Research results (only populated when status is COMPLETED)
      additionalProperties: false
      type: object
      required:
        - id
        - status
        - query
        - created_at
        - updated_at
      title: GetResearchResponseV1
      description: >-
        Response from GET /v1/research/{id} - retrieving research status and
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
    ProfileV1:
      properties:
        person_metadata:
          anyOf:
            - $ref: "#/components/schemas/PersonMetadataV1"
            - type: "null"
          description: Basic metadata about the person
        employment:
          anyOf:
            - items:
                $ref: "#/components/schemas/EmploymentV1"
              type: array
            - type: "null"
          title: Employment
          description: Employment history
        education:
          anyOf:
            - items:
                $ref: "#/components/schemas/EducationV1"
              type: array
            - type: "null"
          title: Education
          description: Education history
        projects:
          anyOf:
            - items:
                $ref: "#/components/schemas/ProjectV1"
              type: array
            - type: "null"
          title: Projects
          description: Projects and achievements
        writings:
          anyOf:
            - items:
                $ref: "#/components/schemas/WritingV1"
              type: array
            - type: "null"
          title: Writings
          description: Writings and publications
        hobbies:
          anyOf:
            - items:
                $ref: "#/components/schemas/HobbyV1"
              type: array
            - type: "null"
          title: Hobbies
          description: Hobbies and personal interests
        summary:
          anyOf:
            - $ref: "#/components/schemas/SummaryV1"
            - type: "null"
          description: Comprehensive summary of the person's profile
      additionalProperties: false
      type: object
      title: ProfileV1
      description: Complete profile of a researched person
    PersonMetadataV1:
      properties:
        full_name:
          anyOf:
            - type: string
            - type: "null"
          title: Full Name
          description: Primary full name of the person
        alternate_names:
          anyOf:
            - items:
                type: string
              type: array
            - type: "null"
          title: Alternate Names
          description: List of alternate names, nicknames, or aliases
        profile_urls:
          anyOf:
            - items:
                type: string
              type: array
            - type: "null"
          title: Profile Urls
          description: URLs to online profiles (LinkedIn, Twitter, etc.)
        current_locations:
          anyOf:
            - items:
                $ref: "#/components/schemas/CurrentLocationV1"
              type: array
            - type: "null"
          title: Current Locations
          description: Current location(s) of the person
        tagline:
          anyOf:
            - type: string
            - type: "null"
          title: Tagline
          description: Professional tagline or headline
      additionalProperties: false
      type: object
      title: PersonMetadataV1
      description: Metadata about a person
    EmploymentV1:
      properties:
        company_name:
          anyOf:
            - type: string
            - type: "null"
          title: Company Name
          description: Name of the company
        job_title:
          anyOf:
            - type: string
            - type: "null"
          title: Job Title
          description: Job title or role
        start_date:
          anyOf:
            - type: string
            - type: "null"
          title: Start Date
          description: Start date (YYYY-MM-DD format)
        end_date:
          anyOf:
            - type: string
            - type: "null"
          title: End Date
          description: End date (YYYY-MM-DD format), null if current position
        description:
          anyOf:
            - type: string
            - type: "null"
          title: Description
          description: Description of role and responsibilities
        urls:
          anyOf:
            - items:
                type: string
              type: array
            - type: "null"
          title: Urls
          description: Related URLs (company website, LinkedIn, etc.)
      additionalProperties: false
      type: object
      title: EmploymentV1
      description: Employment history entry
    EducationV1:
      properties:
        university_name:
          anyOf:
            - type: string
            - type: "null"
          title: University Name
          description: Name of the university or institution
        degree:
          anyOf:
            - type: string
            - type: "null"
          title: Degree
          description: Degree obtained (e.g., BS, MS, PhD)
        start_date:
          anyOf:
            - type: string
            - type: "null"
          title: Start Date
          description: Start date (YYYY-MM-DD format)
        end_date:
          anyOf:
            - type: string
            - type: "null"
          title: End Date
          description: End date (YYYY-MM-DD format)
        description:
          anyOf:
            - type: string
            - type: "null"
          title: Description
          description: Additional details about the education
        urls:
          anyOf:
            - items:
                type: string
              type: array
            - type: "null"
          title: Urls
          description: Related URLs
      additionalProperties: false
      type: object
      title: EducationV1
      description: Education history entry
    ProjectV1:
      properties:
        title:
          anyOf:
            - type: string
            - type: "null"
          title: Title
          description: Title of the project
        description:
          anyOf:
            - type: string
            - type: "null"
          title: Description
          description: Description of the project and achievements
        start_date:
          anyOf:
            - type: string
            - type: "null"
          title: Start Date
          description: Start date (YYYY-MM-DD format)
        end_date:
          anyOf:
            - type: string
            - type: "null"
          title: End Date
          description: End date (YYYY-MM-DD format)
        urls:
          anyOf:
            - items:
                type: string
              type: array
            - type: "null"
          title: Urls
          description: Related URLs (project website, GitHub, etc.)
      additionalProperties: false
      type: object
      title: ProjectV1
      description: Project or achievement
    WritingV1:
      properties:
        title:
          anyOf:
            - type: string
            - type: "null"
          title: Title
          description: Title of the writing or publication
        description:
          anyOf:
            - type: string
            - type: "null"
          title: Description
          description: Summary or description of the content
        date:
          anyOf:
            - type: string
            - type: "null"
          title: Date
          description: Publication date (YYYY-MM-DD format)
        urls:
          anyOf:
            - items:
                type: string
              type: array
            - type: "null"
          title: Urls
          description: URLs to the publication
      additionalProperties: false
      type: object
      title: WritingV1
      description: Writing or publication
    HobbyV1:
      properties:
        description:
          anyOf:
            - type: string
            - type: "null"
          title: Description
          description: Description of the hobby or interest
        urls:
          anyOf:
            - items:
                type: string
              type: array
            - type: "null"
          title: Urls
          description: Related URLs (blog, portfolio, etc.)
      additionalProperties: false
      type: object
      title: HobbyV1
      description: Hobby or personal interest
    SummaryV1:
      properties:
        text:
          type: string
          title: Text
          description: Combined summary text
        urls:
          anyOf:
            - items:
                type: string
              type: array
            - type: "null"
          title: Urls
          description: Deduplicated URLs supporting the summary
      additionalProperties: false
      type: object
      required:
        - text
      title: SummaryV1
      description: Comprehensive summary of the person's profile
    CurrentLocationV1:
      properties:
        location:
          type: string
          title: Location
          description: Location name (e.g., 'Palo Alto, California')
        comments:
          anyOf:
            - type: string
            - type: "null"
          title: Comments
          description: Notes or context about the location
        urls:
          anyOf:
            - items:
                type: string
              type: array
            - type: "null"
          title: Urls
          description: URLs confirming this location
      additionalProperties: false
      type: object
      required:
        - location
      title: CurrentLocationV1
      description: Current location information
  securitySchemes:
    HTTPBearer:
      type: http
      scheme: bearer
````

This documentation is built and hosted on [Mintlify](https://mintlify.com), a developer documentation platform.
