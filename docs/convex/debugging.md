# Debugging

## Debugging in the Playground[​](#debugging-in-the-playground "Direct link to Debugging in the Playground")

Generally the [Playground](/agents/playground.md) gives a lot of information about what's happening, but when that is insufficient, you have other options.

## Logging the raw request and response from LLM calls[​](#logging-the-raw-request-and-response-from-llm-calls "Direct link to Logging the raw request and response from LLM calls")

You can provide a `rawRequestResponseHandler` to the agent to log the raw request and response from the LLM.

You could use this to log the request and response to a table, or use console logs with [Log Streaming](https://docs.convex.dev/production/integrations/log-streams/) to allow debugging and searching through Axiom or another logging service.

```
const supportAgent = new Agent(components.agent, {
  ...
  rawRequestResponseHandler: async (ctx, { request, response }) => {
    console.log("request", request);
    console.log("response", response);
  },
});
```

## Logging the context messages via the contextHandler[​](#logging-the-context-messages-via-the-contexthandler "Direct link to Logging the context messages via the contextHandler")

You can log the context messages via the contextHandler, if you're curious what exactly the LLM is receiving.

```
const supportAgent = new Agent(components.agent, {
  ...
  contextHandler: async (ctx, { allMessages }) => {
    console.log("context", allMessages);
    return allMessages;
  },
});
```

## Inspecting the database in the dashboard[​](#inspecting-the-database-in-the-dashboard "Direct link to Inspecting the database in the dashboard")

You can go to the Data tab in the dashboard and select the agent component above the table list to see the Agent data. The organization of the tables matches the [schema](https://github.com/get-convex/agent/blob/main/src/component/schema.ts). The most useful tables are:

- `threads` has one row per thread
- `messages` has a separate row for each ModelMessage - e.g. a user message, assistant tool call, tool result, assistant message, etc. The most important fields are `agentName` for which agent it's associated with, `status`, `order` and `stepOrder` which are used to order the messages, and `message` which is roughly what is passed to the LLM.
- `streamingMessages` has an entry for each streamed message, until it's cleaned up. You can take the ID to look at the associated `streamDeltas` table.
- `files` captures the files tracked by the Agent from content that was sent in a message that got stored in File Storage.

## Troubleshooting[​](#troubleshooting "Direct link to Troubleshooting")

### Type errors on `components.agent`[​](#type-errors-on-componentsagent "Direct link to type-errors-on-componentsagent")

If you get type errors about `components.agent`, ensure you've run `npx convex dev` to generate code for the component. The types expected by the library are in the npm library, and the types for `components.agent` currently come from generated code in your project (via `npx convex dev`).

### Circular dependencies[​](#circular-dependencies "Direct link to Circular dependencies")

Having the return value of workflows depend on other Convex functions can lead to circular dependencies due to the `internal.foo.bar` way of specifying functions. The way to fix this is to explicitly type the return value of the workflow. When in doubt, add return types to more `handler` functions, like this:

```
export const supportAgentWorkflow = workflow.define({
  args: { prompt: v.string(), userId: v.string(), threadId: v.string() },
  handler: async (step, { prompt, userId, threadId }): Promise<string> => {
    // ...
  },
});

// And regular functions too:
export const myFunction = action({
  args: { prompt: v.string() },
  handler: async (ctx, { prompt }): Promise<string> => {
    // ...
  },
});
```
