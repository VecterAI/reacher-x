"use client";

import { useDemoVisibility } from "@/features/blog/ui/components/app-demo/useDemoVisibility";
import { BlogAppDemo } from "@/features/blog/ui/components/app-demo/BlogAppDemo";
import type { BlogDemoId } from "@/features/blog/lib/blogDemoHelpers";
import "./marketing-demo.css";

/** Reuse the blog timeline with the full-size marketing presentation. */
export function MarketingDemo(props: {
  scenario: BlogDemoId;
  title: string;
  caption: string;
}) {
  const { root, mounted } = useDemoVisibility();
  return (
    <section
      ref={root}
      className="marketing-demo-viewport"
      aria-label={props.title}
    >
      {mounted && (
        <BlogAppDemo {...props} presentation="fixed" loading="eager" />
      )}
    </section>
  );
}
