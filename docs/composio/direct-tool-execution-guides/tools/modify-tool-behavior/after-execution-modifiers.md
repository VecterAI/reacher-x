# After Execution Modifiers (/docs/tools-direct/modify-tool-behavior/after-execution-modifiers)

> If you're building an agent, we recommend using [sessions](/docs/configuring-sessions) instead. See [Tools and toolkits](/docs/tools-and-toolkits#meta-tools) for how sessions handle tool discovery and execution automatically.

After execution modifiers are part of Composio SDK's powerful middleware capabilities that allow you to customize and extend the behavior of tools.

These modifiers are called after the tool is executed. This allows you to modify the result of the tool before it is returned to the agent.

**Useful for:**

- Modifying or truncating the output of the tool
- Converting the output to a different format before returning it to the agent

![After Execution Modifier](/images/after-execute.png)

> Below we use the `afterExecute` modifier to truncate the output of `HACKERNEWS_GET_USER` and only return the karma of the user.

# With Chat Completions

Since completion providers don't have a function execution step, Composio executes the tool call directly. The modifier is configured on the `tools.execute` method.

**Python:**

```python
from composio import Composio, after_execute
from composio.types import ToolExecutionResponse

@after_execute(tools=["HACKERNEWS_GET_USER"])
def after_execute_modifier(
    tool: str,
    toolkit: str,
    response: ToolExecutionResponse,
) -> ToolExecutionResponse:
    return {
        **response,
        "data": {
            "karma": response["data"]["karma"],
        },
    }

tools = composio.tools.get(user_id=user_id, slug="HACKERNEWS_GET_USER")

# Get response from the LLM
response = openai_client.chat.completions.create(
    model="gpt-5.4",
    tools=tools,
    messages=messages,
)
print(response)

# Execute the function calls
result = composio.provider.handle_tool_calls(
  response=response,
  user_id="default",
  modifiers=[
     after_execute_modifier,
  ]
)
print(result)
```

**TypeScript:**

```typescript
const response = await openai.chat.completions.create({
  model: "gpt-5.4",
  messages,
  tools,
  tool_choice: "auto",
});

const { tool_calls } = response.choices[0].message;
console.log(tool_calls);

if (tool_calls) {
  const {
    function: { arguments: toolArgs },
  } = tool_calls[0];

  const result = await composio.tools.execute(
    "HACKERNEWS_GET_USER",
    {
      userId,
      arguments: JSON.parse(toolArgs),
    },
    {
      afterExecute: ({ toolSlug, toolkitSlug, result }) => {
        if (toolSlug === "HACKERNEWS_GET_USER") {
          const { data } = result;
          const { karma } = data.response_data as { karma: number };
          return {
            ...result,
            data: { karma },
          };
        }
        return result;
      },
    }
  );
  console.log(JSON.stringify(result, null, 2));
}
```

# With Agentic Frameworks

Agentic providers have a function execution step. The modifier is configured on the `tools.get` method which modifies the execution logic within the framework.

**Python:**

```python
from composio import Composio, after_execute
from composio.types import ToolExecutionResponse
from composio_crewai import CrewAIProvider

composio = Composio(provider=CrewAIProvider())

@after_execute(tools=["HACKERNEWS_GET_USER"])
def after_execute_modifier(
    tool: str,
    toolkit: str,
    response: ToolExecutionResponse,
) -> ToolExecutionResponse:
    return {
        **response,
        "data": {
            "karma": response["data"]["karma"],
        },
    }

tools = composio.tools.get(
    user_id="default",
    slug="HACKERNEWS_GET_USER",
    modifiers=[
        after_execute_modifier,
    ]
)
```

**TypeScript:**

```typescript
import { Composio } from "@composio/core";
import { VercelProvider } from "@composio/vercel";
import { v4 as uuidv4 } from "uuid";

const composio = new Composio({
  apiKey: process.env.COMPOSIO_API_KEY,
  provider: new VercelProvider(),
});

const userId = uuidv4();

const agenticTools = await composio.tools.get(
  userId,
  {
    tools: ["HACKERNEWS_GET_USER"],
  },
  {
    afterExecute: ({ toolSlug, toolkitSlug, result }) => {
      if (toolSlug === "HACKERNEWS_GET_USER") {
        const { data: { response_data: { karma } = {} } = {} } = result;
        return {
          ...result,
          data: { karma },
        };
      }
      return result;
    },
  }
);
```

# What to read next

- [Before execution modifiers](/docs/tools-direct/modify-tool-behavior/before-execution-modifiers): Modify tool arguments before execution

- [Schema modifiers](/docs/tools-direct/modify-tool-behavior/schema-modifiers): Customize how tools appear to agents

- [Executing tools](/docs/tools-direct/executing-tools): Run tools with providers, agentic frameworks, or direct execution

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
