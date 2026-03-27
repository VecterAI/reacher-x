> ## Documentation Index
>
> Fetch the complete documentation index at: https://docs.x.com/llms.txt
> Use this file to discover all available pages before exploring further.

# Activity Stream

> Stream of X Activities

## OpenAPI

```yaml get /2/activity/stream
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
  /2/activity/stream:
    get:
      tags:
        - Activity
        - Stream
      summary: Activity Stream
      description: Stream of X Activities
      operationId: activityStream
      parameters:
        - name: backfill_minutes
          in: query
          description: The number of minutes of backfill requested.
          required: false
          schema:
            type: integer
            minimum: 0
            maximum: 5
            format: int32
          style: form
        - name: start_time
          in: query
          description: >-
            YYYY-MM-DDTHH:mm:ssZ. The earliest UTC timestamp from which the Post
            labels will be provided.
          required: false
          example: "2021-02-01T18:40:40.000Z"
          schema:
            type: string
            format: date-time
          style: form
        - name: end_time
          in: query
          description: >-
            YYYY-MM-DDTHH:mm:ssZ. The latest UTC timestamp from which the Post
            labels will be provided.
          required: false
          example: "2021-02-01T18:40:40.000Z"
          schema:
            type: string
            format: date-time
          style: form
      responses:
        "200":
          description: The request has succeeded.
          content:
            application/json:
              schema:
                $ref: "#/components/schemas/ActivityStreamingResponse"
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
      externalDocs:
        url: https://docs.x.com/x-api/activity/activity-stream
components:
  schemas:
    ActivityStreamingResponse:
      type: object
      description: >-
        An activity event or error that can be returned by the x activity
        streaming API.
      properties:
        data:
          type: object
          properties:
            event_type:
              type: string
            event_uuid:
              $ref: "#/components/schemas/ActivityEventId"
            filter:
              $ref: "#/components/schemas/ActivitySubscriptionFilter"
            payload:
              $ref: "#/components/schemas/ActivityStreamingResponsePayload"
            tag:
              type: string
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
    ActivityEventId:
      type: string
      description: The unique identifier of an Activity event.
      pattern: ^[0-9]{1,19}$
      example: "1146654567674912769"
    ActivitySubscriptionFilter:
      type: object
      description: An XAA subscription filter.
      properties:
        direction:
          type: string
          description: Optional direction filter for directional events.
          enum:
            - inbound
            - outbound
        keyword:
          $ref: "#/components/schemas/Keyword"
        user_id:
          $ref: "#/components/schemas/UserId"
      additionalProperties: false
    ActivityStreamingResponsePayload:
      oneOf:
        - $ref: "#/components/schemas/ProfileUpdateActivityResponsePayload"
        - $ref: "#/components/schemas/NewsActivityResponsePayload"
        - $ref: "#/components/schemas/FollowActivityResponsePayload"
      discriminator:
        propertyName: ../event_type
        mapping:
          follow.follow:
            $ref: "#/components/schemas/FollowActivityResponsePayload"
          follow.unfollow:
            $ref: "#/components/schemas/FollowActivityResponsePayload"
          news.new:
            $ref: "#/components/schemas/NewsActivityResponsePayload"
          profile.update.affiliate_badge:
            $ref: "#/components/schemas/ProfileUpdateActivityResponsePayload"
          profile.update.banner_picture:
            $ref: "#/components/schemas/ProfileUpdateActivityResponsePayload"
          profile.update.bio:
            $ref: "#/components/schemas/ProfileUpdateActivityResponsePayload"
          profile.update.geo:
            $ref: "#/components/schemas/ProfileUpdateActivityResponsePayload"
          profile.update.handle:
            $ref: "#/components/schemas/ProfileUpdateActivityResponsePayload"
          profile.update.profile_picture:
            $ref: "#/components/schemas/ProfileUpdateActivityResponsePayload"
          profile.update.screenname:
            $ref: "#/components/schemas/ProfileUpdateActivityResponsePayload"
          profile.update.url:
            $ref: "#/components/schemas/ProfileUpdateActivityResponsePayload"
          profile.update.verified_badge:
            $ref: "#/components/schemas/ProfileUpdateActivityResponsePayload"
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
    Keyword:
      type: string
      description: A keyword to filter on.
      minLength: 1
      maxLength: 150
      example: The President
    UserId:
      type: string
      description: >-
        Unique identifier of this User. This is returned as a string in order to
        avoid complications with languages and tools that cannot handle large
        integers.
      pattern: ^[0-9]{1,19}$
      example: "2244994945"
    ProfileUpdateActivityResponsePayload:
      type: object
      properties:
        after:
          type: string
        before:
          type: string
      additionalProperties: false
    NewsActivityResponsePayload:
      type: object
      properties:
        category:
          type: string
        headline:
          type: string
        hook:
          type: string
        summary:
          type: string
      additionalProperties: false
    FollowActivityResponsePayload:
      type: object
      properties:
        source:
          $ref: "#/components/schemas/User"
        target:
          $ref: "#/components/schemas/User"
      additionalProperties: false
    User:
      type: object
      description: The X User object.
      required:
        - id
        - name
        - username
      properties:
        affiliation:
          type: object
          description: Metadata about a user's affiliation.
          properties:
            badge_url:
              type: string
              description: The badge URL corresponding to the affiliation.
              format: uri
            description:
              type: string
              description: The description of the affiliation.
            url:
              type: string
              description: The URL, if available, to details about an affiliation.
              format: uri
            user_id:
              type: array
              minItems: 1
              items:
                $ref: "#/components/schemas/UserId"
        connection_status:
          type: array
          description: >-
            Returns detailed information about the relationship between two
            users.
          minItems: 0
          items:
            type: string
            description: Type of connection between users.
            enum:
              - follow_request_received
              - follow_request_sent
              - blocking
              - followed_by
              - following
              - muting
        created_at:
          type: string
          description: Creation time of this User.
          format: date-time
        description:
          type: string
          description: >-
            The text of this User's profile description (also known as bio), if
            the User provided one.
        entities:
          type: object
          description: A list of metadata found in the User's profile description.
          properties:
            description:
              $ref: "#/components/schemas/FullTextEntities"
            url:
              type: object
              description: >-
                Expanded details for the URL specified in the User's profile,
                with start and end indices.
              properties:
                urls:
                  type: array
                  minItems: 1
                  items:
                    $ref: "#/components/schemas/UrlEntity"
        id:
          $ref: "#/components/schemas/UserId"
        location:
          type: string
          description: >-
            The location specified in the User's profile, if the User provided
            one. As this is a freeform value, it may not indicate a valid
            location, but it may be fuzzily evaluated when performing searches
            with location queries.
        most_recent_tweet_id:
          $ref: "#/components/schemas/TweetId"
        name:
          type: string
          description: The friendly name of this User, as shown on their profile.
        pinned_tweet_id:
          $ref: "#/components/schemas/TweetId"
        profile_banner_url:
          type: string
          description: The URL to the profile banner for this User.
          format: uri
        profile_image_url:
          type: string
          description: The URL to the profile image for this User.
          format: uri
        protected:
          type: boolean
          description: >-
            Indicates if this User has chosen to protect their Posts (in other
            words, if this User's Posts are private).
        public_metrics:
          type: object
          description: A list of metrics for this User.
          required:
            - followers_count
            - following_count
            - tweet_count
            - listed_count
          properties:
            followers_count:
              type: integer
              description: Number of Users who are following this User.
            following_count:
              type: integer
              description: Number of Users this User is following.
            like_count:
              type: integer
              description: The number of likes created by this User.
            listed_count:
              type: integer
              description: The number of lists that include this User.
            tweet_count:
              type: integer
              description: The number of Posts (including Retweets) posted by this User.
        receives_your_dm:
          type: boolean
          description: Indicates if you can send a DM to this User
        subscription_type:
          type: string
          description: >-
            The X Blue subscription type of the user, eg: Basic, Premium,
            PremiumPlus or None.
          enum:
            - Basic
            - Premium
            - PremiumPlus
            - None
        url:
          type: string
          description: The URL specified in the User's profile.
        username:
          $ref: "#/components/schemas/UserName"
        verified:
          type: boolean
          description: Indicate if this User is a verified X User.
        verified_type:
          type: string
          description: >-
            The X Blue verified type of the user, eg: blue, government, business
            or none.
          enum:
            - blue
            - government
            - business
            - none
        withheld:
          $ref: "#/components/schemas/UserWithheld"
      example:
        created_at: "2013-12-14T04:35:55Z"
        id: "2244994945"
        name: X Dev
        protected: false
        username: TwitterDev
    FullTextEntities:
      type: object
      properties:
        annotations:
          type: array
          minItems: 1
          items:
            description: Annotation for entities based on the Tweet text.
            allOf:
              - $ref: "#/components/schemas/EntityIndicesInclusiveInclusive"
              - type: object
                description: Represents the data for the annotation.
                properties:
                  normalized_text:
                    type: string
                    description: Text used to determine annotation.
                    example: Barack Obama
                  probability:
                    type: number
                    description: Confidence factor for annotation type.
                    minimum: 0
                    maximum: 1
                    format: double
                  type:
                    type: string
                    description: Annotation type.
                    example: Person
        cashtags:
          type: array
          minItems: 1
          items:
            $ref: "#/components/schemas/CashtagEntity"
        hashtags:
          type: array
          minItems: 1
          items:
            $ref: "#/components/schemas/HashtagEntity"
        mentions:
          type: array
          minItems: 1
          items:
            $ref: "#/components/schemas/MentionEntity"
        urls:
          type: array
          minItems: 1
          items:
            $ref: "#/components/schemas/UrlEntity"
    UrlEntity:
      description: >-
        Represent the portion of text recognized as a URL, and its start and end
        position within the text.
      allOf:
        - $ref: "#/components/schemas/EntityIndicesInclusiveExclusive"
        - $ref: "#/components/schemas/UrlFields"
    TweetId:
      type: string
      description: >-
        Unique identifier of this Tweet. This is returned as a string in order
        to avoid complications with languages and tools that cannot handle large
        integers.
      pattern: ^[0-9]{1,19}$
      example: "1346889436626259968"
    UserName:
      type: string
      description: The X handle (screen name) of this user.
      pattern: ^[A-Za-z0-9_]{1,15}$
    UserWithheld:
      type: object
      description: >-
        Indicates withholding details for [withheld
        content](https://help.twitter.com/en/rules-and-policies/tweet-withheld-by-country).
      required:
        - country_codes
      properties:
        country_codes:
          type: array
          description: Provides a list of countries where this content is not available.
          minItems: 1
          uniqueItems: true
          items:
            $ref: "#/components/schemas/CountryCode"
        scope:
          type: string
          description: Indicates that the content being withheld is a `user`.
          enum:
            - user
    EntityIndicesInclusiveInclusive:
      type: object
      description: >-
        Represent a boundary range (start and end index) for a recognized entity
        (for example a hashtag or a mention). `start` must be smaller than
        `end`.  The start index is inclusive, the end index is inclusive.
      required:
        - start
        - end
      properties:
        end:
          type: integer
          description: >-
            Index (zero-based) at which position this entity ends.  The index is
            inclusive.
          minimum: 0
          example: 61
        start:
          type: integer
          description: >-
            Index (zero-based) at which position this entity starts.  The index
            is inclusive.
          minimum: 0
          example: 50
    CashtagEntity:
      allOf:
        - $ref: "#/components/schemas/EntityIndicesInclusiveExclusive"
        - $ref: "#/components/schemas/CashtagFields"
    HashtagEntity:
      allOf:
        - $ref: "#/components/schemas/EntityIndicesInclusiveExclusive"
        - $ref: "#/components/schemas/HashtagFields"
    MentionEntity:
      allOf:
        - $ref: "#/components/schemas/EntityIndicesInclusiveExclusive"
        - $ref: "#/components/schemas/MentionFields"
    EntityIndicesInclusiveExclusive:
      type: object
      description: >-
        Represent a boundary range (start and end index) for a recognized entity
        (for example a hashtag or a mention). `start` must be smaller than
        `end`.  The start index is inclusive, the end index is exclusive.
      required:
        - start
        - end
      properties:
        end:
          type: integer
          description: >-
            Index (zero-based) at which position this entity ends.  The index is
            exclusive.
          minimum: 0
          example: 61
        start:
          type: integer
          description: >-
            Index (zero-based) at which position this entity starts.  The index
            is inclusive.
          minimum: 0
          example: 50
    UrlFields:
      type: object
      description: Represent the portion of text recognized as a URL.
      required:
        - url
      properties:
        description:
          type: string
          description: Description of the URL landing page.
          example: This is a description of the website.
        display_url:
          type: string
          description: The URL as displayed in the X client.
          example: twittercommunity.com/t/introducing-…
        expanded_url:
          $ref: "#/components/schemas/Url"
        images:
          type: array
          minItems: 1
          items:
            $ref: "#/components/schemas/UrlImage"
        media_key:
          $ref: "#/components/schemas/MediaKey"
        status:
          $ref: "#/components/schemas/HttpStatusCode"
        title:
          type: string
          description: Title of the page the URL points to.
          example: Introducing the v2 follow lookup endpoints
        unwound_url:
          type: string
          description: Fully resolved url.
          format: uri
          example: >-
            https://twittercommunity.com/t/introducing-the-v2-follow-lookup-endpoints/147118
        url:
          $ref: "#/components/schemas/Url"
    CountryCode:
      type: string
      description: A two-letter ISO 3166-1 alpha-2 country code.
      pattern: ^[A-Z]{2}$
      example: US
    CashtagFields:
      type: object
      description: >-
        Represent the portion of text recognized as a Cashtag, and its start and
        end position within the text.
      required:
        - tag
      properties:
        tag:
          type: string
          example: TWTR
    HashtagFields:
      type: object
      description: >-
        Represent the portion of text recognized as a Hashtag, and its start and
        end position within the text.
      required:
        - tag
      properties:
        tag:
          type: string
          description: The text of the Hashtag.
          example: MondayMotivation
    MentionFields:
      type: object
      description: >-
        Represent the portion of text recognized as a User mention, and its
        start and end position within the text.
      required:
        - username
      properties:
        id:
          $ref: "#/components/schemas/UserId"
        username:
          $ref: "#/components/schemas/UserName"
    Url:
      type: string
      description: A validly formatted URL.
      format: uri
      example: https://developer.twitter.com/en/docs/twitter-api
    UrlImage:
      type: object
      description: Represent the information for the URL image.
      properties:
        height:
          $ref: "#/components/schemas/MediaHeight"
        url:
          $ref: "#/components/schemas/Url"
        width:
          $ref: "#/components/schemas/MediaWidth"
    MediaKey:
      type: string
      description: The Media Key identifier for this attachment.
      pattern: ^([0-9]+)_([0-9]+)$
    HttpStatusCode:
      type: integer
      description: HTTP Status Code.
      minimum: 100
      maximum: 599
    MediaHeight:
      type: integer
      description: The height of the media in pixels.
      minimum: 0
    MediaWidth:
      type: integer
      description: The width of the media in pixels.
      minimum: 0
  securitySchemes:
    BearerToken:
      type: http
      scheme: bearer
```
