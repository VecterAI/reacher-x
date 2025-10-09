import { Badge } from "@/shared/ui/components/Badge";
import { RecentThreads } from "@/features/threads/ui/components/RecentThreads";
// import Link from "next/link";
// removed unused imports related to waitlist sections for lean markup
import { getRecentThreads } from "@/features/threads/lib/getRecentThreads";
// import { PictureCarousel } from "@/features/landing/ui/components/PictureCarousel";
// import { WaitlistFormWrapper } from "@/features/waitlist/ui/components/WaitlistFormWrapper";
// import { WaitlistUsers } from "@/features/waitlist/ui/components/WaitlistUsers";
import Link from "next/link";
import { buttonVariants } from "@/shared/ui/components/Button";

import { FigureVideo } from "@/features/landing/ui/components/FigureVideo";

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

  return (
    <div className="mx-auto w-full max-w-[1288px]">
      <section
        id="hero"
        aria-labelledby="hero-heading"
        className="ease-[cubic-bezier(0.25, 1, 0.5, 1)] grid grid-cols-1 gap-y-4 px-4 pb-12 duration-300 @container md:grid-cols-8 md:gap-x-12 md:pb-56 portrait:md:grid-cols-1"
      >
        <div className="col-span-12 self-end lg:mb-12 portrait:md:col-span-12 landscape:md:col-span-3">
          <Badge variant="outline">v3.0 beta</Badge>
          <hgroup className="mt-4 space-y-2">
            <h1 id="hero-heading" className="text-4xl font-medium md:text-5xl">
              The search engine—to find customers on X/Twitter.
            </h1>
            <p className="text-base font-medium text-muted-foreground md:text-2xl">
              ReacherX finds people who need your{" "}
              <span className="text-foreground">next big thing</span> right now.
              This is{" "}
              <span className="text-foreground">faster and cheaper</span> than
              ads to reach your audience.
            </p>
          </hgroup>
          <Link
            href="/onboarding"
            className={`${buttonVariants({ variant: "default" })} mt-4`}
          >
            Start finding customers
          </Link>
          <br />
          <small className="mt-2 block text-sm text-muted-foreground">
            <span className="font-medium text-foreground">One year free</span>{" "}
            for first{" "}
            <span className="font-mono font-medium text-foreground">100</span>{" "}
            users.
          </small>
        </div>
        <FigureVideo
          mp4Url="https://8xibu2ksfzfcma9o.public.blob.vercel-storage.com/landing/videos/mp4/product-demo/app-demo/reacher-x-v3-app-demo-1-oOUz7R06yhbxY4mtKIwv8NkjK73DkT.mp4"
          ariaLabel="ReacherX video"
          figureClassName="order-last col-span-12 aspect-[1/1] md:order-none portrait:md:col-span-12 landscape:md:col-span-5"
          className="aspect-[1/1] h-full w-full rounded-none"
        />
      </section>
      <section
        aria-labelledby="who-is-it-for-heading"
        className="ease-[cubic-bezier(0.25, 1, 0.5, 1)] grid grid-cols-1 gap-y-4 px-4 pb-12 duration-300 @container md:grid-cols-8 md:gap-x-12 md:pb-56 portrait:md:grid-cols-1"
      >
        <FigureVideo
          mp4Url="https://nmx18xidmv.ufs.sh/f/uF4FhwZJse4NaVuAA63rRHc8WV3PvTh1GiXQdbIY06BofFej"
          ariaLabel="ReacherX video"
          figureClassName="order-last col-span-12 aspect-[1/1] md:order-none portrait:md:col-span-12 landscape:md:col-span-5"
          className="aspect-[1/1] h-full w-full rounded-none"
        />
        <div className="col-span-12 self-end lg:mb-12 portrait:md:col-span-12 landscape:md:col-span-3">
          <hgroup className="mt-4 space-y-2">
            <h2
              id="who-is-it-for-heading"
              className="text-2xl font-medium md:text-3xl"
            >
              Who is it for?
            </h2>
            <p className="text-base font-medium text-muted-foreground md:text-2xl">
              People who want to{" "}
              <span className="text-foreground">make a difference</span> with
              their products or services. People who{" "}
              <span className="text-foreground">
                don&apos;t want to waste money
              </span>{" "}
              on ads.
            </p>
          </hgroup>
          <Link
            href="/onboarding"
            className={`${buttonVariants({ variant: "outline" })} mt-4`}
          >
            Start finding customers
          </Link>
        </div>
      </section>
      <section
        aria-labelledby="keyword-suggestions-heading"
        className="ease-[cubic-bezier(0.25, 1, 0.5, 1)] grid grid-cols-1 gap-y-4 px-4 pb-12 duration-300 @container md:grid-cols-8 md:gap-x-12 md:pb-56 portrait:md:grid-cols-1"
      >
        <div className="col-span-12 self-end lg:mb-12 portrait:md:col-span-12 landscape:md:col-span-3">
          <hgroup className="mt-4 space-y-2">
            <h2
              id="keyword-suggestions-heading"
              className="text-2xl font-medium md:text-3xl"
            >
              Keyword suggestions.
            </h2>
            <p className="text-base font-medium text-muted-foreground md:text-2xl">
              Describe what you offer and who might need it today. Based on
              this, you get{" "}
              <span className="text-foreground">keyword suggestions</span> to
              find people.
            </p>
          </hgroup>
          <Link
            href="/onboarding"
            className={`${buttonVariants({ variant: "outline" })} mt-4`}
          >
            Start finding customers
          </Link>
        </div>
        <FigureVideo
          mp4Url="https://8xibu2ksfzfcma9o.public.blob.vercel-storage.com/landing/videos/mp4/product-demo/feature-demo/keyword-suggestions-feature-demo-k51iMQ4CDLgWgeB7JJlxPf3COwpHPB.mp4"
          ariaLabel="ReacherX video"
          figureClassName="order-last col-span-12 aspect-[1/1] md:order-none portrait:md:col-span-12 landscape:md:col-span-5"
          className="aspect-[1/1] h-full w-full rounded-none"
        />
      </section>
      <section
        aria-labelledby="exact-phrase-match-heading"
        className="ease-[cubic-bezier(0.25, 1, 0.5, 1)] grid grid-cols-1 gap-y-4 px-4 pb-12 duration-300 @container md:grid-cols-8 md:gap-x-12 md:pb-56 portrait:md:grid-cols-1"
      >
        <FigureVideo
          mp4Url="https://8xibu2ksfzfcma9o.public.blob.vercel-storage.com/landing/videos/mp4/product-demo/feature-demo/toggle-exact-match-feature-demo-b1JpiYfmfQLjvnkfx17Qsmev8Pw1hS.mp4"
          ariaLabel="ReacherX video"
          figureClassName="order-last col-span-12 aspect-[1/1] md:order-none portrait:md:col-span-12 landscape:md:col-span-5"
          className="aspect-[1/1] h-full w-full rounded-none"
        />
        <div className="col-span-12 self-end lg:mb-12 portrait:md:col-span-12 landscape:md:col-span-3">
          <hgroup className="mt-4 space-y-2">
            <h2
              id="exact-phrase-match-heading"
              className="text-2xl font-medium md:text-3xl"
            >
              Search with Exact Phrase Match.
            </h2>
            <p className="text-base font-medium text-muted-foreground md:text-2xl">
              Toggle{" "}
              <span className="text-foreground">Exact Phrase Match ON</span> for
              precise, targeted results. Toggle it{" "}
              <span className="text-foreground">OFF</span> for broader results
              and more opportunities.
            </p>
          </hgroup>
          <Link
            href="/onboarding"
            className={`${buttonVariants({ variant: "outline" })} mt-4`}
          >
            Start finding customers
          </Link>
        </div>
      </section>
      <section
        aria-labelledby="reach-out-to-customers-heading"
        className="ease-[cubic-bezier(0.25, 1, 0.5, 1)] grid grid-cols-1 gap-y-4 px-4 pb-12 duration-300 @container md:grid-cols-8 md:gap-x-12 md:pb-56 portrait:md:grid-cols-1"
      >
        <div className="col-span-12 self-end lg:mb-12 portrait:md:col-span-12 landscape:md:col-span-3">
          <hgroup className="mt-4 space-y-2">
            <h2
              id="reach-out-to-customers-heading"
              className="text-2xl font-medium md:text-3xl"
            >
              Reach out to customers.
            </h2>
            <p className="text-base font-medium text-muted-foreground md:text-2xl">
              Reply{" "}
              <span className="text-foreground">directly with ReacherX</span> to
              reach people fast and offer solutions. Keep replying while earlier
              replies are sending
              <span className="text-foreground">—no need to wait</span>.
            </p>
          </hgroup>
          <Link
            href="/onboarding"
            className={`${buttonVariants({ variant: "outline" })} mt-4`}
          >
            Start finding customers
          </Link>
        </div>
        <FigureVideo
          mp4Url="https://8xibu2ksfzfcma9o.public.blob.vercel-storage.com/landing/videos/mp4/product-demo/feature-demo/reply-posting-feature-demo-v0h7ZWWxEq4KAc6I2k9iBzYiArNnfZ.mp4"
          ariaLabel="ReacherX video"
          figureClassName="order-last col-span-12 aspect-[1/1] md:order-none portrait:md:col-span-12 landscape:md:col-span-5 md:mt-0"
          className="aspect-[1/1] h-full w-full rounded-none"
        />
      </section>
      <section
        aria-labelledby="manage-workspace-heading"
        className="ease-[cubic-bezier(0.25, 1, 0.5, 1)] grid grid-cols-1 gap-y-4 px-4 pb-12 duration-300 @container md:grid-cols-8 md:gap-x-12 md:pb-56 portrait:md:grid-cols-1"
      >
        <FigureVideo
          mp4Url="https://8xibu2ksfzfcma9o.public.blob.vercel-storage.com/landing/videos/mp4/product-demo/feature-demo/workspace-feature-demo-6zbrkuC4TPsDWt22ggVHeBc0eiOgnu.mp4"
          ariaLabel="ReacherX video"
          figureClassName="order-last col-span-12 aspect-[1/1] md:order-none portrait:md:col-span-12 landscape:md:col-span-5"
          className="aspect-[1/1] h-full w-full rounded-none"
        />
        <div className="col-span-12 self-end lg:mb-12 portrait:md:col-span-12 landscape:md:col-span-3">
          <hgroup className="mt-4 space-y-2">
            <h2
              id="manage-workspace-heading"
              className="text-2xl font-medium md:text-3xl"
            >
              Manage workspace.
            </h2>
            <p className="text-base font-medium text-muted-foreground md:text-2xl">
              Organize your search for{" "}
              <span className="text-foreground">
                different products or services
              </span>{" "}
              you offer. You can have{" "}
              <span className="text-foreground">one workspace now</span> with
              more coming soon.
            </p>
          </hgroup>
          <Link
            href="/onboarding"
            className={`${buttonVariants({ variant: "outline" })} mt-4`}
          >
            Start finding customers
          </Link>
        </div>
      </section>
      <section
        aria-labelledby="more-features-heading"
        className="ease-[cubic-bezier(0.25, 1, 0.5, 1)] grid grid-cols-1 gap-12 px-4 pb-12 duration-300 @container md:pb-56 lg:grid-cols-3 portrait:md:grid-cols-1 landscape:md:grid-cols-2 landscape:lg:grid-cols-3"
      >
        <h2 id="more-features-heading" className="sr-only">
          More features
        </h2>
        <div className="md:flex md:flex-col">
          <div className="order-1 mt-0 md:order-2 md:mt-4">
            <hgroup className="space-y-2">
              <h2
                id="pin-best-keywords-heading"
                className="text-2xl font-medium md:text-3xl"
              >
                Pin best keywords.
              </h2>
              <p className="text-base font-medium text-muted-foreground">
                Pin any keyword that finds the{" "}
                <span className="text-foreground">best results</span> for you.
                Reuse pinned keywords to discover more people who{" "}
                <span className="text-foreground">need what you have.</span>
              </p>
            </hgroup>
            <Link
              href="/onboarding"
              className={`${buttonVariants({ variant: "outline" })} mt-4`}
            >
              Start finding customers
            </Link>
          </div>
          <FigureVideo
            mp4Url="https://8xibu2ksfzfcma9o.public.blob.vercel-storage.com/landing/videos/mp4/product-demo/feature-demo/pin-keywords-feature-demo-bXq10rLRW7poKl9LN8cVyTEP1u4RYr.mp4"
            ariaLabel="ReacherX video"
            figureClassName="order-2 md:order-1 mt-4 aspect-[1/1] md:mt-0"
            className="aspect-[1/1] h-full w-full rounded-none"
          />
        </div>
        <div className="md:flex md:flex-col">
          <div className="order-1 mt-0 md:order-2 md:mt-4">
            <hgroup className="space-y-2">
              <h2
                id="filter-and-sort-results-heading"
                className="text-2xl font-medium md:text-3xl"
              >
                Filter and sort results.
              </h2>
              <p className="text-base font-medium text-muted-foreground">
                Choose what to see:{" "}
                <span className="text-foreground">
                  Posts, Replies, or Quotes
                </span>{" "}
                with advance filters. Sort results{" "}
                <span className="text-foreground">different ways</span> to find
                people faster.
              </p>
            </hgroup>
            <Link
              href="/onboarding"
              className={`${buttonVariants({ variant: "outline" })} mt-4`}
            >
              Start finding customers
            </Link>
          </div>
          <FigureVideo
            mp4Url="https://8xibu2ksfzfcma9o.public.blob.vercel-storage.com/landing/videos/mp4/product-demo/feature-demo/filter-and-sort-feature-demo-18BbUQ377iALNRb3pOVOgee1Tbz8YM.mp4"
            ariaLabel="ReacherX video"
            figureClassName="order-2 md:order-1 mt-4 aspect-[1/1] md:mt-0"
            className="aspect-[1/1] h-full w-full rounded-none"
          />
        </div>
        <div className="md:flex md:flex-col">
          <div className="order-1 mt-0 md:order-2 md:mt-4">
            <hgroup className="space-y-2">
              <h2
                id="upvote-and-downvote-results-heading"
                className="text-2xl font-medium md:text-3xl"
              >
                Upvote and downvote results.
              </h2>
              <p className="text-base font-medium text-muted-foreground">
                Thumbs up <span className="text-foreground">good results</span>{" "}
                to teach the system what works for you. Thumbs down{" "}
                <span className="text-foreground">bad ones</span> to get better
                suggestions.
              </p>
            </hgroup>
            <Link
              href="/onboarding"
              className={`${buttonVariants({ variant: "outline" })} mt-4`}
            >
              Start finding customers
            </Link>
          </div>
          <FigureVideo
            mp4Url="https://8xibu2ksfzfcma9o.public.blob.vercel-storage.com/landing/videos/mp4/product-demo/feature-demo/upvote-downvote-feature-demo-xot8rCiPgoPbCAnXQKeWIYXhtuND4G.mp4"
            ariaLabel="ReacherX video"
            figureClassName="order-2 md:order-1 mt-4 aspect-[1/1] md:mt-0"
            className="aspect-[1/1] h-full w-full rounded-none"
          />
        </div>
      </section>
      <section className="ease-[cubic-bezier(0.25, 1, 0.5, 1)] space-y-0 px-0 pb-12 duration-300 @container md:space-y-12 md:px-4 md:pb-56">
        <div className="flex items-center justify-between px-4 md:px-0">
          <h2 className="text-2xl font-medium md:text-3xl">Recent threads.</h2>
          <Link
            href="/home/threads"
            className={buttonVariants({ variant: "link" })}
          >
            View all
          </Link>
        </div>
        <RecentThreads threads={recentThreads} size="lg" />
      </section>
      {/* Grid section but with no figure video. */}
      <section className="ease-[cubic-bezier(0.25, 1, 0.5, 1)] grid grid-cols-1 gap-y-4 px-4 pb-12 duration-300 @container md:grid-cols-8 md:gap-x-12 portrait:md:grid-cols-1">
        <div className="col-span-12 self-end lg:mb-12 portrait:md:col-span-12 landscape:md:col-span-3">
          <h2 className="text-2xl font-medium text-muted-foreground md:text-3xl">
            Why hope for customers to find you when you can{" "}
            <span className="text-foreground">find them in seconds?</span>
          </h2>
          <Link
            href="/onboarding"
            className={`${buttonVariants({ variant: "default" })} mt-4`}
          >
            Start finding customers
          </Link>
          <br />
          <small className="mt-2 block text-sm text-muted-foreground">
            <span className="font-medium text-foreground">One year free</span>{" "}
            for first{" "}
            <span className="font-mono font-medium text-foreground">100</span>{" "}
            users.
          </small>
        </div>
      </section>
    </div>
  );
}
