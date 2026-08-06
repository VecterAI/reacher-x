import { Suspense } from "react";
import type { Metadata } from "next";
import { cookies } from "next/headers";
import { pricingFaqItems } from "@/features/landing/lib/faqs";
import { FaqsSection } from "@/features/landing/ui/components/sections/FaqsSection";
import { PricingSection } from "@/features/landing/ui/components/sections/PricingSection";
import {
  parseWorkspaceUseCaseKeyParam,
  WORKSPACE_USE_CASE_STORAGE_KEY,
} from "@/shared/lib/workspaceUseCaseCache";
import { DEFAULT_WORKSPACE_USE_CASE_KEY } from "@/shared/lib/workspaceUseCases";

export const metadata: Metadata = {
  title: "Pricing",
  description:
    "Simple, transparent pricing for ReacherX. Choose a plan and start your Agent.",
  openGraph: {
    title: "Pricing",
    description:
      "Simple, transparent pricing for ReacherX. Choose a plan and start your Agent.",
    images: ["/og-default.jpg"],
    url: "https://reacherx.com/pricing",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Pricing",
    description:
      "Simple, transparent pricing for ReacherX. Choose a plan and start your Agent.",
    images: ["/og-default.jpg"],
  },
};

export default function PricingPage() {
  return (
    <div className="mx-auto w-full max-w-[1288px]">
      <Suspense
        fallback={
          <PricingSection initialUseCaseKey={DEFAULT_WORKSPACE_USE_CASE_KEY} />
        }
      >
        <PricingSectionRuntime />
      </Suspense>
      <FaqsSection items={pricingFaqItems} />
    </div>
  );
}

async function PricingSectionRuntime() {
  const cookieStore = await cookies();
  const initialUseCaseKey =
    parseWorkspaceUseCaseKeyParam(
      cookieStore.get(WORKSPACE_USE_CASE_STORAGE_KEY)?.value
    ) ?? DEFAULT_WORKSPACE_USE_CASE_KEY;

  return <PricingSection initialUseCaseKey={initialUseCaseKey} />;
}
