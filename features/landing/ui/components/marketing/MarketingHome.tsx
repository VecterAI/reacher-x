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
import {
  MarketingWorkflow,
  MarketingFinish,
  MarketingOneSubscription,
} from "./MarketingSections";
import { MarketingUseCaseTabs } from "./MarketingUseCaseTabs";
import { MarketingBlog } from "./MarketingBlog";

function HeroReveal() {
  const { reveal, revealLine } = MARKETING_COPY.home;
  return (
    <>
      {reveal.map((line) => (
        <span key={line} className="text-muted-foreground block">
          {line}
        </span>
      ))}
      <span className="block font-medium">{revealLine}</span>
    </>
  );
}

export function MarketingHome() {
  return (
    <>
      <MarketingHero title={<HeroReveal />}>
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
      <MarketingOneSubscription />
      <MarketingUseCaseTabs />
      <MarketingWorkflow />
      <MarketingCapabilities />
      <MarketingCapabilityIndex />
      <MarketingAuthenticity />
      <MarketingBlog />
      <MarketingDevelopers />
      <MarketingCommunity />
      <MarketingFaq />
      <MarketingFinish />
    </>
  );
}
