> ## Documentation Index
>
> Fetch the complete documentation index at: https://developer.happenstance.ai/llms.txt
> Use this file to discover all available pages before exploring further.

# Changelog

> Changes to the Happenstance API

**2026-10-23**

Happenstance Chat in the API and MCP

Happenstance Chat is now available through the API and the MCP server.

- New endpoints: `POST /v1/chat`, `GET /v1/chat`, `GET /v1/chat/{chat_id}`,
  `POST /v1/chat/{chat_id}/messages`, `GET /v1/chat/{chat_id}/turns/{turn_id}`,
  `POST /v1/chat/{chat_id}/turns/{turn_id}/cancel`, `GET /v1/chat/{chat_id}/people` and
  `GET /v1/chat/{chat_id}/drafts`. See the [Quickstart](https://developer.happenstance.ai/quickstart.md).
- New MCP tools: `chat`, `get-chat-turn`, `get-chat-people`, `get-chat-drafts`, `get-chat`,
  `list-chats` and `cancel-chat-turn`.
- Chat turns have variable cost depending on how much work is done, often 1–4 credits. Each turn is charged when it finishes.
- `GET /v1/usage` lists chat turns with `resource_type` `chat_turn`.
- `GET /v1/users/me` now returns `connections_count`, `friends_count` and `sources`, and group
  members include `connections_count`.

Search and Research are unchanged.

**2026-10-14**

Credit amounts may now be fractional

`balance_credits` and `credit_used` in the `GET /v1/usage` response are now documented as `number` instead of `integer`.

- Whole-credit values still serialize as whole numbers (for example `12`, not `12.0`).
- Fractional values (for example `1.75`) appear only for metered products, such as the upcoming Chat API.
- Existing prices are unchanged: Search costs 2 credits and Research costs 1 credit.

Clients that parse these fields as strict integers should accept decimals.

This documentation is built and hosted on [Mintlify](https://mintlify.com), a developer documentation platform.
