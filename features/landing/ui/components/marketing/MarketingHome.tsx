import { MARKETING_COPY } from "@/features/landing/lib/marketingContentHelpers";
import { Suspense } from "react";
import { MarketingFaq } from "./MarketingFaq";
import { MarketingProof } from "./MarketingProof";
import {
  MarketingConnections,
  MarketingAuthenticity,
  MarketingDevelopers,
  MarketingCommunity,
} from "./MarketingStory";
import { HeroStream } from "../HeroStream";
import { LandingPromptCta } from "../LandingPromptCta";
import { marketingButton as buttonVariants } from "./MarketingLayout";
import { MarketingHero } from "./MarketingLayout";
import { MarketingWorkflow, MarketingFinish } from "./MarketingSections";

export function MarketingHome() {
  return (
    <>
      <MarketingHero
        eyebrow="For solo founders and small teams."
        title={
          <>
            Reach your{" "}
            <HeroStream items={MARKETING_COPY.home.heroStreamItems} />
          </>
        }
        actions={
          <a href="#how-it-works" className={buttonVariants()}>
            See how it works
          </a>
        }
      >
        <p className="text-base leading-7 text-pretty">
          {MARKETING_COPY.home.description}
        </p>
        <div className="mt-7">
          <LandingPromptCta
            placeholder="Who are you looking for, and why?"
            showLabeledCta={false}
            rotatingPlaceholders={MARKETING_COPY.home.heroPlaceholders}
          />
        </div>
        <p className="text-muted-foreground mt-3 text-sm">
          {MARKETING_COPY.home.setupTimeNote}
        </p>
      </MarketingHero>
      <Suspense fallback={null}>
        <MarketingProof />
      </Suspense>
      <MarketingWorkflow />
      <MarketingConnections />
      <MarketingAuthenticity />
      <MarketingDevelopers />
      <MarketingCommunity />
      <MarketingFaq />
      <MarketingFinish />
    </>
  );
}
