import assert from "node:assert/strict";
import test from "node:test";
import type { HttpRequest, Transport } from "../../core/calls/http";
import { BudgetStop, keyFingerprint } from "../../core/execution/spend";
import {
  StepBudget,
  accountUse,
  openRouterAccount,
  renidlyAccount,
  socialApiAccount,
  tregAccount,
} from "../../core/steps/balances";

// Synthetic keys and balances; nothing reaches a provider.
const KEY = "sk-synthetic-not-a-real-key";

/** Answers each URL from `bodies`, records every request, and fails unknown URLs. */
function provider(bodies: Record<string, unknown>, status = 200) {
  const seen: HttpRequest[] = [];
  const transport: Transport = async (request) => {
    seen.push(request);
    const known = request.url in bodies;
    return {
      step: request.step,
      request: { method: request.method, url: request.url },
      response: {
        status: known ? status : 404,
        body: known ? bodies[request.url] : null,
        headers: {},
      },
      latencyMs: 1,
    };
  };
  return { transport, seen };
}

test("each account is read from its free endpoint, with the key only in secret headers", async () => {
  const openRouter = provider({
    "https://openrouter.ai/api/v1/key": {
      data: { usage: 4.5, limit: 50, limit_remaining: 45.5 },
    },
    "https://openrouter.ai/api/v1/credits": {
      data: { total_credits: 20, total_usage: 18.04 },
    },
  });
  const reading = await openRouterAccount(KEY, openRouter.transport).read();
  // The account's credits are lower than the key's own limit.
  assert.equal(Number(reading.available.toFixed(2)), 1.96);
  assert.equal(reading.spentToDate, 4.5);
  assert.equal(reading.accountId, `openrouter:${keyFingerprint(KEY)}`);

  const social = provider({
    // SocialAPI reports cents.
    "https://api.socialapi.me/user": { balance: "25206" },
  });
  assert.equal(
    (await socialApiAccount(KEY, social.transport).read()).available,
    252.06
  );

  const renidly = provider({
    "https://linkdapi.com/api/i/v1/credits/balance/k/": {
      data: { balance: 2_928 },
    },
  });
  const credits = await renidlyAccount(KEY, renidly.transport).read();
  assert.equal(credits.unit, "credits");
  assert.equal(credits.available, 2_928);
  assert.deepEqual(renidly.seen[0].secretHeaders, { "X-AUTHAPI-Key": KEY });

  const treg = provider({
    // Treg's organization IDs are numbers.
    "https://treg.to/orgs": [{ org_id: 41, slug: "team" }],
    "https://treg.to/orgs/41/balance": {
      org_id: 41,
      balance_micro: 501_250_000,
    },
  });
  const account = tregAccount(KEY, treg.transport);
  assert.equal((await account.read()).available, 501.25);
  await account.read();
  // The organization is looked up once; both calls name the key protocol.
  assert.deepEqual(
    treg.seen.map((request) => request.url),
    [
      "https://treg.to/orgs",
      "https://treg.to/orgs/41/balance",
      "https://treg.to/orgs/41/balance",
    ]
  );
  assert.ok(
    treg.seen.every(
      (request) =>
        request.method === "GET" &&
        request.headers?.["X-Treg-Key-Protocol"] === "1" &&
        request.secretHeaders?.["X-Treg-Token"] === KEY
    )
  );
  for (const request of [...openRouter.seen, ...social.seen, ...treg.seen])
    assert.ok(
      !JSON.stringify({ ...request, secretHeaders: undefined }).includes(KEY)
    );
});

test("an unreadable balance stops the step without naming the key", async () => {
  const failing = provider(
    { "https://api.socialapi.me/user": { error: "no" } },
    401
  );
  await assert.rejects(
    socialApiAccount(KEY, failing.transport).read(),
    (error: Error) => {
      assert.ok(error instanceof BudgetStop);
      assert.match(error.message, /HTTP 401/);
      assert.ok(!error.message.includes(KEY));
      return true;
    }
  );
  const shapeless = provider({
    "https://treg.to/orgs": [{ org_id: "a" }, { org_id: "b" }],
  });
  await assert.rejects(
    tregAccount(KEY, shapeless.transport).read(),
    /2 organizations/
  );
});

/** Accounts whose balances the test moves by hand. */
function accounts() {
  const state = { usage: 1, social: 10, credits: 500 };
  const transport: Transport = async (request) => ({
    step: request.step,
    request: { method: request.method, url: request.url },
    response: {
      status: 200,
      headers: {},
      body: request.url.endsWith("/key")
        ? { data: { usage: state.usage } }
        : request.url.endsWith("/credits")
          ? { data: { total_credits: 100, total_usage: state.usage } }
          : request.url.includes("socialapi")
            ? { balance: state.social * 100 }
            : { data: { balance: state.credits } },
    },
    latencyMs: 1,
  });
  return {
    state,
    readers: [
      openRouterAccount("synthetic-or", transport),
      socialApiAccount("synthetic-social", transport),
      renidlyAccount("synthetic-renidly", transport),
    ],
  };
}

const approval = (social: number) => ({
  approvalReference: "Synthetic step",
  approvedAt: "2026-11-15T00:00:00Z",
  accountLimits: [
    {
      accountId: `openrouter:${keyFingerprint("synthetic-or")}`,
      maxAdditionalUsd: 2,
    },
    {
      accountId: `socialapi:${keyFingerprint("synthetic-social")}`,
      maxAdditionalUsd: social,
    },
  ],
});
const credits = [
  {
    accountId: `renidly:${keyFingerprint("synthetic-renidly")}`,
    maxCredits: 30,
  },
];

test("a step is refused when an account holds less than its approval still needs", async () => {
  const { readers } = accounts();
  await assert.rejects(
    new StepBudget(approval(25), credits, readers).open(null),
    (error: Error) => {
      assert.ok(error instanceof BudgetStop);
      assert.match(
        error.message,
        /socialapi:\w+ has \$10\.00 available; the approval still needs \$25\.00/
      );
      return true;
    }
  );
  assert.throws(
    () => new StepBudget(approval(5), [], readers),
    /exactly one limit for each account this step uses: openrouter:\w+ \(USD\), socialapi:\w+ \(USD\), renidly:\w+ \(credits\)/
  );
});

test("spend counts from the first start, and credits stop the step at their approved amount", async () => {
  const { state, readers } = accounts();
  const budget = new StepBudget(approval(5), credits, readers);
  const { baseline } = await budget.open(null);
  state.usage = 2.5;
  state.credits = 480;
  await budget.check();
  // A resumed attempt keeps the first baseline, so earlier spend still counts.
  const resumed = new StepBudget(approval(5), credits, readers);
  const reopened = await resumed.open(baseline);
  assert.equal(
    reopened.spent[`openrouter:${keyFingerprint("synthetic-or")}`],
    1.5
  );
  state.credits = 470;
  await assert.rejects(
    resumed.check(),
    /renidly:\w+ reached its approved amount/
  );
  // Between workspace polls only the deployment key is checked.
  await resumed.check([`openrouter:${keyFingerprint("synthetic-or")}`]);
});

test("an OpenRouter key that may not read its account's credits falls back to its own limit", async () => {
  const limited = provider({
    "https://openrouter.ai/api/v1/key": {
      data: { usage: 2, limit: 10, limit_remaining: 8 },
    },
  });
  // Unknown URLs answer 404; make /credits a 403 instead.
  const forbidden: Transport = async (request) =>
    request.url.endsWith("/credits")
      ? {
          step: request.step,
          request: { method: request.method, url: request.url },
          response: { status: 403, body: null, headers: {} },
          latencyMs: 1,
        }
      : limited.transport(request);
  const reading = await openRouterAccount(KEY, forbidden).read();
  assert.equal(reading.available, 8);
  assert.match(reading.note ?? "", /key's own remaining limit is used/);
  // With no limit of its own either, what it can spend is unknown.
  const unlimited = provider({
    "https://openrouter.ai/api/v1/key": {
      data: { usage: 2, limit_remaining: null },
    },
  });
  await assert.rejects(
    openRouterAccount(KEY, async (request) =>
      request.url.endsWith("/credits")
        ? {
            ...(await unlimited.transport(request)),
            response: { status: 401, body: null, headers: {} },
          }
        : unlimited.transport(request)
    ).read(),
    /has no limit of its own/
  );
});

test("keys shared with production are limited by the deployment's records, not their balance", async () => {
  const { state, readers } = accounts();
  const social = `socialapi:${keyFingerprint("synthetic-social")}`;
  const renidly = `renidly:${keyFingerprint("synthetic-renidly")}`;
  const budget = new StepBudget(approval(5), credits, readers, [
    social,
    renidly,
  ]);
  const { baseline } = await budget.open(null);
  // Production spends from the shared keys; that never stops the step.
  state.social = 6;
  state.credits = 400;
  await budget.check();
  // What the deployment recorded for this step's workspaces does.
  budget.checkRecorded({ [social]: 4.99, [renidly]: 29 });
  assert.throws(
    () => budget.checkRecorded({ [social]: 5 }),
    /reached its approved amount for this step, by the deployment's own records/
  );
  assert.throws(
    () => budget.checkRecorded({ [renidly]: 30 }),
    /approved credits/
  );
  // Before a workspace, the balance must still cover what is approved and not yet used.
  assert.equal(
    (await budget.ensureAvailable([social], { [social]: 1 }))[0].available,
    6
  );
  state.social = 3;
  await assert.rejects(
    budget.ensureAvailable([social], { [social]: 1 }),
    /has \$3\.00 available; the approval still needs \$4\.00/
  );
  // The balance change is recorded for every account, the spend only for unshared ones.
  const use = accountUse(baseline, await budget.read());
  assert.equal(use.balanceChange[social], 7);
  assert.equal(use.spent[social], undefined);
  assert.equal(use.spent[`openrouter:${keyFingerprint("synthetic-or")}`], 0);
});

test("a top-up never frees approved spend, also across a resume", async () => {
  const { state, readers } = accounts();
  const social = `socialapi:${keyFingerprint("synthetic-social")}`;
  state.social = 100;
  const budget = new StepBudget(approval(10), credits, readers);
  await budget.open(null);
  state.social = 91;
  await budget.check();
  // Someone tops the account up by $100: the $9 already spent still counts.
  state.social = 191;
  await budget.check();
  const saved = budget.baseline();
  assert.equal(accountUse(saved, await budget.read()).spent[social], 9);
  // A resumed attempt continues from the saved decreases, not from the new balance.
  const resumed = new StepBudget(approval(10), credits, readers);
  assert.equal((await resumed.open(saved)).spent[social], 9);
  state.social = 189;
  await assert.rejects(
    resumed.check(),
    /socialapi:\w+ reached its approved amount/
  );
  assert.equal(
    accountUse(resumed.baseline(), await resumed.read()).spent[social],
    11
  );
});

test("an approval raised mid-step applies at once; a lower amount never does", async () => {
  const { state, readers } = accounts();
  const openRouter = `openrouter:${keyFingerprint("synthetic-or")}`;
  const social = `socialapi:${keyFingerprint("synthetic-social")}`;
  const renidly = `renidly:${keyFingerprint("synthetic-renidly")}`;
  const budget = new StepBudget(approval(5), credits, readers, [
    social,
    renidly,
  ]);
  await budget.open(null);
  state.usage = 3;
  await assert.rejects(budget.check(), /openrouter:\w+ reached its approved/);
  assert.throws(() => budget.checkRecorded({ [renidly]: 30 }), /credits/);

  const raised = {
    ...approval(5),
    accountLimits: [
      { accountId: openRouter, maxAdditionalUsd: 4 },
      { accountId: social, maxAdditionalUsd: 5 },
    ],
  };
  const first = budget.raise(raised, [{ accountId: renidly, maxCredits: 60 }]);
  assert.equal(first.raised.length, 2);
  assert.deepEqual(first.kept, []);
  await budget.check();
  budget.checkRecorded({ [renidly]: 59 });
  assert.throws(() => budget.checkRecorded({ [renidly]: 60 }), /credits/);

  // A lower amount, or an account the step does not use, changes nothing.
  const lower = budget.raise(
    {
      ...raised,
      accountLimits: [
        { accountId: openRouter, maxAdditionalUsd: 1 },
        { accountId: "treg:unused", maxAdditionalUsd: 99 },
      ],
    },
    []
  );
  assert.deepEqual(lower.raised, []);
  assert.match(lower.kept[0], /openrouter:\w+ stays at \$4\.00/);
  await budget.check();
});
