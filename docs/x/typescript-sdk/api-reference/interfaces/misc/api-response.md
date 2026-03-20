> ## Documentation Index
>
> Fetch the complete documentation index at: https://docs.x.com/llms.txt
> Use this file to discover all available pages before exploring further.

# ApiResponse

Response wrapper with metadata

## Type parameters

| Name | Type  |
| :--- | :---- |
| `T`  | `any` |

## Properties

<ResponseField name="body" type="T" required>
  Response body
</ResponseField>

<ResponseField name="headers" type="Headers" required>
  Response headers
</ResponseField>

<ResponseField name="status" type="number" required>
  HTTP status code
</ResponseField>

<ResponseField name="statusText" type="string" required>
  HTTP status text
</ResponseField>

<ResponseField name="url" type="string" required>
  Response URL
</ResponseField>
