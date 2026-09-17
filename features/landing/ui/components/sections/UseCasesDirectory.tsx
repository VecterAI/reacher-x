import { MARKETING_COPY } from "@/features/landing/lib/marketingContentHelpers";
import Link from "next/link";
import { Button } from "@/shared/ui/components/Button";
import { MarketingUseCaseExplorer } from "../marketing/MarketingUseCaseExplorer";
import {
  MarketingHero,
  marketingPageWidth,
} from "../marketing/MarketingLayout";
import { LandingPromptCta } from "../LandingPromptCta";
import { LandingBookDemoCta } from "../LandingBookDemoCta";

export function UseCasesDirectory() {
  return (
    <>
      <MarketingHero
        title={
          <>
            Who are you
            <br />
            looking for?
          </>
        }
        actions={
          <>
            <Button asChild className="rounded-full">
              <a href="#use-cases">Choose a use case</a>
            </Button>
            <LandingBookDemoCta variant="outline" />
          </>
        }
      >
        <p className="mb-7 max-w-sm text-base leading-7 text-pretty">
          {MARKETING_COPY.useCases.description}
        </p>
        <LandingPromptCta
          placeholder="Tell us who you need to find and why…"
          showLabeledCta={false}
        />
      </MarketingHero>
      <section
        id="use-cases"
        className={`${marketingPageWidth} scroll-mt-24 pb-16 lg:pb-24`}
      >
        <h2 className="mb-8 text-3xl font-normal tracking-tight sm:text-4xl">
          {MARKETING_COPY.useCases.examplesHeading}
        </h2>
        <MarketingUseCaseExplorer />
      </section>
      <section
        className={`${marketingPageWidth} flex flex-wrap items-center justify-between gap-8 py-16`}
      >
        <h2 className="text-2xl font-normal text-balance sm:text-3xl">
          {MARKETING_COPY.useCases.otherHeading}
        </h2>
        <div className="flex flex-wrap gap-3">
          <Button asChild variant="outline" className="rounded-full">
            <Link href="/product">See how it works</Link>
          </Button>
          <Button asChild variant="outline" className="rounded-full">
            <Link href="/blog/category/use-cases">Read the guides</Link>
          </Button>
        </div>
      </section>
    </>
  );
}
