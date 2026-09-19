import { marketingMetadata } from "@/features/landing/lib/agentReadinessHelpers";
import { MarketingStructuredData } from "@/features/landing/ui/components/MarketingStructuredData";
import { Suspense } from "react";
import type { Metadata } from "next";
import { cookies } from "next/headers";
import { getPublicPlanOffers } from "@/features/billing/lib/getPublicPlanOffers";
import { pricingFaqItems } from "@/features/landing/lib/faqs";
import { FaqsSection } from "@/features/landing/ui/components/sections/FaqsSection";
import { PricingSection } from "@/features/landing/ui/components/sections/PricingSection";
import {
  parseWorkspaceUseCaseKeyParam,
  WORKSPACE_USE_CASE_STORAGE_KEY,
} from "@/shared/lib/workspaceUseCaseCache";
import { DEFAULT_WORKSPACE_USE_CASE_KEY } from "@/shared/lib/workspaceUseCases";

export const metadata: Metadata = marketingMetadata("/pricing");

export default async function PricingPage() {
  const publicPlanOffers = await getPublicPlanOffers();

  return (
    <div className="mx-auto w-full max-w-[1288px]">
      <MarketingStructuredData pathname="/pricing" />
      <Suspense
        fallback={
          <PricingSection
            initialUseCaseKey={DEFAULT_WORKSPACE_USE_CASE_KEY}
            initialOffers={publicPlanOffers.offers}
            initialOffersError={publicPlanOffers.isError}
          />
        }
      >
        <PricingSectionRuntime publicPlanOffers={publicPlanOffers} />
      </Suspense>
      <FaqsSection items={pricingFaqItems} />
    </div>
  );
}

async function PricingSectionRuntime({
  publicPlanOffers,
}: {
  publicPlanOffers: Awaited<ReturnType<typeof getPublicPlanOffers>>;
}) {
  const cookieStore = await cookies();
  const initialUseCaseKey =
    parseWorkspaceUseCaseKeyParam(
      cookieStore.get(WORKSPACE_USE_CASE_STORAGE_KEY)?.value
    ) ?? DEFAULT_WORKSPACE_USE_CASE_KEY;

  return (
    <PricingSection
      initialUseCaseKey={initialUseCaseKey}
      initialOffers={publicPlanOffers.offers}
      initialOffersError={publicPlanOffers.isError}
    />
  );
}
