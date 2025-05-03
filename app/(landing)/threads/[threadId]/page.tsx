// app/(landing)/threads/[threadId]/page.tsx
import { ConvexHttpClient } from "convex/browser";
import { api } from "@/convex/_generated/api";
import { TweetCard } from "@/features/landing/ui/components/TweetCard";
import { UserProfileCard } from "@/features/landing/ui/components/UserProfileCard";
import { Separator } from "@/shared/ui/components/Separator";
import { WaitlistUsers } from "@/features/landing/ui/components/WaitlistUsers";
import { Badge } from "@/shared/ui/components/Badge";
import { RecentThreads } from "@/features/landing/ui/components/RecentThreads";
import { Thread } from "../types";
import Link from "next/link";
import { WaitlistSection } from "@/features/landing/ui/components/WaitlistSection";
import { getRecentThreads } from "@/lib/getRecentThreads";
import { WaitlistFormWrapper } from "@/features/landing/ui/components/WaitlistFormWrapper";

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL || "");

export async function generateMetadata({
  params,
}: {
  params: Promise<{ threadId: string }>;
}) {
  const { threadId } = await params; // Await the params Promise
  const thread = (await convex.query(api.socialdata.getThreadById, {
    threadId,
  })) as Thread | null;

  if (!thread) {
    return {
      title: "Thread Not Found",
      description: "This thread could not be found.",
    };
  }

  const firstTweet = thread.tweets[0];
  const ogImage =
    firstTweet?.entities?.media?.[0]?.media_url_https || "/og-default.jpg";
  const title = `Thread by @${firstTweet?.user?.screen_name || "unknown"}`;
  const description = firstTweet?.full_text?.slice(0, 160);

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      images: [ogImage],
      url: `https://reacherx.com/threads/${threadId}`,
      type: "article",
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [ogImage],
    },
  };
}

export default async function ThreadDetailPage(props: {
  params: Promise<{ threadId: string }>;
}) {
  const params = await props.params;
  const { threadId } = params;
  const recentThreads = await getRecentThreads(4);
  const filteredRecentThreads = recentThreads
    .filter((thread) => thread.threadId !== threadId)
    .slice(0, 3);

  // Fetch thread data and thread IDs on the server
  const thread = (await convex.query(api.socialdata.getThreadById, {
    threadId,
  })) as Thread | null;
  const threadIds = (await convex.query(
    api.socialdata.getThreadIds
  )) as string[];

  // Handle thread not found
  if (!thread) {
    return <div>Thread not found</div>;
  }

  // Compute thread number
  const index = threadIds.indexOf(threadId);
  const threadNumber = index !== -1 ? threadIds.length - index : null;

  const tweets = thread.tweets;
  const user = tweets[0].user;

  return (
    <div className="ease-[cubic-bezier(0.25, 1, 0.5, 1)] mt-6 duration-300 md:mt-12">
      <Link
        href="/threads"
        className="ease-[cubic-bezier(0.25, 1, 0.5, 1)] ml-4 block w-fit duration-300 md:ml-28"
      >
        <h1 className="ease-[cubic-bezier(0.25, 1, 0.5, 1)] text-3xl font-medium duration-300 md:text-5xl">
          <span className="ease-[cubic-bezier(0.25, 1, 0.5, 1)] inline-block rotate-180 transform-gpu duration-300 hover:translate-x-1">
            ➞
          </span>{" "}
          Thread #{threadNumber !== null ? threadNumber : ""}
        </h1>
      </Link>
      <div className="ease-[cubic-bezier(0.25, 1, 0.5, 1)] mt-6 grid grid-cols-1 gap-6 duration-300 md:mt-12 md:grid-cols-[calc(66.47%-1.5rem)_calc(33.53%-1.5rem)] md:gap-12 md:px-28">
        <section className="ease-[cubic-bezier(0.25, 1, 0.5, 1)] px-4 duration-300 @container md:px-0">
          {tweets.map((tweet, index) => (
            <TweetCard
              className="pt-2"
              key={tweet.id_str}
              threadId={threadId}
              staticTweet={tweet}
              size="lg"
              showFullContent={true}
              showThread={index === tweets.length - 1}
            />
          ))}
        </section>

        <aside className="space-y-6">
          <Separator orientation="horizontal" className="block md:hidden" />
          <section
            aria-labelledby="hero-heading"
            className="ease-[cubic-bezier(0.25, 1, 0.5, 1)] px-4 duration-300 md:px-0"
          >
            <Badge variant="outline">
              Beta release · June 2025{" "}
              <span className="rotating-symbol">&nbsp;&nbsp;⧖&nbsp;&nbsp;</span>{" "}
              (worth the wait)
            </Badge>
            <hgroup className="mt-4 max-w-2xl space-y-4">
              <h2 id="hero-heading" className="text-3xl font-medium">
                The search engine—to find customers.
              </h2>
              <WaitlistUsers className="mt-4" />
              <p>Join the wait-list for early access and updates!</p>
            </hgroup>
            <WaitlistFormWrapper className="mt-4" />
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
          <Separator orientation="horizontal" />
          <section>
            <h3 className="ease-[cubic-bezier(0.25, 1, 0.5, 1)] px-4 text-2xl font-medium duration-300 md:px-0">
              Recent threads.
            </h3>
            <RecentThreads bordered={true} threads={filteredRecentThreads} />
          </section>
        </aside>
      </div>
      <WaitlistSection />
    </div>
  );
}
