import type { FaqItem } from "@/features/landing/lib/faqs";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/shared/ui/components/Accordion";

export function FaqsAccordion({
  items,
  className,
}: {
  items: FaqItem[];
  className?: string;
}) {
  return (
    <Accordion type="single" collapsible className={className}>
      {items.map((item) => (
        <AccordionItem
          key={item.id}
          value={item.id}
          data-slot="faq-item"
          className="last:border-b-0"
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
  );
}
