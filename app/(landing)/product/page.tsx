import type { Metadata } from "next";
import { MarketingFaq } from "@/features/landing/ui/components/marketing/MarketingFaq";
import { MarketingHero } from "@/features/landing/ui/components/marketing/MarketingLayout";
import {
  MarketingWorkflow,
  MarketingFinish,
} from "@/features/landing/ui/components/marketing/MarketingSections";
import { LandingPromptCta } from "@/features/landing/ui/components/LandingPromptCta";
import { LandingBookDemoCta } from "@/features/landing/ui/components/LandingBookDemoCta";
import { Button } from "@/shared/ui/components/Button";

export const metadata: Metadata = {
  title: "How ReacherX works",
  description:
    "Find people on X and LinkedIn, understand why they fit, and manage outreach with an AI agent and your own judgment.",
  alternates: { canonical: "https://reacherx.com/product" },
};
export default function ProductPage() {
  return (
    <>
      <MarketingHero
        title={
          <>
            From the first search
            <br />
            to the next conversation.
          </>
        }
        actions={
          <>
            <Button asChild className="rounded-full">
              <a href="#find-people">See how it works</a>
            </Button>
            <LandingBookDemoCta variant="outline" />
          </>
        }
      >
        <p className="mb-7 max-w-sm text-base leading-7 text-pretty">
          Research people, plan outreach, and manage conversations on X and
          LinkedIn with an AI agent.
        </p>
        <LandingPromptCta
          placeholder="Describe your project and the people you want to meet…"
          showLabeledCta={false}
        />
      </MarketingHero>
      <MarketingWorkflow />
      <MarketingFaq />
      <MarketingFinish />
    </>
  );
}
