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

const metadataBase = (() => {
  try {
    return new URL(process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000");
  } catch {
    return new URL("http://localhost:3000");
  }
})();

export const metadata: Metadata = {
  metadataBase,
  title: {
    default: "ReacherX",
    template: "%s | ReacherX",
  },
  description: "AI search engine to find potential customers on the web.",
  icons: {
    icon: "/favicon.ico",
  },
};

/** Keep STORAGE_KEY in sync with `WORKSPACE_USE_CASE_STORAGE_KEY` in workspaceUseCaseCache.ts */
const workspaceUseCaseCookieSyncScript = `
(function(){
  try {
    var STORAGE_KEY = 'rx.workspaceUseCaseKey';
    var k = localStorage.getItem(STORAGE_KEY);
    if (!k) return;
    var maxAge = 60 * 60 * 24 * 400;
    var secure = location.protocol === 'https:';
    document.cookie = STORAGE_KEY + '=' + encodeURIComponent(k) + ';path=/;max-age=' + maxAge + ';SameSite=Lax' + (secure ? ';Secure' : '');
  } catch (e) {}
})();
`.trim();

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
        <Script
          id="workspace-use-case-cookie-sync"
          strategy="beforeInteractive"
        >
          {workspaceUseCaseCookieSyncScript}
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
