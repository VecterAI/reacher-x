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
        title="Discovery that keeps going."
        demo={
          <MarketingDemo
            scenario="find-candidates"
            sceneRange={[9, 19]}
            title="Find people through their work"
            caption="Search results with the evidence behind each match."
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
        reverse
        title="Plans for every person."
        demo={
          <MarketingDemo
            scenario="create-plans-for-several-people"
            title="Create and review individual outreach plans"
            caption="A personal introduction for each person, ready for your review."
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
        title="Messages with substance."
        demo={
          <MarketingDemo
            scenario="send-voice-notes"
            title="Send media in a conversation"
            caption="A voice note shared inside a real conversation."
          />
        }
      >
        <p className="text-lg leading-7 text-pretty">
          {MARKETING_COPY.product.messages}
        </p>
        <CapabilityLink href="/blog/send-voice-notes">
          About voice notes
        </CapabilityLink>
      </MarketingFeature>
      <MarketingFeature
        reverse
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
