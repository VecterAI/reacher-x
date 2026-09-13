import type { Metadata } from "next";
import { MarketingHome } from "@/features/landing/ui/components/marketing/MarketingHome";

export const metadata: Metadata = {
  title: "Network homepage preview",
  robots: { index: false, follow: false },
};

export default function NetworkPreviewPage() {
  return <MarketingHome />;
}
