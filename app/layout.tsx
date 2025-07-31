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
