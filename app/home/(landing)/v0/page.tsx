import type { Metadata } from "next";
import { LandingVariantV0 } from "@/features/landing/ui/components/variants/LandingVariantV0";
import { getPublicTestimonials } from "@/features/landing/lib/getPublicTestimonials";
import { getPublicThreads } from "@/features/threads/lib/getPublicThreads";

export const metadata: Metadata = {
  title: "ReacherX — Variant 0 (Original)",
  description:
    "Open-source, self-improving agent that finds the people you need in real time.",
  robots: { index: false, follow: false },
};

export default function HomeVariantV0Page() {
  const testimonialsPromise = getPublicTestimonials(4);
  const recentThreadsPromise = getPublicThreads({ limit: 2 });

  return (
    <LandingVariantV0
      tweetsPromise={testimonialsPromise}
      recentThreadsPromise={recentThreadsPromise}
    />
  );
}
