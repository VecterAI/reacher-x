import { notFound, redirect } from "next/navigation";
import type { Metadata } from "next";
import {
  isBlogDemoId,
  BLOG_DEMO_IDS,
} from "@/features/blog/lib/blogDemoHelpers";
import { getBlogDemoUrl } from "@/features/blog/lib/blogDemoUrl";
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
  redirect(getBlogDemoUrl(scenario));
}
