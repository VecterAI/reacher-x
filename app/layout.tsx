// app/layout.tsx
import type { Metadata } from "next";
import Script from "next/script";
import { ConvexClientProvider } from "./ConvexClientProvider";
import { PostHogProvider } from "./home/PostHogProvider";
import { ThemeProvider } from "@/shared/ui/components/ThemeProvider";
import { Toaster } from "@/shared/ui/components/Sonner";
import MediaChromeYTTemplate from "@/shared/ui/components/MediaChromeYTTemplate";
import { inter, dmMono } from "./fonts";
import "./globals.css";
import { NuqsAdapter } from "nuqs/adapters/next/app";

export const metadata: Metadata = {
  title: {
    default: "ReacherX",
    template: "%s | ReacherX",
  },
  description: "AI search engine to find potential customers on the web.",
  icons: {
    icon: "/favicon.ico",
  },
};

const themeInitScript = `
(function(){
  try {
    var storageKey = 'theme';
    var mql = window.matchMedia('(prefers-color-scheme: dark)');
    var stored = localStorage.getItem(storageKey);
    var theme = stored ? stored.replace('"','').replace('"','') : 'system';
    var resolved = theme === 'dark' || (theme === 'system' && mql.matches) ? 'dark' : 'light';
    var root = document.documentElement;
    root.classList.remove('light','dark');
    root.classList.add(resolved);
    root.style.colorScheme = resolved;
  } catch (e) {}
})();
`.trim();

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link
          rel="preconnect"
          href="https://8xibu2ksfzfcma9o.public.blob.vercel-storage.com"
          crossOrigin="anonymous"
        />
        <link
          rel="dns-prefetch"
          href="https://8xibu2ksfzfcma9o.public.blob.vercel-storage.com"
        />
        <Script id="theme-init" strategy="beforeInteractive">
          {themeInitScript}
        </Script>
      </head>
      <body
        suppressHydrationWarning
        className={`${inter.variable} ${dmMono.variable} antialiased`}
      >
        <PostHogProvider>
          <ConvexClientProvider>
            <ThemeProvider
              attribute="class"
              defaultTheme="system"
              enableSystem
              disableTransitionOnChange
            >
              <NuqsAdapter>
                <MediaChromeYTTemplate />
                {children}
                <Toaster />
              </NuqsAdapter>
            </ThemeProvider>
          </ConvexClientProvider>
        </PostHogProvider>
      </body>
    </html>
  );
}
