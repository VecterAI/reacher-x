import Link from "next/link";
import type { FaqItem } from "@/features/landing/lib/faqs";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/shared/ui/components/Accordion";

export function FaqsSection({
  items,
  contactLabel = "Still have a question? Contact us.",
}: {
  items: FaqItem[];
  contactLabel?: string;
}) {
  return (
    <section aria-labelledby="faqs-heading" className="px-4 py-16 md:py-24">
      <div className="mx-auto w-full max-w-3xl">
        <h2
          id="faqs-heading"
          className="font-pixel-square mb-10 text-center text-4xl font-bold md:mb-12 md:text-5xl"
        >
          FAQs
        </h2>

        <Accordion type="single" collapsible className="rounded-xl border">
          {items.map((item) => (
            <AccordionItem
              key={item.id}
              value={item.id}
              className="px-5 last:border-b-0 md:px-6"
            >
              <AccordionTrigger className="gap-6 py-5 text-left text-base font-medium hover:no-underline focus-visible:underline focus-visible:ring-0 md:text-lg">
                {item.question}
              </AccordionTrigger>
              <AccordionContent className="text-muted-foreground pb-5 text-sm leading-6 md:text-base">
                {item.answer}
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>

        <p className="text-muted-foreground mt-6 text-center text-sm md:text-base">
          {contactLabel}{" "}
          <Link
            href="mailto:support@reacherx.com"
            className="text-foreground underline-offset-4 hover:underline"
          >
            support@reacherx.com
          </Link>
        </p>
      </div>
    </section>
  );
}
