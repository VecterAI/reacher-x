"use client";

import { MARKETING_COPY } from "@/features/landing/lib/marketingContentHelpers";

import Link from "next/link";
import { ArrowOutwardIcon } from "@/shared/ui/components/icons";
import { LandingPrimaryCta } from "../LandingPrimaryCta";
import { marketingButton as buttonVariants } from "./MarketingLayout";
import { MarketingFeature, MarketingSection } from "./MarketingLayout";
import { LandingBookDemoCta } from "../LandingBookDemoCta";
import { MarketingDemo } from "./MarketingDemo";

export function MarketingWorkflow() {
  return (
    <>
      <MarketingFeature
        id="how-it-works"
        title="Describe what you need."
        demo={
          <MarketingDemo
            scenario="find-candidates"
            sceneRange={[0, 9]}
            title="Set up a search by talking to ReacherX"
            caption="The setup conversation, from your goal to a search brief."
          />
        }
      >
        <p className="text-lg leading-7 text-pretty">
          {MARKETING_COPY.workflow.setup}
        </p>
        <p className="text-muted-foreground mt-5 text-sm leading-6">
          {MARKETING_COPY.workflow.setupDetail}
        </p>
        <Link
          href="/blog/getting-started-with-reacherx"
          className={buttonVariants({ variant: "outline", className: "mt-8" })}
        >
          See the setup guide
          <ArrowOutwardIcon className="size-4 shrink-0 fill-current" />
        </Link>
      </MarketingFeature>
      <MarketingFeature
        reverse
        title="See who fits, and why."
        demo={
          <MarketingDemo
            scenario="find-candidates"
            sceneRange={[10, 19]}
            title="Research the frontend candidates"
            caption="Search results with the evidence behind each match."
          />
        }
      >
        <p className="text-lg leading-7 text-pretty">
          {MARKETING_COPY.workflow.research}
        </p>
        <p className="text-muted-foreground mt-5 text-sm leading-6">
          {MARKETING_COPY.workflow.researchDetail}
        </p>
        <Link
          href="/blog/how-reacherx-qualification-works"
          className={buttonVariants({ variant: "outline", className: "mt-8" })}
        >
          How qualification works
          <ArrowOutwardIcon className="size-4 shrink-0 fill-current" />
        </Link>
      </MarketingFeature>
      <MarketingFeature
        title="Reach out like a human."
        demo={
          <MarketingDemo
            scenario="find-candidates"
            sceneRange={[20, 34]}
            title="Review an introduction and follow the reply"
            caption="A personal introduction for each person, ready for your review."
          />
        }
      >
        <p className="text-lg leading-7 text-pretty">
          {MARKETING_COPY.workflow.outreach}
        </p>
        <p className="text-muted-foreground mt-5 text-sm leading-6">
          {MARKETING_COPY.workflow.outreachDetail}
        </p>
        <Link
          href="/blog/what-reacherx-does-automatically"
          className={buttonVariants({ variant: "outline", className: "mt-8" })}
        >
          See the automation controls
          <ArrowOutwardIcon className="size-4 shrink-0 fill-current" />
        </Link>
      </MarketingFeature>
    </>
  );
}

export function MarketingFinish() {
  return (
    <MarketingSection>
      <div className="flex flex-col justify-between gap-8 sm:flex-row sm:items-center">
        <div>
          <h2 className="text-3xl leading-tight font-normal tracking-tight sm:text-4xl">
            {MARKETING_COPY.workflow.finishHeading}
          </h2>
        </div>
        <div className="grid w-full grid-cols-2 gap-3 sm:flex sm:w-auto">
          <LandingPrimaryCta size="lg" />
          <LandingBookDemoCta variant="outline" size="lg" />
        </div>
      </div>
    </MarketingSection>
  );
}
