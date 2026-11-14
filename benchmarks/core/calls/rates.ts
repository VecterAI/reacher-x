import { z } from "zod";
import type { UsageCharge } from "../execution/spend";

/** What a provider call consumed, as the adapter observed it. Pricing happens later. */
export type UsageUnits = Readonly<{
  provider: string;
  unit: string;
  quantity: number;
  // A dollar amount the provider itself reported for this usage, if any.
  reportedUsd: number | null;
}>;

/**
 * Frozen before a live step (proposal section 7): non-sponsored rates and how
 * each provider is funded. A unit without a rate stays unpriced, never $0.
 */
export const rateSnapshotSchema = z.strictObject({
  recordedAt: z.iso.datetime({ offset: true }),
  rates: z.array(
    z.strictObject({
      provider: z.string().min(1),
      unit: z.string().min(1),
      // "reported" uses the dollar amount the provider returned for the call.
      usdPerUnit: z.union([
        z.number().finite().nonnegative(),
        z.literal("reported"),
      ]),
      reference: z.string().min(1),
    })
  ),
  funding: z.array(
    z.strictObject({
      provider: z.string().min(1),
      source: z.enum(["grant", "cash"]),
    })
  ),
});
export type RateSnapshot = z.infer<typeof rateSnapshotSchema>;

export function priceUsage(
  usage: readonly UsageUnits[],
  snapshot: RateSnapshot
): UsageCharge[] {
  return usage.map((item) => {
    const rate = snapshot.rates.find(
      (entry) => entry.provider === item.provider && entry.unit === item.unit
    );
    const normalUsd =
      rate?.usdPerUnit === "reported"
        ? item.reportedUsd
        : rate
          ? rate.usdPerUnit * item.quantity
          : null;
    const valuation: UsageCharge["valuation"] =
      rate && normalUsd !== null
        ? { status: "priced", normalUsd, rateReference: rate.reference }
        : {
            status: "unpriced",
            reason: rate
              ? "The provider did not report a cost for this call."
              : "No frozen rate for this unit.",
          };
    const source = snapshot.funding.find(
      (entry) => entry.provider === item.provider
    )?.source;
    return {
      provider: item.provider,
      quantity: item.quantity,
      unit: item.unit,
      valuation,
      funding:
        source === "grant"
          ? { grantUnitsUsed: item.quantity, cashUsd: 0 }
          : source === "cash"
            ? {
                grantUnitsUsed: 0,
                cashUsd:
                  valuation.status === "priced" ? valuation.normalUsd : null,
              }
            : { grantUnitsUsed: null, cashUsd: null },
    };
  });
}
