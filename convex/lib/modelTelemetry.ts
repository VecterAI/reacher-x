import type { ProviderMetadata } from "ai";
import { internal } from "../_generated/api";
import type { ActionCtx } from "../_generated/server";
import {
  sanitizeProviderMetadataForConvex,
  sanitizeTelemetryPayload,
} from "./agentMetadata";

type PromiseOrValue<T> = PromiseLike<T> | T;

export async function persistRawModelResponse(
  ctx: ActionCtx,
  args: {
    userId?: string;
    threadId?: string;
    agentName?: string;
    request?: PromiseOrValue<unknown>;
    response?: PromiseOrValue<unknown>;
    providerMetadata?: PromiseOrValue<ProviderMetadata | undefined>;
  }
) {
  const [request, response, providerMetadata] = await Promise.all([
    args.request,
    args.response,
    args.providerMetadata,
  ]);

  await ctx.runMutation(internal.agentTelemetry.insertRawResponse, {
    userId: args.userId,
    threadId: args.threadId,
    agentName: args.agentName,
    request: sanitizeTelemetryPayload(request),
    response: sanitizeTelemetryPayload(response),
    providerMetadata: sanitizeProviderMetadataForConvex(providerMetadata),
  });
}
