import { Suspense, type ReactNode } from "react";
import { AppEntry } from "../runtime/AppEntry";
import { geistSans, geistMono, geistPixelSquare } from "@/app/fonts";
import "./experiment.css";
import MediaChromeYTTemplate from "@/shared/ui/components/MediaChromeYTTemplate";

export const metadata = {
  title: "ReacherX interactive demo",
  robots: { index: false, follow: false },
};

export default function Layout({ children }: { children: ReactNode }) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} ${geistPixelSquare.variable}`}
      suppressHydrationWarning
    >
      <body>
        <MediaChromeYTTemplate />
        <Suspense fallback={null}>
          <AppEntry>{children}</AppEntry>
        </Suspense>
      </body>
    </html>
  );
}
