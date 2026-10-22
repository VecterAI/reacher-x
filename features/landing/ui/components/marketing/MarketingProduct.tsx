import { MARKETING_COPY } from "@/features/landing/lib/marketingContentHelpers";
import type { ReactNode } from "react";
import Link from "next/link";
import {
  marketingButton as buttonVariants,
  MarketingFeature,
  MarketingSection,
  marketingSectionTitle,
} from "./MarketingLayout";
import { MarketingDemo } from "./MarketingDemo";
import { MarketingCapabilityCarousel } from "./MarketingCapabilityCarousel";
import {
  ArrowOutwardIcon,
  CognitionIcon,
  FilledLinkedinIcon,
  FilledTwitterIcon,
  ImageIcon,
  MicIcon,
  VideoLibraryIcon,
} from "@/shared/ui/components/icons";

function PlatformSearchRow() {
  return (
    <div className="text-muted-foreground mt-6 flex items-center gap-5 text-sm">
      <span className="inline-flex items-center gap-1.5">
        <FilledTwitterIcon
          className="text-foreground size-4 shrink-0"
          aria-hidden="true"
        />
        X/Twitter
      </span>
      <span className="inline-flex items-center gap-1.5">
        <FilledLinkedinIcon
          className="text-foreground size-4 shrink-0"
          aria-hidden="true"
        />
        LinkedIn
      </span>
    </div>
  );
}

function CapabilityLink({
  href,
  children,
}: {
  href: string;
  children: string;
}) {
  return (
    <Link
      href={href}
      className={buttonVariants({ variant: "outline", className: "mt-8" })}
    >
      {children}
      <ArrowOutwardIcon className="size-4 shrink-0 fill-current" />
    </Link>
  );
}

function PlansCopy() {
  // The "@ " mention mirrors the app's composer, where typing @ tags a
  // person (MentionNode: font-mono text-muted-foreground).
  const parts = MARKETING_COPY.product.plans.split("@ ");
  return (
    <p className="text-lg leading-7 text-pretty">
      {parts.map((part, index) => (
        <span key={index}>
          {index > 0 ? (
            <span>
              <span className="font-mono text-muted-foreground">@</span>{" "}
            </span>
          ) : null}
          {part}
        </span>
      ))}
    </p>
  );
}

function MarketingFeatureTitle({ children }: { children: ReactNode }) {
  // MarketingFeature titles accept ReactNode; headings that name app
  // features render the app's own icon inline at text size.
  return (
    <span className="[&_svg]:mr-[0.18em] [&_svg]:inline [&_svg]:size-[0.72em] [&_svg]:shrink-0 [&_svg]:align-[-0.06em]">
      {children}
    </span>
  );
}

function MarketingCapabilities() {
  return (
    <>
      <MarketingFeature
        id="capabilities"
        reverse
        title="No stale contact database."
        demo={
          <MarketingDemo
            scenario="agent-around-the-clock"
            title="The agent at work, around the clock"
            caption="Live workspace progress, one click away."
          />
        }
      >
        <p className="text-lg leading-7 text-pretty">
          {MARKETING_COPY.product.discovery}
        </p>
        <PlatformSearchRow />
        <CapabilityLink href="/blog/how-reacherx-discovery-works">
          How discovery works
        </CapabilityLink>
      </MarketingFeature>
      <MarketingFeature
        title="A different plan for each person."
        demo={
          <MarketingDemo
            scenario="create-plans-for-several-people"
            title="Create and review individual outreach plans"
            caption="Three people, three different invitations."
          />
        }
      >
        <PlansCopy />
        <CapabilityLink href="/blog/how-reacherx-planning-works">
          How planning works
        </CapabilityLink>
      </MarketingFeature>
      <MarketingFeature
        reverse
        title={
          <MarketingFeatureTitle>
            Send <MicIcon aria-hidden="true" /> voice notes,{" "}
            <ImageIcon aria-hidden="true" /> images, and{" "}
            <VideoLibraryIcon aria-hidden="true" /> video.
          </MarketingFeatureTitle>
        }
        demo={
          <MarketingDemo
            scenario="outreach-with-images-and-video"
            title="Send media in a conversation"
            caption="A clip shared inside a real conversation."
          />
        }
      >
        <p className="text-lg leading-7 text-pretty">
          {MARKETING_COPY.product.messages}
        </p>
        <CapabilityLink href="/blog/outreach-with-images-and-video">
          About media in conversations
        </CapabilityLink>
      </MarketingFeature>
      <MarketingFeature
        title={
          <MarketingFeatureTitle>
            <CognitionIcon aria-hidden="true" /> △ Agent, with a memory.
          </MarketingFeatureTitle>
        }
        demo={
          <MarketingDemo
            scenario="teach-reacherx-what-you-want"
            title="Save a writing preference and use it in a new plan"
            caption="A saved preference applied to the next draft."
          />
        }
      >
        <p className="text-lg leading-7 text-pretty">
          {MARKETING_COPY.product.memory}
        </p>
        <CapabilityLink href="/blog/how-reacherx-memory-works">
          How memory works
        </CapabilityLink>
      </MarketingFeature>
    </>
  );
}

function MarketingCapabilityIndex() {
  return (
    <MarketingSection labelledBy="capability-index-heading">
      <h2 id="capability-index-heading" className={marketingSectionTitle}>
        {MARKETING_COPY.product.moreHeading}
      </h2>
      <div className="mt-14">
        <MarketingCapabilityCarousel />
      </div>
    </MarketingSection>
  );
}

export { CapabilityLink, MarketingCapabilities, MarketingCapabilityIndex };
