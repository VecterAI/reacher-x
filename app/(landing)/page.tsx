import twitter from "twitter-text";
import { ThreadCard } from "@/features/landing/ui/components/ThreadCard";

// Mock data that you might fetch from a DB/API
const mockThreads = [
  {
    id: "1",
    detailHref: "/threads/1",
    displayName: "John Smith",
    username: "johnsmith",
    dateTime: "2025-01-22T13:00:00Z",
    body: "Hello world! Check out #NextJS and @twitter for more info: https://nextjs.org",
    repliesCount: "2",
  },
  {
    id: "2",
    detailHref: "/threads/2",
    displayName: "Jane Doe",
    username: "janedoe",
    dateTime: "2025-01-23T14:30:00Z",
    body: "Another test tweet with #hashtags, mentions like @someone, and a link https://example.com or reacerx.com",
    likesCount: "5",
  },
];

// This page.tsx is a Server Component by default, so we can parse on the server.
export default function Home() {
  // 1) Parse all bodies on the server
  const threadsWithParsedHtml = mockThreads.map((thread) => {
    // Escape any dangerous HTML in user input, then auto-link
    const escaped = twitter.htmlEscape(thread.body || "");
    const parsedBody = twitter.autoLink(escaped, {
      hashtagUrlBase: "https://twitter.com/hashtag/",
      mentionUrlBase: "https://twitter.com/",
      usernameIncludeSymbol: true,
      targetBlank: true,
    });

    // Return a new object with the auto-linked HTML stored in parsedBody
    return {
      ...thread,
      parsedBody,
    };
  });

  // 2) Render the UI
  return (
    <main className="flex h-screen flex-wrap items-center justify-center gap-2">
      {threadsWithParsedHtml.map((thread) => (
        <ThreadCard key={thread.id} {...thread} />
      ))}
    </main>
  );
}
