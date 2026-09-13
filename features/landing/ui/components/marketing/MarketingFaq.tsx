import Link from "next/link";
import { homepageFaqItems } from "@/features/landing/lib/faqs";
import { FaqsAccordion } from "../sections/FaqsAccordion";
import { marketingPageWidth } from "./MarketingLayout";

export function MarketingFaq() {
  return (
    <section
      id="faqs"
      aria-labelledby="marketing-faq-heading"
      className={`${marketingPageWidth} scroll-mt-24 py-16 lg:py-24`}
    >
      <div className="grid gap-10 lg:grid-cols-[1fr_1.25fr] lg:gap-24">
        <div>
          <h2
            id="marketing-faq-heading"
            className="text-4xl leading-tight font-normal tracking-tight sm:text-5xl"
          >
            Frequently asked
            <br />
            questions.
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
        <FaqsAccordion
          items={homepageFaqItems}
          className="[&_[data-slot=faq-item]]:border-0 [&_h3>button]:py-4 [&_h3>button]:font-normal [&_h3>button]:md:text-base"
        />
      </div>
    </section>
  );
}
