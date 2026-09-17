import { marketingMetadata } from "@/features/landing/lib/agentReadinessHelpers";
import { MarketingStructuredData } from "@/features/landing/ui/components/MarketingStructuredData";
import type { Metadata } from "next";
import { UseCasesDirectory } from "@/features/landing/ui/components/sections/UseCasesDirectory";

export const metadata: Metadata = marketingMetadata("/use-cases");

export default function UseCasesPage() {
  return (
    <>
      <MarketingStructuredData pathname="/use-cases" />
      <UseCasesDirectory />
    </>
  );
}
