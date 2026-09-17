import type { FaqItem } from "@/features/landing/lib/faqs";
import { KeyboardArrowDownIcon } from "@/shared/ui/components/icons";

/** Native disclosure keeps answers in the HTML and works without hydration. */
export function FaqsAccordion({
  items,
  className,
}: {
  items: FaqItem[];
  className?: string;
}) {
  return (
    <div className={className}>
      {items.map((item) => (
        <details
          key={item.id}
          name="marketing-faq"
          data-slot="faq-item"
          className="group border-b last:border-b-0"
        >
          <summary className="cursor-pointer list-none py-5 text-left focus-visible:underline [&::-webkit-details-marker]:hidden">
            <h3 className="flex items-center justify-between gap-6 text-base font-medium md:text-lg">
              {item.question}
              <KeyboardArrowDownIcon
                aria-hidden="true"
                className="size-4 shrink-0 fill-current transition-transform group-open:rotate-180 motion-reduce:transition-none"
              />
            </h3>
          </summary>
          <p className="text-muted-foreground pb-5 text-sm leading-6 md:text-base">
            {item.answer}
          </p>
        </details>
      ))}
    </div>
  );
}
