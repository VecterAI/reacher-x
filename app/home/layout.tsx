// app/home/layout.tsx
import type { Metadata } from "next";
import { Header } from "@/features/landing/ui/components/Header";
import { Footer } from "@/features/landing/ui/components/Footer";
import { Toaster } from "@/shared/ui/components/Toaster";

export const metadata: Metadata = {
  title: "ReacherX",
  description: "The search engine—to find customers.",
};

export default function LandingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div>
      <Header />
      <main>{children}</main>
      <Toaster />
      <Footer />
    </div>
  );
}
