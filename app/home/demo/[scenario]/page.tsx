import { notFound } from "next/navigation";
import type { Metadata } from "next";
import {
  isBlogDemoId,
  BLOG_DEMO_IDS,
} from "@/features/blog/lib/blogDemoHelpers";
import { BlogDemoApp } from "@/features/blog/ui/components/app-demo/BlogDemoApp";
export const metadata: Metadata = {
  title: "ReacherX demo",
  robots: { index: false, follow: false },
};
export function generateStaticParams() {
  return BLOG_DEMO_IDS.map((scenario) => ({ scenario }));
}
export default async function DemoPage({
  params,
}: {
  params: Promise<{ scenario: string }>;
}) {
  const { scenario } = await params;
  if (!isBlogDemoId(scenario)) notFound();
  return <BlogDemoApp key={scenario} scenario={scenario} />;
}
