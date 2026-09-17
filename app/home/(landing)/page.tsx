import { marketingMetadata } from "@/features/landing/lib/agentReadinessHelpers";
import { MarketingStructuredData } from "@/features/landing/ui/components/MarketingStructuredData";
import type { Metadata } from "next";
import { MarketingHome } from "@/features/landing/ui/components/marketing/MarketingHome";

export const metadata: Metadata = marketingMetadata("/home");

export default function Home() {
  return (
    <>
      <MarketingStructuredData pathname="/home" />
      <MarketingHome />
    </>
  );
}
