"use client";

import { api } from "@/convex/_generated/api";
import { useQueryWithStatus } from "@/shared/hooks/useQueryWithStatus";

/** Never use a static offer fallback while the live configuration is unknown. */
export function useAvailablePlanOffers(enabled = true) {
  return useQueryWithStatus(
    api.billing.getAvailableOffers,
    enabled ? {} : "skip"
  );
}
