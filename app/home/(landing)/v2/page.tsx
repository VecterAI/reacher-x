import type { Metadata } from "next";
import { LandingVariantV2 } from "@/features/landing/ui/components/variants/LandingVariantV2";
import { getPublicTestimonials } from "@/features/landing/lib/getPublicTestimonials";

export const metadata: Metadata = {
  title: "ReacherX — Variant 2",
  description:
    "Building got easy. Reaching people didn't. Anyone can build now. Finding the right people is still the hard part. Tell △ Agent who you need, and it figures out the rest.",
  robots: { index: false, follow: false },
};

export default function HomeVariantV2Page() {
  const testimonialsPromise = getPublicTestimonials(4);

  return <LandingVariantV2 tweetsPromise={testimonialsPromise} />;
}
