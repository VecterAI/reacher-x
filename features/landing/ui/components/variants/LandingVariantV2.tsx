import { Suspense } from "react";
import type { ReactNode } from "react";
import type { Tweet } from "@/features/threads/types";
import { homepageFaqItems } from "@/features/landing/lib/faqs";
import { GITHUB_REPO_URL } from "@/features/landing/lib/github";
import { cn } from "@/shared/lib/utils";
import { buttonVariants } from "@/shared/ui/components/Button";
import {
  ArrowOutwardIcon,
  DiscordIcon,
  GitHubIcon,
} from "@/shared/ui/components/icons";
import { AgentInline } from "../LandingAgentMark";
import { LandingBookDemoInvite } from "../LandingBookDemoCta";
import { LandingPromptCta } from "../LandingPromptCta";
import { FaqsSection } from "../sections/FaqsSection";
import { SocialProofSectionSkeleton } from "../sections/SocialProofSectionSkeleton";
import { ThemedFigureVideo } from "../ThemedFigureVideo";
import { UseCaseDemo } from "../use-case-demo/UseCaseDemo";
import { SystemFactsGrid } from "./SystemFactsGrid";
import { VariantProofCarousel } from "./VariantProofCarousel";

/**
 * V2: The worldview, composed and polished.
 *
 * Type scale, aligned with the main landing page:
 * - Display:    hero h1 only, text-4xl md:text-6xl bold pixel
 * - Heading:    every section h2, text-4xl md:text-5xl medium pixel
 * - Statement:  the manifesto, text-3xl md:text-4xl medium pixel
 * - Step title: text-2xl md:text-3xl medium (matches StepBlock)
 * - Item title: text-lg md:text-xl medium
 * - Body:       text-base md:text-lg muted
 * - Detail:     text-sm md:text-base muted
 * - Label:      font-mono text-xs muted
 *
 * Spacing, aligned with the main landing page: sections py-16 md:py-24,
 * header-to-content mt-12 md:mt-16, kicker-to-heading mt-4,
 * heading-to-body mt-6. Whitespace separates sections; no dividers.
 */
const DOCS_URL = "https://github.com/VecterAI/reacher-x/blob/main/README.md";
const DISCORD_URL = "https://discord.gg/76dF9NPH";

const FINDABLE_PEOPLE: Array<{ person: string; detail: string }> = [
  {
    person: "Customers",
    detail: "who are already looking for what you built.",
  },
  {
    person: "Candidates",
    detail: "who match the role and are open to something new.",
  },
  { person: "Investors", detail: "who back companies like yours." },
  {
    person: "Creators",
    detail: "who would genuinely care about your product.",
  },
  { person: "Partners", detail: "who make the next step possible." },
  { person: "People", detail: "you cannot describe with a job title." },
];

const ASSUMED_KNOWLEDGE: Array<{ title: string; detail: string }> = [
  { title: "Outbound", detail: "Know what it means." },
  { title: "Sequences", detail: "Know how to build one." },
  { title: "Leads", detail: "Know how to score and qualify." },
  { title: "Workflow", detail: "Know how to connect the entire thing." },
];

const STEPS: Array<{ index: string; title: string; description: ReactNode }> = [
  {
    index: "01",
    title: "Describe",
    description: (
      <>
        Tell <AgentInline /> who you need in plain English.
      </>
    ),
  },
  {
    index: "02",
    title: "Discover",
    description: "It reads X/Twitter and LinkedIn around the clock.",
  },
  {
    index: "03",
    title: "Qualify",
    description:
      "Every match is scored out of 100, with the exact post that proves fit.",
  },
  {
    index: "04",
    title: "Approve",
    description:
      "Outreach is drafted in your voice. Nothing sends without your approval.",
  },
];

const OSS_CAPABILITIES: Array<{ title: string; detail: string }> = [
  {
    title: "Own it",
    detail: "Self-host ReacherX and keep control of your stack.",
  },
  {
    title: "Change it",
    detail: "Modify the workflows, qualification rules, and behavior.",
  },
  {
    title: "Build on it",
    detail: "Extend it for your own use cases or contribute upstream.",
  },
];

function SectionKicker({ children }: { children: ReactNode }) {
  return <p className="text-muted-foreground font-mono text-xs">{children}</p>;
}

export function LandingVariantV2({
  tweetsPromise,
}: {
  tweetsPromise: Promise<Tweet[]>;
}) {
  return (
    <>
      {/* 1: The shift. Centered hero; the composer is the CTA. */}
      <section
        aria-labelledby="v2-hero-heading"
        className="px-4 py-16 text-center md:py-24"
      >
        <div className="mx-auto w-full max-w-[1288px]">
          <div className="mx-auto max-w-3xl">
            <h1
              id="v2-hero-heading"
              className="font-pixel-square text-4xl leading-[1.06] font-medium tracking-tight text-balance md:text-6xl"
            >
              Building got easy. Reaching people didn&apos;t.
            </h1>
            <p className="text-muted-foreground mx-auto mt-6 max-w-xl text-base md:text-lg">
              Anyone can build now. Finding the right people is still the hard
              part. Tell <AgentInline /> who you need, and it figures out the
              rest.
            </p>
            <div className="mx-auto mt-12 w-full max-w-2xl">
              <LandingPromptCta showLabeledCta={false} className="max-w-none" />
              <LandingBookDemoInvite />
            </div>
          </div>
        </div>
      </section>

      {/* 2: Who you can find. Split: sticky argument left, sentences right. */}
      <section aria-labelledby="v2-who-heading" className="px-4 py-16 md:py-24">
        <div className="mx-auto grid w-full max-w-[1288px] gap-12 md:grid-cols-12 md:gap-16">
          <div className="md:col-span-5">
            <div className="md:sticky md:top-24">
              <SectionKicker>Who you can find</SectionKicker>
              <h2
                id="v2-who-heading"
                className="font-pixel-square mt-4 max-w-md text-4xl font-medium text-balance md:text-5xl"
              >
                Powerful enough for experts. Simple enough for everyone.
              </h2>
              <p className="text-muted-foreground mt-6 max-w-md text-base md:text-lg">
                Describe the people you need. The <AgentInline /> figures out
                how and where to find them.
              </p>
            </div>
          </div>
          <ul className="grid gap-x-12 sm:grid-cols-2 md:col-span-7">
            {FINDABLE_PEOPLE.map((item, index) => (
              <li
                key={item.person + item.detail}
                className="border-border border-t pt-5 pb-8"
              >
                <span className="text-muted-foreground font-mono text-xs">
                  {String(index + 1).padStart(2, "0")}
                </span>
                <p className="mt-3 text-lg font-medium md:text-xl">
                  {item.person}{" "}
                  <span className="text-muted-foreground font-normal">
                    {item.detail}
                  </span>
                </p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* 3: Why now. Same split as Who / System: thesis left, proof right. */}
      <section
        aria-labelledby="v2-tools-heading"
        className="px-4 py-16 md:py-24"
      >
        <div className="mx-auto grid w-full max-w-[1288px] gap-12 md:grid-cols-12 md:gap-16">
          <div className="md:col-span-5">
            <SectionKicker>Why now</SectionKicker>
            <h2
              id="v2-tools-heading"
              className="font-pixel-square mt-4 max-w-md text-4xl font-medium text-balance md:text-5xl"
            >
              The tools were built for experts. Most people aren&apos;t.
            </h2>
            <p className="text-muted-foreground mt-6 max-w-md text-base md:text-lg">
              Most tools expect you to learn their workflows, terminology, and
              best practices before you can get value from them. ReacherX flips
              that around. Describe the people you need, and the <AgentInline />{" "}
              figures out the rest.
            </p>
          </div>
          <ul className="grid gap-x-12 sm:grid-cols-2 md:col-span-7">
            {ASSUMED_KNOWLEDGE.map((item, index) => (
              <li key={item.title} className="border-border border-t pt-5 pb-8">
                <span className="text-muted-foreground font-mono text-xs">
                  {String(index + 1).padStart(2, "0")}
                </span>
                <p className="mt-3 text-lg font-medium md:text-xl">
                  {item.title}{" "}
                  <span className="text-muted-foreground font-normal">
                    {item.detail}
                  </span>
                </p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* 4: The manifesto. One founder observation, its own section. */}
      <section
        aria-labelledby="v2-manifesto-heading"
        className="px-4 py-16 md:py-24"
      >
        <div className="mx-auto w-full max-w-[1288px]">
          <h2
            id="v2-manifesto-heading"
            className="font-pixel-square max-w-4xl text-3xl leading-snug font-medium text-balance md:text-4xl"
          >
            <span className="text-muted-foreground">
              Companies now hire &lsquo;Clay specialists&rsquo; just to run
              their outreach.
            </span>{" "}
            If software needs a specialist, the software failed.
          </h2>
        </div>
      </section>

      {/* 5: How it works. Four steps, one idea each. */}
      <section aria-labelledby="v2-how-heading" className="px-4 py-16 md:py-24">
        <div className="mx-auto w-full max-w-[1288px]">
          <SectionKicker>How it works</SectionKicker>
          <h2
            id="v2-how-heading"
            className="font-pixel-square mt-4 max-w-xl text-4xl font-medium text-balance md:text-5xl"
          >
            How Agent works.
          </h2>
          <ol className="mt-12 grid gap-10 sm:grid-cols-2 md:mt-16 lg:grid-cols-4 lg:gap-8">
            {STEPS.map((step) => (
              <li key={step.index} className="border-border border-t pt-5">
                <span className="text-muted-foreground font-mono text-xs">
                  {step.index}
                </span>
                <h3 className="mt-3 text-2xl font-medium md:text-3xl">
                  {step.title}
                </h3>
                <p className="text-muted-foreground mt-3 text-base">
                  {step.description}
                </p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* 6: The product. The demo speaks for itself, no frame. */}
      <section
        aria-labelledby="v2-demo-heading"
        className="px-4 py-16 md:py-24"
      >
        <div className="mx-auto w-full max-w-[1288px]">
          <SectionKicker>The product</SectionKicker>
          <h2
            id="v2-demo-heading"
            className="font-pixel-square mt-4 text-4xl font-medium md:text-5xl"
          >
            See Agent in action.
          </h2>
          <div className="mt-12 md:mt-16">
            <ThemedFigureVideo
              videoAssetKey="hero"
              ariaLabel="ReacherX Agent dashboard demo"
              figureClassName="aspect-[335/216] w-full rounded-lg border"
              className="h-full w-full"
              initialPreload="metadata"
              variant="player"
            />
          </div>
        </div>
      </section>

      {/* 7: Use cases. The real product UI, scaled down, with example data. */}
      <section
        aria-labelledby="v2-use-cases-heading"
        className="px-4 py-16 md:py-24"
      >
        <div className="mx-auto w-full max-w-[1288px]">
          <SectionKicker>Use cases</SectionKicker>
          <h2
            id="v2-use-cases-heading"
            className="font-pixel-square mt-4 text-4xl font-medium text-balance md:text-5xl"
          >
            One Agent. Every use case.
          </h2>
          <p className="text-muted-foreground mt-6 max-w-xl text-base md:text-lg">
            Switch between use cases and click around.
          </p>
          <div className="mt-12 md:mt-16">
            <UseCaseDemo />
          </div>
        </div>
      </section>

      {/* 8: System. Product facts, not customer outcomes. */}
      <section
        aria-labelledby="v2-system-heading"
        className="px-4 py-16 md:py-24"
      >
        <div className="mx-auto grid w-full max-w-[1288px] gap-12 md:grid-cols-12 md:gap-16">
          <div className="md:col-span-5">
            <SectionKicker>System</SectionKicker>
            <h2
              id="v2-system-heading"
              className="font-pixel-square mt-4 max-w-md text-4xl font-medium text-balance md:text-5xl"
            >
              One Agent. Handles everything.
            </h2>
            <p className="text-muted-foreground mt-6 max-w-md text-base md:text-lg">
              One <AgentInline /> continuously discovers people, qualifies them,
              drafts outreach, and helps manage every conversation from one
              place.
            </p>
          </div>
          <SystemFactsGrid />
        </div>
      </section>

      {/* 9: Social proof. Scroll-driven gallery, its own composition. */}
      <section aria-labelledby="v2-proof-heading">
        <Suspense fallback={<SocialProofSectionSkeleton />}>
          <V2ProofCarouselContent tweetsPromise={tweetsPromise} />
        </Suspense>
      </section>

      {/* 10: Open source. Editorial split: message left, capabilities right. */}
      <section aria-labelledby="v2-oss-heading" className="px-4 py-16 md:py-24">
        <div className="mx-auto w-full max-w-[1288px]">
          <div className="grid gap-12 md:grid-cols-12 md:gap-16">
            <div className="md:col-span-5">
              <SectionKicker>Open source</SectionKicker>
              <h2
                id="v2-oss-heading"
                className="font-pixel-square mt-4 max-w-xl text-4xl font-medium text-balance md:text-5xl"
              >
                Your outreach stack should belong to you.
              </h2>
              <p className="text-muted-foreground mt-6 max-w-md text-base md:text-lg">
                ReacherX is open source. Inspect it, self-host it, modify it, or
                extend it around the way you work.
              </p>
            </div>
            <ul className="md:col-span-7">
              {OSS_CAPABILITIES.map((capability) => (
                <li
                  key={capability.title}
                  className="border-border border-t pt-5 pb-8"
                >
                  <p className="text-lg font-medium md:text-xl">
                    {capability.title}
                  </p>
                  <p className="text-muted-foreground mt-1 text-sm md:text-base">
                    {capability.detail}
                  </p>
                </li>
              ))}
            </ul>
          </div>
          <div className="mt-12 flex flex-col gap-3 sm:flex-row md:mt-16">
            <a
              href={GITHUB_REPO_URL}
              target="_blank"
              rel="noreferrer"
              className={cn(
                buttonVariants({ variant: "default" }),
                "justify-center sm:flex-1"
              )}
            >
              <GitHubIcon className="size-4 fill-current" />
              View source
            </a>
            <a
              href={DOCS_URL}
              target="_blank"
              rel="noreferrer"
              className={cn(
                buttonVariants({ variant: "outline" }),
                "justify-center sm:flex-1"
              )}
            >
              Read the docs
              <ArrowOutwardIcon className="size-4 fill-current" />
            </a>
            <a
              href={DISCORD_URL}
              target="_blank"
              rel="noreferrer"
              className={cn(
                buttonVariants({ variant: "outline" }),
                "justify-center sm:flex-1"
              )}
            >
              <DiscordIcon className="size-4 fill-current" />
              Join Discord
            </a>
          </div>
        </div>
      </section>

      {/* 11: Objections. Docs-style split: sticky heading left, accordion right. */}
      <FaqsSection items={homepageFaqItems} layout="split" />

      {/* 12: The ask. A direct invitation; the composer is the CTA. */}
      <section
        aria-labelledby="v2-final-heading"
        className="px-4 pt-16 pb-12 text-center md:pt-24 md:pb-16"
      >
        <div className="mx-auto w-full max-w-[1288px]">
          <h2
            id="v2-final-heading"
            className="font-pixel-square mx-auto max-w-3xl text-4xl font-medium text-balance md:text-5xl"
          >
            Who will your Agent reach?
          </h2>
          <div className="mx-auto mt-12 w-full max-w-2xl">
            <LandingPromptCta showLabeledCta={false} className="max-w-none" />
            <LandingBookDemoInvite />
          </div>
        </div>
      </section>
    </>
  );
}

async function V2ProofCarouselContent({
  tweetsPromise,
}: {
  tweetsPromise: Promise<Tweet[]>;
}) {
  const tweets = await tweetsPromise;
  if (tweets.length === 0) return null;

  return <VariantProofCarousel tweets={tweets} />;
}
