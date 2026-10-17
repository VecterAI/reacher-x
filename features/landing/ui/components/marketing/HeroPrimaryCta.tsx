"use client";

import { useAuth } from "@workos-inc/authkit-nextjs/components";
import { MARKETING_COPY } from "@/features/landing/lib/marketingContentHelpers";
import { LandingPrimaryCta } from "../LandingPrimaryCta";

/** Hero CTA column: the setup-time note shows only to logged-out visitors. */
export function HeroPrimaryCta() {
  const { user, loading } = useAuth();
  return (
    <div className="flex flex-col items-center">
      <LandingPrimaryCta />
      {!loading && !user ? (
        <p className="text-muted-foreground mt-3 text-sm">
          {MARKETING_COPY.home.setupTimeNote}
        </p>
      ) : null}
    </div>
  );
}
