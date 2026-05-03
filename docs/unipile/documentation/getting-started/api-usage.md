# API Usage

# Authentication

The Unipile API uses Access Tokens to authenticate requests. You can view and manage your Access Tokens in the Unipile Dashboard. This is your API key.

Your Access Tokens carry many privileges, so be sure to keep them secure. Don't share your Access Tokens in publicly accessible areas such as GitHub, client-side code, and so forth.

Don't forget to modify the **base URL** with **your DSN** (copy it from your dashboard) in your code or directly in the [ interactive documentation](https://developer.unipile.com/reference):

![](https://files.readme.io/cac7878-image.png)

_If custom port are blocked in your environment, you can use port as query parameter to stay on standard 443, https//apiX.unipile.com/api/v1/accounts?port=XXXXX_

### With an SDK

Use your Access Token by setting it in the initial configuration of the SDK. The client library then automatically sends this token in each request.

### Manually

If you want to request manually, include this token in the **X-API-KEY** header of your request.

```curl
curl --request GET \
     --url https://{YOUR_DSN}/api/v1/accounts \
     --header 'X-API-KEY: {YOUR_ACCESS_TOKEN}' \
     --header 'accept: application/json'
```

# Pagination

API Methods that return a list of results are always paginated. Paginated results will include a "cursor" value, which can be sent in the next request in "cursor" parameter to get the next page of results.

Note that if the cursor is null, there is no more results.

# Errors

Please refer to the [API Reference](https://developer.unipile.com/reference) for more details about error types.

# API Schema

Unipile use the Open API specification. The API schema is available at:

- https\://\{YOUR_DSN}/api-json
- https\://\{YOUR_DSN}/api-yaml

You can import it into an API platform like Postman using this URL.
