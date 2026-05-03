> ## Documentation Index
>
> Fetch the complete documentation index at: https://docs.x.com/llms.txt
> Use this file to discover all available pages before exploring further.

# Direct Messages Lookup

> Retrieve Direct Message events and conversations

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

The Direct Messages lookup endpoints let you retrieve DM events for the authenticated user, including messages from both one-to-one and group conversations.

## Overview

<CardGroup cols={2}>
  <Card title="All DM events" icon="messages">
    Get all DM events for the user
  </Card>

  <Card title="One-to-one" icon="message">
    Get events from a specific conversation
  </Card>

  <Card title="By conversation ID" icon="comments">
    Get events by conversation ID
  </Card>

  <Card title="Event types" icon="bell">
    Messages, joins, and leaves
  </Card>
</CardGroup>

---

## Endpoints

| Method | Endpoint                                                                                                            | Description                             |
| :----- | :------------------------------------------------------------------------------------------------------------------ | :-------------------------------------- |
| GET    | [`/2/dm_events`](/x-api/direct-messages/get-dm-events)                                                              | Get all DM events for the user          |
| GET    | [`/2/dm_conversations/with/:participant_id/dm_events`](/x-api/direct-messages/get-dm-events-for-a-dm-conversation)  | Get events from one-to-one conversation |
| GET    | [`/2/dm_conversations/:dm_conversation_id/dm_events`](/x-api/direct-messages/get-dm-events-for-a-dm-conversation-1) | Get events by conversation ID           |

---

## Event types

| Event               | Description                            |
| :------------------ | :------------------------------------- |
| `MessageCreate`     | A message was sent in the conversation |
| `ParticipantsJoin`  | A user joined the conversation         |
| `ParticipantsLeave` | A user left the conversation           |

---

## Data retention

<Note>
  Events from up to **30 days ago** are available through these endpoints.
</Note>

---

## Getting started

<Note>
  **Prerequisites**

- An approved [developer account](https://developer.x.com/en/portal/petition/essential/basic-info)
- A [Project and App](/resources/fundamentals/developer-apps) in the Developer Console
- User Access Tokens via [3-legged OAuth](/resources/fundamentals/authentication#obtaining-access-tokens-using-3-legged-oauth-flow)
  </Note>

<CardGroup cols={2}>
  <Card title="Quickstart" icon="rocket" href="/x-api/direct-messages/lookup/quickstart">
    Make your first DM lookup request
  </Card>

  <Card title="Integration guide" icon="book" href="/x-api/direct-messages/lookup/integrate">
    Key concepts and best practices
  </Card>

  <Card title="API Reference" icon="code" href="/x-api/direct-messages/get-dm-events">
    Full endpoint documentation
  </Card>

  <Card title="Sample code" icon="github" href="https://github.com/xdevplatform/Twitter-API-v2-sample-code">
    Working code examples
  </Card>
</CardGroup>
