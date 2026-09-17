import Link from "next/link";
import { homepageFaqItems } from "@/features/landing/lib/faqs";
import { FaqsAccordion } from "../sections/FaqsAccordion";
import { MarketingSection, marketingSectionTitle } from "./MarketingLayout";

export function MarketingFaq() {
  return (
    <MarketingSection id="faqs" labelledBy="marketing-faq-heading">
      <div className="grid gap-10 lg:grid-cols-[1fr_1.25fr] lg:gap-24">
        <div>
          <h2 id="marketing-faq-heading" className={marketingSectionTitle}>
            Frequently asked questions.
          </h2>
          <p className="text-muted-foreground mt-6 max-w-xs text-base leading-7">
            Need help with something else?{" "}
            <Link
              href="mailto:creativecoder.crco@gmail.com"
              className="text-foreground underline underline-offset-4"
            >
              Get in touch.
            </Link>
          </p>
        </div>
        <FaqsAccordion items={homepageFaqItems} />
      </div>
    </MarketingSection>
  );
}
