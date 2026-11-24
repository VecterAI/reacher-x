> ## Documentation Index
>
> Fetch the complete documentation index at: https://developer.happenstance.ai/llms.txt
> Use this file to discover all available pages before exploring further.

# The Basics

> Happenstance API basic info

## API Resources

Our API is organized around REST principles with predictable, resource-oriented URLs.

### Base URL

```text theme={null}
https://api.happenstance.ai
```

### Authentication

All requests require an API key passed in the `Authorization` header:

```bash theme={null}
Authorization: Bearer YOUR_API_KEY
```

> [!NOTE]
>
> API keys are sensitive credentials. Never share them publicly or commit them to version control.

## OpenAPI Spec

Download the OpenAPI 3.1 specification to import into Postman, Insomnia, or any API client:

> [card] [Download OpenAPI Spec](https://developer.happenstance.ai/openapi.json)
>
> openapi.json

## Billing

Our API consumes credits for Search, Research and Chat operations:

- **Search**: 2 credits per search request (charged when search completes)
- **Research**: 1 credit per successful, completed research
- **Chat**: Chat turns have variable cost depending on how much work is done, often 1–4 credits. Each turn is charged when it finishes, to two decimal places.

You can add credits at any time from your [Settings](https://happenstance.ai/developer/keys) page.
You can also monitor your credits from the [Settings](https://happenstance.ai/developer/keys) page, or via the API's [ Get Usage](https://developer.happenstance.ai/api-reference/get-usage.md) endpoint.

## Error Response Format

All errors follow the RFC 7807 Problem Details format:

```json theme={null}
{
  "type": "about:blank",
  "title": "Bad Request",
  "status": 400,
  "detail": "Description must not be empty",
  "instance": "/v1/research"
}
```

| Field      | Description                                              |
| ---------- | -------------------------------------------------------- |
| `type`     | A URI reference that identifies the problem type         |
| `title`    | A short, human-readable summary of the problem           |
| `status`   | The HTTP status code                                     |
| `detail`   | A human-readable explanation specific to this occurrence |
| `instance` | A URI reference that identifies the specific occurrence  |

## HTTP Status Codes

### 2xx Success

| Code     | Description       |
| -------- | ----------------- |
| `200 OK` | Request succeeded |

### 4xx Client Errors

> [accordion] 400 Bad Request
>
> The request was malformed or contains invalid parameters.
>
> **Common Causes:**
>
> - Missing required fields
> - Invalid JSON format
> - Empty or invalid values
>
> **Example:**
>
> ```json theme={null}
> {
>   "type": "about:blank",
>   "title": "Bad Request",
>   "status": 400,
>   "detail": "Description must not be empty",
>   "instance": "/v1/research"
> }
> ```
>
> **Solution:** Check your request body against the API documentation

> [accordion] 401 Unauthorized
>
> Authentication failed - your API key is invalid or missing.
>
> **Common Causes:**
>
> - Missing `Authorization` header
> - Invalid API key
> - Revoked API key
>
> **Example:**
>
> ```json theme={null}
> {
>   "type": "about:blank",
>   "title": "Unauthorized",
>   "status": 401,
>   "detail": "Invalid API key",
>   "instance": "/v1/research"
> }
> ```
>
> **Solution:** Verify your API key is correct and not revoked

> [accordion] 402 Payment Required
>
> You don't have enough credits to perform this operation.
>
> **Common Causes:**
>
> - Account has zero credits
> - Insufficient credits for the requested operation
>
> **Example:**
>
> ```json theme={null}
> {
>   "type": "about:blank",
>   "title": "Payment Required",
>   "status": 402,
>   "detail": "Insufficient credits. You have 0 credits. This operation requires 2 credit(s).",
>   "instance": "/v1/search"
> }
> ```
>
> **Solution:** Purchase more credits from your [Settings](https://happenstance.ai/developer/keys) page

> [accordion] 403 Forbidden
>
> You don't have permission to access the requested resource.
>
> **Common Causes:**
>
> - Attempting to access another user's research
> - Insufficient permissions for the operation
>
> **Example:**
>
> ```json theme={null}
> {
>   "type": "about:blank",
>   "title": "Forbidden",
>   "status": 403,
>   "detail": "Access denied",
>   "instance": "/v1/research/550e8400-e29b-41d4-a716-446655440000"
> }
> ```
>
> **Solution:** Verify you have access to the resources you're requesting

> [accordion] 404 Not Found
>
> The requested resource doesn't exist.
>
> **Common Causes:**
>
> - Invalid endpoint URL
> - Resource has been deleted
> - Wrong research ID
>
> **Example:**
>
> ```json theme={null}
> {
>   "type": "about:blank",
>   "title": "Not Found",
>   "status": 404,
>   "detail": "Research request not found",
>   "instance": "/v1/research/550e8400-e29b-41d4-a716-446655440000"
> }
> ```
>
> **Solution:** Check the resource ID and endpoint URL

> [accordion] 422 Validation Error
>
> The request body failed validation.
>
> **Common Causes:**
>
> - Missing required fields
> - Invalid field types
> - Fields that don't match expected format
>
> **Example:**
>
> ```json theme={null}
> {
>   "type": "about:blank",
>   "title": "Validation Error",
>   "status": 422,
>   "detail": "Field 'description' is required",
>   "instance": "/v1/research"
> }
> ```
>
> **Solution:** Ensure all required fields are present and correctly formatted

> [accordion] 429 Too Many Requests
>
> You've exceeded the rate limit.
>
> **Common Causes:**
>
> - Making too many research requests per hour
> - Burst of requests in short time period
>
> **Example:**
>
> ```json theme={null}
> {
>   "type": "about:blank",
>   "title": "Too Many Requests",
>   "status": 429,
>   "detail": "Rate limit exceeded. Try again in 30 minutes.",
>   "instance": "/v1/research"
> }
> ```
>
> **Solution:** Implement exponential backoff and respect rate limits

### 5xx Server Errors

> [accordion] 500 Internal Server Error
>
> Something went wrong on our end.
>
> **Example:**
>
> ```json theme={null}
> {
>   "type": "about:blank",
>   "title": "Internal Server Error",
>   "status": 500,
>   "detail": "Internal server error",
>   "instance": "/v1/research"
> }
> ```
>
> **Solution:**
>
> - Retry the request with exponential backoff
> - If the issue persists, contact us on Discord

> [accordion] 503 Service Unavailable
>
> The API is temporarily unavailable.
>
> **Common Causes:**
>
> - Scheduled maintenance
> - Temporary outage
> - Database connection issues
>
> **Solution:**
>
> - Retry the request with exponential backoff
> - If the issue persists, contact [support](mailto:support@happenstance.ai)

## Error Handling Best Practices

### Check Status Codes

Always check the HTTP status code before parsing the response:

```python Python theme={null}
response = requests.post(url, headers=headers, json=data)

if response.status_code == 200:
    result = response.json()
    # Handle success
elif response.status_code == 401:
    # Handle authentication error
    print("Invalid API key")
elif response.status_code == 402:
    # Handle insufficient credits
    print("Insufficient credits - purchase more at happenstance.ai/developer/keys")
elif response.status_code == 429:
    # Handle rate limit
    print("Rate limited, retry later")
else:
    # Handle other errors
    error = response.json()
    print(f"Error: {error.get('title')} - {error.get('detail')}")
```

```javascript JavaScript theme={null}
const response = await fetch(url, {
  method: "POST",
  headers: headers,
  body: JSON.stringify(data),
});

if (response.ok) {
  const result = await response.json();
  // Handle success
} else if (response.status === 401) {
  // Handle authentication error
  console.error("Invalid API key");
} else if (response.status === 402) {
  // Handle insufficient credits
  console.error(
    "Insufficient credits - purchase more at happenstance.ai/developer/keys"
  );
} else if (response.status === 429) {
  // Handle rate limit
  console.error("Rate limited, retry later");
} else {
  const error = await response.json();
  console.error(`Error: ${error.title} - ${error.detail}`);
}
```

### Implement Retry Logic

For transient errors (429, 500, 503), implement exponential backoff:

```python theme={null}
import time
import requests

def make_request_with_retry(url, headers, data, max_retries=3):
    for attempt in range(max_retries):
        try:
            response = requests.post(url, headers=headers, json=data)

            if response.status_code == 200:
                return response.json()

            if response.status_code in [429, 500, 503]:
                # Exponential backoff: 1s, 2s, 4s
                wait_time = 2 ** attempt
                print(f"Retrying in {wait_time}s...")
                time.sleep(wait_time)
                continue

            # Don't retry client errors
            response.raise_for_status()

        except requests.exceptions.RequestException as e:
            if attempt == max_retries - 1:
                raise
            time.sleep(2 ** attempt)

    raise Exception("Max retries exceeded")
```

### Validate Input Before Sending

Catch errors early by validating input:

```python theme={null}
def validate_research_request(description):
    if not description or not description.strip():
        raise ValueError("Description cannot be empty")

    # Include as much detail as possible for best results
    if len(description) < 10:
        print("Warning: Short descriptions may yield less accurate results")
```

### Log Errors for Debugging

Always log error details:

```python theme={null}
import logging

try:
    response = make_api_request(...)
except Exception as e:
    logging.error(f"API request failed: {e}", exc_info=True)
    # Handle error gracefully
```

## Common Error Scenarios

### Invalid API Key

```bash theme={null}
curl -X POST https://api.happenstance.ai/v1/research \
  -H "Authorization: Bearer invalid_key" \
  -H "Content-Type: application/json" \
  -d '{"description": "John Smith, CEO at Acme Corp"}'

# Response: 401
{
  "type": "about:blank",
  "title": "Unauthorized",
  "status": 401,
  "detail": "Invalid API key",
  "instance": "/v1/research"
}
```

**Fix:** Use a valid API key from your account settings.

### Empty Description

```bash theme={null}
curl -X POST https://api.happenstance.ai/v1/research \
  -H "Authorization: Bearer YOUR_KEY" \
  -H "Content-Type: application/json" \
  -d '{"description": ""}'

# Response: 400
{
  "type": "about:blank",
  "title": "Bad Request",
  "status": 400,
  "detail": "Description must not be empty",
  "instance": "/v1/research"
}
```

**Fix:** Provide a non-empty description with details about the person.

### Research Not Found

```bash theme={null}
curl -X GET https://api.happenstance.ai/v1/research/invalid-id \
  -H "Authorization: Bearer YOUR_KEY"

# Response: 404
{
  "type": "about:blank",
  "title": "Not Found",
  "status": 404,
  "detail": "Research request not found",
  "instance": "/v1/research/invalid-id"
}
```

**Fix:** Check that the research ID is correct and belongs to your account.

### Insufficient Credits

```bash theme={null}
curl -X POST https://api.happenstance.ai/v1/search \
  -H "Authorization: Bearer YOUR_KEY" \
  -H "Content-Type: application/json" \
  -d '{"text": "engineers at Google"}'

# Response: 402
{
  "type": "about:blank",
  "title": "Payment Required",
  "status": 402,
  "detail": "Insufficient credits. You have 0 credits. This operation requires 2 credit(s).",
  "instance": "/v1/search"
}
```

**Fix:** Purchase more credits from your [Settings](https://happenstance.ai/developer/keys) page.

### Empty Search Results

```bash theme={null}
curl -X POST https://api.happenstance.ai/v1/search \
  -H "Authorization: Bearer YOUR_KEY" \
  -H "Content-Type: application/json" \
  -d '{"text": "engineers at Google", "include_my_connections": true}'

# Response: 200 (but with empty results)
{
  "id": "a1b2c3d4-5678-90ab-cdef-1234567890ab",
  "status": "COMPLETED",
  "results": []
}
```

**Cause:** You set `include_my_connections` or `include_friends_connections` to `true`, but you haven't uploaded any connections to search across.

**Fix:** Upload your LinkedIn connections at [happenstance.ai](https://happenstance.ai) before searching. Alternatively, search within specific groups by providing `group_ids`.

## Need Help?

> [card] [Research Reference](https://developer.happenstance.ai/api-reference/create-research.md)
>
> Detailed endpoint documentation

> [card] [Support](https://happenstance.ai/contact)
>
> Contact our support team

This documentation is built and hosted on [Mintlify](https://mintlify.com), a developer documentation platform.
