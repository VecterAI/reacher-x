import { Badge } from "@/shared/ui/components/Badge";
import { WaitlistUsers } from "@/features/landing/ui/components/WaitlistUsers";
import { WaitlistDrawer } from "@/features/landing/ui/components/WaitlistDrawer";

// const mockTweets = [
//   {
//     tweet_created_at: "2025-03-04T18:27:13.000000Z",
//     id: 1896990833385292157,
//     id_str: "1896990833385292157",
//     conversation_id_str: "1896990833385292157",
//     text: null,
//     full_text:
//       "5+ Features that could make T3 Chat even better.\n\n@theo I have been using the T3 Chat, and I have some ideas that could make it even better. So, I made a video breaking them down. Let’s discuss. 🧵 https://t.co/vshXdwJEaF",
//     source:
//       '<a href="http://twitter.com/download/android" rel="nofollow">Twitter for Android</a>',
//     truncated: false,
//     in_reply_to_status_id: null,
//     in_reply_to_status_id_str: null,
//     in_reply_to_user_id: null,
//     in_reply_to_user_id_str: null,
//     in_reply_to_screen_name: null,
//     user: {
//       id: 1743216568451125248,
//       id_str: "1743216568451125248",
//       name: "ReacherX founder",
//       screen_name: "ReacherXfounder",
//       location: "Vice City",
//       url: null,
//       description:
//         "↳ Building ReacherX, A search engine—to find customers. DM for early access.",
//       protected: false,
//       verified: true,
//       followers_count: 136,
//       friends_count: 504,
//       listed_count: 4,
//       favourites_count: 803,
//       statuses_count: 558,
//       created_at: "2024-01-05T10:23:41.000000Z",
//       profile_banner_url:
//         "https://pbs.twimg.com/profile_banners/1743216568451125248/1715349496",
//       profile_image_url_https:
//         "https://pbs.twimg.com/profile_images/1769118183061848064/bOqqwNMn_normal.jpg",
//       can_dm: true,
//     },
//     quoted_status_id: null,
//     quoted_status_id_str: null,
//     is_quote_status: false,
//     quoted_status: null,
//     retweeted_status: null,
//     quote_count: 0,
//     reply_count: 1,
//     retweet_count: 0,
//     favorite_count: 0,
//     views_count: 41,
//     bookmark_count: 0,
//     lang: "en",
//     entities: {
//       media: [
//         {
//           display_url: "pic.x.com/vshXdwJEaF",
//           expanded_url:
//             "https://x.com/ReacherXfounder/status/1896990833385292157/video/1",
//           id_str: "1896990560742682624",
//           indices: [197, 220],
//           media_key: "7_1896990560742682624",
//           media_url_https:
//             "https://pbs.twimg.com/ext_tw_video_thumb/1896990560742682624/pu/img/mgmRVUrVN9w5RIt4.jpg",
//           type: "video",
//           url: "https://t.co/vshXdwJEaF",
//           additional_media_info: {
//             monetizable: false,
//           },
//           ext_media_availability: {
//             status: "Available",
//           },
//           sizes: {
//             large: {
//               h: 720,
//               w: 1280,
//               resize: "fit",
//             },
//             medium: {
//               h: 675,
//               w: 1200,
//               resize: "fit",
//             },
//             small: {
//               h: 383,
//               w: 680,
//               resize: "fit",
//             },
//             thumb: {
//               h: 150,
//               w: 150,
//               resize: "crop",
//             },
//           },
//           original_info: {
//             height: 720,
//             width: 1280,
//             focus_rects: [],
//           },
//           video_info: {
//             aspect_ratio: [16, 9],
//             duration_millis: 300332,
//             variants: [
//               {
//                 content_type: "application/x-mpegURL",
//                 url: "https://video.twimg.com/ext_tw_video/1896990560742682624/pu/pl/QLy9BWQJu14aSiKh.m3u8?tag=12",
//               },
//               {
//                 bitrate: 256000,
//                 content_type: "video/mp4",
//                 url: "https://video.twimg.com/ext_tw_video/1896990560742682624/pu/vid/avc1/480x270/1LU4IvnO8OWqxVXm.mp4?tag=12",
//               },
//               {
//                 bitrate: 832000,
//                 content_type: "video/mp4",
//                 url: "https://video.twimg.com/ext_tw_video/1896990560742682624/pu/vid/avc1/640x360/S8bVVWuy8l3F865n.mp4?tag=12",
//               },
//               {
//                 bitrate: 2176000,
//                 content_type: "video/mp4",
//                 url: "https://video.twimg.com/ext_tw_video/1896990560742682624/pu/vid/avc1/1280x720/pQq0914MnQExXpum.mp4?tag=12",
//               },
//             ],
//           },
//         },
//         {
//           display_url: "pic.x.com/vshXdwJEaF",
//           expanded_url:
//             "https://x.com/ReacherXfounder/status/1896990833385292157/video/1",
//           id_str: "1896990560742682624",
//           indices: [197, 220],
//           media_key: "7_1896990560742682624",
//           media_url_https:
//             "https://pbs.twimg.com/ext_tw_video_thumb/1896990560742682624/pu/img/mgmRVUrVN9w5RIt4.jpg",
//           type: "video",
//           url: "https://t.co/vshXdwJEaF",
//           additional_media_info: {
//             monetizable: false,
//           },
//           ext_media_availability: {
//             status: "Available",
//           },
//           sizes: {
//             large: {
//               h: 720,
//               w: 1280,
//               resize: "fit",
//             },
//             medium: {
//               h: 675,
//               w: 1200,
//               resize: "fit",
//             },
//             small: {
//               h: 383,
//               w: 680,
//               resize: "fit",
//             },
//             thumb: {
//               h: 150,
//               w: 150,
//               resize: "crop",
//             },
//           },
//           original_info: {
//             height: 720,
//             width: 1280,
//             focus_rects: [],
//           },
//           video_info: {
//             aspect_ratio: [16, 9],
//             duration_millis: 300332,
//             variants: [
//               {
//                 content_type: "application/x-mpegURL",
//                 url: "https://video.twimg.com/ext_tw_video/1896990560742682624/pu/pl/QLy9BWQJu14aSiKh.m3u8?tag=12",
//               },
//               {
//                 bitrate: 256000,
//                 content_type: "video/mp4",
//                 url: "https://video.twimg.com/ext_tw_video/1896990560742682624/pu/vid/avc1/480x270/1LU4IvnO8OWqxVXm.mp4?tag=12",
//               },
//               {
//                 bitrate: 832000,
//                 content_type: "video/mp4",
//                 url: "https://video.twimg.com/ext_tw_video/1896990560742682624/pu/vid/avc1/640x360/S8bVVWuy8l3F865n.mp4?tag=12",
//               },
//               {
//                 bitrate: 2176000,
//                 content_type: "video/mp4",
//                 url: "https://video.twimg.com/ext_tw_video/1896990560742682624/pu/vid/avc1/1280x720/pQq0914MnQExXpum.mp4?tag=12",
//               },
//             ],
//           },
//         },
//       ],
//       user_mentions: [
//         {
//           id_str: "786375418685165568",
//           name: "Theo - t3.gg",
//           screen_name: "theo",
//           indices: [50, 55],
//         },
//       ],
//       urls: [],
//       hashtags: [],
//       symbols: [],
//     },
//     is_pinned: false,
//   },
//   {
//     tweet_created_at: "2025-03-04T18:29:42.000000Z",
//     id: 1896991457283858915,
//     id_str: "1896991457283858915",
//     conversation_id_str: "1896990833385292157",
//     text: null,
//     full_text:
//       "↳ 4. Light/Dark Mode (Vercel V0 style).\n\nI love minimal, sharp black &amp; white interfaces. A well-designed Light/Dark Mode would make T3 Chat feel polished and modern. Right now it's lagging behind in terms of UI and polish. https://t.co/MSS3VFzCnh",
//     source: "",
//     truncated: false,
//     in_reply_to_status_id: 1896991427034513806,
//     in_reply_to_status_id_str: "1896991427034513806",
//     in_reply_to_user_id: 1743216568451125248,
//     in_reply_to_user_id_str: "1743216568451125248",
//     in_reply_to_screen_name: "ReacherXfounder",
//     user: {
//       id: 1743216568451125248,
//       id_str: "1743216568451125248",
//       name: "ReacherX founder",
//       screen_name: "ReacherXfounder",
//       location: "Vice City",
//       url: null,
//       description:
//         "↳ Building ReacherX, A search engine—to find customers. DM for early access.",
//       protected: false,
//       verified: true,
//       followers_count: 136,
//       friends_count: 504,
//       listed_count: 0,
//       favourites_count: 803,
//       statuses_count: 558,
//       created_at: "2024-01-05T10:23:41.000000Z",
//       profile_banner_url:
//         "https://pbs.twimg.com/profile_banners/1743216568451125248/1715349496",
//       profile_image_url_https:
//         "https://pbs.twimg.com/profile_images/1769118183061848064/bOqqwNMn_normal.jpg",
//       can_dm: true,
//     },
//     quoted_status_id: null,
//     quoted_status_id_str: null,
//     is_quote_status: false,
//     quoted_status: null,
//     retweeted_status: null,
//     quote_count: 0,
//     reply_count: 1,
//     retweet_count: 0,
//     favorite_count: 0,
//     views_count: 22,
//     bookmark_count: 0,
//     lang: "en",
//     entities: {
//       hashtags: [],
//       symbols: [],
//       timestamps: [],
//       urls: [],
//       user_mentions: [],
//       media: [
//         {
//           display_url: "pic.x.com/MSS3VFzCnh",
//           expanded_url:
//             "https://x.com/ReacherXfounder/status/1896991457283858915/photo/1",
//           ext_alt_text: "T3 Chat user interface with black background.",
//           ext_media_availability: {
//             status: "Available",
//           },
//           features: {
//             large: {
//               faces: [],
//             },
//           },
//           id_str: "1896991450446897152",
//           indices: [227, 250],
//           media_key: "3_1896991450446897152",
//           media_url_https: "https://pbs.twimg.com/media/GlN3rGnXIAAgG_q.jpg",
//           original_info: {
//             focus_rects: [
//               {
//                 h: 2464,
//                 w: 4400,
//                 x: 0,
//                 y: 11,
//               },
//               {
//                 h: 2475,
//                 w: 2475,
//                 x: 963,
//                 y: 0,
//               },
//               {
//                 h: 2475,
//                 w: 2171,
//                 x: 1115,
//                 y: 0,
//               },
//               {
//                 h: 2475,
//                 w: 1238,
//                 x: 1581,
//                 y: 0,
//               },
//               {
//                 h: 2475,
//                 w: 4400,
//                 x: 0,
//                 y: 0,
//               },
//             ],
//             height: 2475,
//             width: 4400,
//           },
//           sizes: {
//             large: {
//               h: 1152,
//               w: 2048,
//             },
//           },
//           type: "photo",
//           url: "https://t.co/MSS3VFzCnh",
//         },
//       ],
//     },
//     is_pinned: false,
//   },
// ];

export default function Home() {
  return (
    <div className="space-y-12 px-4 py-6 md:space-y-48 md:px-28 md:pb-52 md:pt-12">
      <section id="hero" aria-labelledby="hero-heading">
        <Badge variant="outline">✶&nbsp;&nbsp;Launching March/April 2025</Badge>
        <hgroup className="mt-4 max-w-2xl space-y-4">
          <h1 id="hero-heading" className="text-4xl font-medium md:text-5xl">
            A search engine—to find customers.
          </h1>
          <p>Join the wait-list for early access and updates!</p>
        </hgroup>

        <WaitlistDrawer />

        <WaitlistUsers className="mt-6 md:mt-12" />
      </section>

      {/* <section
        id="vision"
        aria-labelledby="vision-heading"
        className="space-y-6 md:space-y-12"
      >
        <h2 id="vision-heading" className="text-3xl font-medium">
          Vision.
        </h2>
        <TweetCard
          size="lg"
          className="px-0"
          idStr={mockTweets[0].id_str}
          name={mockTweets[0].user.name}
          screenName={mockTweets[0].user.screen_name}
          profileImageUrlHttps={mockTweets[0].user.profile_image_url_https}
          verified={mockTweets[0].user.verified}
          tweetCreatedAt={mockTweets[0].tweet_created_at}
          fullText={mockTweets[0].full_text || ""}
          replyCount={mockTweets[0].reply_count}
          favoriteCount={mockTweets[0].favorite_count}
          bookmarkCount={mockTweets[0].bookmark_count}
          viewsCount={mockTweets[0].views_count}
          retweetCount={mockTweets[0].retweet_count}
          entities={mockTweets[0].entities}
          media={mockTweets[0].entities?.media || []}
        />
      </section> */}

      {/* <section aria-label="Key value props" className="mb-16 space-y-4 text-lg">
        <div className="text-5xl font-medium md:text-6xl">
          No upfront payments.
          <br />
          No hidden customers.
          <br />
          No waiting—just results!
        </div>
      </section> */}

      {/* <section
        id="recent-thread"
        aria-labelledby="recent-thread-heading"
        className="space-y-6 md:space-y-12"
      >
        <div className="flex items-center justify-between">
          <h2 id="recent-thread-heading" className="text-3xl font-medium">
            Recent thread.
          </h2>
          <Link
            href="/threads"
            className="text-sm font-medium text-primary underline-offset-4 hover:underline"
          >
            View all
          </Link>
        </div>
        <TweetCard
          size="lg"
          className="px-0"
          idStr={mockTweets[0].id_str}
          name={mockTweets[0].user.name}
          screenName={mockTweets[0].user.screen_name}
          profileImageUrlHttps={mockTweets[0].user.profile_image_url_https}
          verified={mockTweets[0].user.verified}
          tweetCreatedAt={mockTweets[0].tweet_created_at}
          fullText={mockTweets[0].full_text || ""}
          replyCount={mockTweets[0].reply_count}
          favoriteCount={mockTweets[0].favorite_count}
          bookmarkCount={mockTweets[0].bookmark_count}
          viewsCount={mockTweets[0].views_count}
          retweetCount={mockTweets[0].retweet_count}
          media={mockTweets[0].entities?.media || []}
        />
      </section> */}

      {/* <section id="join-waitlist" aria-labelledby="waitlist-heading">
        <h2 id="waitlist-heading" className="text-3xl font-medium">
          Join over 50 people already on the wait-list!
        </h2>

        <WaitlistDrawer />

        <WaitlistUsers className="mt-6 md:mt-12" />
      </section> */}
    </div>
  );
}
