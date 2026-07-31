import type { Metadata } from "next";
import { APP_DESCRIPTION } from "@/shared/lib/metadata";
import { LandingVariantV2 } from "@/features/landing/ui/components/variants/LandingVariantV2";
import { getPublicTestimonials } from "@/features/landing/lib/getPublicTestimonials";

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

  return <LandingVariantV2 tweetsPromise={testimonialsPromise} />;
}
