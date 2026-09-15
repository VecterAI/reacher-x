import Link from "next/link";
import { GITHUB_REPO_URL } from "@/features/landing/lib/github";
import { ArrowOutwardIcon } from "@/shared/ui/components/icons";
import {
  marketingButton,
  MarketingSection,
  marketingSectionTitle,
} from "./MarketingLayout";
import { MarketingUseCaseExplorer } from "./MarketingUseCaseExplorer";

export function MarketingConnections() {
  return (
    <MarketingSection id="use-cases" labelledBy="connections-heading">
      <header className="mb-8 flex flex-wrap items-end justify-between gap-5">
        <div>
          <h2 id="connections-heading" className={marketingSectionTitle}>
            Find anyone.
          </h2>
          <p className="text-muted-foreground mt-5 max-w-lg text-base leading-7">
            Customers, candidates, investors, partners. The problem is always
            the same: the right people.
          </p>
        </div>
      </header>
      <MarketingUseCaseExplorer />
    </MarketingSection>
  );
}

export function MarketingAuthenticity() {
  return (
    <MarketingSection labelledBy="authenticity-heading">
      <h2 id="authenticity-heading" className={marketingSectionTitle}>
        Get access to the right network. Because your network is your net worth.
      </h2>
    </MarketingSection>
  );
}

export function MarketingDevelopers() {
  return (
    <MarketingSection labelledBy="developers-heading">
      <div className="flex flex-col justify-between gap-10 lg:flex-row lg:items-center">
        <div>
          <h2 id="developers-heading" className={marketingSectionTitle}>
            Open source.
          </h2>
          <p className="text-muted-foreground mt-5 max-w-lg text-base leading-7">
            Use, modify, and self-host ReacherX under Apache 2.0, as part of the
            Convex Open Source program.
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <a href={GITHUB_REPO_URL} className={marketingButton()}>
            View on GitHub
            <ArrowOutwardIcon className="size-4 shrink-0 fill-current" />
          </a>
          <Link
            href="/blog/run-reacherx-yourself"
            className={marketingButton({ variant: "outline" })}
          >
            Self-hosting guide
            <ArrowOutwardIcon className="size-4 shrink-0 fill-current" />
          </Link>
        </div>
      </div>
    </MarketingSection>
  );
}
