import { ConvexReactClient } from "convex/react";
import { getFunctionName } from "convex/server";
import type {
  FunctionArgs,
  FunctionReference,
  FunctionReturnType,
} from "convex/server";

/** Demo-only adapter of the SDK's public client surface. No hook replacement. */
export class LocalClient extends ConvexReactClient {
  private handlers = new Map<string, (args: never) => unknown>();
  private observers = new Set<() => void>();
  private version = 0;
  private timers = new Set<ReturnType<typeof setTimeout>>();
  private queryResults = new Map<
    string,
    { value: unknown; serialized: string | undefined; version: number }
  >();

  constructor() {
    // Never configured with a real deployment; all used data methods are overridden.
    super("http://127.0.0.1:1", { skipConvexDeploymentUrlCheck: true });
  }

  register<F extends FunctionReference<"query" | "mutation" | "action">>(
    reference: F,
    handler: (
      args: FunctionArgs<F>
    ) => FunctionReturnType<F> | Promise<FunctionReturnType<F>>
  ) {
    this.handlers.set(getFunctionName(reference), handler);
  }

  private run(
    reference: FunctionReference<"query" | "mutation" | "action">,
    args: unknown
  ) {
    const name = getFunctionName(reference);
    const handler = this.handlers.get(name);
    if (!handler) {
      console.error("[DemoServices] Missing local handler", name);
      throw new Error(`Unimplemented demo service: ${name}`);
    }
    return handler(args as never);
  }

  notify() {
    this.version += 1;
    for (const observer of this.observers) observer();
  }

  schedule(callback: () => void, delayMs: number) {
    const timer = setTimeout(() => {
      this.timers.delete(timer);
      callback();
      this.notify();
    }, delayMs);
    if (typeof timer === "object" && "unref" in timer) timer.unref();
    this.timers.add(timer);
  }

  override async close() {
    this.timers.forEach(clearTimeout);
    this.timers.clear();
    this.observers.clear();
    await super.close();
  }

  override watchQuery: ConvexReactClient["watchQuery"] = (query, ...args) => ({
    onUpdate: (callback) => {
      this.observers.add(callback);
      return () => {
        this.observers.delete(callback);
      };
    },
    // Runtime name dispatch is the one type-erasure boundary; registrations remain typed.
    localQueryResult: () => {
      const key = JSON.stringify([getFunctionName(query), args[0] ?? {}]);
      const cached = this.queryResults.get(key);
      if (cached?.version === this.version) return cached.value as never;
      const value = this.run(query, args[0] ?? {});
      if (value instanceof Promise)
        throw new Error("Local query handlers must return synchronously");
      const serialized = JSON.stringify(value);
      const snapshot =
        cached && cached.serialized === serialized
          ? cached.value
          : structuredClone(value);
      this.queryResults.set(key, {
        value: snapshot,
        serialized,
        version: this.version,
      });
      return snapshot as never;
    },
    localQueryLogs: () => undefined,
    journal: () => undefined,
  });
  override action: ConvexReactClient["action"] = async (action, ...args) => {
    try {
      return (await this.run(action, args[0] ?? {})) as never;
    } finally {
      // Local actions can persist state just like actions calling mutations.
      this.notify();
    }
  };
  override mutation: ConvexReactClient["mutation"] = async (
    mutation,
    ...args
  ) => {
    const result = await this.run(mutation, args[0] ?? {});
    this.notify();
    return result as never;
  };
  override query: ConvexReactClient["query"] = async (query, ...args) => {
    // Imperative SDK queries settle after the caller's current browser task,
    // like a network response. Subscribed watchQuery reads remain synchronous.
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
    return structuredClone(await this.run(query, args[0] ?? {})) as never;
  };
  override setAuth: ConvexReactClient["setAuth"] = (_fetchToken, onChange) => {
    onChange?.(true);
  };
  override clearAuth() {}
}
