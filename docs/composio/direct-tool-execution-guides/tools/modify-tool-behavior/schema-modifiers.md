# Schema Modifiers (/docs/tools-direct/modify-tool-behavior/schema-modifiers)

> If you're building an agent, we recommend using [sessions](/docs/configuring-sessions) instead. See [Tools and toolkits](/docs/tools-and-toolkits#meta-tools) for how sessions handle tool discovery and execution automatically.

Schema modifiers are part of Composio SDK's powerful middleware capabilities that allow you to customize and extend the behavior of tools.

Schema modifiers transform a tool's schema before the tool is seen by an agent.

![Schema Modifier](/images/schema-modifier.png)

**Useful for:**

- Modifying or rewriting the tool description to better fit your use case
- Adding arguments to the tool (e.g., adding a `thought` argument to prompt the agent to explain reasoning)
- Hiding arguments from the tool when they're irrelevant
- Adding extra arguments for custom use cases
- Adding default values to tool arguments

> Below we modify the schema of `HACKERNEWS_GET_LATEST_POSTS` to make the `size` argument required and remove the `page` argument.

**Python:**

```python
from composio import Composio, schema_modifier
from composio.types import Tool

user_id = "your@email.com"

@schema_modifier(tools=["HACKERNEWS_GET_LATEST_POSTS"])
def modify_schema(
    tool: str,
    toolkit: str,
    schema: Tool,
) -> Tool:
    _ = schema.input_parameters["properties"].pop("page", None)
    schema.input_parameters["required"] = ["size"]
    return schema

tools = composio.tools.get(
    user_id=user_id,
    tools=["HACKERNEWS_GET_LATEST_POSTS", "HACKERNEWS_GET_USER"],
    modifiers=[
        modify_schema,
    ]
)
```

**TypeScript:**

```typescript
const userId = "your@email.com";

const tools = await composio.tools.get(
  userId,
  {
    tools: ["HACKERNEWS_GET_LATEST_POSTS", "HACKERNEWS_GET_USER"],
  },
  {
    modifySchema: ({ toolSlug, toolkitSlug, schema }) => {
      if (toolSlug === "HACKERNEWS_GET_LATEST_POSTS") {
        const { inputParameters } = schema;
        if (inputParameters?.properties) {
          delete inputParameters.properties["page"];
        }
        inputParameters.required = ["size"];
      }
      return schema;
    },
  }
);

console.log(JSON.stringify(tools, null, 2));
```

With the modified tool schema, the `page` argument is removed and `size` is required.

**Full example with LLM**

**Python:**

```python
from openai import OpenAI
from composio import Composio, schema_modifier
from composio.types import Tool
from composio_openai import OpenAIProvider

@schema_modifier(tools=["HACKERNEWS_GET_LATEST_POSTS"])
def modify_schema(
    tool: str,
    toolkit: str,
    schema: Tool,
) -> Tool:
    _ = schema.input_parameters["properties"].pop("page", None)
    schema.input_parameters["required"] = ["size"]
    return schema

# Initialize tools
openai_client = OpenAI()
composio = Composio(provider=OpenAIProvider())

# Define task
task = "Get the latest posts from Hacker News"

# Get tools with modifier
tools = composio.tools.get(
  user_id="default",
  tools=['HACKERNEWS_GET_LATEST_POSTS', 'HACKERNEWS_GET_USER'],
  modifiers=[
      modify_schema,
  ],
)

# Get response from the LLM
response = openai_client.chat.completions.create(
    model="gpt-5.4",
    tools=tools,
    messages=[
        {"role": "system", "content": "You are a helpful assistant."},
        {"role": "user", "content": task},
    ],
)
print(response)

# Execute the function calls
result = composio.provider.handle_tool_calls(response=response, user_id="default")
print(result)
```

**TypeScript:**

```typescript
import { Composio } from "@composio/core";
import { OpenAI } from "openai";

const composio = new Composio({
  apiKey: process.env.COMPOSIO_API_KEY,
});
const openai = new OpenAI();

const userId = "your@email.com";

const tools = await composio.tools.get(
  userId,
  {
    tools: ["HACKERNEWS_GET_LATEST_POSTS", "HACKERNEWS_GET_USER"],
  },
  {
    modifySchema: ({ toolSlug, toolkitSlug, schema }) => {
      if (toolSlug === "HACKERNEWS_GET_LATEST_POSTS") {
        const { inputParameters } = schema;
        if (inputParameters?.properties) {
          delete inputParameters.properties["page"];
        }
        inputParameters.required = ["size"];
      }
      return schema;
    },
  }
);

console.log(JSON.stringify(tools, null, 2));

const response = await openai.chat.completions.create({
  model: "gpt-5.4",
  messages: [
    {
      role: "system",
      content: "You are a helpful assistant that can help with tasks.",
    },
    { role: "user", content: "Get the latest posts from Hacker News" },
  ],
  tools: tools,
  tool_choice: "auto",
});

console.log(response.choices[0].message.tool_calls);
```

# Example: Modifying the tool description

Sometimes you need to provide additional context to help the agent understand how to use a tool correctly. This example demonstrates modifying the description of `GITHUB_LIST_REPOSITORY_ISSUES` to specify a default repository.

> This approach is useful when you want to guide the agent's behavior without changing the tool's underlying functionality.

In this example:

- We append additional instructions to the tool's description
- The modified description tells the agent to use `composiohq/composio` as the default repository
- This helps prevent errors when the agent forgets to specify a repository parameter

**Python:**

```python
from composio import Composio, schema_modifier
from composio.types import Tool
from composio_google import GoogleProvider
from google import genai
from uuid import uuid4

composio = Composio(provider=GoogleProvider())
client = genai.Client()
user_id = uuid4()

@schema_modifier(tools=["GITHUB_LIST_REPOSITORY_ISSUES"])
def append_repository(
    tool: str,
    toolkit: str,
    schema: Tool,
) -> Tool:
    schema.description += " When not specified, use the `composiohq/composio` repository"
    return schema

tools = composio.tools.get(
    user_id=user_id,
    tools=["GITHUB_LIST_REPOSITORY_ISSUES"],
    modifiers=[append_repository]
)

print(tools)
```

**TypeScript:**

```typescript
import { Composio } from "@composio/core";
import { VercelProvider } from "@composio/vercel";
import { v4 as uuidv4 } from "uuid";

const userId = uuidv4();
const composio = new Composio({
  apiKey: process.env.COMPOSIO_API_KEY,
  provider: new VercelProvider(),
});

const addDescription = ({ toolSlug, toolkitSlug, schema }) => {
  if (toolSlug === "GITHUB_LIST_REPOSITORY_ISSUES") {
    schema.description +=
      "If not specified, use the `composiohq/composio` repository";
  }
  return schema;
};

const tools = await composio.tools.get(
  userId,
  {
    tools: ["GITHUB_LIST_REPOSITORY_ISSUES"],
  },
  {
    modifySchema: addDescription,
  }
);

console.log(tools);
```

# What to read next

- [Before execution modifiers](/docs/tools-direct/modify-tool-behavior/before-execution-modifiers): Modify tool arguments before execution

- [After execution modifiers](/docs/tools-direct/modify-tool-behavior/after-execution-modifiers): Transform tool results after execution

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
