> ## Documentation Index
>
> Fetch the complete documentation index at: https://docs.x.com/llms.txt
> Use this file to discover all available pages before exploring further.

# Delete webhook

> Deletes an existing webhook configuration.

## OpenAPI

```yaml delete /2/webhooks/{webhook_id}
openapi: 3.0.0
info:
  description: X API v2 available endpoints
  version: "2.160"
  title: X API v2
  termsOfService: https://developer.x.com/en/developer-terms/agreement-and-policy.html
  contact:
    name: X Developers
    url: https://developer.x.com/
  license:
    name: X Developer Agreement and Policy
    url: https://developer.x.com/en/developer-terms/agreement-and-policy.html
servers:
  - description: X API
    url: https://api.x.com
security: []
tags:
  - name: Account Activity
    description: Endpoints relating to retrieving, managing AAA subscriptions
    externalDocs:
      description: Find out more
      url: >-
        https://docs.x.com/x-api/enterprise-gnip-2.0/fundamentals/account-activity
  - name: Bookmarks
    description: Endpoints related to retrieving, managing bookmarks of a user
    externalDocs:
      description: Find out more
      url: https://developer.twitter.com/en/docs/twitter-api/bookmarks
  - name: Compliance
    description: Endpoints related to keeping X data in your systems compliant
    externalDocs:
      description: Find out more
      url: >-
        https://developer.twitter.com/en/docs/twitter-api/compliance/batch-tweet/introduction
  - name: Connections
    description: Endpoints related to streaming connections
    externalDocs:
      description: Find out more
      url: https://developer.x.com/en/docs/x-api/connections
  - name: Direct Messages
    description: Endpoints related to retrieving, managing Direct Messages
    externalDocs:
      description: Find out more
      url: https://developer.twitter.com/en/docs/twitter-api/direct-messages
  - name: General
    description: Miscellaneous endpoints for general API functionality
    externalDocs:
      description: Find out more
      url: https://developer.twitter.com/en/docs/twitter-api
  - name: Lists
    description: Endpoints related to retrieving, managing Lists
    externalDocs:
      description: Find out more
      url: https://developer.twitter.com/en/docs/twitter-api/lists
  - name: Marketplace
    description: Endpoints related to marketplace handles
    externalDocs:
      description: Handle marketplace availability
      url: https://docs.x.com/x-api/marketplace/handles/availability
  - name: Media
    description: Endpoints related to Media
    externalDocs:
      description: Find out more
      url: https://developer.x.com
  - name: MediaUpload
    description: Endpoints related to uploading Media
    externalDocs:
      description: Find out more
      url: https://developer.x.com
  - name: News
    description: Endpoint for retrieving news stories
    externalDocs:
      description: Find out more
      url: https://developer.twitter.com/en/docs/twitter-api/news
  - name: Spaces
    description: Endpoints related to retrieving, managing Spaces
    externalDocs:
      description: Find out more
      url: https://developer.twitter.com/en/docs/twitter-api/spaces
  - name: Stream
    description: Endpoints related to streaming
    externalDocs:
      description: Find out more
      url: https://developer.x.com
  - name: Tweets
    description: Endpoints related to retrieving, searching, and modifying Tweets
    externalDocs:
      description: Find out more
      url: https://developer.twitter.com/en/docs/twitter-api/tweets/lookup
  - name: Users
    description: Endpoints related to retrieving, managing relationships of Users
    externalDocs:
      description: Find out more
      url: https://developer.twitter.com/en/docs/twitter-api/users/lookup
paths:
  /2/webhooks/{webhook_id}:
    delete:
      tags:
        - Webhooks
      summary: Delete webhook
      description: Deletes an existing webhook configuration.
      operationId: deleteWebhooks
      parameters:
        - name: webhook_id
          in: path
          description: The ID of the webhook to delete.
          required: true
          schema:
            $ref: "#/components/schemas/WebhookConfigId"
          style: simple
      responses:
        "200":
          description: The request has succeeded.
          content:
            application/json:
              schema:
                $ref: "#/components/schemas/WebhookConfigDeleteResponse"
        default:
          description: The request has failed.
          content:
            application/json:
              schema:
                $ref: "#/components/schemas/Error"
            application/problem+json:
              schema:
                $ref: "#/components/schemas/Problem"
      security:
        - BearerToken: []
        - UserToken: []
      externalDocs:
        url: https://docs.x.com/x-api/webhooks/introduction
components:
  schemas:
    WebhookConfigId:
      type: string
      description: The unique identifier of this webhook config.
      pattern: ^[0-9]{1,19}$
      example: "1146654567674912769"
    WebhookConfigDeleteResponse:
      type: object
      properties:
        data:
          type: object
          properties:
            deleted:
              type: boolean
        errors:
          type: array
          minItems: 1
          items:
            $ref: "#/components/schemas/Problem"
    Error:
      type: object
      required:
        - code
        - message
      properties:
        code:
          type: integer
          format: int32
        message:
          type: string
    Problem:
      type: object
      description: >-
        An HTTP Problem Details object, as defined in IETF RFC 7807
        (https://tools.ietf.org/html/rfc7807).
      required:
        - type
        - title
      properties:
        detail:
          type: string
        status:
          type: integer
        title:
          type: string
        type:
          type: string
      discriminator:
        propertyName: type
        mapping:
          about:blank:
            $ref: "#/components/schemas/GenericProblem"
          https://api.twitter.com/2/problems/client-disconnected:
            $ref: "#/components/schemas/ClientDisconnectedProblem"
          https://api.twitter.com/2/problems/client-forbidden:
            $ref: "#/components/schemas/ClientForbiddenProblem"
          https://api.twitter.com/2/problems/conflict:
            $ref: "#/components/schemas/ConflictProblem"
          https://api.twitter.com/2/problems/disallowed-resource:
            $ref: "#/components/schemas/DisallowedResourceProblem"
          https://api.twitter.com/2/problems/duplicate-rules:
            $ref: "#/components/schemas/DuplicateRuleProblem"
          https://api.twitter.com/2/problems/invalid-request:
            $ref: "#/components/schemas/InvalidRequestProblem"
          https://api.twitter.com/2/problems/invalid-rules:
            $ref: "#/components/schemas/InvalidRuleProblem"
          https://api.twitter.com/2/problems/noncompliant-rules:
            $ref: "#/components/schemas/NonCompliantRulesProblem"
          https://api.twitter.com/2/problems/not-authorized-for-field:
            $ref: "#/components/schemas/FieldUnauthorizedProblem"
          https://api.twitter.com/2/problems/not-authorized-for-resource:
            $ref: "#/components/schemas/ResourceUnauthorizedProblem"
          https://api.twitter.com/2/problems/operational-disconnect:
            $ref: "#/components/schemas/OperationalDisconnectProblem"
          https://api.twitter.com/2/problems/resource-not-found:
            $ref: "#/components/schemas/ResourceNotFoundProblem"
          https://api.twitter.com/2/problems/resource-unavailable:
            $ref: "#/components/schemas/ResourceUnavailableProblem"
          https://api.twitter.com/2/problems/rule-cap:
            $ref: "#/components/schemas/RulesCapProblem"
          https://api.twitter.com/2/problems/streaming-connection:
            $ref: "#/components/schemas/ConnectionExceptionProblem"
          https://api.twitter.com/2/problems/unsupported-authentication:
            $ref: "#/components/schemas/UnsupportedAuthenticationProblem"
          https://api.twitter.com/2/problems/usage-capped:
            $ref: "#/components/schemas/UsageCapExceededProblem"
    GenericProblem:
      description: >-
        A generic problem with no additional information beyond that provided by
        the HTTP status code.
      allOf:
        - $ref: "#/components/schemas/Problem"
    ClientDisconnectedProblem:
      description: Your client has gone away.
      allOf:
        - $ref: "#/components/schemas/Problem"
    ClientForbiddenProblem:
      description: >-
        A problem that indicates your client is forbidden from making this
        request.
      allOf:
        - $ref: "#/components/schemas/Problem"
        - type: object
          properties:
            reason:
              type: string
              enum:
                - official-client-forbidden
                - client-not-enrolled
            registration_url:
              type: string
              format: uri
    ConflictProblem:
      description: You cannot create a new job if one is already in progress.
      allOf:
        - $ref: "#/components/schemas/Problem"
    DisallowedResourceProblem:
      description: >-
        A problem that indicates that the resource requested violates the
        precepts of this API.
      allOf:
        - $ref: "#/components/schemas/Problem"
        - type: object
          required:
            - resource_id
            - resource_type
            - section
          properties:
            resource_id:
              type: string
            resource_type:
              type: string
              enum:
                - user
                - tweet
                - media
                - list
                - space
            section:
              type: string
              enum:
                - data
                - includes
    DuplicateRuleProblem:
      description: The rule you have submitted is a duplicate.
      allOf:
        - $ref: "#/components/schemas/Problem"
        - type: object
          properties:
            id:
              type: string
            value:
              type: string
    InvalidRequestProblem:
      description: A problem that indicates this request is invalid.
      allOf:
        - $ref: "#/components/schemas/Problem"
        - type: object
          properties:
            errors:
              type: array
              minItems: 1
              items:
                type: object
                properties:
                  message:
                    type: string
                  parameters:
                    type: object
                    additionalProperties:
                      type: array
                      items:
                        type: string
    InvalidRuleProblem:
      description: The rule you have submitted is invalid.
      allOf:
        - $ref: "#/components/schemas/Problem"
    NonCompliantRulesProblem:
      description: A problem that indicates the user's rule set is not compliant.
      allOf:
        - $ref: "#/components/schemas/Problem"
    FieldUnauthorizedProblem:
      description: >-
        A problem that indicates that you are not allowed to see a particular
        field on a Tweet, User, etc.
      allOf:
        - $ref: "#/components/schemas/Problem"
        - type: object
          required:
            - resource_type
            - field
            - section
          properties:
            field:
              type: string
            resource_type:
              type: string
              enum:
                - user
                - tweet
                - media
                - list
                - space
            section:
              type: string
              enum:
                - data
                - includes
    ResourceUnauthorizedProblem:
      description: >-
        A problem that indicates you are not allowed to see a particular Tweet,
        User, etc.
      allOf:
        - $ref: "#/components/schemas/Problem"
        - type: object
          required:
            - value
            - resource_id
            - resource_type
            - section
            - parameter
          properties:
            parameter:
              type: string
            resource_id:
              type: string
            resource_type:
              type: string
              enum:
                - user
                - tweet
                - media
                - list
                - space
            section:
              type: string
              enum:
                - data
                - includes
            value:
              type: string
    OperationalDisconnectProblem:
      description: You have been disconnected for operational reasons.
      allOf:
        - $ref: "#/components/schemas/Problem"
        - type: object
          properties:
            disconnect_type:
              type: string
              enum:
                - OperationalDisconnect
                - UpstreamOperationalDisconnect
                - ForceDisconnect
                - UpstreamUncleanDisconnect
                - SlowReader
                - InternalError
                - ClientApplicationStateDegraded
                - InvalidRules
    ResourceNotFoundProblem:
      description: A problem that indicates that a given Tweet, User, etc. does not exist.
      allOf:
        - $ref: "#/components/schemas/Problem"
        - type: object
          required:
            - parameter
            - value
            - resource_id
            - resource_type
          properties:
            parameter:
              type: string
              minLength: 1
            resource_id:
              type: string
            resource_type:
              type: string
              enum:
                - user
                - tweet
                - media
                - list
                - space
            value:
              type: string
              description: Value will match the schema of the field.
    ResourceUnavailableProblem:
      description: >-
        A problem that indicates a particular Tweet, User, etc. is not available
        to you.
      allOf:
        - $ref: "#/components/schemas/Problem"
        - type: object
          required:
            - parameter
            - resource_id
            - resource_type
          properties:
            parameter:
              type: string
              minLength: 1
            resource_id:
              type: string
            resource_type:
              type: string
              enum:
                - user
                - tweet
                - media
                - list
                - space
    RulesCapProblem:
      description: You have exceeded the maximum number of rules.
      allOf:
        - $ref: "#/components/schemas/Problem"
    ConnectionExceptionProblem:
      description: A problem that indicates something is wrong with the connection.
      allOf:
        - $ref: "#/components/schemas/Problem"
        - type: object
          properties:
            connection_issue:
              type: string
              enum:
                - TooManyConnections
                - ProvisioningSubscription
                - RuleConfigurationIssue
                - RulesInvalidIssue
    UnsupportedAuthenticationProblem:
      description: A problem that indicates that the authentication used is not supported.
      allOf:
        - $ref: "#/components/schemas/Problem"
    UsageCapExceededProblem:
      description: A problem that indicates that a usage cap has been exceeded.
      allOf:
        - $ref: "#/components/schemas/Problem"
        - type: object
          properties:
            period:
              type: string
              enum:
                - Daily
                - Monthly
            scope:
              type: string
              enum:
                - Account
                - Product
  securitySchemes:
    BearerToken:
      type: http
      scheme: bearer
    UserToken:
      type: http
      scheme: OAuth
```
