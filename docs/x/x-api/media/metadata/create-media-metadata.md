> ## Documentation Index
>
> Fetch the complete documentation index at: https://docs.x.com/llms.txt
> Use this file to discover all available pages before exploring further.

# Create Media metadata

> Creates metadata for a Media file.

## OpenAPI

```yaml post /2/media/metadata
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
  /2/media/metadata:
    post:
      tags:
        - Media
      summary: Create Media metadata
      description: Creates metadata for a Media file.
      operationId: createMediaMetadata
      parameters: []
      requestBody:
        content:
          application/json:
            schema:
              $ref: "#/components/schemas/MetadataCreateRequest"
      responses:
        "200":
          description: The request has succeeded.
          content:
            application/json:
              schema:
                $ref: "#/components/schemas/MetadataCreateResponse"
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
        - OAuth2UserToken:
            - media.write
        - UserToken: []
      externalDocs:
        url: https://docs.x.com/x-api/media/media-metadata-create#metadata-create
components:
  schemas:
    MetadataCreateRequest:
      type: object
      required:
        - id
      properties:
        id:
          $ref: "#/components/schemas/MediaId"
        metadata:
          type: object
          properties:
            allow_download_status:
              $ref: "#/components/schemas/AllowDownloadStatus"
            alt_text:
              $ref: "#/components/schemas/AltText"
            audience_policy:
              $ref: "#/components/schemas/AudiencePolicy"
            content_expiration:
              $ref: "#/components/schemas/ContentExpiration"
            domain_restrictions:
              $ref: "#/components/schemas/DomainRestrictions"
            found_media_origin:
              $ref: "#/components/schemas/FoundMediaOrigin"
            geo_restrictions:
              $ref: "#/components/schemas/GeoRestrictions"
            management_info:
              $ref: "#/components/schemas/ManagementInfo"
            preview_image:
              $ref: "#/components/schemas/PreviewImage"
            sensitive_media_warning:
              $ref: "#/components/schemas/SensitiveMediaWarning"
            shared_info:
              $ref: "#/components/schemas/SharedInfo"
            sticker_info:
              $ref: "#/components/schemas/StickerInfo"
            upload_source:
              $ref: "#/components/schemas/UploadSource"
    MetadataCreateResponse:
      type: object
      properties:
        data:
          type: object
          properties:
            associated_metadata:
              type: object
              properties:
                allow_download_status:
                  $ref: "#/components/schemas/AllowDownloadStatus"
                alt_text:
                  $ref: "#/components/schemas/AltText"
                audience_policy:
                  $ref: "#/components/schemas/AudiencePolicy"
                content_expiration:
                  $ref: "#/components/schemas/ContentExpiration"
                domain_restrictions:
                  $ref: "#/components/schemas/DomainRestrictions"
                found_media_origin:
                  $ref: "#/components/schemas/FoundMediaOrigin"
                geo_restrictions:
                  $ref: "#/components/schemas/GeoRestrictions"
                management_info:
                  $ref: "#/components/schemas/ManagementInfo"
                preview_image:
                  $ref: "#/components/schemas/PreviewImage"
                sensitive_media_warning:
                  $ref: "#/components/schemas/SensitiveMediaWarning"
                shared_info:
                  $ref: "#/components/schemas/SharedInfo"
                sticker_info:
                  $ref: "#/components/schemas/StickerInfo"
                upload_source:
                  $ref: "#/components/schemas/UploadSource"
            id:
              $ref: "#/components/schemas/MediaId"
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
    MediaId:
      type: string
      description: The unique identifier of this Media.
      pattern: ^[0-9]{1,19}$
      example: "1146654567674912769"
    AllowDownloadStatus:
      type: object
      properties:
        allow_download:
          type: boolean
          example: true
    AltText:
      type: object
      required:
        - text
      properties:
        text:
          type: string
          description: Description of media ( <= 1000 characters )
          maxLength: 1000
          example: A dancing cat
    AudiencePolicy:
      type: object
      properties:
        creator_subscriptions:
          type: array
          items:
            type: string
            enum:
              - Any
        x_subscriptions:
          type: array
          items:
            type: string
            enum:
              - Any
    ContentExpiration:
      type: object
      required:
        - timestamp_sec
      properties:
        timestamp_sec:
          type: number
          description: Expiration time for content as a Unix timestamp in seconds
          format: long
          example: 1740787200
    DomainRestrictions:
      type: object
      required:
        - whitelist
      properties:
        whitelist:
          type: array
          description: List of whitelisted domains
          items:
            type: string
    FoundMediaOrigin:
      type: object
      required:
        - provider
        - id
      properties:
        id:
          type: string
          description: Unique Identifier of media within provider ( <= 24 characters ))
          example: u5BzatR15TZ04
        provider:
          type: string
          description: >-
            The media provider (e.g., 'giphy') that sourced the media ( <= 8
            Characters )
          example: giphy
    GeoRestrictions:
      oneOf:
        - type: object
          required:
            - whitelisted_country_codes
            - blacklisted_country_codes
          properties:
            blacklisted_country_codes:
              type: array
              description: List of blacklisted country codes
              minItems: 0
              maxItems: 0
              items:
                type: string
                description: Country code in ISO 3166-1 alpha-2 format
                pattern: ^[a-zA-Z]{2}$
                example: us
            whitelisted_country_codes:
              type: array
              description: List of whitelisted country codes
              minItems: 1
              items:
                type: string
                description: Country code in ISO 3166-1 alpha-2 format
                pattern: ^[a-zA-Z]{2}$
                example: us
        - type: object
          required:
            - whitelisted_country_codes
            - blacklisted_country_codes
          properties:
            blacklisted_country_codes:
              type: array
              description: List of blacklisted country codes
              minItems: 1
              items:
                type: string
                description: Country code in ISO 3166-1 alpha-2 format
                pattern: ^[a-zA-Z]{2}$
                example: us
            whitelisted_country_codes:
              type: array
              description: List of whitelisted country codes
              minItems: 0
              maxItems: 0
              items:
                type: string
                description: Country code in ISO 3166-1 alpha-2 format
                pattern: ^[a-zA-Z]{2}$
                example: us
    ManagementInfo:
      type: object
      required:
        - managed
      properties:
        managed:
          type: boolean
          description: Indicates if the media is managed by Media Studio
          example: false
    PreviewImage:
      type: object
      required:
        - media_key
      properties:
        media_key:
          type: object
          properties:
            media:
              $ref: "#/components/schemas/MediaId"
            media_category:
              type: string
              description: The media category of media
              enum:
                - TweetImage
              default: TweetImage
              example: TweetImage
    SensitiveMediaWarning:
      type: object
      properties:
        adult_content:
          type: boolean
          description: Indicates if the content contains adult material
          example: true
        graphic_violence:
          type: boolean
          description: Indicates if the content depicts graphic violence
          example: true
        other:
          type: boolean
          description: Indicates if the content has other sensitive characteristics
          example: false
    SharedInfo:
      type: object
      required:
        - shared
      properties:
        shared:
          type: boolean
          description: Indicates if the media is shared in direct messages
          example: false
    StickerInfo:
      type: object
      required:
        - stickers
      properties:
        stickers:
          type: array
          description: Stickers list must not be empty and should not exceed 25
          items:
            $ref: "#/components/schemas/Sticker"
    UploadSource:
      type: object
      required:
        - upload_source
      properties:
        upload_source:
          type: string
          description: >-
            Records the source (e.g., app, device) from which the media was
            uploaded
          example: gallery
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
    Sticker:
      type: object
      properties:
        aspect_ratio:
          type: number
          description: width-to-height ratio of the media
          format: double
          example: 1.78
        group_annotation_id:
          type: number
          description: >-
            A unique identifier for the group of annotations associated with the
            media
          format: long
          example: 987654321098765
        id:
          type: string
          description: Unique identifier for sticker
          example: "12345"
        sticker_set_annotation_id:
          type: number
          description: A unique identifier for the sticker set associated with the media
          format: long
          example: 123456789012345
        transform_a:
          type: number
          description: Scale or rotate the media on the x-axis
          format: double
          example: 1
        transform_b:
          type: number
          description: Skew the media on the x-axis
          format: double
          example: 0
        transform_c:
          type: number
          description: Skew the media on the y-axis
          format: double
          example: 0
        transform_d:
          type: number
          description: Scale or rotate the media on the y-axis
          format: double
          example: 1
        transform_tx:
          type: number
          description: Scale or rotate the media on the x-axis
          format: double
          example: 10.5
        transform_ty:
          type: number
          description: The vertical translation (shift) value for the media
          format: double
          example: -5.2
  securitySchemes:
    OAuth2UserToken:
      type: oauth2
      flows:
        authorizationCode:
          authorizationUrl: https://api.x.com/2/oauth2/authorize
          tokenUrl: https://api.x.com/2/oauth2/token
          scopes:
            block.read: View accounts you have blocked.
            bookmark.read: Read your bookmarked Posts.
            bookmark.write: Create and delete your bookmarks.
            dm.read: Read all your Direct Messages.
            dm.write: Send and manage your Direct Messages.
            follows.read: View accounts you follow and accounts following you.
            follows.write: Follow and unfollow accounts on your behalf.
            like.read: View Posts you have liked and likes you can see.
            like.write: Like and unlike Posts on your behalf.
            list.read: >-
              View Lists, members, and followers of Lists you created or are a
              member of, including private Lists.
            list.write: Create and manage Lists on your behalf.
            media.write: Upload media, such as photos and videos, on your behalf.
            mute.read: View accounts you have muted.
            mute.write: Mute and unmute accounts on your behalf.
            offline.access: Request a refresh token for the app.
            space.read: View all Spaces you have access to.
            timeline.read: >-
              View all Custom Timelines you can see, including public Custom
              Timelines from other developers.
            tweet.moderate.write: Hide and unhide replies to your Posts.
            tweet.read: >-
              View all Posts you can see, including those from protected
              accounts.
            tweet.write: Post and repost on your behalf.
            users.read: View any account you can see, including protected accounts.
    UserToken:
      type: http
      scheme: OAuth
```
