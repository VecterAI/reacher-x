import { z } from "zod";
import { liveTransport, type HttpRequest, type Transport } from "../calls/http";
import {
  BudgetStop,
  SpendGuard,
  keyFingerprint,
  openRouterKeySpend,
  type KeySpendSnapshot,
  type SpendReader,
  type StepSpendApproval,
} from "../execution/spend";

/**
 * Free account endpoints only, read through a Transport so tests use fakes.
 * Accounts are named by provider and a short key fingerprint; key values are
 * sent in secret headers only and never appear in a message. Balances are
 * read before and after each step. A balance measures the step's spend only
 * when nobody else uses the key: the funded X and LinkedIn keys are also
 * production's, so for them a balance is a sufficiency check and a recorded
 * account change, never a workspace's cost.
 */

export type AccountUnit = "usd" | "credits";

export type AccountReading = Readonly<{
  accountId: string;
  unit: AccountUnit;
  // What can still be spent: the balance, capped by the key's own limit when it has one.
  available: number;
  // Cumulative spend the key reports itself (OpenRouter); null for balance-only accounts.
  spentToDate: number | null;
  recordedAt: string;
  // How the reading was made when it differs from the usual, e.g. a fallback.
  note: string | null;
}>;

export type AccountReader = Readonly<{
  accountId: string;
  unit: AccountUnit;
  read(): Promise<AccountReading>;
  // The step guard's view of spend: a key's own usage, or the balance's decrease.
  spend: SpendReader;
}>;

const amount = z.union([
  z.number().finite(),
  z
    .string()
    .regex(/^-?\d+(\.\d+)?$/)
    .transform(Number),
]);

async function getBody(
  transport: Transport,
  accountId: string,
  request: Omit<HttpRequest, "method" | "timeoutMs">
) {
  let status: number;
  let body: unknown;
  try {
    const exchange = await transport({
      ...request,
      method: "GET",
      timeoutMs: 30_000,
    });
    status = exchange.response.status;
    body = exchange.response.body;
  } catch {
    throw new BudgetStop(`Cannot read the balance of ${accountId}.`);
  }
  if (status !== 200)
    throw new BudgetStop(
      `Cannot read the balance of ${accountId} (HTTP ${status}).`
    );
  return body;
}

function parsed<T>(schema: z.ZodType<T>, body: unknown, accountId: string) {
  const result = schema.safeParse(body);
  if (!result.success)
    throw new BudgetStop(
      `The balance of ${accountId} came back in an unexpected shape.`
    );
  return result.data;
}

/** Spend as the decrease of a balance; only differences are ever used. */
function balanceSpend(
  accountId: string,
  read: () => Promise<AccountReading>
): SpendReader {
  return {
    accountId,
    async read(): Promise<KeySpendSnapshot> {
      const reading = await read();
      return {
        accountId,
        recordedAt: reading.recordedAt,
        cumulativeUsd: -reading.available,
      };
    },
  };
}

const keySchema = z.object({
  data: z.object({
    usage: amount,
    limit_remaining: amount.nullish(),
  }),
});
const creditsSchema = z.object({
  data: z.object({ total_credits: amount, total_usage: amount }),
});

/** The account's credits left, or null when the key may not read them (401 or 403). */
async function openRouterCreditsLeft(
  transport: Transport,
  accountId: string,
  auth: Readonly<Record<string, string>>
) {
  let status: number;
  let body: unknown;
  try {
    const exchange = await transport({
      step: "balance:openrouter-credits",
      method: "GET",
      url: "https://openrouter.ai/api/v1/credits",
      secretHeaders: auth,
      timeoutMs: 30_000,
    });
    status = exchange.response.status;
    body = exchange.response.body;
  } catch {
    throw new BudgetStop(`Cannot read the balance of ${accountId}.`);
  }
  if (status === 401 || status === 403) return null;
  if (status !== 200)
    throw new BudgetStop(
      `Cannot read the balance of ${accountId} (HTTP ${status}).`
    );
  const credits = parsed(creditsSchema, body, accountId).data;
  return credits.total_credits - credits.total_usage;
}

/**
 * An OpenRouter key: its usage from GET /api/v1/key, and what it can still
 * spend, which is the account's credits left (GET /api/v1/credits) or the
 * key's own remaining limit, whichever is lower. If the key may not read the
 * account's credits, its own remaining limit is used and the reading says so.
 * The deployment's key is not shared with production, so its usage is
 * ReacherX's cost of record.
 */
export function openRouterAccount(
  apiKey: string,
  transport: Transport = liveTransport()
): AccountReader {
  const accountId = `openrouter:${keyFingerprint(apiKey)}`;
  const auth = { Authorization: `Bearer ${apiKey}` };
  return {
    accountId,
    unit: "usd",
    spend: openRouterKeySpend(apiKey, transport),
    async read() {
      const key = parsed(
        keySchema,
        await getBody(transport, accountId, {
          step: "balance:openrouter-key",
          url: "https://openrouter.ai/api/v1/key",
          secretHeaders: auth,
        }),
        accountId
      ).data;
      const left = await openRouterCreditsLeft(transport, accountId, auth);
      const limit = key.limit_remaining ?? null;
      if (left === null && limit === null)
        throw new BudgetStop(
          `${accountId} may not read its account's credits and has no limit of its own, so what it can spend is unknown.`
        );
      return {
        accountId,
        unit: "usd",
        available: Math.min(left ?? Infinity, limit ?? Infinity),
        spentToDate: key.usage,
        recordedAt: new Date().toISOString(),
        note:
          left === null
            ? "The account's credits could not be read (HTTP 401/403); the key's own remaining limit is used."
            : null,
      };
    },
  };
}

/**
 * SocialAPI (ReacherX's X data): GET /user returns the account balance in US
 * cents (its `rates.*` fields are cents per item too), converted here to USD.
 */
export function socialApiAccount(
  apiKey: string,
  transport: Transport = liveTransport()
): AccountReader {
  const accountId = `socialapi:${keyFingerprint(apiKey)}`;
  const read = async (): Promise<AccountReading> => ({
    accountId,
    unit: "usd",
    available:
      parsed(
        z.object({ balance: amount }),
        await getBody(transport, accountId, {
          step: "balance:socialapi",
          url: "https://api.socialapi.me/user",
          secretHeaders: { Authorization: `Bearer ${apiKey}` },
        }),
        accountId
      ).balance / 100,
    spentToDate: null,
    recordedAt: new Date().toISOString(),
    note: null,
  });
  return {
    accountId,
    unit: "usd",
    read,
    spend: balanceSpend(accountId, read),
  };
}

/** Renidly, formerly LinkdAPI (ReacherX's LinkedIn data): credits left on the key. The trailing slash is required. */
export function renidlyAccount(
  apiKey: string,
  transport: Transport = liveTransport()
): AccountReader {
  const accountId = `renidly:${keyFingerprint(apiKey)}`;
  const read = async (): Promise<AccountReading> => ({
    accountId,
    unit: "credits",
    available: parsed(
      z.object({ data: z.object({ balance: amount }) }),
      await getBody(transport, accountId, {
        step: "balance:renidly",
        url: "https://linkdapi.com/api/i/v1/credits/balance/k/",
        secretHeaders: { "X-AUTHAPI-Key": apiKey },
      }),
      accountId
    ).data.balance,
    spentToDate: null,
    recordedAt: new Date().toISOString(),
    note: null,
  });
  return {
    accountId,
    unit: "credits",
    read,
    spend: balanceSpend(accountId, read),
  };
}

const orgRowSchema = z
  .object({ org_id: z.string().optional(), id: z.string().optional() })
  .transform((row) => row.org_id ?? row.id ?? null);
const orgsSchema = z.union([
  z.array(orgRowSchema),
  z.object({ orgs: z.array(orgRowSchema) }).transform((body) => body.orgs),
  orgRowSchema.transform((id) => [id]),
]);
const tregBalanceSchema = z
  .object({ balance_usd: amount.optional(), balance_micro: amount.optional() })
  .refine(
    (body) => body.balance_usd !== undefined || body.balance_micro !== undefined
  )
  .transform((body) => body.balance_usd ?? body.balance_micro! / 1_000_000);

/**
 * Treg (Apollo, Lusha, Crustdata and its own search): GET /orgs names the
 * token's organization, then GET /orgs/{id}/balance its balance. The
 * organization is looked up once.
 */
export function tregAccount(
  token: string,
  transport: Transport = liveTransport()
): AccountReader {
  const accountId = `treg:${keyFingerprint(token)}`;
  const headers = { "X-Treg-Key-Protocol": "1" };
  const secretHeaders = { "X-Treg-Token": token };
  let orgId: string | null = null;
  const read = async (): Promise<AccountReading> => {
    if (orgId === null) {
      const ids = [
        ...new Set(
          parsed(
            orgsSchema,
            await getBody(transport, accountId, {
              step: "balance:treg-orgs",
              url: "https://treg.to/orgs",
              headers,
              secretHeaders,
            }),
            accountId
          ).filter((id): id is string => id !== null)
        ),
      ];
      if (ids.length !== 1)
        throw new BudgetStop(
          `The Treg token ${accountId} sees ${ids.length} organizations; it must belong to exactly one.`
        );
      orgId = ids[0];
    }
    const balance = parsed(
      tregBalanceSchema,
      await getBody(transport, accountId, {
        step: "balance:treg",
        url: `https://treg.to/orgs/${encodeURIComponent(orgId)}/balance`,
        // One transaction row is enough; only the balance is read.
        query: { limit: "1" },
        headers,
        secretHeaders,
      }),
      accountId
    );
    return {
      accountId,
      unit: "usd",
      available: balance,
      spentToDate: null,
      recordedAt: new Date().toISOString(),
      note: null,
    };
  };
  return { accountId, unit: "usd", read, spend: balanceSpend(accountId, read) };
}

export type CreditLimit = Readonly<{ accountId: string; maxCredits: number }>;

/** Saved when a step first starts, so a resumed step counts spend from the same point. */
export const budgetBaselineSchema = z.strictObject({
  // Guarded dollar accounts: spend so far as the guard reads it.
  spend: z.array(
    z.strictObject({
      accountId: z.string(),
      recordedAt: z.string(),
      cumulativeUsd: z.number(),
    })
  ),
  // Guarded credit accounts: credits available at the start.
  credits: z.array(
    z.strictObject({ accountId: z.string(), available: z.number() })
  ),
  // Every account's balance at the start, for the recorded account change.
  balances: z
    .array(z.strictObject({ accountId: z.string(), available: z.number() }))
    .default([]),
});
export type BudgetBaseline = z.infer<typeof budgetBaselineSchema>;

const show = (unit: AccountUnit, value: number) =>
  unit === "usd" ? `$${value.toFixed(2)}` : `${Math.round(value)} credits`;

/**
 * One step's approved spend across its accounts. Accounts only the benchmark
 * uses are guarded by their own spend: dollar accounts through the
 * SpendGuard, credit accounts by their balance. Accounts shared with
 * production (`shared`) are measured from the deployment's own records
 * instead (`checkRecorded`), and their balances only show there is enough
 * money. A step is refused when an account holds less than its approval
 * still needs.
 */
export class StepBudget {
  private readonly guard: SpendGuard;
  private readonly limits: Map<string, number>;
  private readonly units: Map<string, AccountUnit>;
  private readonly creditStart = new Map<string, number>();

  constructor(
    approval: StepSpendApproval,
    private readonly creditLimits: readonly CreditLimit[],
    private readonly accounts: readonly AccountReader[],
    private readonly shared: readonly string[] = []
  ) {
    const usd = accounts.filter((account) => account.unit === "usd");
    const credits = accounts.filter((account) => account.unit === "credits");
    const expected = [
      ...usd.map((account) => `${account.accountId} (USD)`),
      ...credits.map((account) => `${account.accountId} (credits)`),
    ].join(", ");
    const mismatch = new BudgetStop(
      `The approval must give exactly one limit for each account this step uses: ${expected}.`
    );
    const creditIds = new Set(creditLimits.map((limit) => limit.accountId));
    const usdIds = new Set(
      approval.accountLimits.map((limit) => limit.accountId)
    );
    if (
      creditIds.size !== creditLimits.length ||
      creditIds.size !== credits.length ||
      credits.some((account) => !creditIds.has(account.accountId)) ||
      usdIds.size !== approval.accountLimits.length ||
      usdIds.size !== usd.length ||
      usd.some((account) => !usdIds.has(account.accountId))
    )
      throw mismatch;
    const guarded = usd.filter(
      (account) => !shared.includes(account.accountId)
    );
    try {
      this.guard = new SpendGuard(
        {
          ...approval,
          accountLimits: approval.accountLimits.filter(
            (limit) => !shared.includes(limit.accountId)
          ),
        },
        guarded.map((account) => account.spend)
      );
    } catch {
      throw mismatch;
    }
    this.limits = new Map([
      ...approval.accountLimits.map(
        (limit) => [limit.accountId, limit.maxAdditionalUsd] as const
      ),
      ...creditLimits.map(
        (limit) => [limit.accountId, limit.maxCredits] as const
      ),
    ]);
    this.units = new Map(
      accounts.map((account) => [account.accountId, account.unit] as const)
    );
  }

  private shortfall(reading: AccountReading, used: number) {
    const need = Math.max(0, this.limits.get(reading.accountId)! - used);
    return reading.available < need
      ? `${reading.accountId} has ${show(reading.unit, reading.available)} available; the approval still needs ${show(reading.unit, need)}.`
      : null;
  }

  /**
   * Reads every account, starts the guard (from `saved` when resuming) and
   * refuses the step when any account cannot cover what is still approved.
   * `recorded` is what the deployment's records show the shared accounts
   * have already been used for in this step.
   */
  async open(
    saved: BudgetBaseline | null,
    recorded: Readonly<Record<string, number>> = {}
  ) {
    const readings = await this.read();
    const spend = await this.guard.start(saved?.spend ?? []);
    for (const reading of readings)
      if (
        reading.unit === "credits" &&
        !this.shared.includes(reading.accountId)
      )
        this.creditStart.set(
          reading.accountId,
          saved?.credits.find((item) => item.accountId === reading.accountId)
            ?.available ?? reading.available
        );
    const spent: Record<string, number> = {
      ...(await this.guard.check()),
      ...recorded,
    };
    for (const [accountId, start] of this.creditStart)
      spent[accountId] =
        start -
        readings.find((reading) => reading.accountId === accountId)!.available;
    const shortfalls = readings.flatMap(
      (reading) => this.shortfall(reading, spent[reading.accountId] ?? 0) ?? []
    );
    if (shortfalls.length) throw new BudgetStop(shortfalls.join(" "));
    const baseline: BudgetBaseline = {
      spend: [...spend],
      credits: [...this.creditStart].map(([accountId, available]) => ({
        accountId,
        available,
      })),
      balances:
        saved?.balances ??
        readings.map(({ accountId, available }) => ({ accountId, available })),
    };
    return { baseline, readings, spent };
  }

  /** Before each unit of paid work; throws BudgetStop at an approved amount. Shared accounts are skipped. */
  async check(accountIds?: readonly string[]) {
    await this.guard.check(accountIds);
    for (const limit of this.creditLimits) {
      if (accountIds && !accountIds.includes(limit.accountId)) continue;
      if (this.shared.includes(limit.accountId)) continue;
      const [reading] = await this.read([limit.accountId]);
      const used = this.creditStart.get(limit.accountId)! - reading.available;
      if (used >= limit.maxCredits)
        throw new BudgetStop(
          `${limit.accountId} reached its approved credits for this step.`
        );
    }
  }

  /** Shared accounts against their approved amounts, from the deployment's own records of this step. */
  checkRecorded(recorded: Readonly<Record<string, number>>) {
    for (const accountId of this.shared) {
      const limit = this.limits.get(accountId);
      if (limit !== undefined && (recorded[accountId] ?? 0) >= limit)
        throw new BudgetStop(
          `${accountId} reached its approved ${this.units.get(accountId) === "usd" ? "amount" : "credits"} for this step, by the deployment's own records.`
        );
    }
  }

  /** Before a workspace: the named accounts still hold what the approval needs, given what is recorded as used. */
  async ensureAvailable(
    accountIds: readonly string[],
    recorded: Readonly<Record<string, number>>
  ) {
    const readings = await this.read(accountIds);
    const shortfalls = readings.flatMap(
      (reading) =>
        this.shortfall(reading, recorded[reading.accountId] ?? 0) ?? []
    );
    if (shortfalls.length) throw new BudgetStop(shortfalls.join(" "));
    return readings;
  }

  /** Current readings, for all accounts or the named ones. */
  read(accountIds?: readonly string[]) {
    return Promise.all(
      this.accounts
        .filter(
          (account) => !accountIds || accountIds.includes(account.accountId)
        )
        .map((account) => account.read())
    );
  }
}

/**
 * What each account was used for since the step first started: guarded
 * accounts by their own spend, and every account's balance change (which,
 * for a shared key, includes other users).
 */
export function accountUse(
  baseline: BudgetBaseline,
  readings: readonly AccountReading[]
) {
  const spent: Record<string, number> = {};
  const balanceChange: Record<string, number> = {};
  for (const reading of readings) {
    const start = baseline.balances.find(
      (item) => item.accountId === reading.accountId
    );
    if (start)
      balanceChange[reading.accountId] = start.available - reading.available;
    const credits = baseline.credits.find(
      (item) => item.accountId === reading.accountId
    );
    if (credits)
      spent[reading.accountId] = credits.available - reading.available;
    const usd = baseline.spend.find(
      (item) => item.accountId === reading.accountId
    );
    if (usd)
      spent[reading.accountId] =
        (reading.spentToDate ?? -reading.available) - usd.cumulativeUsd;
  }
  return { spent, balanceChange };
}
