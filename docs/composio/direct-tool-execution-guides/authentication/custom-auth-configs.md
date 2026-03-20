# Custom Auth Configs (/docs/auth-configuration/custom-auth-configs)

> If you're building an agent, we recommend using [sessions](/docs/configuring-sessions) instead. See [Using custom auth configs](/docs/using-custom-auth-configuration) for how to use custom credentials with sessions.

Auth configs control how users authenticate with a toolkit. By default, Composio provides managed credentials for many toolkits. You create a custom auth config when the defaults don't fit your needs.

# When to create a custom auth config

| Reason                           | Example                                                                                                                          |
| -------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| **Toolkit has no managed auth**  | PostHog, Tavily, Perplexity: you must provide your own credentials                                                               |
| **White-labeling**               | Show your app name on OAuth consent screens instead of "Composio". See [White-labeling](/docs/auth-configuration/white-labeling) |
| **Rate limits and quota**        | Composio's default OAuth app shares quota across all users. Your own app gets a dedicated quota                                  |
| **Custom scopes**                | You need permissions beyond what Composio's default app has approved                                                             |
| **Custom instance or subdomain** | Connecting to a self-hosted or regional variant (e.g., custom Salesforce subdomain)                                              |

# Creating a custom auth config

To create a custom auth config, click **Create Auth Config** in your dashboard, then navigate to **Authentication management** → **Manage authentication with custom credentials**.

You'll need to customize the auth config when you want to use different values than the defaults - such as your own subdomain, base URL, client ID, client secret, etc.

**Example: PostHog:**

You may change the subdomain for the PostHog toolkit to match your own instance.

![PostHog Auth Config Settings](/images/custom-auth-posthog.png)
_PostHog Auth Config Settings_

**Example: Hubspot:**

For Hubspot you may customize everything here. For each auth scheme there is a different set of fields.

If you choose to use your own developer app for the OAuth2 scheme, you will have to provide the client ID and client secret.

![Hubspot Auth Config Settings](/images/custom-auth-hubspot.png)
_Hubspot Auth Config Settings_

Toolkits that support OAuth2 allow using your own developer app. This is the recommended approach for most cases.

> **Use your own developer app!**: We recommend using your own developer app for the OAuth2 scheme as it is more suited for production usage with many users and more granular control over scopes.

However, getting OAuth approvals takes time, so Composio provides a default developer app!

# OAuth2 Auth Configs

#### Generate the OAuth Client ID and Client Secret

To set up a custom OAuth config, you'll need the OAuth Client ID and Client Secret.

You can generate the client ID and client secret from the toolkit's OAuth configuration page.

Examples for Google and GitHub:

**Google:**

![Google OAuth Configuration](/images/google-oauth-config.png)
_Google OAuth Configuration_

**GitHub:**

![GitHub OAuth Configuration](/images/github-oauth-config.png)
_GitHub OAuth Configuration_

#### Set the Authorized Redirect URI

When creating your OAuth app, make sure to configure the Authorized Redirect URI to point to the Composio callback URL below:

```
https://backend.composio.dev/api/v3/toolkits/auth/callback
```

#### Create the auth config

Once you have the OAuth credentials, you can add them to the auth config in the dashboard.

    1. Select the OAuth2 scheme.
    2. Toggle on **Use your own developer credentials**.
    3. Enter the OAuth client ID and client secret for your developer app.
    4. Click Create!

![Auth Config Settings](/images/integration-step-3-0.png)
_Auth Config Settings_

This auth config is now ready to be used in your application!

**Python:**

```python
# Create a new connected account
connection_request = composio.connected_accounts.initiate(
    user_id="user_id",
    auth_config_id="ac_1234",
)
print(connection_request)

# Wait for the connection to be established
connected_account = connection_request.wait_for_connection()
print(connected_account)
```

**TypeScript:**

```typescript
import { Composio } from "@composio/core";
const composio = new Composio({ apiKey: "your_api_key" });
const userId = "user_123";
const connReq = await composio.connectedAccounts.initiate(userId, "ac_1234");

console.log(connReq.redirectUrl);

const connection = await composio.connectedAccounts.waitForConnection(
  connReq.id
);

console.log(connection);
```

# What to read next

- [Connected accounts](/docs/auth-configuration/connected-accounts): Manage and monitor user connections to toolkits

- [Programmatic auth configs](/docs/auth-configuration/programmatic-auth-configs): Create auth configs programmatically via the SDK

- [Authenticating tools](/docs/tools-direct/authenticating-tools): Create auth configs and connect user accounts

---

📚 **More documentation:** [View all docs](https://docs.composio.dev/llms.txt) | [Glossary](https://docs.composio.dev/llms.mdx/docs/glossary) | [Cookbooks](https://docs.composio.dev/llms.mdx/cookbooks) | [API Reference](https://docs.composio.dev/llms.mdx/reference)

---

# Composio SDK — Instructions for AI Code Generators

**Context:** This page documents the **direct tool execution API**. For most applications, the session-based pattern (`composio.create(user_id)` + `session.tools()`) is simpler — but if the user is here, they likely want direct execution.

---

## Key Patterns

### Authenticating Users

Create an **Auth Config** on [platform.composio.dev](https://platform.composio.dev), then use the auth config ID to generate a hosted auth URL:

```python
from composio import Composio

composio = Composio()
connection = composio.connected_accounts.link(
    user_id="user_123",
    auth_config_id="ac_...",  # from platform dashboard
)
print(connection.redirect_url)  # send user here to authenticate
```

```typescript
import { Composio } from "@composio/core";

const composio = new Composio();
const connection = await composio.connectedAccounts.link("user_123", "ac_...", {
  callbackUrl: "https://your-app.com/callback",
});
console.log(connection.redirectUrl); // send user here to authenticate
```

### Executing Tools

```python
tools = composio.tools.get("user_123", tools=["GITHUB_CREATE_ISSUE"])

result = composio.tools.execute(
    "GITHUB_CREATE_ISSUE",
    {"owner": "org", "repo": "repo", "title": "Bug report"},
    user_id="user_123",
)
```

```typescript
const tools = await composio.tools.get("user_123", {
  tools: ["GITHUB_CREATE_ISSUE"],
});

const result = await composio.tools.execute("GITHUB_CREATE_ISSUE", {
  userId: "user_123",
  arguments: { owner: "org", repo: "repo", title: "Bug report" },
});
```

---

## Rules

1. **`user_id` is required** — pass it to `tools.get()`, `tools.execute()`, and `provider.handle_tool_calls()`.
2. **`tools.execute()` signature** — Python: `execute(slug, arguments_dict, *, user_id=...)` (arguments is the second positional param). TypeScript: `execute(slug, { userId, arguments })`.
3. **Provider at init** — `Composio(provider=OpenAIProvider())` in Python, `new Composio({ provider: new OpenAIProvider() })` in TypeScript. Defaults to OpenAI if omitted.
4. **Correct provider imports** — `composio_<provider>` for Python, `@composio/<provider>` for TypeScript. For OpenAI Agents SDK use `composio_openai_agents` / `@composio/openai-agents`.

---

## Terminology Migration (old → current)

If you encounter these terms in error messages, old documentation, or user prompts, translate them to the current equivalents. **Do not use the old terms in generated code or explanations.**

| Old term (v1/v2)                | Current term (v3)                | In code                                 |
| ------------------------------- | -------------------------------- | --------------------------------------- |
| entity ID                       | user ID                          | `user_id` parameter                     |
| actions                         | tools                            | e.g., `GITHUB_CREATE_ISSUE` is a _tool_ |
| apps / appType                  | toolkits                         | e.g., `github` is a _toolkit_           |
| integration / integration ID    | auth config / auth config ID     | `auth_config_id` parameter              |
| connection                      | connected account                | `connected_accounts` namespace          |
| ComposioToolSet / OpenAIToolSet | `Composio` class with a provider | `Composio(provider=...)`                |
| toolset                         | provider                         | e.g., `OpenAIProvider`                  |

If a user says "entity ID", they mean `user_id`. If they say "integration", they mean "auth config". Always respond using the current terminology.
