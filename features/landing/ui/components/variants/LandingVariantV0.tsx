import { HeroSection } from "../sections/HeroSection";
import { HowAgentWorksSection } from "../sections/HowAgentWorksSection";
import { RelationshipLayerSection } from "../sections/RelationshipLayerSection";
import { GetsSmarterSection } from "../sections/GetsSmarterSection";
import { InControlSection } from "../sections/InControlSection";
import { UseCasesSection } from "../sections/UseCasesSection";
import { OpenSourceSection } from "../sections/OpenSourceSection";
import { SocialProofSection } from "../sections/SocialProofSection";
import { RecentThreadsSection } from "../sections/RecentThreadsSection";
import { FounderStorySection } from "../sections/FounderStorySection";
import { FaqsSection } from "../sections/FaqsSection";
import { FinalCtaSection } from "../sections/FinalCtaSection";
import { homepageFaqItems } from "@/features/landing/lib/faqs";
import type { Thread, Tweet } from "@/features/threads/types";

/**
 * V0: The original `/home` composition before the V2 promotion.
 * Archived for iteration switching in development.
 */
export function LandingVariantV0({
  tweetsPromise,
  recentThreadsPromise,
}: {
  tweetsPromise: Promise<Tweet[]>;
  recentThreadsPromise: Promise<Thread[]>;
}) {
  return (
    <>
      <div className="mx-auto w-full max-w-[1288px]">
        <HeroSection />
        <HowAgentWorksSection />
        <RelationshipLayerSection />
        <GetsSmarterSection />
        <InControlSection />
      </div>
      {/* Full-viewport-width — cards scroll edge-to-edge */}
      <UseCasesSection />
      <div className="mx-auto w-full max-w-[1288px]">
        <OpenSourceSection />
        <SocialProofSection tweetsPromise={tweetsPromise} />
        <RecentThreadsSection threadsPromise={recentThreadsPromise} />
        <FounderStorySection />
        <FaqsSection items={homepageFaqItems} />
        <FinalCtaSection />
      </div>
    </>
  );
}
