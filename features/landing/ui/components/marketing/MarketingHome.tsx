import { MARKETING_COPY } from "@/features/landing/lib/marketingContentHelpers";
import { MARKETING_USE_CASES } from "@/features/landing/lib/marketingUseCaseHelpers";
import { GITHUB_REPO_URL } from "@/features/landing/lib/github";
import { ArrowForwardIcon, GitHubIcon } from "@/shared/ui/components/icons";
import Link from "next/link";
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
import { HeroPrimaryCta } from "./HeroPrimaryCta";
import {
  MarketingHero,
  highlightTerms,
  inlinePlatformIcons,
} from "./MarketingLayout";
import { MarketingDemo } from "./MarketingDemo";
import {
  MarketingWorkflow,
  MarketingFinish,
  MarketingNarrative,
} from "./MarketingSections";
import { MarketingUseCaseTabs } from "./MarketingUseCaseTabs";
import { MarketingBlog } from "./MarketingBlog";

function HeroReveal() {
  const { reveal } = MARKETING_COPY.home;
  return (
    <>
      {/* Two-line headline, same color and weight; pixel font accents the
      key words for an edgy touch (matches the "adapts" treatment). */}
      {reveal.map((line) => (
        <span key={line} className="block">{line}</span>
      ))}
      <span className="block font-medium">
        {"for "}
        <span className="font-pixel-square">everyone</span>
        {"."}
      </span>
    </>
  );
}

/** Hero tagline: everything muted; "Open source" links to the repo. */
function HeroTagline() {
  const phrase = "Open source";
  const rest: string = MARKETING_COPY.home.tagline;
  const index = rest.indexOf(phrase);
  if (index === -1) {
    return inlinePlatformIcons(rest);
  }
  return (
    <>
      <span>{inlinePlatformIcons(rest.slice(0, index))}</span>
      <a
        href={GITHUB_REPO_URL}
        target="_blank"
        rel="noopener noreferrer"
        className="whitespace-nowrap hover:underline"
      >
        <GitHubIcon
          className="mr-1 inline size-4 fill-current align-[-2px]"
          aria-hidden="true"
        />
        {phrase}
        <span aria-hidden="true"> ↗</span>
      </a>
      <span>{inlinePlatformIcons(rest.slice(index + phrase.length))}</span>
    </>
  );
}

export function MarketingHome() {
  // First use case ("getting customers") drives the hero demo; the section
  // below renders the same component, so the sizes match by construction.
  const customersUseCase = MARKETING_USE_CASES[0];
  return (
    <>
      <MarketingHero
        className="pt-8 lg:pt-12"
        eyebrow={
          <p className="flex flex-wrap items-center justify-center gap-2 text-center">
            <span>
              {highlightTerms(MARKETING_COPY.home.guaranteeNote, [
                "30-day money-back guarantee",
              ])}
            </span>
            <Link
              href="/pricing"
              className="text-foreground inline-flex items-center gap-1 hover:underline"
            >
              See pricing
              <ArrowForwardIcon
                className="size-4 shrink-0 fill-current"
                aria-hidden="true"
              />
            </Link>
          </p>
        }
        title={<HeroReveal />}
        lede={<HeroTagline />}
        actions={<HeroPrimaryCta />}
        below={
          <>
            <MarketingDemo
              scenario={customersUseCase.guide}
              title={customersUseCase.goal}
              caption={customersUseCase.navigationDescription}
            />
            <p className="text-muted-foreground mt-6 text-center text-sm">
              This demo is interactive. Click around.
            </p>
          </>
        }
      >
        {/* Side column hidden for the new hero layout; may return later.
        <p className="text-base leading-7 text-pretty">
          {inlinePlatformIcons(MARKETING_COPY.home.description)}
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
        */}
      </MarketingHero>
      <Suspense fallback={null}>
        <MarketingProof />
      </Suspense>
      <MarketingNarrative />
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
