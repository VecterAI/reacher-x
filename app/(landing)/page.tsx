import { Badge } from "@/shared/ui/components/Badge";
import { RecentThreads } from "@/features/landing/ui/components/RecentThreads";
import Link from "next/link";
import { WaitlistSection } from "@/features/landing/ui/components/WaitlistSection";
import { getRecentThreads } from "@/lib/getRecentThreads";
import { PictureCarousel } from "@/features/landing/ui/components/PictureCarousel";
import { WaitlistFormWrapper } from "@/features/landing/ui/components/WaitlistFormWrapper";
import { WaitlistUsers } from "@/features/landing/ui/components/WaitlistUsers";

export const metadata = {
  title: "ReacherX",
  description:
    "The search engine—to find customers. Join the wait-list for early access and updates!",
  openGraph: {
    title: "🆁 ReacherX",
    description:
      "The search engine—to find customers. Join the wait-list for early access and updates!",
    images: ["/og-default.jpg"],
    url: "https://reacherx.com",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "🆁 ReacherX",
    description:
      "The search engine—to find customers. Join the wait-list for early access and updates!",
    images: ["/og-default.jpg"],
  },
};

export default async function Home() {
  const recentThreads = await getRecentThreads(5);
  const applicationImages = [
    {
      mobileSrc: "/reacherx-home-mobile-(waitlist).webp",
      desktopSrc: "/reacherx-home-dekstop-(waitlist).webp",
      alt: "ReacherX Home",
    },
    {
      mobileSrc: "/reacherx-search-mobile-(waitlist).webp",
      desktopSrc: "/reacherx-search-dekstop-(waitlist).webp",
      alt: "ReacherX Search",
    },
  ];

  return (
    <div>
      <section
        id="hero"
        aria-labelledby="hero-heading"
        className="ease-[cubic-bezier(0.25, 1, 0.5, 1)] px-4 pb-6 pt-6 duration-300 md:px-28 md:pb-52 md:pt-12"
      >
        <Badge variant="outline">
          Beta release · June 2025{" "}
          <span className="rotating-symbol">&nbsp;&nbsp;⧖&nbsp;&nbsp;</span>{" "}
          (worth the wait)
        </Badge>
        <hgroup className="mt-4 max-w-2xl space-y-4">
          <h1 id="hero-heading" className="text-4xl font-medium md:text-5xl">
            The search engine—to find customers.
          </h1>
          <WaitlistUsers className="mt-4" />
          <p>Join the wait-list for early access and updates!</p>
        </hgroup>
        <WaitlistFormWrapper className="mt-4 max-w-md" />
      </section>

      <section className="px-4 pb-6 duration-300 md:px-28 md:pb-52">
        <PictureCarousel images={applicationImages} />
      </section>

      <section
        id="recent-thread"
        aria-labelledby="recent-thread-heading"
        className="ease-[cubic-bezier(0.25, 1, 0.5, 1)] space-y-0 duration-300 @container md:space-y-12"
      >
        <div className="ease-[cubic-bezier(0.25, 1, 0.5, 1)] flex items-center justify-between px-4 duration-300 md:px-28">
          <h2
            id="recent-thread-heading"
            className="text-2xl font-medium md:text-3xl"
          >
            Recent threads.
          </h2>
          <Link
            href="/threads"
            className="text-sm font-medium text-primary underline-offset-4 hover:underline"
          >
            View all
          </Link>
        </div>
        <RecentThreads
          className="ease-[cubic-bezier(0.25, 1, 0.5, 1)] px-0 duration-300 md:px-28"
          threads={recentThreads}
          size="lg"
          bordered={true}
        />
      </section>
      <WaitlistSection />
    </div>
  );
}
