// app/home/layout.tsx
import type { Metadata } from "next";
import { Suspense } from "react";
import { Header } from "@/features/landing/ui/components/Header";
import { Footer } from "@/features/landing/ui/components/Footer";

import { LandingAutoPlayProvider } from "@/features/landing/ui/components/LandingAutoPlayProvider";
import { APP_NAME } from "@/shared/lib/metadata";

export const metadata: Metadata = {
  title: APP_NAME,
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
