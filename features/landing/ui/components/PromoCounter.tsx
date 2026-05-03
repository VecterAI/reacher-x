"use client";

import { api } from "@/convex/_generated/api";
import AnimatedNumber from "@/shared/ui/components/AnimatedNumber";
import { PROMO_FAKE_OFFSET } from "@/features/landing/lib/promoConfig";
import { useQueryWithStatus } from "@/shared/hooks";

export function PromoCounter({ className }: { className?: string }) {
  const statsQuery = useQueryWithStatus(api.promo.getPromoStats, {});
  const stats = statsQuery.data;

  if (statsQuery.isError) {
    return null;
  }

  // Hide entirely once the real threshold is met
  if (stats && stats.soldOut) return null;

  // Show zeros while loading so the value animates from 0 on hydration
  const threshold = stats ? stats.threshold : 0;
  const remainingReal = stats ? stats.remaining : 0;
  const displayRemaining = Math.max(0, remainingReal - PROMO_FAKE_OFFSET);

  return (
    <span className={className}>
      <AnimatedNumber
        value={threshold}
        className="text-foreground"
        animateOnMount
      />{" "}
      users{" "}
      <AnimatedNumber
        value={displayRemaining}
        className="text-foreground"
        animateOnMount
      />{" "}
      spots left.
    </span>
  );
}
