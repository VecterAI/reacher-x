import twitter from "twitter-text";
import { Badge } from "@/shared/ui/components/Badge";
import { Button } from "@/shared/ui/components/Button";
import { PostCard } from "@/features/landing/ui/components/PostCard";
import { WaitlistMarquee } from "@/features/landing/ui/components/WaitlistUsersMarquee";

// Mock data that you might fetch from a DB/API
const mockThreads = [
  {
    id: "1",
    detailHref: "/threads/1",
    avatarUrl: "https://avatars.githubusercontent.com/u/85483006?v=4",
    thread: true,
    displayName: "ReacherX founder",
    username: "ReacherXfounder",
    dateTime: "2023-03-01T00:00:00.000Z",
    body: `1/4

    Hey, aspiring web developers! Web development is the art of building websites and web applications.  It involves everything from creating simple static pages to complex interactive platforms.
    
    Want to learn more? Check out this awesome guide by @freeCodeCamp https://www.freecodecamp.org/learn/
    
    #webdev #coding`,
    replies: "2000",
    likes: "50000",
    bookmarks: "32",
    impressions: "1000000",
    reposts: "200000",
    pro: true,
  },
  {
    id: "2",
    detailHref: "/threads/1",
    avatarUrl: "https://avatars.githubusercontent.com/u/85483006?v=4",
    thread: false,
    displayName: "ReacherX founder",
    username: "ReacherXfounder",
    dateTime: "2023-03-02T00:00:00.000Z",
    replyingTo: "ReacherXfounder",
    body: `2/4

    So, you want to be a web developer? Awesome! Here are some essential skills you'll need:

    Explore different learning paths on @Codecademy https://www.codecademy.com/
    
    #webdevelopment #programming`,
    replies: "200",
    likes: "58",
    bookmarks: "136",
    impressions: "10",
    reposts: "20",
    pro: true,
  },
];

// This page.tsx is a Server Component by default, so we can parse on the server.
export default function Home() {
  // 1) Parse all bodies on the server
  const threadsWithParsedHtml = mockThreads.map((thread) => {
    // Escape any dangerous HTML in user input, then auto-link
    const escaped = twitter.htmlEscape(thread.body || "");
    const parsedBody = twitter.autoLink(escaped, {
      hashtagUrlBase: "https://x.com/hashtag/",
      // Replace mentionUrlBase with usernameUrlBase
      usernameUrlBase: "https://x.com/",
      usernameIncludeSymbol: true,
      targetBlank: true,
    });

    // Return a new object with the auto-linked HTML stored in parsedBody
    return {
      ...thread,
      parsedBody,
    };
  });

  // const mockUserProfile = {
  //   avatarUrl: "https://avatars.githubusercontent.com/u/85483006?v=4",
  //   displayName: "ReacherX founder",
  //   username: "ReacherXfounder",
  //   pro: true,
  //   bio: "Spreading positivity and good vibes! | Follow my bestie @AmazingFriend | #BeKind #LoveLife | Check out my blog: https://www.exampleblog.com 💻",
  //   link: "https://reacherx.com",
  //   followers: 96378,
  //   following: 876,
  // };

  // // 1) Escape any potential HTML in the bio
  // const escapedBio = twitter.htmlEscape(mockUserProfile.bio ?? "");

  // // 2) Auto-link mentions, hashtags, and URLs using the same config as PostCard
  // const parsedBio = twitter.autoLink(escapedBio, {
  //   hashtagUrlBase: "https://x.com/hashtag/",
  //   usernameUrlBase: "https://x.com/",
  //   usernameIncludeSymbol: true,
  //   targetBlank: true,
  // });

  const mockWaitlistUsers = [
    {
      avatarUrl: "https://avatars.githubusercontent.com/u/85483006?v=4",
      displayName: "ReacherX founder",
      username: "ReacherXfounder",
      pro: true,
    },
    {
      avatarUrl: "https://avatars.githubusercontent.com/u/85483006?v=4",
      displayName: "John Doe",
      username: "JohnDoe",
      pro: false,
    },
    {
      avatarUrl: "https://avatars.githubusercontent.com/u/85483006?v=4",
      displayName: "Alex Costa",
      username: "AlexC",
      pro: true,
    },
    {
      avatarUrl: "https://avatars.githubusercontent.com/u/85483006?v=4",
      displayName: "Mike Dane",
      username: "MikeDane",
      pro: true,
    },
    {
      avatarUrl: "https://avatars.githubusercontent.com/u/85483006?v=4",
      displayName: "Anonymous Fanboy",
      username: "anonymousAAAA",
      pro: true,
    },
    {
      avatarUrl: "https://avatars.githubusercontent.com/u/85483006?v=4",
      displayName: "Anonymous Fanboy",
      username: "anonymousAAAA",
      pro: true,
    },{
      avatarUrl: "https://avatars.githubusercontent.com/u/85483006?v=4",
      displayName: "Anonymous Fanboy",
      username: "anonymousAAAA",
      pro: true,
    },{
      avatarUrl: "https://avatars.githubusercontent.com/u/85483006?v=4",
      displayName: "Anonymous Fanboy",
      username: "anonymousAAAA",
      pro: true,
    },
  ];

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 lg:px-8 lg:py-16">
      <section
        id="hero"
        aria-labelledby="hero-heading"
        className="mb-16 space-y-4"
      >
        <Badge variant="outline" className="text-sm">
          ✶ Launching March/April 2025
        </Badge>

        <h1 id="hero-heading" className="text-3xl font-bold md:text-4xl">
          A search engine—to find customers.
        </h1>

        <p className="text-lg text-muted-foreground">
          Join our wait-list for early access and updates!
        </p>

        <Button size="lg">Join wait-list</Button>

        <div className="mt-6">
          <WaitlistMarquee users={mockWaitlistUsers} />
        </div>
      </section>

      <section
        id="vision"
        aria-labelledby="vision-heading"
        className="mb-16 space-y-4"
      >
        <h2 id="vision-heading" className="text-2xl font-semibold md:text-3xl">
          Vision.
        </h2>
        <PostCard {...threadsWithParsedHtml[0]} />
      </section>

      <section aria-label="Key value props" className="mb-16 space-y-4 text-lg">
        <div>
          No upfront payments.
          <br />
          No hidden customers.
          <br />
          No waiting—just results!
        </div>
      </section>

      <section
        id="recent-thread"
        aria-labelledby="recent-thread-heading"
        className="mb-16 space-y-4"
      >
        <div className="flex items-center justify-between">
          <h2 id="recent-thread-heading" className="text-2xl font-semibold">
            Recent thread
          </h2>
          <Button variant="link" className="text-sm">
            View all
          </Button>
        </div>
        <PostCard {...threadsWithParsedHtml[0]} />
      </section>

      <section
        id="join-waitlist"
        aria-labelledby="waitlist-heading"
        className="space-y-4"
      >
        <h2
          id="waitlist-heading"
          className="text-2xl font-semibold md:text-3xl"
        >
          Join over 50 people already on the wait-list!
        </h2>
        <Button size="lg">Join wait-list</Button>

        <div className="mt-6">
          <WaitlistMarquee users={mockWaitlistUsers} />
        </div>
      </section>
    </div>
  );
}
