import type { ReactNode } from "react";
import "@/features/blog/ui/blog.css";

export default function BlogLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <a
        href="#blog-content"
        className="bg-background sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-50 focus:p-3"
      >
        Skip to blog content
      </a>
      <div id="blog-content" tabIndex={-1}>
        {children}
      </div>
    </>
  );
}
