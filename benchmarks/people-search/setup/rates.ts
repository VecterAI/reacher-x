import type { RateSnapshot } from "../../core/calls/rates";

// Proposal 7 and 7.2: competitor usage is priced at non-sponsored rates frozen
// before comparison. Providers that report the exact charge per call (Exa's
// costDollars, Treg's x-treg-cost-micro, OpenRouter's usage cost) use that
// figure. Quota-covered units (Clay results, Firecrawl and context.dev credits)
// have no dollar rate here, so they are reported as units, never as $0.
// Credits change cash needed, not comparable cost, so funding is listed apart.
export function peopleSearchRates(recordedAt: string): RateSnapshot {
  return {
    recordedAt,
    rates: [
      {
        provider: "exa",
        unit: "request",
        usdPerUnit: "reported",
        reference: "Exa costDollars per response; exa.ai/pricing",
      },
      {
        provider: "treg",
        unit: "call",
        usdPerUnit: "reported",
        reference:
          "Treg x-treg-cost-micro per call; Treg search $0.007, Lusha $0.00499/result, Apollo $0.026/lookup, Crustdata $0.009/result (proposal 7.2)",
      },
      {
        provider: "openrouter-harness",
        unit: "model-call",
        usdPerUnit: "reported",
        reference: "OpenRouter usage cost per call",
      },
      // ReacherX's own cost. The deployment's OpenRouter key is not shared
      // with production, so its spend before and after each cycle (one
      // workspace at a time) is the cost of record. The X and LinkedIn keys
      // are production's too, so their use comes from the deployment's own
      // provider records, never from their balances; LinkedIn credits have
      // no frozen dollar rate and stay units.
      {
        provider: "openrouter",
        unit: "usd",
        usdPerUnit: "reported",
        reference:
          "Deployment OpenRouter key spend before and after the cycle (key not shared with production)",
      },
      {
        provider: "socialapi",
        unit: "tweet-or-user",
        usdPerUnit: 0.0002,
        reference:
          "SocialAPI $0.20 per 1,000 tweets or users, applied to the deployment's recorded units (SOCIAL_API_COST_PER_ENTITY_USD)",
      },
    ],
    funding: [
      { provider: "openrouter", source: "cash" },
      { provider: "openrouter-harness", source: "cash" },
      { provider: "exa", source: "cash" },
      { provider: "socialapi", source: "cash" },
      { provider: "treg", source: "grant" },
      { provider: "renidly", source: "grant" },
      { provider: "context.dev", source: "grant" },
      { provider: "crustdata", source: "grant" },
    ],
  };
}
