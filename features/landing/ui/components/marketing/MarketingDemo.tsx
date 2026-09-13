import { BlogAppDemo } from "@/features/blog/ui/components/app-demo/BlogAppDemo";
import type { BlogDemoId } from "@/features/blog/lib/blogDemoHelpers";
import "./marketing-demo.css";

/** Reuse the blog's real interaction timeline with a stable desktop viewport. */
export function MarketingDemo(props: {
  scenario: BlogDemoId;
  title: string;
  caption: string;
}) {
  return <BlogAppDemo {...props} presentation="fixed" />;
}
