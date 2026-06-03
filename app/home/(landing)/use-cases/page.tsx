import type { Metadata } from "next";
import { UseCasesDirectory } from "@/features/landing/ui/components/sections/UseCasesDirectory";

export const metadata: Metadata = {
  title: "Use Cases — ReacherX",
  description:
    "Customers, candidates, investors, partners, creators, community members, podcast guests, and more. One agent that adapts to who you need.",
  openGraph: {
    title: "Use Cases — ReacherX",
    description:
      "One agent that adapts to who you need. Customers, candidates, investors, partners, and more.",
    images: ["/og-default.jpg"],
    url: "https://reacherx.com/home/use-cases",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Use Cases — ReacherX",
    description:
      "One agent that adapts to who you need. Customers, candidates, investors, partners, and more.",
    images: ["/og-default.jpg"],
  },
};

export default function UseCasesPage() {
  return <UseCasesDirectory />;
}
