// app/home/layout.tsx
import type { Metadata } from "next";
import { Suspense } from "react";
import { Header } from "@/features/landing/ui/components/Header";
import { Footer } from "@/features/landing/ui/components/Footer";

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
      <Suspense fallback={null}>
        <Header />
      </Suspense>
      <Suspense fallback={null}>
        <LandingAutoPlayProvider>
          <main>{children}</main>
        </LandingAutoPlayProvider>
      </Suspense>
      <Suspense fallback={null}>
        <Footer />
      </Suspense>
    </div>
  );
}
