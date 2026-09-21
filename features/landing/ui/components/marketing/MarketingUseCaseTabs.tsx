"use client";

import { useState } from "react";
import Link from "next/link";
import { MARKETING_COPY } from "@/features/landing/lib/marketingContentHelpers";
import { MARKETING_USE_CASES } from "@/features/landing/lib/marketingUseCaseHelpers";
import { PillSelector } from "@/shared/ui/components/pill-navigation/PillSelector";
import { ArrowOutwardIcon } from "@/shared/ui/components/icons";
import {
  cn,
} from "@/shared/lib/utils";
import {
  marketingButton,
  MarketingSection,
  marketingSectionTitle,
} from "./MarketingLayout";
import { MarketingDemo } from "./MarketingDemo";

const TAB_ITEMS = MARKETING_USE_CASES.map((item) => ({
  value: item.slug,
  label: item.tabLabel,
}));

/** Homepage use-case explorer: pill tabs above copy beside the live demo. */
export function MarketingUseCaseTabs() {
  const [activeSlug, setActiveSlug] = useState(TAB_ITEMS[0]?.value ?? "");
  const activeIndex = MARKETING_USE_CASES.findIndex(
    (item) => item.slug === activeSlug
  );
  const active = MARKETING_USE_CASES[activeIndex];
  if (!active) return null;
  const demoRight = activeIndex % 2 === 0;

  return (
    <MarketingSection id="use-cases" labelledBy="use-case-tabs-heading">
      <h2 id="use-case-tabs-heading" className={marketingSectionTitle}>
        {MARKETING_COPY.story.connectionsHeading}
      </h2>
      <div className="mt-8">
        <PillSelector
          items={TAB_ITEMS}
          value={active.slug}
          onValueChange={setActiveSlug}
          label="Pick a use case"
        />
      </div>
      <div className="mt-10 lg:mt-14" key={active.slug}>
        <div
          className={cn(
            "grid gap-8 lg:gap-x-14 lg:gap-y-10",
            demoRight
              ? "lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]"
              : "lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]"
          )}
        >
          <div
            className={cn(
              "min-w-0 self-center",
              demoRight
                ? "lg:col-start-1 lg:row-start-1"
                : "lg:col-start-2 lg:row-start-1"
            )}
          >
            <h3 className={marketingSectionTitle}>{active.heading}</h3>
            <p className="mt-5 text-lg leading-7 text-pretty">
              {active.explanation}
            </p>
            <p className="text-muted-foreground mt-5 text-sm leading-6">
              {active.exampleHeading}
            </p>
            <Link
              href={active.blogHref}
              className={marketingButton({
                variant: "outline",
                className: "mt-8",
              })}
            >
              Read the guide
              <ArrowOutwardIcon className="size-4 shrink-0 fill-current" />
            </Link>
          </div>
          <div
            className={cn(
              "min-w-0",
              demoRight
                ? "lg:col-start-2 lg:row-start-1"
                : "lg:col-start-1 lg:row-start-1"
            )}
          >
            <MarketingDemo
              scenario={active.guide}
              title={active.goal}
              caption={active.navigationDescription}
            />
          </div>
        </div>
      </div>
    </MarketingSection>
  );
}
