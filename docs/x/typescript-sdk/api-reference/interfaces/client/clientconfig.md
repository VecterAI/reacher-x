> ## Documentation Index
>
> Fetch the complete documentation index at: https://docs.x.com/llms.txt
> Use this file to discover all available pages before exploring further.

# ClientConfig

Configuration options for the X API client

## Properties

<ResponseField name="baseUrl" type="string">
  Base URL for API requests
</ResponseField>

<ResponseField name="bearerToken" type="string">
  Bearer token for authentication
</ResponseField>

<ResponseField name="accessToken" type="string">
  OAuth2 access token
</ResponseField>

<ResponseField name="oauth1" type="any">
  OAuth1 instance for authentication
</ResponseField>

<ResponseField name="headers" type="Record<string, string>">
  Custom headers to include in requests
</ResponseField>

<ResponseField name="timeout" type="number">
  Request timeout in milliseconds
</ResponseField>

<ResponseField name="retry" type="boolean">
  Whether to automatically retry failed requests
</ResponseField>

<ResponseField name="maxRetries" type="number">
  Maximum number of retry attempts
</ResponseField>
