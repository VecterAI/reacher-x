"use client";

import { useState } from "react";
import Link from "next/link";
import { MARKETING_COPY } from "@/features/landing/lib/marketingContentHelpers";
import { MARKETING_USE_CASES } from "@/features/landing/lib/marketingUseCaseHelpers";
import { PillSelector } from "@/shared/ui/components/pill-navigation/PillSelector";
import { CheckIcon, ArrowOutwardIcon } from "@/shared/ui/components/icons";
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

/** Homepage use-case explorer: pill tabs above a demo and copy panel. */
export function MarketingUseCaseTabs() {
  const [activeSlug, setActiveSlug] = useState(TAB_ITEMS[0]?.value ?? "");
  const active =
    MARKETING_USE_CASES.find((item) => item.slug === activeSlug) ??
    MARKETING_USE_CASES[0];
  if (!active) return null;

  return (
    <MarketingSection id="use-cases" labelledBy="use-case-tabs-heading">
      <header className="mb-8">
        <h2 id="use-case-tabs-heading" className={marketingSectionTitle}>
          {MARKETING_COPY.story.connectionsHeading}
        </h2>
        <p className="text-muted-foreground mt-5 max-w-lg text-base leading-7">
          {MARKETING_COPY.story.connections}
        </p>
      </header>
      <PillSelector
        items={TAB_ITEMS}
        value={active.slug}
        onValueChange={setActiveSlug}
        label="Pick a use case"
      />
      <div
        key={active.slug}
        className="mt-10 grid gap-8 lg:grid-cols-[minmax(0,3fr)_minmax(0,1fr)] lg:gap-x-14 lg:gap-y-10"
      >
        <MarketingDemo
          scenario={active.guide}
          title={active.goal}
          caption={active.explanation}
        />
        <div className="min-w-0 self-center lg:max-w-xs">
          <h3 className="text-2xl leading-8 font-normal">{active.heading}</h3>
          <p className="text-muted-foreground mt-4 text-base leading-7">
            {active.explanation}
          </p>
          <ul className="mt-6 space-y-2 text-sm">
            {active.checks.map((check) => (
              <li key={check} className="flex gap-2">
                <CheckIcon
                  className="text-foreground mt-0.5 size-4 shrink-0 fill-current"
                  aria-hidden
                />
                <span>{check}</span>
              </li>
            ))}
          </ul>
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
      </div>
    </MarketingSection>
  );
}
