"use client";

import { useState } from "react";
import Link from "next/link";
import { MARKETING_COPY } from "@/features/landing/lib/marketingContentHelpers";
import { MARKETING_USE_CASES } from "@/features/landing/lib/marketingUseCaseHelpers";
import { PillSelector } from "@/shared/ui/components/pill-navigation/PillSelector";
import { ArrowOutwardIcon } from "@/shared/ui/components/icons";
import {
  marketingButton,
  MarketingFeatureColumns,
  MarketingSection,
  marketingSectionTitle,
} from "./MarketingLayout";
import { MarketingDemo } from "./MarketingDemo";

const TAB_ITEMS = MARKETING_USE_CASES.map((item) => ({
  value: item.slug,
  label: item.tabLabel,
}));

/** Homepage use-case explorer: pill tabs above the shared feature columns. */
export function MarketingUseCaseTabs() {
  const [activeSlug, setActiveSlug] = useState(TAB_ITEMS[0]?.value ?? "");
  const activeIndex = MARKETING_USE_CASES.findIndex(
    (item) => item.slug === activeSlug
  );
  const active = MARKETING_USE_CASES[activeIndex];
  if (!active) return null;

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
        <MarketingFeatureColumns
          title={active.heading}
          titleAs="h3"
          reverse={activeIndex % 2 === 1}
          demo={
            <MarketingDemo
              scenario={active.guide}
              title={active.goal}
              caption={active.navigationDescription}
            />
          }
        >
          <p className="text-lg leading-7 text-pretty">
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
        </MarketingFeatureColumns>
      </div>
    </MarketingSection>
  );
}
