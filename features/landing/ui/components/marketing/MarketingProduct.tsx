import { MARKETING_COPY } from "@/features/landing/lib/marketingContentHelpers";
import Link from "next/link";
import {
  marketingButton as buttonVariants,
  MarketingFeature,
  MarketingSection,
  marketingSectionTitle,
} from "./MarketingLayout";
import { MarketingDemo } from "./MarketingDemo";
import { MarketingCapabilityCarousel } from "./MarketingCapabilityCarousel";
import { ArrowOutwardIcon } from "@/shared/ui/components/icons";

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

function MarketingCapabilities() {
  return (
    <>
      <MarketingFeature
        id="capabilities"
        reverse
        title="Working around the clock."
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
        <CapabilityLink href="/blog/how-reacherx-discovery-works">
          How discovery works
        </CapabilityLink>
      </MarketingFeature>
      <MarketingFeature
        title="Plans for every person."
        demo={
          <MarketingDemo
            scenario="create-plans-for-several-people"
            title="Create and review individual outreach plans"
            caption="Three people, three different invitations."
          />
        }
      >
        <p className="text-lg leading-7 text-pretty">
          {MARKETING_COPY.product.plans}
        </p>
        <CapabilityLink href="/blog/how-reacherx-planning-works">
          How planning works
        </CapabilityLink>
      </MarketingFeature>
      <MarketingFeature
        reverse
        title="Send more than text."
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
        title="△ Agent, with a memory."
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
