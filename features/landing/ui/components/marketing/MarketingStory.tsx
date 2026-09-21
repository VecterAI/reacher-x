import { MARKETING_COPY } from "@/features/landing/lib/marketingContentHelpers";
import Link from "next/link";
import type { ReactNode } from "react";
import { GITHUB_REPO_URL } from "@/features/landing/lib/github";
import {
  DISCORD_INVITE_URL,
  PATREON_URL,
} from "@/features/landing/lib/communityUrls";
import {
  ArrowOutwardIcon,
  DiscordOutlineIcon,
  PatreonIcon,
} from "@/shared/ui/components/icons";
import {
  marketingButton,
  MarketingSection,
  marketingSectionTitle,
} from "./MarketingLayout";

export function MarketingAuthenticity() {
  return (
    <MarketingSection labelledBy="authenticity-heading">
      <h2 id="authenticity-heading" className={marketingSectionTitle}>
        {MARKETING_COPY.story.authenticityHeading}
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
            {MARKETING_COPY.story.developersHeading}
          </h2>
          <p className="text-muted-foreground mt-5 max-w-lg text-base leading-7">
            {MARKETING_COPY.story.developers}
          </p>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
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

export function MarketingCommunity() {
  return (
    <MarketingSection labelledBy="community-heading">
      <header className="mb-10">
        <h2 id="community-heading" className={marketingSectionTitle}>
          {MARKETING_COPY.story.communityHeading}
        </h2>
      </header>
      <div className="grid gap-4 sm:grid-cols-2">
        <CommunityCard
          href={DISCORD_INVITE_URL}
          icon={<DiscordOutlineIcon className="size-6" />}
          title="Talk to us on Discord"
          description="Ask questions, share what you build, and follow the roadmap with the people using it every day."
          linkLabel="Join the Discord"
        />
        <CommunityCard
          href={PATREON_URL}
          icon={<PatreonIcon className="size-6 fill-current" />}
          title="Support on Patreon"
          description="Fund development and keep ReacherX independent, open source, and free to self-host."
          linkLabel="Become a patron"
        />
      </div>
    </MarketingSection>
  );
}

function CommunityCard({
  href,
  icon,
  title,
  description,
  linkLabel,
}: {
  href: string;
  icon: ReactNode;
  title: string;
  description: string;
  linkLabel: string;
}) {
  return (
    <div className="blog-card relative flex h-full min-w-0 flex-col bg-background p-6 transition-colors duration-200 hover:bg-neutral-50 motion-reduce:transition-none dark:bg-neutral-950 dark:hover:bg-neutral-900 lg:p-8">
      <div className="mb-5" aria-hidden="true">
        {icon}
      </div>
      <h3 className="text-2xl leading-8 font-normal">{title}</h3>
      <p className="text-muted-foreground mt-4 text-base leading-7">
        {description}
      </p>
      <div className="mt-auto pt-6">
        <a
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className={marketingButton({ size: "sm" })}
        >
          {linkLabel}
          <ArrowOutwardIcon className="size-4 shrink-0 fill-current" />
        </a>
      </div>
    </div>
  );
}
