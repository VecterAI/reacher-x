import { internal } from "../_generated/api";
import type { ActionCtx } from "../_generated/server";
import {
  assertProviderRequestAllowed,
  ProviderCircuitOpenError,
  type ProviderRequestContext,
} from "./providerReliability";
import { linkdApiCycleCapMessage } from "./benchmarkLinkdApiCap";
import { getSystemRuntimeConfig } from "./runtimeConfigHelpers";

const internalLinkdApiBudget = (internal as any).linkdapiBudget;

export const LINKDAPI_PROVIDER = "linkdapi";

export function getLinkdApiBudgetConfig() {
  return getSystemRuntimeConfig().providers.linkdApi;
}

export async function acquireLinkdApiBudget(
  ctx: ActionCtx,
  consumer: string,
  requestContext?: Omit<ProviderRequestContext, "consumer" | "endpoint">
) {
  await assertProviderRequestAllowed(ctx, "linkdapi", {
    consumer,
    endpoint: consumer,
    ...requestContext,
  });
  const reservation = await ctx.runAction(
    internalLinkdApiBudget.acquireLinkdApiBudgetInternal,
    {
      consumer,
    }
  );
  if (reservation.benchmarkCapRefused !== null) {
    // Development benchmark cap: refused as an open circuit is, without
    // recording a provider failure, so every caller degrades as it already
    // does for an unavailable provider and the circuit stays closed.
    const refusal = new ProviderCircuitOpenError({
      provider: "linkdapi",
      reason: "credits",
    });
    refusal.message = linkdApiCycleCapMessage(reservation.benchmarkCapRefused);
    throw refusal;
  }
  return reservation;
}
