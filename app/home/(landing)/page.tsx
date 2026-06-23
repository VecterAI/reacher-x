import type { Metadata } from "next";
import { APP_DESCRIPTION } from "@/shared/lib/metadata";
import { HeroSection } from "@/features/landing/ui/components/sections/HeroSection";
import { HowAgentWorksSection } from "@/features/landing/ui/components/sections/HowAgentWorksSection";
import { RelationshipLayerSection } from "@/features/landing/ui/components/sections/RelationshipLayerSection";
import { GetsSmarterSection } from "@/features/landing/ui/components/sections/GetsSmarterSection";
import { InControlSection } from "@/features/landing/ui/components/sections/InControlSection";
import { UseCasesSection } from "@/features/landing/ui/components/sections/UseCasesSection";
import { OpenSourceSection } from "@/features/landing/ui/components/sections/OpenSourceSection";
import { SocialProofSection } from "@/features/landing/ui/components/sections/SocialProofSection";
import { RecentThreadsSection } from "@/features/landing/ui/components/sections/RecentThreadsSection";
import { FounderStorySection } from "@/features/landing/ui/components/sections/FounderStorySection";
import { FaqsSection } from "@/features/landing/ui/components/sections/FaqsSection";
import { FinalCtaSection } from "@/features/landing/ui/components/sections/FinalCtaSection";
import { homepageFaqItems } from "@/features/landing/lib/faqs";
import { getPublicTestimonials } from "@/features/landing/lib/getPublicTestimonials";
import { getPublicThreads } from "@/features/threads/lib/getPublicThreads";

export const metadata: Metadata = {
  description: APP_DESCRIPTION,
  openGraph: {
    title: "🆁 ReacherX",
    description: APP_DESCRIPTION,
    images: ["/og-default.jpg"],
    url: "https://reacherx.com",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "🆁 ReacherX",
    description: APP_DESCRIPTION,
    images: ["/og-default.jpg"],
  },
};

export default function Home() {
  const testimonialsPromise = getPublicTestimonials(4);
  const recentThreadsPromise = getPublicThreads({ limit: 2 });

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
        <SocialProofSection tweetsPromise={testimonialsPromise} />
        <RecentThreadsSection threadsPromise={recentThreadsPromise} />
        <FounderStorySection />
        <FaqsSection items={homepageFaqItems} />
        <FinalCtaSection />
      </div>
    </>
  );
}
