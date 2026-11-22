> ## Documentation Index
>
> Fetch the complete documentation index at: https://developer.happenstance.ai/llms.txt
> Use this file to discover all available pages before exploring further.

# Quickstart

> Get started with the Happenstance API in minutes

## Prerequisites

Before you begin, make sure you have:

- A Happenstance account
- Your API key (generated from [Settings](https://happenstance.ai/developer/keys))

## Make Your First Request

> [tab] Search Your Network
>
> ### 1. Submit a Search Request
>
> Search for relevant people within your groups and connections:
>
> ```bash theme={null}
> curl -X POST https://api.happenstance.ai/v1/search \
>   -H "Authorization: Bearer YOUR_API_KEY" \
>   -H "Content-Type: application/json" \
>   -d '{
>     "text": "engineers who have worked on AI infrastructure",
>     "include_my_connections": true
>   }'
> ```
>
> **Response:**
>
> ```json theme={null}
> {
>   "id": "a1b2c3d4-5678-90ab-cdef-1234567890ab",
>   "url": "https://happenstance.ai/search/a1b2c3d4-5678-90ab-cdef-1234567890ab"
> }
> ```
>
> > [!NOTE]
> >
> > You can also search within specific groups by including `group_ids` - get your group IDs from the `/v1/groups` endpoint.
>
> > [!TIP]
> >
> > Use @mentions in your query to filter results to a specific person's connections.
> > For example: `"engineers @Jane Smith knows"`. Use the `/v1/groups/{group_id}` endpoint
> > to look up member names.
>
> ### 2. Poll for Results
>
> Search runs asynchronously. Poll the GET endpoint until `status` is `COMPLETED`:
>
> ```bash theme={null}
> curl -X GET https://api.happenstance.ai/v1/search/a1b2c3d4-5678-90ab-cdef-1234567890ab \
>   -H "Authorization: Bearer YOUR_API_KEY"
> ```
>
> **Response (in progress):**
>
> ```json theme={null}
> {
>   "id": "a1b2c3d4-5678-90ab-cdef-1234567890ab",
>   "url": "https://happenstance.ai/search/a1b2c3d4-5678-90ab-cdef-1234567890ab",
>   "status": "RUNNING",
>   "text": "engineers who have worked on AI infrastructure",
>   "created_at": "2025-01-15T10:30:00Z",
>   "updated_at": "2025-01-15T10:30:05Z",
>   "results": null
> }
> ```
>
> **Response (completed):**
>
> ```json theme={null}
> {
>   "id": "a1b2c3d4-5678-90ab-cdef-1234567890ab",
>   "url": "https://happenstance.ai/search/a1b2c3d4-5678-90ab-cdef-1234567890ab",
>   "status": "COMPLETED",
>   "text": "engineers who have worked on AI infrastructure",
>   "created_at": "2025-01-15T10:30:00Z",
>   "updated_at": "2025-01-15T10:30:45Z",
>   "results": [
>     {
>       "id": "person-uuid-1",
>       "name": "Jane Smith",
>       "current_title": "Staff Engineer",
>       "current_company": "OpenAI",
>       "summary": "Led infrastructure team building distributed training systems...",
>       "weighted_traits_score": 2.5,
>       "socials": {
>         "happenstance_url": "https://happenstance.ai/u/person-uuid-1",
>         "linkedin_url": "https://linkedin.com/in/janesmith"
>       }
>     }
>   ],
>   "has_more": true
> }
> ```
>
> > [!TIP]
> >
> > Poll every 5-10 seconds. Search typically completes within 30-60 seconds.
>
> ### 3. Find More Results (Optional)
>
> If `has_more` is `true`, you can request additional results:
>
> ```bash theme={null}
> curl -X POST https://api.happenstance.ai/v1/search/a1b2c3d4-5678-90ab-cdef-1234567890ab/find-more \
>   -H "Authorization: Bearer YOUR_API_KEY"
> ```

> [tab] Research A Person
>
> ### 1. Submit a Research Request
>
> Generate a detailed profile about a person:
>
> ```bash theme={null}
> curl -X POST https://api.happenstance.ai/v1/research \
>   -H "Authorization: Bearer YOUR_API_KEY" \
>   -H "Content-Type: application/json" \
>   -d '{
>     "description": "Garry Tan Y Combinator"
>   }'
> ```
>
> **Response:**
>
> ```json theme={null}
> {
>   "id": "547e404b-0129-4400-b42d-038cca184414",
>   "url": "https://happenstance.ai/research/547e404b-0129-4400-b42d-038cca184414"
> }
> ```
>
> > [!NOTE]
> >
> > Include as much detail as possible (full name, company, title, social handles) for best results.
>
> ### 2. Poll for Completion
>
> Research runs asynchronously. Poll the GET endpoint until `status` is `COMPLETED`:
>
> ```bash theme={null}
> curl -X GET https://api.happenstance.ai/v1/research/547e404b-0129-4400-b42d-038cca184414 \
>   -H "Authorization: Bearer YOUR_API_KEY"
> ```
>
> **Response (in progress):**
>
> ```json theme={null}
> {
>   "id": "547e404b-0129-4400-b42d-038cca184414",
>   "status": "RUNNING",
>   "query": "Garry Tan Y Combinator",
>   "created_at": "2025-01-15T10:30:00Z",
>   "updated_at": "2025-01-15T10:30:05Z",
>   "profile": null
> }
> ```
>
> **Response (completed):**
>
> ```json theme={null}
> {
>   "id": "547e404b-0129-4400-b42d-038cca184414",
>   "status": "COMPLETED",
>   "query": "Garry Tan Y Combinator",
>   "created_at": "2025-01-15T10:30:00Z",
>   "updated_at": "2025-01-15T10:32:15Z",
>   "profile": {
>     "person_metadata": {
>       "full_name": "Garry Tan",
>       "alternate_names": [],
>       "profile_urls": [
>         "https://www.ycombinator.com/people/garry-tan",
>         "https://x.com/garrytan",
>         "https://www.linkedin.com/in/garrytan"
>       ],
>       "current_locations": [
>         {
>           "location": "San Francisco, California",
>           "urls": ["https://www.forbes.com/profile/garry-tan/"]
>         }
>       ],
>       "tagline": "President and CEO of Y Combinator, entrepreneur, and investor"
>     },
>     "employment": [
>       {
>         "company_name": "Y Combinator",
>         "job_title": "President and CEO",
>         "start_date": "2022",
>         "end_date": null,
>         "description": "Leads Y Combinator, the world's most successful startup accelerator."
>       }
>     ],
>     "summary": {
>       "text": "Garry Tan is a prominent Silicon Valley entrepreneur, investor, and the current President and CEO of Y Combinator...",
>       "urls": [
>         "https://www.ycombinator.com/people/garry-tan",
>         "https://www.forbes.com/profile/garry-tan/"
>       ]
>     }
>   }
> }
> ```
>
> > [!TIP]
> >
> > Poll every 5-10 seconds. Research typically completes within 1-3 minutes.
> > Status can be `RUNNING`, `COMPLETED`, `FAILED`, or `FAILED_AMBIGUOUS`.

> [tab] Chat
>
> Happenstance Chat works toward a goal over several turns: it searches your network, checks
> people on the web, explains why each person fits and who can introduce you, and drafts outreach.
>
> ### 1. Send a Message
>
> Start a chat with its first message:
>
> ```bash theme={null}
> curl -X POST https://api.happenstance.ai/v1/chat \
>   -H "Authorization: Bearer YOUR_API_KEY" \
>   -H "Content-Type: application/json" \
>   -d '{
>     "message": "Who do we know that would make a great angel investor for us?"
>   }'
> ```
>
> **Response:**
>
> ```json theme={null}
> {
>   "id": "3f2b8c1e-6d4a-4b7e-9a1c-2e5f8d9b0a17",
>   "url": "https://happenstance.ai/chat/3f2b8c1e-6d4a-4b7e-9a1c-2e5f8d9b0a17",
>   "turn_id": "7c9e6679-7425-40de-944b-e07fc1f90ae7",
>   "status": "queued"
> }
> ```
>
> > [!NOTE]
> >
> > Write the message as you would in Happenstance Chat: the goal, who to include or leave out,
> > and any names you want Chat to work from.
>
> ### 2. Poll the Turn
>
> Each message starts a turn. Poll it until `status` is no longer `queued` or `running`:
>
> ```bash theme={null}
> curl -X GET https://api.happenstance.ai/v1/chat/3f2b8c1e-6d4a-4b7e-9a1c-2e5f8d9b0a17/turns/7c9e6679-7425-40de-944b-e07fc1f90ae7 \
>   -H "Authorization: Bearer YOUR_API_KEY"
> ```
>
> **Response (completed, shortened):**
>
> ```json theme={null}
> {
>   "id": "7c9e6679-7425-40de-944b-e07fc1f90ae7",
>   "chat_id": "3f2b8c1e-6d4a-4b7e-9a1c-2e5f8d9b0a17",
>   "status": "completed",
>   "stop_reason": "done",
>   "message": "Who do we know that would make a great angel investor for us?",
>   "reply": {
>     "markdown": "I found 12 people you know who would make strong angel investors for you.\n\n- **[Jane Smith](https://happenstance.ai/u/person-uuid-1)** · Angel investor, ex-Stripe · [LinkedIn](https://linkedin.com/in/janesmith) · mutuals: Sam Lee\n  Has backed 30+ seed rounds in developer tools...",
>     "people_count": 12,
>     "people_new_count": 12,
>     "drafts_count": 0,
>     "suggested_followup": "Draft intro requests to the top three",
>     "questions": []
>   },
>   "usage": {
>     "credits_charged": 1.24,
>     "searches": 2,
>     "web_searches": 3,
>     "model_calls": 9,
>     "people_reviewed": 58
>   },
>   "created_at": "2026-10-21T10:30:00.482113",
>   "completed_at": "2026-10-21T10:31:24.913207",
>   "elapsed_seconds": 84
> }
> ```
>
> `reply.markdown` is Chat's answer. For the people as data (title, company, LinkedIn, mutuals
> and connection strength, why each person fits), call `GET /v1/chat/{chat_id}/people`. For the
> message drafts, call `GET /v1/chat/{chat_id}/drafts`.
>
> > [!TIP]
> >
> > Poll every 5 seconds for the first minute, then every 10. Turns that search usually take 1-3
> > minutes. Status can be `queued`, `running`, `completed`, `failed`, or `cancelled`.
>
> ### 3. Continue the Chat (Optional)
>
> Chat keeps the conversation, so a follow-up can build on what it found:
>
> ```bash theme={null}
> curl -X POST https://api.happenstance.ai/v1/chat/3f2b8c1e-6d4a-4b7e-9a1c-2e5f8d9b0a17/messages \
>   -H "Authorization: Bearer YOUR_API_KEY" \
>   -H "Content-Type: application/json" \
>   -d '{
>     "message": "Draft intro requests to the top three"
>   }'
> ```
>
> The response holds the `turn_id` to poll. A message sent while a turn is still running joins
> that turn (`"joined": true`): keep polling the same turn. Start a new chat for a new goal: long
> chats cost more per turn.
>
> When a turn ends with `stop_reason` `needs_input`, Chat asked questions with options
> (`reply.questions`) and waits for the answers. Send them by question index and option label,
> in words as a `message`, or both:
>
> ```json theme={null}
> {
>   "answers": [{ "question_index": 0, "selected": ["Pre-seed and seed"] }]
> }
> ```
>
> > [!NOTE]
> >
> > Chat turns have variable cost depending on how much work is done, often 1–4 credits. Each turn is charged when it finishes, to two decimal places. A failed turn
> > is free, and a cancelled turn is charged for the work done.

## Next Steps

> [card] [The Basics](https://developer.happenstance.ai/api-reference/introduction.md)
>
> Learn about the API

> [card] [Support](https://happenstance.ai/contact)
>
> Contact our support team

This documentation is built and hosted on [Mintlify](https://mintlify.com), a developer documentation platform.
