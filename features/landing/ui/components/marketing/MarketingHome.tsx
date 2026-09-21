import { MARKETING_COPY } from "@/features/landing/lib/marketingContentHelpers";
import { Suspense } from "react";
import { MarketingFaq } from "./MarketingFaq";
import { MarketingProof } from "./MarketingProof";
import {
  MarketingAuthenticity,
  MarketingDevelopers,
  MarketingCommunity,
} from "./MarketingStory";
import {
  MarketingCapabilities,
  MarketingCapabilityIndex,
} from "./MarketingProduct";
import { LandingPromptCta } from "../LandingPromptCta";
import { MarketingHero } from "./MarketingLayout";
import { MarketingWorkflow, MarketingFinish } from "./MarketingSections";
import { MarketingUseCaseTabs } from "./MarketingUseCaseTabs";

export function MarketingHome() {
  return (
    <>
      <MarketingHero title={MARKETING_COPY.home.headline}>
        <p className="text-base leading-7 text-pretty">
          {MARKETING_COPY.home.description}
        </p>
        <div className="mt-7">
          <LandingPromptCta
            placeholder="Who are you looking for, and why?"
            showLabeledCta={false}
          />
        </div>
        <p className="text-muted-foreground mt-3 text-sm">
          {MARKETING_COPY.home.setupTimeNote}
        </p>
      </MarketingHero>
      <Suspense fallback={null}>
        <MarketingProof />
      </Suspense>
      <MarketingUseCaseTabs />
      <MarketingWorkflow />
      <MarketingCapabilities />
      <MarketingCapabilityIndex />
      <MarketingAuthenticity />
      <MarketingDevelopers />
      <MarketingCommunity />
      <MarketingFaq />
      <MarketingFinish />
    </>
  );
}
