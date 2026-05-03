> ## Documentation Index
>
> Fetch the complete documentation index at: https://docs.x.com/llms.txt
> Use this file to discover all available pages before exploring further.

# Likes

> Like and unlike Posts, and retrieve like information

export const Button = ({href, children}) => {
return <div className="not-prose group">
<a href={href}>
<button className="flex items-center space-x-2.5 py-1 px-4 bg-primary-dark dark:bg-white text-white dark:text-gray-950 rounded-full group-hover:opacity-[0.9] font-medium">
<span>
{children}
</span>
<svg width="3" height="24" viewBox="0 -9 3 24" class="h-6 rotate-0 overflow-visible"><path d="M0 0L3 3L0 6" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"></path></svg>
</button>
</a>

  </div>;
};

The Likes endpoints let you like and unlike Posts, see which users liked a Post, and get Posts liked by a user.

## Overview

<CardGroup cols={2}>
  <Card title="Like a Post" icon="heart">
    Like a Post on behalf of a user
  </Card>

  <Card title="Unlike a Post" icon="heart-crack">
    Remove a like from a Post
  </Card>

  <Card title="Liking users" icon="users">
    See who liked a Post
  </Card>

  <Card title="Liked Posts" icon="list-heart">
    Get Posts a user has liked
  </Card>
</CardGroup>

---

## Endpoints

### Likes lookup

| Method | Endpoint                                                      | Description                |
| :----- | :------------------------------------------------------------ | :------------------------- |
| GET    | [`/2/tweets/:id/liking_users`](/x-api/posts/get-liking-users) | Get users who liked a Post |
| GET    | [`/2/users/:id/liked_tweets`](/x-api/users/get-liked-posts)   | Get Posts liked by a user  |

### Manage likes

| Method | Endpoint                                                   | Description   |
| :----- | :--------------------------------------------------------- | :------------ |
| POST   | [`/2/users/:id/likes`](/x-api/users/like-post)             | Like a Post   |
| DELETE | [`/2/users/:id/likes/:tweet_id`](/x-api/users/unlike-post) | Unlike a Post |

---

## Important notes

<Note>
  The liking users endpoint returns a maximum of **100 users** per Post for all time, regardless of the actual number of likes.
</Note>

---

## Example: Get liking users

```bash theme={null}
curl "https://api.x.com/2/tweets/1234567890/liking_users?\
user.fields=username,verified" \
  -H "Authorization: Bearer $BEARER_TOKEN"
```

## Example: Like a Post

```bash theme={null}
curl -X POST "https://api.x.com/2/users/123456789/likes" \
  -H "Authorization: Bearer $USER_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"tweet_id": "1234567890"}'
```

---

## Getting started

<Note>
  **Prerequisites**

- An approved [developer account](https://developer.x.com/en/portal/petition/essential/basic-info)
- A [Project and App](/resources/fundamentals/developer-apps) in the Developer Console
- Your App's [keys and tokens](/resources/fundamentals/authentication)
  </Note>

<CardGroup cols={2}>
  <Card title="Lookup quickstart" icon="heart" href="/x-api/posts/likes/quickstart/likes-lookup">
    Get likes for a Post
  </Card>

  <Card title="Manage quickstart" icon="plus" href="/x-api/posts/likes/quickstart/manage-likes">
    Like and unlike Posts
  </Card>

  <Card title="API Reference" icon="code" href="/x-api/posts/liking-users-of-a-post">
    Full endpoint documentation
  </Card>

  <Card title="Sample code" icon="github" href="https://github.com/xdevplatform/Twitter-API-v2-sample-code">
    Working code examples
  </Card>
</CardGroup>
