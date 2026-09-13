import Link from "next/link";
import type { FaqItem } from "@/features/landing/lib/faqs";
import { FaqsAccordion } from "./FaqsAccordion";

export function FaqsSection({
  items,
  contactLabel = "Still have a question? Contact us.",
  layout = "centered",
}: {
  items: FaqItem[];
  contactLabel?: string;
  /** "split" puts a sticky heading + contact column left of the accordion. */
  layout?: "centered" | "split";
}) {
  const accordion = <FaqsAccordion items={items} />;

  const contact = (
    <p className="text-muted-foreground mt-6 text-sm md:text-base">
      {contactLabel}{" "}
      <Link
        href="mailto:creativecoder.crco@gmail.com"
        className="text-foreground underline-offset-4 hover:underline"
      >
        creativecoder.crco@gmail.com
      </Link>
    </p>
  );

  if (layout === "split") {
    return (
      <section aria-labelledby="faqs-heading" className="px-4 py-16 md:py-24">
        <div className="mx-auto grid w-full max-w-[1288px] gap-10 md:grid-cols-12 md:gap-16">
          <div className="md:col-span-4">
            <div className="md:sticky md:top-24">
              <h2
                id="faqs-heading"
                className="font-pixel-square text-4xl font-medium md:text-5xl"
              >
                FAQs
              </h2>
              {contact}
            </div>
          </div>
          <div className="md:col-span-8">{accordion}</div>
        </div>
      </section>
    );
  }

  return (
    <section aria-labelledby="faqs-heading" className="px-4 py-16 md:py-24">
      <div className="mx-auto w-full max-w-3xl">
        <h2
          id="faqs-heading"
          className="font-pixel-square mb-10 text-center text-4xl font-medium md:mb-12 md:text-5xl"
        >
          FAQs
        </h2>

        {accordion}

        <p className="text-muted-foreground mt-6 text-center text-sm md:text-base">
          {contactLabel}{" "}
          <Link
            href="mailto:creativecoder.crco@gmail.com"
            className="text-foreground underline-offset-4 hover:underline"
          >
            creativecoder.crco@gmail.com
          </Link>
        </p>
      </div>
    </section>
  );
}
