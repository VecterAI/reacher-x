import { Suspense, type ReactNode } from "react";
import { AppEntry } from "../runtime/AppEntry";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import "./experiment.css";

export const metadata = {
  title: "ReacherX interactive demo",
  robots: { index: false, follow: false },
};

export default function Layout({ children }: { children: ReactNode }) {
  return (
    <html
      lang="en"
      className={`${GeistSans.variable} ${GeistMono.variable}`}
      suppressHydrationWarning
    >
      <body>
        <Suspense fallback={null}>
          <AppEntry>{children}</AppEntry>
        </Suspense>
      </body>
    </html>
  );
}
