> ## Documentation Index
>
> Fetch the complete documentation index at: https://docs.x.com/llms.txt
> Use this file to discover all available pages before exploring further.

# PaginatedResponse

Paginated response interface

Represents the structure of a paginated API response from the X API.

## Type parameters

| Name | Description                       |
| :--- | :-------------------------------- |
| `T`  | The type of items in the response |

## Properties

<ResponseField name="data" type="T[]" required>
  Array of items in the current page
</ResponseField>

<ResponseField name="meta" type="Object">
  Pagination metadata

  <Expandable title="properties">
    <ResponseField name="Name" type="Type | Description" required />

    <ResponseField name="resultCount" type="number | Number of results in the current page" />

    <ResponseField name="nextToken" type="string | Token for fetching the next page" />

    <ResponseField name="previousToken" type="string | Token for fetching the previous page" />

  </Expandable>
</ResponseField>

<ResponseField name="includes" type="Record<string, any>">
  Additional included objects (users, tweets, etc.)
</ResponseField>

<ResponseField name="errors" type="any[]">
  Any errors in the response
</ResponseField>
