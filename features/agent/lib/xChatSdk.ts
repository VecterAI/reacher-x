import type * as XChatSdk from "@xdevplatform/chat-xdk";

/**
 * The only runtime entry point to `@xdevplatform/chat-xdk`.
 *
 * The SDK does XChat encryption in WASM and only ever runs in the browser.
 * Next replaces `typeof window` with a constant in server builds, so on the
 * server the `import()` branch is dead code: the SDK, its `.wasm` file, and the
 * WASM loader never enter a server bundle. When they did, the loader's dynamic
 * path made the bundler trace all of `node_modules` into every Vercel function
 * (upstream: vercel/next.js#100314, fix PR vercel/next.js#100391).
 *
 * Lint blocks runtime imports (both static `import ... from` and dynamic
 * `import()`) of the SDK elsewhere, while allowing erased `import type`
 * declarations, and `scripts/check-function-size.ts` fails the build if the SDK
 * sneaks back into a server bundle another way.
 */
export function loadXChatSdk(): Promise<typeof XChatSdk> {
  return typeof window === "undefined"
    ? Promise.reject(new Error("XChat is only available in the browser."))
    : import("@xdevplatform/chat-xdk");
}
