// app/(landing)/threads/page.tsx
import { ConvexHttpClient } from "convex/browser";
import { api } from "@/convex/_generated/api";
import Link from "next/link";
import { TweetCard } from "@/features/landing/ui/components/TweetCard";
import { Badge } from "@/shared/ui/components/Badge";
import { WaitlistDrawer } from "@/features/landing/ui/components/WaitlistDrawer";
import { Separator } from "@/shared/ui/components/Separator";
import { WaitlistUsers } from "@/features/landing/ui/components/WaitlistUsers";
import { Thread } from "@/app/(landing)/threads/types";
import { LinkWrapper } from "@/features/landing/ui/components/LinkWrapper";
import { UserProfileCard } from "@/features/landing/ui/components/UserProfileCard";
import { WaitlistSection } from "@/features/landing/ui/components/WaitlistSection";

export const metadata = {
  title: "Threads",
  description: "Browse recent threads to stay updated on ReacherX.",
  openGraph: {
    title: "🆁 | Threads",
    description: "Browse recent threads to stay updated on ReacherX.",
    images: ["/og-default.jpg"],
    url: "https://reacherx.com/threads",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "🆁 | Threads",
    description: "Browse recent threads to stay updated on ReacherX.",
    images: ["/og-default.jpg"],
  },
};

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL || "");

export default async function ThreadsPage() {
  let staticThreads: Thread[] = [];
  try {
    staticThreads = (await convex.query(
      api.socialdata.getStaticThreads
    )) as Thread[];
  } catch (error) {
    console.error("Error fetching threads:", error);
  }

  const firstThread = staticThreads[0];
  const user = firstThread.tweets[0].user;

  return (
    <div className="ease-[cubic-bezier(0.25, 1, 0.5, 1)] mt-6 duration-300 md:mt-12">
      <Link href="/" className="ml-4 block w-fit md:ml-28">
        <h1 className="text-3xl font-medium md:text-5xl">
          <span className="ease-[cubic-bezier(0.25, 1, 0.5, 1)] inline-block rotate-180 transform-gpu duration-300 hover:translate-x-1">
            ➞
          </span>{" "}
          Threads.
        </h1>
      </Link>
      <div className="ease-[cubic-bezier(0.25, 1, 0.5, 1)] mt-6 grid grid-cols-1 gap-6 duration-300 md:mt-12 md:grid-cols-[calc(66.47%-1.5rem)_calc(33.53%-1.5rem)] md:gap-12 md:px-28">
        <section className="ease-[cubic-bezier(0.25, 1, 0.5, 1)] duration-300 @container">
          {staticThreads.length === 0 ? (
            <p className="mt-4 px-4 text-muted-foreground md:px-0">
              No threads available yet.
            </p>
          ) : (
            staticThreads.map((thread) => (
              <LinkWrapper
                href={`/threads/${thread.threadId}`}
                key={thread.threadId}
              >
                <TweetCard
                  className="px-4 py-4 md:px-0 md:py-6"
                  threadId={thread.threadId}
                  staticTweet={thread.tweets[0]}
                  size="lg"
                  bordered={true}
                  showThread={false}
                />
              </LinkWrapper>
            ))
          )}
        </section>

        <aside className="space-y-6">
          <section
            aria-labelledby="hero-heading"
            className="ease-[cubic-bezier(0.25, 1, 0.5, 1)] px-4 duration-300 md:px-0"
          >
            <Badge variant="outline">Beta release · April 2025</Badge>
            <hgroup className="mt-4 max-w-2xl space-y-4">
              <h2 id="hero-heading" className="text-3xl font-medium">
                The search engine—to find customers.
              </h2>
              <p>Join the wait-list for early access and updates!</p>
            </hgroup>
            <WaitlistDrawer />
            <WaitlistUsers className="mt-6 md:mt-12" />
          </section>
          <Separator orientation="horizontal" />
          <section className="px-4 md:px-0">
            <h3 className="text-2xl font-medium">Author.</h3>
            <UserProfileCard
              className="mt-4"
              profileImageUrlHttps={user?.profile_image_url_https}
              name={user?.name}
              screenName={user?.screen_name}
              verified={user?.verified}
              description={user?.description}
              followersCount={user?.followers_count}
              friendsCount={user?.friends_count}
              url={user?.url}
            />
          </section>
          <Separator orientation="horizontal" className="block md:hidden" />
        </aside>
      </div>
      <WaitlistSection />
    </div>
  );
}
