import { marketingMetadata } from "@/features/landing/lib/agentReadinessHelpers";
import { MarketingStructuredData } from "@/features/landing/ui/components/MarketingStructuredData";
import { MARKETING_COPY } from "@/features/landing/lib/marketingContentHelpers";
import type { Metadata } from "next";
import { MarketingFaq } from "@/features/landing/ui/components/marketing/MarketingFaq";
import { marketingPageWidth } from "@/features/landing/ui/components/marketing/MarketingLayout";
import {
  MarketingCapabilities,
  MarketingCapabilityIndex,
} from "@/features/landing/ui/components/marketing/MarketingProduct";
import { MarketingFinish } from "@/features/landing/ui/components/marketing/MarketingSections";
import { LandingPrimaryCta } from "@/features/landing/ui/components/LandingPrimaryCta";
import { LandingBookDemoCta } from "@/features/landing/ui/components/LandingBookDemoCta";

export const metadata: Metadata = marketingMetadata("/product");
export default function ProductPage() {
  return (
    <div className="overflow-x-clip">
      <MarketingStructuredData pathname="/product" />
      <section className={`${marketingPageWidth} py-20 lg:py-36`}>
        <div className="grid items-center gap-14 lg:grid-cols-2 lg:gap-24">
          <h1 className="text-4xl leading-[1.02] font-normal tracking-[-0.03em] text-balance sm:text-6xl lg:text-7xl">
            {MARKETING_COPY.productPage.heading}
          </h1>
          <div className="lg:justify-self-end">
            <p className="text-muted-foreground max-w-md text-lg leading-7 text-pretty">
              {MARKETING_COPY.productPage.description}
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <LandingPrimaryCta />
              <LandingBookDemoCta variant="outline" />
            </div>
          </div>
        </div>
      </section>
      <MarketingCapabilities />
      <MarketingCapabilityIndex />
      <MarketingFaq />
      <MarketingFinish />
    </div>
  );
}
