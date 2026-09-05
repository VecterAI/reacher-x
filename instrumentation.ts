import type { NodeInstrumentationHooks } from "evlog/next/instrumentation";

export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    // A literal import lets Next.js trace the logger into deployed functions.
    const instrumentation =
      await import("@/shared/lib/logging/instrumentationHelpers");
    await instrumentation.register();
  }
}

export const onRequestError: NodeInstrumentationHooks["onRequestError"] =
  async (error, request, context) => {
    if (process.env.NEXT_RUNTIME === "nodejs") {
      const instrumentation =
        await import("@/shared/lib/logging/instrumentationHelpers");
      await instrumentation.onRequestError(error, request, context);
    }
  };
