import { createHash } from "node:crypto";
import { z } from "zod";
import { liveTransport, type Exchange, type Transport } from "../calls/http";
import { timestampSchema } from "../types";

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

/** Raised when a step must stop: spend unreadable, or past its approved amount. */
export class BudgetStop extends Error {}

export type SpendReader = Readonly<{
  accountId: string;
  read(): Promise<KeySpendSnapshot>;
}>;

const openRouterKeySchema = z.object({
  data: z.object({ usage: z.number().finite().nonnegative() }),
});

/** Identifies a key by a short hash, so aliases sharing one key share one limit and no value is logged. */
export function keyFingerprint(key: string) {
  return createHash("sha256").update(key.trim()).digest("hex").slice(0, 10);
}

/** Cumulative spend of one OpenRouter key, from GET /api/v1/key (free). */
export function openRouterKeySpend(
  apiKey: string,
  transport: Transport = liveTransport()
): SpendReader {
  const accountId = `openrouter:${keyFingerprint(apiKey)}`;
  return {
    accountId,
    async read() {
      let exchange: Exchange;
      try {
        exchange = await transport({
          step: "spend:openrouter-key",
          method: "GET",
          url: "https://openrouter.ai/api/v1/key",
          secretHeaders: { Authorization: `Bearer ${apiKey}` },
          timeoutMs: 30_000,
        });
      } catch {
        throw new BudgetStop(`Cannot read spend for ${accountId}.`);
      }
      const body = openRouterKeySchema.safeParse(
        exchange.response.status === 200 ? exchange.response.body : null
      );
      if (!body.success)
        throw new BudgetStop(`Cannot read spend for ${accountId}.`);
      return {
        accountId,
        recordedAt: new Date().toISOString(),
        cumulativeUsd: body.data.data.usage,
      };
    },
  };
}

/**
 * Software limit for one approved step. Each account's spend is read at the
 * start and before every unit of paid work; reaching the approved amount, or
 * failing to read spend, stops the step. A key's own credit limit, set by its
 * owner, remains the hard backstop.
 */
export class SpendGuard {
  private readonly baselines = new Map<string, KeySpendSnapshot>();
  private readonly limits: Map<string, number>;

  constructor(
    approval: StepSpendApproval,
    private readonly readers: readonly SpendReader[]
  ) {
    this.limits = new Map(
      approval.accountLimits.map((limit) => [
        limit.accountId,
        limit.maxAdditionalUsd,
      ])
    );
    const approved = new Set(
      approval.accountLimits.map((limit) => limit.accountId)
    );
    if (
      new Set(readers.map((reader) => reader.accountId)).size !==
        readers.length ||
      readers.length !== approved.size ||
      readers.some((reader) => !approved.has(reader.accountId))
    )
      throw new BudgetStop(
        "Every paid account needs exactly one approved limit."
      );
  }

  /**
   * Reads each account's starting spend. A resumed step passes the baselines
   * its first start returned, so the approved amount covers the whole step,
   * not each attempt.
   */
  async start(saved: readonly KeySpendSnapshot[] = []) {
    for (const reader of this.readers)
      this.baselines.set(
        reader.accountId,
        saved.find((snapshot) => snapshot.accountId === reader.accountId) ??
          (await reader.read())
      );
    return [...this.baselines.values()];
  }

  /**
   * Call before each unit of paid work, optionally for some accounts only
   * (for example the key a workspace spends on, between its status polls).
   * Returns spend so far per account read.
   */
  async check(only?: readonly string[]) {
    const spent: Record<string, number> = {};
    for (const reader of this.readers) {
      if (only && !only.includes(reader.accountId)) continue;
      const baseline = this.baselines.get(reader.accountId);
      if (!baseline) throw new BudgetStop("The spend guard was not started.");
      const limit = this.limits.get(reader.accountId)!;
      const additional =
        (await reader.read()).cumulativeUsd - baseline.cumulativeUsd;
      spent[reader.accountId] = additional;
      if (additional >= limit)
        throw new BudgetStop(
          `${reader.accountId} reached its approved amount for this step.`
        );
    }
    return spent;
  }

  /** Raises an account's approved amount mid-step; never lowers it. */
  raise(accountId: string, amount: number) {
    const current = this.limits.get(accountId);
    if (current !== undefined && amount > current)
      this.limits.set(accountId, amount);
  }
}
