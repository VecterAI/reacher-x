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
import { Button } from "@/shared/ui/components/Button";
import { LandingBookDemoCta } from "@/features/landing/ui/components/LandingBookDemoCta";
import {
  MarketingHero,
  MarketingFeature,
} from "@/features/landing/ui/components/marketing/MarketingLayout";

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
  return {
    title: item.goal,
    description: item.explanation,
    alternates: { canonical: `https://reacherx.com${item.href}` },
    openGraph: {
      title: item.goal,
      description: item.explanation,
      url: `https://reacherx.com${item.href}`,
      images: ["/og-default.jpg"],
    },
  };
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
      <MarketingHero
        title={item.heading}
        actions={
          <>
            <Button asChild className="rounded-full">
              <a href="#example">See it in action</a>
            </Button>
            <LandingBookDemoCta variant="outline" />
          </>
        }
      >
        <p className="mb-7 max-w-sm text-base leading-7 text-pretty">
          {item.explanation}
        </p>
        <LandingPromptCta
          key={item.slug}
          placeholder="Tell the agent about your project and who you want to meet…"
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
          Read the walkthrough{" "}
          <span aria-hidden="true" className="ml-2">
            ↗
          </span>
        </Link>
      </MarketingFeature>
      <MarketingFinish />
    </>
  );
}
