import Link from "next/link";
import { GITHUB_REPO_URL } from "@/features/landing/lib/github";
import {
  MarketingFeature,
  marketingPageWidth,
  marketingButton,
} from "./MarketingLayout";
import { MarketingDemo } from "./MarketingDemo";
import { MarketingUseCaseExplorer } from "./MarketingUseCaseExplorer";

export function MarketingSimplicity() {
  return (
    <MarketingFeature
      id="simplicity"
      title="No learning curve."
      demo={
        <MarketingDemo
          scenario="getting-started-with-reacherx"
          title="Set up a search by talking to ReacherX"
          caption="Try the setup conversation and review the search criteria."
        />
      }
    >
      <p className="text-lg leading-7 text-pretty">
        Chat with ReacherX to find people, plan outreach, and manage
        conversations.
      </p>
    </MarketingFeature>
  );
}

export function MarketingConnections() {
  return (
    <section
      className={`${marketingPageWidth} py-16 lg:py-24`}
      aria-labelledby="connections-heading"
    >
      <header className="mb-8 flex flex-wrap items-end justify-between gap-5">
        <h2
          id="connections-heading"
          className="max-w-xl text-3xl font-normal tracking-tight sm:text-4xl"
        >
          Network with anyone.
        </h2>
        <Link
          href="/use-cases"
          className="text-sm underline-offset-4 hover:underline"
        >
          All use cases <span aria-hidden="true">↗</span>
        </Link>
      </header>
      <MarketingUseCaseExplorer />
    </section>
  );
}

export function MarketingDevelopers() {
  return (
    <section
      className={`${marketingPageWidth} py-16 lg:py-24`}
      aria-labelledby="developers-heading"
    >
      <div className="flex flex-col justify-between gap-8 lg:flex-row lg:items-center">
        <div>
          <h2
            id="developers-heading"
            className="text-3xl font-normal tracking-tight sm:text-5xl"
          >
            Open source.
          </h2>
          <p className="text-muted-foreground mt-5 max-w-lg text-base leading-7">
            Use, modify, and self-host ReacherX under Apache 2.0.
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <a href={GITHUB_REPO_URL} className={marketingButton()}>
            View on GitHub <span aria-hidden="true">↗</span>
          </a>
          <Link
            href="/blog/run-reacherx-yourself"
            className={marketingButton({ variant: "outline" })}
          >
            Self-hosting guide
          </Link>
        </div>
      </div>
    </section>
  );
}
