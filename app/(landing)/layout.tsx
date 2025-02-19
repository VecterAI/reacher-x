import type { Metadata } from "next";
import { DM_Sans, DM_Mono } from "next/font/google";
import { Header } from "@/features/landing/ui/components/Header";
import { Footer } from "@/features/landing/ui/components/Footer";
import { ThemeProvider } from "@/shared/ui/components/ThemeProvider";
import { Toaster } from "@/shared/ui/components/Toaster";
import "../globals.css";
import ConvexClientProvider from "./ConvexClientProvider";

const dmSans = DM_Sans({
  weight: ["400", "500", "600"],
  subsets: ["latin"],
  variable: "--font-dm-sans",
  display: "swap",
});

const dmMono = DM_Mono({
  weight: ["400", "500"],
  subsets: ["latin"],
  variable: "--font-dm-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "ReacherX",
  description: "A search engine—to find customers.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={`${dmSans.variable} ${dmMono.variable} antialiased`}>
        <ConvexClientProvider>
          <ThemeProvider
            attribute="class"
            defaultTheme="system"
            enableSystem
            disableTransitionOnChange
          >
            <Header />
            <main>{children}</main>
            <Toaster />
            <Footer />
          </ThemeProvider>
        </ConvexClientProvider>
      </body>
    </html>
  );
}
