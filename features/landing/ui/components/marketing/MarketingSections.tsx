"use client";

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
          No tables or sales jargon. Tell △ Agent what you are working on and
          who you want to reach, in plain words.
        </p>
        <p className="text-muted-foreground mt-5 text-sm leading-6">
          It asks what it needs to know and starts looking.
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
          ReacherX finds people on X/Twitter and LinkedIn, researches their
          background, and explains every match.
        </p>
        <p className="text-muted-foreground mt-5 text-sm leading-6">
          Check the posts and profile details behind each result before you
          decide.
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
          △ Agent turns its research into a personal introduction, ready for
          your review. Nothing sends without your approval.
        </p>
        <p className="text-muted-foreground mt-5 text-sm leading-6">
          Conversations, notes, and your writing style stay in one place.
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
            Who will you and your △ Agent reach?
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
