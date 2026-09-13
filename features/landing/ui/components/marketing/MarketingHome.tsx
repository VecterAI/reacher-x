import { Suspense } from "react";
import { MarketingFaq } from "./MarketingFaq";
import { MarketingProof } from "./MarketingProof";
import {
  MarketingSimplicity,
  MarketingConnections,
  MarketingDevelopers,
} from "./MarketingStory";
import { LandingPromptCta } from "../LandingPromptCta";
import { LandingBookDemoCta } from "../LandingBookDemoCta";
import { marketingButton as buttonVariants } from "./MarketingLayout";
import { MarketingHero } from "./MarketingLayout";
import { MarketingWorkflow, MarketingFinish } from "./MarketingSections";

export function MarketingHome() {
  return (
    <>
      <MarketingHero
        title="Build your network."
        actions={
          <>
            <a href="#find-people" className={buttonVariants()}>
              See how it works
            </a>
            <LandingBookDemoCta variant="outline" />
          </>
        }
      >
        <p className="mb-7 text-base leading-7 text-pretty">
          Find relevant people on X/Twitter and LinkedIn, research their
          background, and plan your outreach with an AI agent.
        </p>
        <LandingPromptCta
          placeholder="Describe your project and who you want to reach..."
          showLabeledCta={false}
        />
      </MarketingHero>
      <Suspense fallback={null}>
        <MarketingProof />
      </Suspense>
      <MarketingSimplicity />
      <div className="pt-20 lg:pt-28">
        <MarketingWorkflow />
      </div>
      <MarketingConnections />
      <MarketingDevelopers />
      <MarketingFaq />
      <MarketingFinish />
    </>
  );
}
