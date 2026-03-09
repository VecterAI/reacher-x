import { query } from "./lib/functionBuilders";

const PROMO_THRESHOLD = 100; // Update this to change the offer threshold

export const getPromoStats = query({
  args: {},
  handler: async (ctx) => {
    const users = await ctx.db.query("users").collect();
    const claimedCount = users.length;
    const remaining = Math.max(0, PROMO_THRESHOLD - claimedCount);

    return {
      threshold: PROMO_THRESHOLD,
      claimedCount,
      remaining,
      soldOut: remaining === 0,
    };
  },
});
