import { internal } from "../_generated/api";
import type { ActionCtx } from "../_generated/server";
import {
  assertProviderRequestAllowed,
  ProviderCircuitOpenError,
  type ProviderRequestContext,
} from "./providerReliability";
import {
  benchmarkHaltMessage,
  keywordPostSearchCapMessage,
  type LinkdApiPurpose,
} from "./benchmarkLinkdApiCap";
import { getSystemRuntimeConfig } from "./runtimeConfigHelpers";

const internalLinkdApiBudget = (internal as any).linkdapiBudget;

export const LINKDAPI_PROVIDER = "linkdapi";

export function getLinkdApiBudgetConfig() {
  return getSystemRuntimeConfig().providers.linkdApi;
}

export async function acquireLinkdApiBudget(
  ctx: ActionCtx,
  consumer: string,
  requestContext?: Omit<ProviderRequestContext, "consumer" | "endpoint">,
  // Set only by enrichment's keyword post search, the one call the
  // development benchmark cap counts (see benchmarkLinkdApiCap.ts).
  purpose?: LinkdApiPurpose
) {
  await assertProviderRequestAllowed(ctx, "linkdapi", {
    consumer,
    endpoint: consumer,
    ...requestContext,
  });
  const reservation = await ctx.runAction(
    internalLinkdApiBudget.acquireLinkdApiBudgetInternal,
    { consumer, ...(purpose ? { purpose } : {}) }
  );
  if (reservation.benchmarkHalted) {
    // Development benchmark kill switch: refused the same way, so work that
    // is already running stops calling LinkedIn while its workspace stops.
    const refusal = new ProviderCircuitOpenError({
      provider: "linkdapi",
      reason: "credits",
    });
    refusal.message = benchmarkHaltMessage(reservation.benchmarkHalted);
    throw refusal;
  }
  if (reservation.benchmarkCapRefused !== null) {
    // Development benchmark cap on the keyword post search: refused as an
    // open circuit is, without recording a provider failure, so the search
    // degrades as it already does for an unavailable provider and the circuit
    // stays closed.
    const refusal = new ProviderCircuitOpenError({
      provider: "linkdapi",
      reason: "credits",
    });
    refusal.message = keywordPostSearchCapMessage(
      reservation.benchmarkCapRefused
    );
    throw refusal;
  }
  return reservation;
}
