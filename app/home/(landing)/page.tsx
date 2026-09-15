import type { Metadata } from "next";
import { APP_DESCRIPTION } from "@/shared/lib/metadata";
import { MarketingHome } from "@/features/landing/ui/components/marketing/MarketingHome";

export const metadata: Metadata = {
  description: APP_DESCRIPTION,
  alternates: { canonical: "https://reacherx.com/home" },
  openGraph: {
    title: "🆁 ReacherX",
    description: APP_DESCRIPTION,
    images: ["/og-default.jpg"],
    url: "https://reacherx.com/home",
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
  return <MarketingHome />;
}
