import { marketingMetadata } from "@/features/landing/lib/agentReadinessHelpers";
import { MarketingStructuredData } from "@/features/landing/ui/components/MarketingStructuredData";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  getMarketingUseCase,
  MARKETING_USE_CASES,
} from "@/features/landing/lib/marketingUseCaseHelpers";
import { LandingPromptCta } from "@/features/landing/ui/components/LandingPromptCta";
import { MarketingFinish } from "@/features/landing/ui/components/marketing/MarketingSections";
import { MarketingDemo } from "@/features/landing/ui/components/marketing/MarketingDemo";
import {
  MarketingHero,
  MarketingFeature,
  marketingButton as buttonVariants,
} from "@/features/landing/ui/components/marketing/MarketingLayout";
import { ArrowOutwardIcon } from "@/shared/ui/components/icons";
import { LandingBookDemoCta } from "@/features/landing/ui/components/LandingBookDemoCta";

export function generateStaticParams() {
  return MARKETING_USE_CASES.map(({ slug }) => ({ slug }));
}
export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const item = getMarketingUseCase((await params).slug);
  if (!item) return { title: "Use case not found", robots: { index: false } };
  return marketingMetadata(item.href);
}
export default async function UseCasePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const item = getMarketingUseCase((await params).slug);
  if (!item) notFound();
  return (
    <>
      <MarketingStructuredData pathname={item.href} />
      <MarketingHero
        title={item.heading}
        actions={
          <>
            <a href="#example" className={buttonVariants()}>
              See it in action
            </a>
            <LandingBookDemoCta variant="outline" />
          </>
        }
      >
        <p className="mb-7 max-w-sm text-base leading-7 text-pretty">
          {item.explanation}
        </p>
        <LandingPromptCta
          key={item.slug}
          placeholder="Tell the agent who you want to meet and why…"
          showLabeledCta={false}
        />
      </MarketingHero>
      <MarketingFeature
        id="example"
        title={item.exampleHeading}
        demo={
          <MarketingDemo
            scenario={item.guide}
            title={item.goal}
            caption="Explore the full workspace, open a profile, and read the source posts."
          />
        }
      >
        <ul className="text-base leading-7">
          {item.checks.map((check) => (
            <li key={check} className="py-5 first:pt-0 last:pb-0">
              {check}
            </li>
          ))}
        </ul>
        <Link
          href={`/blog/${item.guide}`}
          className="mt-6 inline-flex text-sm underline-offset-4 hover:underline"
        >
          Read the walkthrough
          <ArrowOutwardIcon className="ml-1 inline size-3.5 shrink-0 fill-current" />
        </Link>
      </MarketingFeature>
      <MarketingFinish />
    </>
  );
}
