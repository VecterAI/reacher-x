# Resolve any B2B identity in milliseconds

GET

https://renidly.com/api/data/v1/health

0Defaultreacher-x-search-engine-development-previewreacher-x-search-engine-productionSend⌘↵

Health probe

Returns a minimal success envelope when the service is up. Use this to verify the API is reachable.

**Response:**

```json
{ "success": true, "message": "ok" }
```

Show more

Request

No parameters for this endpoint.

Responses

200

200OK

Successful response. The `data` field contains the endpoint-specific payload.

Schema

successbooleanrequired

statusCodeintegerrequired

Mirrors the HTTP status code.

messagestringrequired

errorsobject?required

Always null on success.

dataany?required

Endpoint-specific payload (object, array, or null).

ResponseHeadersCode examples

No response yet

Hit **Send** to fire a live request against the endpoint.
