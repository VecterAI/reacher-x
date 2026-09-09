"use client";

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/shared/ui/components/Accordion";
import { cn } from "@/shared/lib/utils";
import type { BlogHeading } from "../../lib/blogHelpers";
import { useBlogActiveHeading } from "../../hooks/useBlogActiveHeading";

export function BlogTableOfContents({ headings }: { headings: BlogHeading[] }) {
  const activeId = useBlogActiveHeading(headings);
  if (headings.length < 2) return null;
  const links = (
    <ol className="border-border border-l">
      {headings.map((heading) => (
        <li key={heading.id}>
          <a
            href={`#${heading.id}`}
            aria-current={activeId === heading.id ? "location" : undefined}
            className={cn(
              "text-muted-foreground hover:text-foreground focus-visible:outline-ring -ml-px block border-l border-transparent py-2 pl-3 text-sm leading-5 focus-visible:outline-2 focus-visible:outline-offset-2",
              heading.depth === 3 && "pl-6",
              activeId === heading.id &&
                "border-foreground text-foreground font-medium"
            )}
          >
            {heading.text}
          </a>
        </li>
      ))}
    </ol>
  );
  return (
    <>
      <nav aria-label="On this page" className="mb-8 xl:hidden">
        <Accordion type="single" collapsible>
          <AccordionItem value="contents">
            <AccordionTrigger>On this page</AccordionTrigger>
            <AccordionContent>{links}</AccordionContent>
          </AccordionItem>
        </Accordion>
      </nav>
      <aside className="absolute top-0 left-full hidden h-full pl-12 xl:block">
        <nav
          aria-label="On this page"
          className="sticky top-28 max-h-[calc(100dvh-8rem)] w-48 overflow-y-auto"
        >
          <p className="mb-4 text-sm font-medium">On this page</p>
          {links}
        </nav>
      </aside>
    </>
  );
}
