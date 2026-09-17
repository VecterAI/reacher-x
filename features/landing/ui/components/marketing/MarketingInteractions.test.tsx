// @vitest-environment node
import { renderToStaticMarkup } from "react-dom/server";
import { expect, test } from "vitest";
import { FaqsAccordion } from "../sections/FaqsAccordion";
import { homepageFaqItems, pricingFaqItems } from "@/features/landing/lib/faqs";

test.each([{ items: homepageFaqItems }, { items: pricingFaqItems }])(
  "all FAQ answers are available without JavaScript",
  ({ items }) => {
    const html = renderToStaticMarkup(<FaqsAccordion items={items} />);
    expect((html.match(/<details /g) ?? []).length).toBe(items.length);
    for (const item of items) {
      const answer = renderToStaticMarkup(<p>{item.answer}</p>).slice(3, -4);
      expect(html).toContain(answer);
    }
    expect(html).not.toContain("<button");
    expect(html).toContain('name="marketing-faq"');
  }
);
