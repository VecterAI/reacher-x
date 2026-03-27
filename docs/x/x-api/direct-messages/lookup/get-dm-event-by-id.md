> ## Documentation Index
>
> Fetch the complete documentation index at: https://docs.x.com/llms.txt
> Use this file to discover all available pages before exploring further.

# Get DM event by ID

> Retrieves details of a specific direct message event by its ID.

## OpenAPI

```yaml get /2/dm_events/{event_id}
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
  /2/dm_events/{event_id}:
    get:
      tags:
        - Direct Messages
      summary: Get DM event by ID
      description: Retrieves details of a specific direct message event by its ID.
      operationId: getDirectMessagesEventsById
      parameters:
        - name: event_id
          in: path
          description: dm event id.
          required: true
          schema:
            $ref: "#/components/schemas/DmEventId"
          style: simple
        - $ref: "#/components/parameters/DmEventFieldsParameter"
        - $ref: "#/components/parameters/DmEventExpansionsParameter"
        - $ref: "#/components/parameters/MediaFieldsParameter"
        - $ref: "#/components/parameters/UserFieldsParameter"
        - $ref: "#/components/parameters/TweetFieldsParameter"
      responses:
        "200":
          description: The request has succeeded.
          content:
            application/json:
              schema:
                $ref: "#/components/schemas/Get2DmEventsEventIdResponse"
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
            - dm.read
            - tweet.read
            - users.read
        - UserToken: []
components:
  schemas:
    DmEventId:
      type: string
      description: Unique identifier of a DM Event.
      pattern: ^[0-9]{1,19}$
      example: "1146654567674912769"
    Get2DmEventsEventIdResponse:
      type: object
      properties:
        data:
          $ref: "#/components/schemas/DmEvent"
        errors:
          type: array
          minItems: 1
          items:
            $ref: "#/components/schemas/Problem"
        includes:
          $ref: "#/components/schemas/Expansions"
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
    DmEvent:
      type: object
      required:
        - id
        - event_type
      properties:
        attachments:
          type: object
          description: Specifies the type of attachments (if any) present in this DM.
          properties:
            card_ids:
              type: array
              description: A list of card IDs (if cards are attached).
              minItems: 1
              items:
                type: string
            media_keys:
              type: array
              description: >-
                A list of Media Keys for each one of the media attachments (if
                media are attached).
              minItems: 1
              items:
                $ref: "#/components/schemas/MediaKey"
        cashtags:
          type: array
          minItems: 1
          items:
            $ref: "#/components/schemas/CashtagEntity"
        created_at:
          type: string
          format: date-time
        dm_conversation_id:
          $ref: "#/components/schemas/DmConversationId"
        event_type:
          type: string
          example: MessageCreate
        hashtags:
          type: array
          minItems: 1
          items:
            $ref: "#/components/schemas/HashtagEntity"
        id:
          $ref: "#/components/schemas/DmEventId"
        mentions:
          type: array
          minItems: 1
          items:
            $ref: "#/components/schemas/MentionEntity"
        participant_ids:
          type: array
          description: >-
            A list of participants for a ParticipantsJoin or ParticipantsLeave
            event_type.
          minItems: 1
          items:
            $ref: "#/components/schemas/UserId"
        referenced_tweets:
          type: array
          description: A list of Posts this DM refers to.
          minItems: 1
          items:
            type: object
            required:
              - id
            properties:
              id:
                $ref: "#/components/schemas/TweetId"
        sender_id:
          $ref: "#/components/schemas/UserId"
        text:
          type: string
        urls:
          type: array
          minItems: 1
          items:
            $ref: "#/components/schemas/UrlEntityDm"
    Expansions:
      type: object
      properties:
        media:
          type: array
          minItems: 1
          items:
            $ref: "#/components/schemas/Media"
        places:
          type: array
          minItems: 1
          items:
            $ref: "#/components/schemas/Place"
        polls:
          type: array
          minItems: 1
          items:
            $ref: "#/components/schemas/Poll"
        topics:
          type: array
          minItems: 1
          items:
            $ref: "#/components/schemas/Topic"
        tweets:
          type: array
          minItems: 1
          items:
            $ref: "#/components/schemas/Tweet"
        users:
          type: array
          minItems: 1
          items:
            $ref: "#/components/schemas/User"
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
    MediaKey:
      type: string
      description: The Media Key identifier for this attachment.
      pattern: ^([0-9]+)_([0-9]+)$
    CashtagEntity:
      allOf:
        - $ref: "#/components/schemas/EntityIndicesInclusiveExclusive"
        - $ref: "#/components/schemas/CashtagFields"
    DmConversationId:
      type: string
      description: >-
        Unique identifier of a DM conversation. This can either be a numeric
        string, or a pair of numeric strings separated by a '-' character in the
        case of one-on-one DM Conversations.
      pattern: ^([0-9]{1,19}-[0-9]{1,19}|[0-9]{15,19})$
      example: 123123123-456456456
    HashtagEntity:
      allOf:
        - $ref: "#/components/schemas/EntityIndicesInclusiveExclusive"
        - $ref: "#/components/schemas/HashtagFields"
    MentionEntity:
      allOf:
        - $ref: "#/components/schemas/EntityIndicesInclusiveExclusive"
        - $ref: "#/components/schemas/MentionFields"
    UserId:
      type: string
      description: >-
        Unique identifier of this User. This is returned as a string in order to
        avoid complications with languages and tools that cannot handle large
        integers.
      pattern: ^[0-9]{1,19}$
      example: "2244994945"
    TweetId:
      type: string
      description: >-
        Unique identifier of this Tweet. This is returned as a string in order
        to avoid complications with languages and tools that cannot handle large
        integers.
      pattern: ^[0-9]{1,19}$
      example: "1346889436626259968"
    UrlEntityDm:
      description: >-
        Represent the portion of text recognized as a URL, and its start and end
        position within the text.
      allOf:
        - $ref: "#/components/schemas/EntityIndicesInclusiveExclusive"
        - $ref: "#/components/schemas/UrlFields"
    Media:
      type: object
      required:
        - type
      properties:
        height:
          $ref: "#/components/schemas/MediaHeight"
        media_key:
          $ref: "#/components/schemas/MediaKey"
        type:
          type: string
        width:
          $ref: "#/components/schemas/MediaWidth"
      discriminator:
        propertyName: type
        mapping:
          animated_gif:
            $ref: "#/components/schemas/AnimatedGif"
          photo:
            $ref: "#/components/schemas/Photo"
          video:
            $ref: "#/components/schemas/Video"
    Place:
      type: object
      required:
        - id
        - full_name
      properties:
        contained_within:
          type: array
          minItems: 1
          items:
            $ref: "#/components/schemas/PlaceId"
        country:
          type: string
          description: The full name of the county in which this place exists.
          example: United States
        country_code:
          $ref: "#/components/schemas/CountryCode"
        full_name:
          type: string
          description: The full name of this place.
          example: Lakewood, CO
        geo:
          $ref: "#/components/schemas/Geo"
        id:
          $ref: "#/components/schemas/PlaceId"
        name:
          type: string
          description: The human readable name of this place.
          example: Lakewood
        place_type:
          $ref: "#/components/schemas/PlaceType"
    Poll:
      type: object
      description: Represent a Poll attached to a Tweet.
      required:
        - id
        - options
      properties:
        duration_minutes:
          type: integer
          minimum: 5
          maximum: 10080
          format: int32
        end_datetime:
          type: string
          format: date-time
        id:
          $ref: "#/components/schemas/PollId"
        options:
          type: array
          minItems: 2
          maxItems: 4
          items:
            $ref: "#/components/schemas/PollOption"
        voting_status:
          type: string
          enum:
            - open
            - closed
    Topic:
      type: object
      description: The topic of a Space, as selected by its creator.
      required:
        - id
        - name
      properties:
        description:
          type: string
          description: The description of the given topic.
          example: All about technology
        id:
          $ref: "#/components/schemas/TopicId"
        name:
          type: string
          description: The name of the given topic.
          example: Technology
    Tweet:
      type: object
      properties:
        attachments:
          type: object
          description: Specifies the type of attachments (if any) present in this Tweet.
          properties:
            media_keys:
              type: array
              description: >-
                A list of Media Keys for each one of the media attachments (if
                media are attached).
              minItems: 1
              items:
                $ref: "#/components/schemas/MediaKey"
            media_source_tweet_id:
              type: array
              description: >-
                A list of Posts the media on this Tweet was originally posted
                in. For example, if the media on a tweet is re-used in another
                Tweet, this refers to the original, source Tweet..
              minItems: 1
              items:
                $ref: "#/components/schemas/TweetId"
            poll_ids:
              type: array
              description: A list of poll IDs (if polls are attached).
              minItems: 1
              items:
                $ref: "#/components/schemas/PollId"
        author_id:
          $ref: "#/components/schemas/UserId"
        community_id:
          $ref: "#/components/schemas/CommunityId"
        context_annotations:
          type: array
          minItems: 1
          items:
            $ref: "#/components/schemas/ContextAnnotation"
        conversation_id:
          $ref: "#/components/schemas/TweetId"
        created_at:
          type: string
          description: Creation time of the Tweet.
          format: date-time
          example: "2021-01-06T18:40:40.000Z"
        display_text_range:
          $ref: "#/components/schemas/DisplayTextRange"
        edit_controls:
          type: object
          required:
            - is_edit_eligible
            - editable_until
            - edits_remaining
          properties:
            editable_until:
              type: string
              description: Time when Tweet is no longer editable.
              format: date-time
              example: "2021-01-06T18:40:40.000Z"
            edits_remaining:
              type: integer
              description: Number of times this Tweet can be edited.
            is_edit_eligible:
              type: boolean
              description: Indicates if this Tweet is eligible to be edited.
              example: false
        edit_history_tweet_ids:
          type: array
          description: A list of Tweet Ids in this Tweet chain.
          minItems: 1
          items:
            $ref: "#/components/schemas/TweetId"
        entities:
          $ref: "#/components/schemas/FullTextEntities"
        geo:
          type: object
          description: The location tagged on the Tweet, if the user provided one.
          properties:
            coordinates:
              $ref: "#/components/schemas/Point"
            place_id:
              $ref: "#/components/schemas/PlaceId"
        id:
          $ref: "#/components/schemas/TweetId"
        in_reply_to_user_id:
          $ref: "#/components/schemas/UserId"
        lang:
          type: string
          description: >-
            Language of the Tweet, if detected by X. Returned as a BCP47
            language tag.
          example: en
        non_public_metrics:
          type: object
          description: >-
            Nonpublic engagement metrics for the Tweet at the time of the
            request.
          properties:
            impression_count:
              type: integer
              description: Number of times this Tweet has been viewed.
              format: int32
        note_tweet:
          type: object
          description: The full-content of the Tweet, including text beyond 280 characters.
          properties:
            entities:
              type: object
              properties:
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
            text:
              $ref: "#/components/schemas/NoteTweetText"
        organic_metrics:
          type: object
          description: >-
            Organic nonpublic engagement metrics for the Tweet at the time of
            the request.
          required:
            - impression_count
            - retweet_count
            - reply_count
            - like_count
          properties:
            impression_count:
              type: integer
              description: Number of times this Tweet has been viewed.
            like_count:
              type: integer
              description: Number of times this Tweet has been liked.
            reply_count:
              type: integer
              description: Number of times this Tweet has been replied to.
            retweet_count:
              type: integer
              description: Number of times this Tweet has been Retweeted.
        possibly_sensitive:
          type: boolean
          description: >-
            Indicates if this Tweet contains URLs marked as sensitive, for
            example content suitable for mature audiences.
          example: false
        promoted_metrics:
          type: object
          description: >-
            Promoted nonpublic engagement metrics for the Tweet at the time of
            the request.
          properties:
            impression_count:
              type: integer
              description: Number of times this Tweet has been viewed.
              format: int32
            like_count:
              type: integer
              description: Number of times this Tweet has been liked.
              format: int32
            reply_count:
              type: integer
              description: Number of times this Tweet has been replied to.
              format: int32
            retweet_count:
              type: integer
              description: Number of times this Tweet has been Retweeted.
              format: int32
        public_metrics:
          type: object
          description: Engagement metrics for the Tweet at the time of the request.
          required:
            - retweet_count
            - reply_count
            - like_count
            - impression_count
            - bookmark_count
          properties:
            bookmark_count:
              type: integer
              description: Number of times this Tweet has been bookmarked.
              format: int32
            impression_count:
              type: integer
              description: Number of times this Tweet has been viewed.
              format: int32
            like_count:
              type: integer
              description: Number of times this Tweet has been liked.
            quote_count:
              type: integer
              description: Number of times this Tweet has been quoted.
            reply_count:
              type: integer
              description: Number of times this Tweet has been replied to.
            retweet_count:
              type: integer
              description: Number of times this Tweet has been Retweeted.
        referenced_tweets:
          type: array
          description: >-
            A list of Posts this Tweet refers to. For example, if the parent
            Tweet is a Retweet, a Quoted Tweet or a Reply, it will include the
            related Tweet referenced to by its parent.
          minItems: 1
          items:
            type: object
            required:
              - type
              - id
            properties:
              id:
                $ref: "#/components/schemas/TweetId"
              type:
                type: string
                enum:
                  - retweeted
                  - quoted
                  - replied_to
        reply_settings:
          $ref: "#/components/schemas/ReplySettingsWithVerifiedUsers"
        scopes:
          type: object
          description: The scopes for this tweet
          properties:
            followers:
              type: boolean
              description: >-
                Indicates if this Tweet is viewable by followers without the
                Tweet ID
              example: false
        source:
          type: string
          description: This is deprecated.
        suggested_source_links:
          type: array
          minItems: 0
          items:
            $ref: "#/components/schemas/UrlEntity"
        suggested_source_links_with_counts:
          type: object
          description: >-
            Suggested source links and the number of requests that included each
            link.
          properties:
            count:
              type: integer
              description: Number of note requests that included the source link.
            url:
              $ref: "#/components/schemas/UrlEntity"
        text:
          $ref: "#/components/schemas/TweetText"
        username:
          $ref: "#/components/schemas/UserName"
        withheld:
          $ref: "#/components/schemas/TweetWithheld"
      example:
        author_id: "2244994945"
        created_at: Wed Jan 06 18:40:40 +0000 2021
        id: "1346889436626259968"
        text: >-
          Learn how to use the user Tweet timeline and user mention timeline
          endpoints in the X API v2 to explore Tweet\u2026
          https:\/\/t.co\/56a0vZUx7i
        username: XDevelopers
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
    MediaHeight:
      type: integer
      description: The height of the media in pixels.
      minimum: 0
    MediaWidth:
      type: integer
      description: The width of the media in pixels.
      minimum: 0
    AnimatedGif:
      allOf:
        - $ref: "#/components/schemas/Media"
        - type: object
          properties:
            preview_image_url:
              type: string
              format: uri
            variants:
              $ref: "#/components/schemas/Variants"
    Photo:
      allOf:
        - $ref: "#/components/schemas/Media"
        - type: object
          properties:
            alt_text:
              type: string
            url:
              type: string
              format: uri
    Video:
      allOf:
        - $ref: "#/components/schemas/Media"
        - type: object
          properties:
            duration_ms:
              type: integer
            non_public_metrics:
              type: object
              description: >-
                Nonpublic engagement metrics for the Media at the time of the
                request.
              properties:
                playback_0_count:
                  type: integer
                  description: Number of users who made it through 0% of the video.
                  format: int32
                playback_100_count:
                  type: integer
                  description: Number of users who made it through 100% of the video.
                  format: int32
                playback_25_count:
                  type: integer
                  description: Number of users who made it through 25% of the video.
                  format: int32
                playback_50_count:
                  type: integer
                  description: Number of users who made it through 50% of the video.
                  format: int32
                playback_75_count:
                  type: integer
                  description: Number of users who made it through 75% of the video.
                  format: int32
            organic_metrics:
              type: object
              description: >-
                Organic nonpublic engagement metrics for the Media at the time
                of the request.
              properties:
                playback_0_count:
                  type: integer
                  description: Number of users who made it through 0% of the video.
                  format: int32
                playback_100_count:
                  type: integer
                  description: Number of users who made it through 100% of the video.
                  format: int32
                playback_25_count:
                  type: integer
                  description: Number of users who made it through 25% of the video.
                  format: int32
                playback_50_count:
                  type: integer
                  description: Number of users who made it through 50% of the video.
                  format: int32
                playback_75_count:
                  type: integer
                  description: Number of users who made it through 75% of the video.
                  format: int32
                view_count:
                  type: integer
                  description: Number of times this video has been viewed.
                  format: int32
            preview_image_url:
              type: string
              format: uri
            promoted_metrics:
              type: object
              description: >-
                Promoted nonpublic engagement metrics for the Media at the time
                of the request.
              properties:
                playback_0_count:
                  type: integer
                  description: Number of users who made it through 0% of the video.
                  format: int32
                playback_100_count:
                  type: integer
                  description: Number of users who made it through 100% of the video.
                  format: int32
                playback_25_count:
                  type: integer
                  description: Number of users who made it through 25% of the video.
                  format: int32
                playback_50_count:
                  type: integer
                  description: Number of users who made it through 50% of the video.
                  format: int32
                playback_75_count:
                  type: integer
                  description: Number of users who made it through 75% of the video.
                  format: int32
                view_count:
                  type: integer
                  description: Number of times this video has been viewed.
                  format: int32
            public_metrics:
              type: object
              description: Engagement metrics for the Media at the time of the request.
              properties:
                view_count:
                  type: integer
                  description: Number of times this video has been viewed.
                  format: int32
            variants:
              $ref: "#/components/schemas/Variants"
    PlaceId:
      type: string
      description: The identifier for this place.
      example: f7eb2fa2fea288b1
    CountryCode:
      type: string
      description: A two-letter ISO 3166-1 alpha-2 country code.
      pattern: ^[A-Z]{2}$
      example: US
    Geo:
      type: object
      required:
        - type
        - bbox
        - properties
      properties:
        bbox:
          type: array
          minItems: 4
          maxItems: 4
          items:
            type: number
            minimum: -180
            maximum: 180
            format: double
          example:
            - -105.193475
            - 39.60973
            - -105.053164
            - 39.761974
        geometry:
          $ref: "#/components/schemas/Point"
        properties:
          type: object
        type:
          type: string
          enum:
            - Feature
    PlaceType:
      type: string
      enum:
        - poi
        - neighborhood
        - city
        - admin
        - country
        - unknown
      example: city
    PollId:
      type: string
      description: Unique identifier of this poll.
      pattern: ^[0-9]{1,19}$
      example: "1365059861688410112"
    PollOption:
      type: object
      description: Describes a choice in a Poll object.
      required:
        - position
        - label
        - votes
      properties:
        label:
          $ref: "#/components/schemas/PollOptionLabel"
        position:
          type: integer
          description: Position of this choice in the poll.
        votes:
          type: integer
          description: Number of users who voted for this choice.
    TopicId:
      type: string
      description: Unique identifier of this Topic.
    CommunityId:
      type: string
      description: The unique identifier of this Community.
      pattern: ^[0-9]{1,19}$
      example: "1146654567674912769"
    ContextAnnotation:
      type: object
      description: Annotation inferred from the Tweet text.
      required:
        - domain
        - entity
      properties:
        domain:
          $ref: "#/components/schemas/ContextAnnotationDomainFields"
        entity:
          $ref: "#/components/schemas/ContextAnnotationEntityFields"
    DisplayTextRange:
      type: array
      description: >-
        Represent a boundary range (start and end zero-based indices) for the
        portion of text that is displayed for a post. `start` must be smaller
        than `end`. The start index is inclusive, the end index is exclusive.
      minItems: 2
      maxItems: 2
      items:
        type: integer
        minimum: 0
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
    Point:
      type: object
      description: >-
        A [GeoJson Point](https://tools.ietf.org/html/rfc7946#section-3.1.2)
        geometry object.
      required:
        - type
        - coordinates
      properties:
        coordinates:
          $ref: "#/components/schemas/Position"
        type:
          type: string
          enum:
            - Point
          example: Point
    UrlEntity:
      description: >-
        Represent the portion of text recognized as a URL, and its start and end
        position within the text.
      allOf:
        - $ref: "#/components/schemas/EntityIndicesInclusiveExclusive"
        - $ref: "#/components/schemas/UrlFields"
    NoteTweetText:
      type: string
      description: The note content of the Tweet.
      example: >-
        Learn how to use the user Tweet timeline and user mention timeline
        endpoints in the X API v2 to explore Tweet\u2026
        https:\/\/t.co\/56a0vZUx7i
    ReplySettingsWithVerifiedUsers:
      type: string
      description: >-
        Shows who can reply a Tweet. Fields returned are everyone,
        mentioned_users, subscribers, verified and following.
      pattern: ^[A-Za-z]{1,12}$
      enum:
        - everyone
        - mentionedUsers
        - following
        - other
        - subscribers
        - verified
    TweetText:
      type: string
      description: The content of the Tweet.
      example: >-
        Learn how to use the user Tweet timeline and user mention timeline
        endpoints in the X API v2 to explore Tweet\u2026
        https:\/\/t.co\/56a0vZUx7i
    UserName:
      type: string
      description: The X handle (screen name) of this user.
      pattern: ^[A-Za-z0-9_]{1,15}$
    TweetWithheld:
      type: object
      description: >-
        Indicates withholding details for [withheld
        content](https://help.twitter.com/en/rules-and-policies/tweet-withheld-by-country).
      required:
        - copyright
        - country_codes
      properties:
        copyright:
          type: boolean
          description: >-
            Indicates if the content is being withheld for on the basis of
            copyright infringement.
        country_codes:
          type: array
          description: Provides a list of countries where this content is not available.
          minItems: 1
          uniqueItems: true
          items:
            $ref: "#/components/schemas/CountryCode"
        scope:
          type: string
          description: >-
            Indicates whether the content being withheld is the `tweet` or a
            `user`.
          enum:
            - tweet
            - user
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
    HttpStatusCode:
      type: integer
      description: HTTP Status Code.
      minimum: 100
      maximum: 599
    Variants:
      type: array
      description: An array of all available variants of the media.
      items:
        $ref: "#/components/schemas/Variant"
    PollOptionLabel:
      type: string
      description: The text of a poll choice.
      minLength: 1
      maxLength: 25
    ContextAnnotationDomainFields:
      type: object
      description: Represents the data for the context annotation domain.
      required:
        - id
      properties:
        description:
          type: string
          description: Description of the context annotation domain.
        id:
          type: string
          description: The unique id for a context annotation domain.
          pattern: ^[0-9]{1,19}$
        name:
          type: string
          description: Name of the context annotation domain.
    ContextAnnotationEntityFields:
      type: object
      description: Represents the data for the context annotation entity.
      required:
        - id
      properties:
        description:
          type: string
          description: Description of the context annotation entity.
        id:
          type: string
          description: The unique id for a context annotation entity.
          pattern: ^[0-9]{1,19}$
        name:
          type: string
          description: Name of the context annotation entity.
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
    Position:
      type: array
      description: >-
        A [GeoJson Position](https://tools.ietf.org/html/rfc7946#section-3.1.1)
        in the format `[longitude,latitude]`.
      minItems: 2
      maxItems: 2
      items:
        type: number
      example:
        - -105.18816086351444
        - 40.247749999999996
    Variant:
      type: object
      properties:
        bit_rate:
          type: integer
          description: The bit rate of the media.
        content_type:
          type: string
          description: The content type of the media.
        url:
          type: string
          description: The url to the media.
          format: uri
  parameters:
    DmEventFieldsParameter:
      name: dm_event.fields
      in: query
      description: A comma separated list of DmEvent fields to display.
      required: false
      schema:
        type: array
        description: The fields available for a DmEvent object.
        minItems: 1
        uniqueItems: true
        items:
          type: string
          enum:
            - attachments
            - created_at
            - dm_conversation_id
            - entities
            - event_type
            - id
            - participant_ids
            - referenced_tweets
            - sender_id
            - text
        example:
          - attachments
          - created_at
          - dm_conversation_id
          - entities
          - event_type
          - id
          - participant_ids
          - referenced_tweets
          - sender_id
          - text
      explode: false
      style: form
    DmEventExpansionsParameter:
      name: expansions
      in: query
      description: A comma separated list of fields to expand.
      schema:
        type: array
        description: >-
          The list of fields you can expand for a [DmEvent](#DmEvent) object. If
          the field has an ID, it can be expanded into a full object.
        minItems: 1
        uniqueItems: true
        items:
          type: string
          enum:
            - attachments.media_keys
            - participant_ids
            - referenced_tweets.id
            - sender_id
        example:
          - attachments.media_keys
          - participant_ids
          - referenced_tweets.id
          - sender_id
      explode: false
      style: form
    MediaFieldsParameter:
      name: media.fields
      in: query
      description: A comma separated list of Media fields to display.
      required: false
      schema:
        type: array
        description: The fields available for a Media object.
        minItems: 1
        uniqueItems: true
        items:
          type: string
          enum:
            - alt_text
            - duration_ms
            - height
            - media_key
            - non_public_metrics
            - organic_metrics
            - preview_image_url
            - promoted_metrics
            - public_metrics
            - type
            - url
            - variants
            - width
        example:
          - alt_text
          - duration_ms
          - height
          - media_key
          - non_public_metrics
          - organic_metrics
          - preview_image_url
          - promoted_metrics
          - public_metrics
          - type
          - url
          - variants
          - width
      explode: false
      style: form
    UserFieldsParameter:
      name: user.fields
      in: query
      description: A comma separated list of User fields to display.
      required: false
      schema:
        type: array
        description: The fields available for a User object.
        minItems: 1
        uniqueItems: true
        items:
          type: string
          enum:
            - affiliation
            - confirmed_email
            - connection_status
            - created_at
            - description
            - entities
            - id
            - is_identity_verified
            - location
            - most_recent_tweet_id
            - name
            - parody
            - pinned_tweet_id
            - profile_banner_url
            - profile_image_url
            - protected
            - public_metrics
            - receives_your_dm
            - subscription
            - subscription_type
            - url
            - username
            - verified
            - verified_followers_count
            - verified_type
            - withheld
        example:
          - affiliation
          - confirmed_email
          - connection_status
          - created_at
          - description
          - entities
          - id
          - is_identity_verified
          - location
          - most_recent_tweet_id
          - name
          - parody
          - pinned_tweet_id
          - profile_banner_url
          - profile_image_url
          - protected
          - public_metrics
          - receives_your_dm
          - subscription
          - subscription_type
          - url
          - username
          - verified
          - verified_followers_count
          - verified_type
          - withheld
      explode: false
      style: form
    TweetFieldsParameter:
      name: tweet.fields
      in: query
      description: A comma separated list of Tweet fields to display.
      required: false
      schema:
        type: array
        description: The fields available for a Tweet object.
        minItems: 1
        uniqueItems: true
        items:
          type: string
          enum:
            - article
            - attachments
            - author_id
            - card_uri
            - community_id
            - context_annotations
            - conversation_id
            - created_at
            - display_text_range
            - edit_controls
            - edit_history_tweet_ids
            - entities
            - geo
            - id
            - in_reply_to_user_id
            - lang
            - media_metadata
            - non_public_metrics
            - note_tweet
            - organic_metrics
            - possibly_sensitive
            - promoted_metrics
            - public_metrics
            - referenced_tweets
            - reply_settings
            - scopes
            - source
            - suggested_source_links
            - suggested_source_links_with_counts
            - text
            - withheld
        example:
          - article
          - attachments
          - author_id
          - card_uri
          - community_id
          - context_annotations
          - conversation_id
          - created_at
          - display_text_range
          - edit_controls
          - edit_history_tweet_ids
          - entities
          - geo
          - id
          - in_reply_to_user_id
          - lang
          - media_metadata
          - non_public_metrics
          - note_tweet
          - organic_metrics
          - possibly_sensitive
          - promoted_metrics
          - public_metrics
          - referenced_tweets
          - reply_settings
          - scopes
          - source
          - suggested_source_links
          - suggested_source_links_with_counts
          - text
          - withheld
      explode: false
      style: form
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
