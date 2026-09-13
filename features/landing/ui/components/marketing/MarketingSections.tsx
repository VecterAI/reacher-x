import Link from "next/link";
import { GITHUB_REPO_URL } from "@/features/landing/lib/github";
import { marketingButton as buttonVariants } from "./MarketingLayout";
import { MarketingFeature, marketingPageWidth } from "./MarketingLayout";
import { LandingBookDemoCta } from "../LandingBookDemoCta";
import { MarketingDemo } from "./MarketingDemo";

export const marketingContainer = marketingPageWidth;

export function MarketingTrust() {
  return (
    <section
      className={`${marketingContainer} py-10`}
      aria-label="About ReacherX"
    >
      <div className="grid gap-8 sm:grid-cols-3">
        <div>
          <p className="font-medium">Built by a founder.</p>
          <p className="text-muted-foreground mt-2 text-sm leading-6">
            For people building with a small team, or on their own.
          </p>
          <Link
            href="/about"
            className="mt-3 inline-block text-sm underline underline-offset-4"
          >
            Meet Salman
          </Link>
        </div>
        <div>
          <p className="font-medium">Open source.</p>
          <p className="text-muted-foreground mt-2 text-sm leading-6">
            Read the code, contribute, or run ReacherX yourself.
          </p>
          <a
            href={GITHUB_REPO_URL}
            className="mt-3 inline-block text-sm underline underline-offset-4"
          >
            View on GitHub
          </a>
        </div>
        <div>
          <p className="font-medium">Part of Convex for Open Source.</p>
          <p className="text-muted-foreground mt-2 text-sm leading-6">
            ReacherX participates in the Convex Open Source program.
          </p>
          <a
            href="https://www.convex.dev/open-source-program"
            className="mt-3 inline-block text-sm underline underline-offset-4"
          >
            About Convex
          </a>
        </div>
      </div>
    </section>
  );
}

export function MarketingFinish() {
  return (
    <section className={`${marketingPageWidth} py-16 lg:py-20`}>
      <div className="flex flex-col justify-between gap-8 sm:flex-row sm:items-center">
        <div>
          <h2 className="text-3xl leading-tight font-normal tracking-tight sm:text-4xl">
            Who do you want to reach?
          </h2>
        </div>
        <div className="flex flex-wrap gap-3">
          <a href="#get-started" className={buttonVariants({ size: "lg" })}>
            Reach people
          </a>
          <LandingBookDemoCta variant="outline" size="lg" />
        </div>
      </div>
    </section>
  );
}

export function MarketingWorkflow() {
  return (
    <>
      <MarketingFeature
        id="find-people"
        title="Meet people who share your interests."
        demo={
          <MarketingDemo
            scenario="find-potential-customers"
            title="Research and qualify a potential customer"
            caption="Review the search brief, inspect source posts, and archive a person who does not fit."
          />
        }
      >
        <p className="text-lg leading-7 text-pretty">
          ReacherX finds people on X/Twitter and LinkedIn, researches their
          background, and explains each match.
        </p>
        <p className="text-muted-foreground mt-5 text-sm leading-6">
          Review their profiles and posts to see why they fit.
        </p>
        <Link
          href="/blog/how-reacherx-qualification-works"
          className={buttonVariants({ variant: "outline", className: "mt-8" })}
        >
          How qualification works
        </Link>
      </MarketingFeature>
      <MarketingFeature
        reverse
        title="Start with something in common."
        demo={
          <MarketingDemo
            scenario="create-plans-for-several-people"
            title="Create and review individual outreach plans"
            caption="Ask the agent for plans for three people, review their different invitations, and retry the one that failed."
          />
        }
      >
        <p className="text-lg leading-7 text-pretty">
          The agent turns its research into a personal outreach plan, with
          messages ready for your review.
        </p>
        <p className="text-muted-foreground mt-5 text-sm leading-6">
          Review and edit before sending. Approval is required by default.
        </p>
        <Link
          href="/blog/what-reacherx-does-automatically"
          className={buttonVariants({ variant: "outline", className: "mt-8" })}
        >
          Review the automation controls
        </Link>
      </MarketingFeature>
      <MarketingFeature
        title="Keep up with the people you meet."
        demo={
          <MarketingDemo
            scenario="write-with-autocomplete"
            title="Write and send a message with autocomplete"
            caption="Open a conversation, write a message, review the autocomplete suggestion, and send it inside the sample app."
          />
        }
      >
        <p className="text-lg leading-7 text-pretty">
          Read and reply to X/Twitter and LinkedIn messages in one place.
          Autocomplete helps with the words.
        </p>
        <p className="text-muted-foreground mt-5 text-sm leading-6">
          Track who you have contacted and which conversations are moving
          forward.
        </p>
        <Link
          href="/blog/manage-dm-conversations"
          className={buttonVariants({ variant: "outline", className: "mt-8" })}
        >
          Explore conversations
        </Link>
      </MarketingFeature>
      <MarketingFeature
        reverse
        title="An agent that gets to know you."
        demo={
          <MarketingDemo
            scenario="teach-reacherx-what-you-want"
            title="Save a writing preference and use it in a new plan"
            caption="Save a writing instruction, request a new introduction, and check how the draft uses the saved instruction."
          />
        }
      >
        <p className="text-lg leading-7 text-pretty">
          The agent remembers your preferences and uses them in future searches
          and messages.
        </p>
        <p className="text-muted-foreground mt-5 text-sm leading-6">
          Inspect its activity, review your results, and pause the agent
          whenever you need to.
        </p>
        <Link
          href="/blog/teach-reacherx-what-you-want"
          className={buttonVariants({ variant: "outline", className: "mt-8" })}
        >
          Personalize your agent
        </Link>
      </MarketingFeature>
    </>
  );
}
