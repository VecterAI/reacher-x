// app/layout.tsx
import { AuthKitProvider } from "@workos-inc/authkit-nextjs/components";
import { ConvexClientProvider } from "./ConvexClientProvider";
import { PostHogProvider } from "./home/PostHogProvider";
import { ThemeProvider } from "@/shared/ui/components/ThemeProvider";
import { dmSans, dmMono } from "./fonts";
import "./globals.css";

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={`${dmSans.variable} ${dmMono.variable} antialiased`}>
        <script
          id="__theme-initializer"
          dangerouslySetInnerHTML={{
            __html: `
;(function(){
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
            `.trim(),
          }}
        />
        <AuthKitProvider>
          <PostHogProvider>
            <ConvexClientProvider>
              <ThemeProvider
                attribute="class"
                defaultTheme="system"
                enableSystem
                disableTransitionOnChange
              >
                {children}
              </ThemeProvider>
            </ConvexClientProvider>
          </PostHogProvider>
        </AuthKitProvider>
      </body>
    </html>
  );
}
