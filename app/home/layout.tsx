// app/home/layout.tsx
import type { Metadata } from "next";
import { Header } from "@/features/landing/ui/components/Header";
import { Footer } from "@/features/landing/ui/components/Footer";
import { Toaster } from "@/shared/ui/components/Toaster";
import { LandingAutoPlayProvider } from "@/features/landing/ui/components/LandingAutoPlayProvider";

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
      <LandingAutoPlayProvider>
        <main>{children}</main>
      </LandingAutoPlayProvider>
      <Toaster />
      <Footer />
    </div>
  );
}
