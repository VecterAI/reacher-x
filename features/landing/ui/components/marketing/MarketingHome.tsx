import { Suspense } from "react";
import { MarketingFaq } from "./MarketingFaq";
import { MarketingProof } from "./MarketingProof";
import {
  MarketingConnections,
  MarketingAuthenticity,
  MarketingDevelopers,
  MarketingCommunity,
} from "./MarketingStory";
import { LandingPromptCta } from "../LandingPromptCta";
import { marketingButton as buttonVariants } from "./MarketingLayout";
import { MarketingHero } from "./MarketingLayout";
import { MarketingWorkflow, MarketingFinish } from "./MarketingSections";

export function MarketingHome() {
  return (
    <>
      <MarketingHero
        eyebrow="Your network is your net worth."
        title="Reach the right people."
        actions={
          <a href="#how-it-works" className={buttonVariants()}>
            See how it works
          </a>
        }
      >
        <p className="text-base leading-7 text-pretty">
          Tell ReacherX <strong>△</strong> Agent who you need to reach. It finds
          the right people, explains why they fit, and helps you start the
          conversation.
        </p>
        <div className="mt-7">
          <LandingPromptCta
            placeholder="Who are you looking for, and why?"
            showLabeledCta={false}
          />
        </div>
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
