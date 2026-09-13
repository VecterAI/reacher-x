import { HeroSection } from "../sections/HeroSection";
import { HowAgentWorksSection } from "../sections/HowAgentWorksSection";
import { RelationshipLayerSection } from "../sections/RelationshipLayerSection";
import { GetsSmarterSection } from "../sections/GetsSmarterSection";
import { InControlSection } from "../sections/InControlSection";
import { UseCasesSection } from "../sections/UseCasesSection";
import { OpenSourceSection } from "../sections/OpenSourceSection";
import { SocialProofSection } from "../sections/SocialProofSection";
import { FounderStorySection } from "../sections/FounderStorySection";
import { FaqsSection } from "../sections/FaqsSection";
import { FinalCtaSection } from "../sections/FinalCtaSection";
import { homepageFaqItems } from "@/features/landing/lib/faqs";
import type { Tweet } from "@/features/threads/types";

/**
 * V0: The original `/home` composition before the V2 promotion.
 * Archived for iteration switching in development.
 */
export function LandingVariantV0({
  tweetsPromise,
}: {
  tweetsPromise: Promise<Tweet[]>;
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
        <FounderStorySection />
        <FaqsSection items={homepageFaqItems} />
        <FinalCtaSection />
      </div>
    </>
  );
}
