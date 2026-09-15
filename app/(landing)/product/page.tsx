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

export const metadata: Metadata = {
  title: "Product",
  description:
    "Discovery, qualification, outreach plans, conversations, memory, and analytics on X/Twitter and LinkedIn, run by an AI agent with you in control.",
  alternates: { canonical: "https://reacherx.com/product" },
};
export default function ProductPage() {
  return (
    <div className="overflow-x-clip">
      <section className={`${marketingPageWidth} py-20 lg:py-36`}>
        <div className="grid items-center gap-14 lg:grid-cols-2 lg:gap-24">
          <h1 className="text-4xl leading-[1.02] font-normal tracking-[-0.03em] text-balance sm:text-6xl lg:text-7xl">
            Find your people.
          </h1>
          <div className="lg:justify-self-end">
            <p className="text-muted-foreground max-w-md text-lg leading-7 text-pretty">
              ReacherX searches X/Twitter and LinkedIn around the clock,
              researches every match, and drafts a personal introduction.
              Nothing sends without you.
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
