import { z } from "zod";
import { timestampSchema } from "./types";

export type UsageCharge = Readonly<{
  provider: string;
  quantity: number;
  unit: string;
  valuation:
    | { status: "priced"; normalUsd: number; rateReference: string }
    | { status: "unpriced"; reason: string };
  funding: { grantUnitsUsed: number | null; cashUsd: number | null };
}>;

export type KeySpendSnapshot = Readonly<{
  // Identify the actual account/key, not an env alias: two aliases can share a balance.
  accountId: string;
  recordedAt: string;
  cumulativeUsd: number;
}>;

export const stepSpendApprovalSchema = z
  .strictObject({
    approvalReference: z.string().trim().min(1),
    accountLimits: z
      .array(
        z.strictObject({
          accountId: z.string().min(1),
          maxAdditionalUsd: z.number().finite().nonnegative(),
        })
      )
      .min(1),
    approvedAt: timestampSchema,
  })
  .refine(
    (approval) =>
      new Set(approval.accountLimits.map((account) => account.accountId))
        .size === approval.accountLimits.length,
    "Account limits must not be duplicated through aliases."
  );
export type StepSpendApproval = Readonly<
  z.infer<typeof stepSpendApprovalSchema>
>;

export type UsageSummary = ReturnType<typeof summarizeUsage>;

/** Comparable usage rates and cash after grants are separate; unknown prices are never zero. */
export function summarizeUsage(charges: readonly UsageCharge[]) {
  let pricedUsageUsd = 0;
  let knownCashUsd = 0;
  let cashComplete = true;
  const unpricedUsage: { provider: string; quantity: number; unit: string }[] =
    [];
  for (const charge of charges) {
    const amounts = [
      charge.quantity,
      charge.funding.grantUnitsUsed,
      charge.funding.cashUsd,
    ];
    if (charge.valuation.status === "priced")
      amounts.push(charge.valuation.normalUsd);
    if (
      amounts.some(
        (amount) => amount !== null && (!Number.isFinite(amount) || amount < 0)
      )
    ) {
      throw new Error("Usage amounts must be finite and nonnegative.");
    }
    if (charge.valuation.status === "priced")
      pricedUsageUsd += charge.valuation.normalUsd;
    else
      unpricedUsage.push({
        provider: charge.provider,
        quantity: charge.quantity,
        unit: charge.unit,
      });
    if (charge.funding.cashUsd === null) cashComplete = false;
    else knownCashUsd += charge.funding.cashUsd;
  }
  return { pricedUsageUsd, unpricedUsage, knownCashUsd, cashComplete };
}

export interface SpendController {
  snapshot(accountId: string): Promise<KeySpendSnapshot>;
  applyLimits(approval: StepSpendApproval): Promise<void>;
  restoreLimits(): Promise<void>;
}
