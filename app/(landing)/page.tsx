import twitter from "twitter-text";
import { Badge } from "@/shared/ui/components/Badge";
import { Button } from "@/shared/ui/components/Button";
import { PostCard } from "@/features/landing/ui/components/PostCard";
import { WaitlistUsersMarquee } from "@/features/landing/ui/components/WaitlistUsersMarquee";
import { WaitlistDrawer } from "@/features/landing/ui/components/WaitlistDrawer";
import PostMedia from "@/features/landing/ui/components/PostMedia";

// Mock data that you might fetch from a DB/API
const mockThreads = [
  {
    id: "1",
    detailHref: "/threads/1",
    avatarUrl: "https://avatars.githubusercontent.com/u/85483006?v=4",
    thread: false,
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
    },
    {
      avatarUrl: "https://avatars.githubusercontent.com/u/85483006?v=4",
      displayName: "John Doe",
      username: "JohnDoe",
      pro: false,
    },
    {
      avatarUrl: "https://avatars.githubusercontent.com/u/85483006?v=4",
      displayName: "John Doe",
      username: "JohnDoe",
      pro: false,
    },
    {
      avatarUrl: "https://avatars.githubusercontent.com/u/85483006?v=4",
      displayName: "John Doe",
      username: "JohnDoe",
      pro: false,
    },
  ];

  const mockTweets = [
    {
      tweet_created_at: "2025-01-30T00:00:08.000000Z",
      id: 1884753424463319430,
      id_str: "1884753424463319430",
      conversation_id_str: "1884753424463319430",
      text: null,
      full_text:
        "Overwhelmed trying to find customers on Twitter?_  ReacherX is my solution – it's like having a super-powered search engine just for finding *your* ideal clients_  It's amazing for gathering intel too_  Seriously, game-changer_ https://t.co/ofRJVKqcq5",
      source:
        '<a href="https://reacherx.com" rel="nofollow">1796575779846856706testing_use</a>',
      truncated: false,
      in_reply_to_status_id: null,
      in_reply_to_status_id_str: null,
      in_reply_to_user_id: null,
      in_reply_to_user_id_str: null,
      in_reply_to_screen_name: null,
      user: {
        id: 1677281259624730631,
        id_str: "1677281259624730631",
        name: "testing_demo",
        screen_name: "testing_userss",
        location: "",
        url: null,
        description: "",
        protected: false,
        verified: false,
        followers_count: 0,
        friends_count: 1,
        listed_count: 0,
        favourites_count: 1,
        statuses_count: 602,
        created_at: "2023-07-07T11:40:24.000000Z",
        profile_banner_url:
          "https://pbs.twimg.com/profile_banners/1677281259624730631/1735916012",
        profile_image_url_https:
          "https://pbs.twimg.com/profile_images/1875195279609077760/Kk8fGYn7_normal.jpg",
        can_dm: false,
      },
      quoted_status_id: null,
      quoted_status_id_str: null,
      is_quote_status: false,
      quoted_status: null,
      retweeted_status: null,
      quote_count: 0,
      reply_count: 0,
      retweet_count: 0,
      favorite_count: 0,
      views_count: 3,
      bookmark_count: 0,
      lang: "en",
      entities: {
        media: [
          {
            display_url: "pic.x.com/ofRJVKqcq5",
            expanded_url:
              "https://x.com/testing_userss/status/1884753424463319430/photo/1",
            id_str: "1884753418582999040",
            indices: [228, 251],
            media_key: "3_1884753418582999040",
            media_url_https: "https://pbs.twimg.com/media/Gif9P5PXwAAa2a1.jpg",
            type: "photo",
            url: "https://t.co/ofRJVKqcq5",
            ext_media_availability: {
              status: "Available",
            },
            features: {
              large: {
                faces: [],
              },
              medium: {
                faces: [],
              },
              small: {
                faces: [],
              },
              orig: {
                faces: [],
              },
            },
            sizes: {
              large: {
                h: 630,
                w: 1200,
                resize: "fit",
              },
              medium: {
                h: 630,
                w: 1200,
                resize: "fit",
              },
              small: {
                h: 357,
                w: 680,
                resize: "fit",
              },
              thumb: {
                h: 150,
                w: 150,
                resize: "crop",
              },
            },
            original_info: {
              height: 630,
              width: 1200,
              focus_rects: [
                {
                  x: 8,
                  y: 0,
                  w: 1125,
                  h: 630,
                },
                {
                  x: 255,
                  y: 0,
                  w: 630,
                  h: 630,
                },
                {
                  x: 294,
                  y: 0,
                  w: 553,
                  h: 630,
                },
                {
                  x: 413,
                  y: 0,
                  w: 315,
                  h: 630,
                },
                {
                  x: 0,
                  y: 0,
                  w: 1200,
                  h: 630,
                },
              ],
            },
          },
          {
            display_url: "pic.x.com/ofRJVKqcq5",
            expanded_url:
              "https://x.com/testing_userss/status/1884753424463319430/photo/1",
            id_str: "1884753418733887489",
            indices: [228, 251],
            media_key: "3_1884753418733887489",
            media_url_https: "https://pbs.twimg.com/media/Gif9P5zWIAEvOCP.png",
            type: "photo",
            url: "https://t.co/ofRJVKqcq5",
            ext_media_availability: {
              status: "Available",
            },
            features: {
              large: {
                faces: [
                  {
                    x: 163,
                    y: 256,
                    h: 641,
                    w: 641,
                  },
                ],
              },
              medium: {
                faces: [
                  {
                    x: 163,
                    y: 256,
                    h: 641,
                    w: 641,
                  },
                ],
              },
              small: {
                faces: [
                  {
                    x: 102,
                    y: 161,
                    h: 403,
                    w: 403,
                  },
                ],
              },
              orig: {
                faces: [
                  {
                    x: 163,
                    y: 256,
                    h: 641,
                    w: 641,
                  },
                ],
              },
            },
            sizes: {
              large: {
                h: 1080,
                w: 1080,
                resize: "fit",
              },
              medium: {
                h: 1080,
                w: 1080,
                resize: "fit",
              },
              small: {
                h: 680,
                w: 680,
                resize: "fit",
              },
              thumb: {
                h: 150,
                w: 150,
                resize: "crop",
              },
            },
            original_info: {
              height: 1080,
              width: 1080,
              focus_rects: [
                {
                  x: 0,
                  y: 211,
                  w: 1080,
                  h: 605,
                },
                {
                  x: 0,
                  y: 0,
                  w: 1080,
                  h: 1080,
                },
                {
                  x: 94,
                  y: 0,
                  w: 947,
                  h: 1080,
                },
                {
                  x: 297,
                  y: 0,
                  w: 540,
                  h: 1080,
                },
                {
                  x: 0,
                  y: 0,
                  w: 1080,
                  h: 1080,
                },
              ],
            },
          },
          {
            display_url: "pic.x.com/ofRJVKqcq5",
            expanded_url:
              "https://x.com/testing_userss/status/1884753424463319430/photo/1",
            id_str: "1884753418582999040",
            indices: [228, 251],
            media_key: "3_1884753418582999040",
            media_url_https: "https://pbs.twimg.com/media/Gif9P5PXwAAa2a1.jpg",
            type: "photo",
            url: "https://t.co/ofRJVKqcq5",
            ext_media_availability: {
              status: "Available",
            },
            features: {
              large: {
                faces: [],
              },
              medium: {
                faces: [],
              },
              small: {
                faces: [],
              },
              orig: {
                faces: [],
              },
            },
            sizes: {
              large: {
                h: 630,
                w: 1200,
                resize: "fit",
              },
              medium: {
                h: 630,
                w: 1200,
                resize: "fit",
              },
              small: {
                h: 357,
                w: 680,
                resize: "fit",
              },
              thumb: {
                h: 150,
                w: 150,
                resize: "crop",
              },
            },
            original_info: {
              height: 630,
              width: 1200,
              focus_rects: [
                {
                  x: 8,
                  y: 0,
                  w: 1125,
                  h: 630,
                },
                {
                  x: 255,
                  y: 0,
                  w: 630,
                  h: 630,
                },
                {
                  x: 294,
                  y: 0,
                  w: 553,
                  h: 630,
                },
                {
                  x: 413,
                  y: 0,
                  w: 315,
                  h: 630,
                },
                {
                  x: 0,
                  y: 0,
                  w: 1200,
                  h: 630,
                },
              ],
            },
          },
          {
            display_url: "pic.x.com/ofRJVKqcq5",
            expanded_url:
              "https://x.com/testing_userss/status/1884753424463319430/photo/1",
            id_str: "1884753418733887489",
            indices: [228, 251],
            media_key: "3_1884753418733887489",
            media_url_https: "https://pbs.twimg.com/media/Gif9P5zWIAEvOCP.png",
            type: "photo",
            url: "https://t.co/ofRJVKqcq5",
            ext_media_availability: {
              status: "Available",
            },
            features: {
              large: {
                faces: [
                  {
                    x: 163,
                    y: 256,
                    h: 641,
                    w: 641,
                  },
                ],
              },
              medium: {
                faces: [
                  {
                    x: 163,
                    y: 256,
                    h: 641,
                    w: 641,
                  },
                ],
              },
              small: {
                faces: [
                  {
                    x: 102,
                    y: 161,
                    h: 403,
                    w: 403,
                  },
                ],
              },
              orig: {
                faces: [
                  {
                    x: 163,
                    y: 256,
                    h: 641,
                    w: 641,
                  },
                ],
              },
            },
            sizes: {
              large: {
                h: 1080,
                w: 1080,
                resize: "fit",
              },
              medium: {
                h: 1080,
                w: 1080,
                resize: "fit",
              },
              small: {
                h: 680,
                w: 680,
                resize: "fit",
              },
              thumb: {
                h: 150,
                w: 150,
                resize: "crop",
              },
            },
            original_info: {
              height: 1080,
              width: 1080,
              focus_rects: [
                {
                  x: 0,
                  y: 211,
                  w: 1080,
                  h: 605,
                },
                {
                  x: 0,
                  y: 0,
                  w: 1080,
                  h: 1080,
                },
                {
                  x: 94,
                  y: 0,
                  w: 947,
                  h: 1080,
                },
                {
                  x: 297,
                  y: 0,
                  w: 540,
                  h: 1080,
                },
                {
                  x: 0,
                  y: 0,
                  w: 1080,
                  h: 1080,
                },
              ],
            },
          },
        ],
        user_mentions: [],
        urls: [],
        hashtags: [],
        symbols: [],
      },
      is_pinned: false,
    },
    {
      tweet_created_at: "2025-01-17T23:11:52.000000Z",
      id: 1880392624126791962,
      id_str: "1880392624126791962",
      conversation_id_str: "1880392624126791962",
      text: null,
      full_text:
        "↳ How often do you design applications with loading states in mind?\n\nLoading states aren't just fillers—they’re a part of the experience.\n\nI’ve created a Figma prototype that focuses on seamless loading experiences.\n\nLet me know your thoughts!\n\n#buildinpublic #Designers \n\n• Design post—01",
      source:
        '<a href="http://twitter.com/download/android" rel="nofollow">Twitter for Android</a>',
      truncated: false,
      in_reply_to_status_id: null,
      in_reply_to_status_id_str: null,
      in_reply_to_user_id: null,
      in_reply_to_user_id_str: null,
      in_reply_to_screen_name: null,
      user: {
        id: 1743216568451125248,
        id_str: "1743216568451125248",
        name: "ReacherX founder",
        screen_name: "ReacherXfounder",
        location: "Vice City",
        url: "http://reacherx.com",
        description:
          "Building ReacherX, A search engine—to find customers. DM me for early access.",
        protected: false,
        verified: true,
        followers_count: 122,
        friends_count: 403,
        listed_count: 3,
        favourites_count: 777,
        statuses_count: 514,
        created_at: "2024-01-05T10:23:41.000000Z",
        profile_banner_url:
          "https://pbs.twimg.com/profile_banners/1743216568451125248/1715349496",
        profile_image_url_https:
          "https://pbs.twimg.com/profile_images/1769118183061848064/bOqqwNMn_normal.jpg",
        can_dm: true,
      },
      quoted_status_id: null,
      quoted_status_id_str: null,
      is_quote_status: false,
      quoted_status: null,
      retweeted_status: null,
      quote_count: 0,
      reply_count: 0,
      retweet_count: 0,
      favorite_count: 2,
      views_count: 88,
      bookmark_count: 0,
      lang: "en",
      entities: {
        media: [
          {
            display_url: "pic.x.com/wua2Q7pXNP",
            expanded_url:
              "https://x.com/ReacherXfounder/status/1880392624126791962/video/1",
            id_str: "1880392542413291520",
            indices: [275, 298],
            media_key: "7_1880392542413291520",
            media_url_https:
              "https://pbs.twimg.com/ext_tw_video_thumb/1880392542413291520/pu/img/I9CdHjKxWrmayUjM.jpg",
            type: "video",
            url: "https://t.co/wua2Q7pXNP",
            additional_media_info: {
              monetizable: false,
            },
            ext_media_availability: {
              status: "Available",
            },
            sizes: {
              large: {
                h: 966,
                w: 1914,
                resize: "fit",
              },
              medium: {
                h: 606,
                w: 1200,
                resize: "fit",
              },
              small: {
                h: 343,
                w: 680,
                resize: "fit",
              },
              thumb: {
                h: 150,
                w: 150,
                resize: "crop",
              },
            },
            original_info: {
              height: 966,
              width: 1914,
              focus_rects: [],
            },
            video_info: {
              aspect_ratio: [319, 161],
              duration_millis: 45137,
              variants: [
                {
                  content_type: "application/x-mpegURL",
                  url: "https://video.twimg.com/ext_tw_video/1880392542413291520/pu/pl/KxltpAS29UKjDKXc.m3u8?tag=12",
                },
                {
                  bitrate: 256000,
                  content_type: "video/mp4",
                  url: "https://video.twimg.com/ext_tw_video/1880392542413291520/pu/vid/avc1/534x270/bxtesY189X5a85dJ.mp4?tag=12",
                },
                {
                  bitrate: 832000,
                  content_type: "video/mp4",
                  url: "https://video.twimg.com/ext_tw_video/1880392542413291520/pu/vid/avc1/712x360/V1aL8TA8YePOnXsp.mp4?tag=12",
                },
                {
                  bitrate: 2176000,
                  content_type: "video/mp4",
                  url: "https://video.twimg.com/ext_tw_video/1880392542413291520/pu/vid/avc1/1426x720/D4ivNB1vwht-WdDs.mp4?tag=12",
                },
              ],
            },
          },
          {
            display_url: "pic.x.com/wua2Q7pXNP",
            expanded_url:
              "https://x.com/ReacherXfounder/status/1880392624126791962/video/1",
            id_str: "1880392542413291520",
            indices: [275, 298],
            media_key: "7_1880392542413291520",
            media_url_https:
              "https://pbs.twimg.com/ext_tw_video_thumb/1880392542413291520/pu/img/I9CdHjKxWrmayUjM.jpg",
            type: "video",
            url: "https://t.co/wua2Q7pXNP",
            additional_media_info: {
              monetizable: false,
            },
            ext_media_availability: {
              status: "Available",
            },
            sizes: {
              large: {
                h: 966,
                w: 1914,
                resize: "fit",
              },
              medium: {
                h: 606,
                w: 1200,
                resize: "fit",
              },
              small: {
                h: 343,
                w: 680,
                resize: "fit",
              },
              thumb: {
                h: 150,
                w: 150,
                resize: "crop",
              },
            },
            original_info: {
              height: 966,
              width: 1914,
              focus_rects: [],
            },
            video_info: {
              aspect_ratio: [319, 161],
              duration_millis: 45137,
              variants: [
                {
                  content_type: "application/x-mpegURL",
                  url: "https://video.twimg.com/ext_tw_video/1880392542413291520/pu/pl/KxltpAS29UKjDKXc.m3u8?tag=12",
                },
                {
                  bitrate: 256000,
                  content_type: "video/mp4",
                  url: "https://video.twimg.com/ext_tw_video/1880392542413291520/pu/vid/avc1/534x270/bxtesY189X5a85dJ.mp4?tag=12",
                },
                {
                  bitrate: 832000,
                  content_type: "video/mp4",
                  url: "https://video.twimg.com/ext_tw_video/1880392542413291520/pu/vid/avc1/712x360/V1aL8TA8YePOnXsp.mp4?tag=12",
                },
                {
                  bitrate: 2176000,
                  content_type: "video/mp4",
                  url: "https://video.twimg.com/ext_tw_video/1880392542413291520/pu/vid/avc1/1426x720/D4ivNB1vwht-WdDs.mp4?tag=12",
                },
              ],
            },
          },
        ],
        user_mentions: [],
        urls: [],
        hashtags: [
          {
            indices: [245, 259],
            text: "buildinpublic",
          },
          {
            indices: [260, 270],
            text: "Designers",
          },
          {
            indices: [245, 259],
            text: "buildinpublic",
          },
          {
            indices: [260, 270],
            text: "Designers",
          },
        ],
        symbols: [],
      },
      is_pinned: false,
    },
    {
      tweet_created_at: "2025-01-21T06:26:31.000000Z",
      id: 1881589170352914812,
      id_str: "1881589170352914812",
      conversation_id_str: "1881589170352914812",
      text: null,
      full_text:
        "Dark mode emails ↯ hit differently.\n\nThis is the waitlist email for ReacherX—all-black everything.\n\n↳ Minimal.\n↳ Sleek.\n↳ Unapologetically bold.\n\nWhat do you think?\n\n#buildinpublic\n\n• Design post—02",
      source:
        '<a href="http://twitter.com/download/android" rel="nofollow">Twitter for Android</a>',
      truncated: false,
      in_reply_to_status_id: null,
      in_reply_to_status_id_str: null,
      in_reply_to_user_id: null,
      in_reply_to_user_id_str: null,
      in_reply_to_screen_name: null,
      user: {
        id: 1743216568451125248,
        id_str: "1743216568451125248",
        name: "ReacherX founder",
        screen_name: "ReacherXfounder",
        location: "Vice City",
        url: "http://reacherx.com",
        description:
          "Building ReacherX, A search engine—to find customers. DM me for early access.",
        protected: false,
        verified: true,
        followers_count: 122,
        friends_count: 403,
        listed_count: 3,
        favourites_count: 777,
        statuses_count: 514,
        created_at: "2024-01-05T10:23:41.000000Z",
        profile_banner_url:
          "https://pbs.twimg.com/profile_banners/1743216568451125248/1715349496",
        profile_image_url_https:
          "https://pbs.twimg.com/profile_images/1769118183061848064/bOqqwNMn_normal.jpg",
        can_dm: true,
      },
      quoted_status_id: null,
      quoted_status_id_str: null,
      is_quote_status: false,
      quoted_status: null,
      retweeted_status: null,
      quote_count: 0,
      reply_count: 0,
      retweet_count: 0,
      favorite_count: 1,
      views_count: 53,
      bookmark_count: 0,
      lang: "en",
      entities: {
        media: [
          {
            display_url: "pic.x.com/FhiNXmzbQ4",
            expanded_url:
              "https://x.com/ReacherXfounder/status/1881589170352914812/video/1",
            id_str: "1881589126274670593",
            indices: [199, 222],
            media_key: "7_1881589126274670593",
            media_url_https:
              "https://pbs.twimg.com/ext_tw_video_thumb/1881589126274670593/pu/img/qrgJrzbYqS_FGHPw.jpg",
            type: "video",
            url: "https://t.co/FhiNXmzbQ4",
            additional_media_info: {
              monetizable: false,
            },
            ext_media_availability: {
              status: "Available",
            },
            sizes: {
              large: {
                h: 960,
                w: 720,
                resize: "fit",
              },
              medium: {
                h: 960,
                w: 720,
                resize: "fit",
              },
              small: {
                h: 680,
                w: 510,
                resize: "fit",
              },
              thumb: {
                h: 150,
                w: 150,
                resize: "crop",
              },
            },
            original_info: {
              height: 960,
              width: 720,
              focus_rects: [],
            },
            video_info: {
              aspect_ratio: [3, 4],
              duration_millis: 28292,
              variants: [
                {
                  content_type: "application/x-mpegURL",
                  url: "https://video.twimg.com/ext_tw_video/1881589126274670593/pu/pl/u2FOCi-9WOPFgnWq.m3u8?tag=12",
                },
                {
                  bitrate: 632000,
                  content_type: "video/mp4",
                  url: "https://video.twimg.com/ext_tw_video/1881589126274670593/pu/vid/avc1/320x426/nkk8GTpmkMDH51aL.mp4?tag=12",
                },
                {
                  bitrate: 950000,
                  content_type: "video/mp4",
                  url: "https://video.twimg.com/ext_tw_video/1881589126274670593/pu/vid/avc1/480x640/jSjHNaR6281FpEN7.mp4?tag=12",
                },
                {
                  bitrate: 2176000,
                  content_type: "video/mp4",
                  url: "https://video.twimg.com/ext_tw_video/1881589126274670593/pu/vid/avc1/720x960/o8aks-ycayQhhd4f.mp4?tag=12",
                },
              ],
            },
          },
          {
            display_url: "pic.x.com/FhiNXmzbQ4",
            expanded_url:
              "https://x.com/ReacherXfounder/status/1881589170352914812/video/1",
            id_str: "1881589126274670593",
            indices: [199, 222],
            media_key: "7_1881589126274670593",
            media_url_https:
              "https://pbs.twimg.com/ext_tw_video_thumb/1881589126274670593/pu/img/qrgJrzbYqS_FGHPw.jpg",
            type: "video",
            url: "https://t.co/FhiNXmzbQ4",
            additional_media_info: {
              monetizable: false,
            },
            ext_media_availability: {
              status: "Available",
            },
            sizes: {
              large: {
                h: 960,
                w: 720,
                resize: "fit",
              },
              medium: {
                h: 960,
                w: 720,
                resize: "fit",
              },
              small: {
                h: 680,
                w: 510,
                resize: "fit",
              },
              thumb: {
                h: 150,
                w: 150,
                resize: "crop",
              },
            },
            original_info: {
              height: 960,
              width: 720,
              focus_rects: [],
            },
            video_info: {
              aspect_ratio: [3, 4],
              duration_millis: 28292,
              variants: [
                {
                  content_type: "application/x-mpegURL",
                  url: "https://video.twimg.com/ext_tw_video/1881589126274670593/pu/pl/u2FOCi-9WOPFgnWq.m3u8?tag=12",
                },
                {
                  bitrate: 632000,
                  content_type: "video/mp4",
                  url: "https://video.twimg.com/ext_tw_video/1881589126274670593/pu/vid/avc1/320x426/nkk8GTpmkMDH51aL.mp4?tag=12",
                },
                {
                  bitrate: 950000,
                  content_type: "video/mp4",
                  url: "https://video.twimg.com/ext_tw_video/1881589126274670593/pu/vid/avc1/480x640/jSjHNaR6281FpEN7.mp4?tag=12",
                },
                {
                  bitrate: 2176000,
                  content_type: "video/mp4",
                  url: "https://video.twimg.com/ext_tw_video/1881589126274670593/pu/vid/avc1/720x960/o8aks-ycayQhhd4f.mp4?tag=12",
                },
              ],
            },
          },
        ],
        user_mentions: [],
        urls: [],
        hashtags: [
          {
            indices: [166, 180],
            text: "buildinpublic",
          },
          {
            indices: [166, 180],
            text: "buildinpublic",
          },
        ],
        symbols: [],
      },
      is_pinned: false,
    },
    {
      tweet_created_at: "2025-02-09T09:27:24.000000Z",
      id: 1888520061142339744,
      id_str: "1888520061142339744",
      conversation_id_str: "1888351506442895405",
      text: null,
      full_text:
        '@fdotinc Built this prototype a while back to validate the idea.\n\nBecause this thing is kinda hard to pull off, I desperately first wanted to validate it before going all in.\n\nSo I did the unthinkable, I used OpenAI "DALLE" AND "ChatGPT" to mock customers.\n\nPeople paid for this, but I refunded the amount back to them by informing them that this was a prototype for validation purposes.\n\nNow I am working on the real version and plan to launch anytime in March.\n\nI would like to get support from you guys because, X API costs a hell of a lot of money. So your help is needed.\n\nYou can also test this prototype at: https://t.co/9A6df19fNj',
      source:
        '<a href="http://twitter.com/download/android" rel="nofollow">Twitter for Android</a>',
      truncated: false,
      in_reply_to_status_id: 1888351506442895405,
      in_reply_to_status_id_str: "1888351506442895405",
      in_reply_to_user_id: 1230404765827256320,
      in_reply_to_user_id_str: "1230404765827256320",
      in_reply_to_screen_name: "fdotinc",
      user: {
        id: 1743216568451125248,
        id_str: "1743216568451125248",
        name: "ReacherX founder",
        screen_name: "ReacherXfounder",
        location: "Vice City",
        url: "http://reacherx.com",
        description:
          "Building ReacherX, A search engine—to find customers. DM me for early access.",
        protected: false,
        verified: true,
        followers_count: 126,
        friends_count: 408,
        listed_count: 3,
        favourites_count: 778,
        statuses_count: 515,
        created_at: "2024-01-05T10:23:41.000000Z",
        profile_banner_url:
          "https://pbs.twimg.com/profile_banners/1743216568451125248/1715349496",
        profile_image_url_https:
          "https://pbs.twimg.com/profile_images/1769118183061848064/bOqqwNMn_normal.jpg",
        can_dm: true,
      },
      quoted_status_id: null,
      quoted_status_id_str: null,
      is_quote_status: false,
      quoted_status: null,
      retweeted_status: null,
      quote_count: 0,
      reply_count: 0,
      retweet_count: 0,
      favorite_count: 0,
      views_count: 35,
      bookmark_count: 0,
      lang: "en",
      entities: {
        media: [
          {
            display_url: "pic.x.com/DcWsZFMBOu",
            expanded_url:
              "https://x.com/ReacherXfounder/status/1888520061142339744/video/1",
            id_str: "1888519902689959936",
            indices: [289, 312],
            media_key: "7_1888519902689959936",
            media_url_https:
              "https://pbs.twimg.com/ext_tw_video_thumb/1888519902689959936/pu/img/bn9-aUx0QKYes6oV.jpg",
            type: "video",
            url: "https://t.co/DcWsZFMBOu",
            additional_media_info: {
              monetizable: false,
            },
            ext_media_availability: {
              status: "Available",
            },
            sizes: {
              large: {
                h: 1280,
                w: 576,
                resize: "fit",
              },
              medium: {
                h: 1200,
                w: 540,
                resize: "fit",
              },
              small: {
                h: 680,
                w: 306,
                resize: "fit",
              },
              thumb: {
                h: 150,
                w: 150,
                resize: "crop",
              },
            },
            original_info: {
              height: 1280,
              width: 576,
              focus_rects: [],
            },
            video_info: {
              aspect_ratio: [9, 20],
              duration_millis: 255019,
              variants: [
                {
                  content_type: "application/x-mpegURL",
                  url: "https://video.twimg.com/ext_tw_video/1888519902689959936/pu/pl/SvZh3C2ma-KeM8g8.m3u8?tag=12",
                },
                {
                  bitrate: 632000,
                  content_type: "video/mp4",
                  url: "https://video.twimg.com/ext_tw_video/1888519902689959936/pu/vid/avc1/320x710/4-GgWP1pPlq_Aeg-.mp4?tag=12",
                },
                {
                  bitrate: 950000,
                  content_type: "video/mp4",
                  url: "https://video.twimg.com/ext_tw_video/1888519902689959936/pu/vid/avc1/480x1066/WusC_uIod6_rz3ED.mp4?tag=12",
                },
                {
                  bitrate: 2176000,
                  content_type: "video/mp4",
                  url: "https://video.twimg.com/ext_tw_video/1888519902689959936/pu/vid/avc1/576x1280/LkgOvEr9SZxUJM5C.mp4?tag=12",
                },
              ],
            },
          },
          {
            display_url: "pic.x.com/DcWsZFMBOu",
            expanded_url:
              "https://x.com/ReacherXfounder/status/1888520061142339744/video/1",
            id_str: "1888519902689959936",
            indices: [289, 312],
            media_key: "7_1888519902689959936",
            media_url_https:
              "https://pbs.twimg.com/ext_tw_video_thumb/1888519902689959936/pu/img/bn9-aUx0QKYes6oV.jpg",
            type: "video",
            url: "https://t.co/DcWsZFMBOu",
            additional_media_info: {
              monetizable: false,
            },
            ext_media_availability: {
              status: "Available",
            },
            sizes: {
              large: {
                h: 1280,
                w: 576,
                resize: "fit",
              },
              medium: {
                h: 1200,
                w: 540,
                resize: "fit",
              },
              small: {
                h: 680,
                w: 306,
                resize: "fit",
              },
              thumb: {
                h: 150,
                w: 150,
                resize: "crop",
              },
            },
            original_info: {
              height: 1280,
              width: 576,
              focus_rects: [],
            },
            video_info: {
              aspect_ratio: [9, 20],
              duration_millis: 255019,
              variants: [
                {
                  content_type: "application/x-mpegURL",
                  url: "https://video.twimg.com/ext_tw_video/1888519902689959936/pu/pl/SvZh3C2ma-KeM8g8.m3u8?tag=12",
                },
                {
                  bitrate: 632000,
                  content_type: "video/mp4",
                  url: "https://video.twimg.com/ext_tw_video/1888519902689959936/pu/vid/avc1/320x710/4-GgWP1pPlq_Aeg-.mp4?tag=12",
                },
                {
                  bitrate: 950000,
                  content_type: "video/mp4",
                  url: "https://video.twimg.com/ext_tw_video/1888519902689959936/pu/vid/avc1/480x1066/WusC_uIod6_rz3ED.mp4?tag=12",
                },
                {
                  bitrate: 2176000,
                  content_type: "video/mp4",
                  url: "https://video.twimg.com/ext_tw_video/1888519902689959936/pu/vid/avc1/576x1280/LkgOvEr9SZxUJM5C.mp4?tag=12",
                },
              ],
            },
          },
        ],
        user_mentions: [
          {
            id_str: "1230404765827256320",
            name: "Founders Inc",
            screen_name: "fdotinc",
            indices: [0, 8],
          },
          {
            id_str: "1230404765827256320",
            name: "Founders Inc",
            screen_name: "fdotinc",
            indices: [9, 17],
          },
          {
            id_str: "1230404765827256320",
            name: "Founders Inc",
            screen_name: "fdotinc",
            indices: [0, 8],
          },
        ],
        urls: [
          {
            display_url: "app.reacherx.com",
            expanded_url: "http://app.reacherx.com",
            url: "https://t.co/9A6df19fNj",
            indices: [615, 638],
          },
        ],
        hashtags: [],
        symbols: [],
      },
      is_pinned: false,
    },
    {
      tweet_created_at: "2024-11-03T17:36:30.000000Z",
      id: 1853129138821017726,
      id_str: "1853129138821017726",
      conversation_id_str: "1853129138821017726",
      text: null,
      full_text:
        "Saw 20 notification count 👀,\n\nI opened the Twitter app,\n\nJump to the Notifications,\n\nOh! So these bots have followed me 😒\n\nWHEN WILL TWITTER GET RID OF THESE BOTS? https://t.co/3d6hh428Ld",
      source:
        '<a href="http://twitter.com/download/android" rel="nofollow">Twitter for Android</a>',
      truncated: false,
      in_reply_to_status_id: null,
      in_reply_to_status_id_str: null,
      in_reply_to_user_id: null,
      in_reply_to_user_id_str: null,
      in_reply_to_screen_name: null,
      user: {
        id: 1743216568451125248,
        id_str: "1743216568451125248",
        name: "ReacherX founder",
        screen_name: "ReacherXfounder",
        location: "Vice City",
        url: "http://reacherx.com",
        description:
          "Building ReacherX, A search engine—to find customers. DM me for early access.",
        protected: false,
        verified: true,
        followers_count: 126,
        friends_count: 408,
        listed_count: 3,
        favourites_count: 778,
        statuses_count: 515,
        created_at: "2024-01-05T10:23:41.000000Z",
        profile_banner_url:
          "https://pbs.twimg.com/profile_banners/1743216568451125248/1715349496",
        profile_image_url_https:
          "https://pbs.twimg.com/profile_images/1769118183061848064/bOqqwNMn_normal.jpg",
        can_dm: true,
      },
      quoted_status_id: null,
      quoted_status_id_str: null,
      is_quote_status: false,
      quoted_status: null,
      retweeted_status: null,
      quote_count: 0,
      reply_count: 0,
      retweet_count: 0,
      favorite_count: 0,
      views_count: 68,
      bookmark_count: 0,
      lang: "en",
      entities: {
        media: [
          {
            display_url: "pic.x.com/3d6hh428Ld",
            expanded_url:
              "https://x.com/ReacherXfounder/status/1853129138821017726/photo/1",
            id_str: "1853129130122043392",
            indices: [164, 187],
            media_key: "16_1853129130122043392",
            media_url_https:
              "https://pbs.twimg.com/tweet_video_thumb/GbejICPaYAAhMPY.jpg",
            type: "animated_gif",
            url: "https://t.co/3d6hh428Ld",
            ext_media_availability: {
              status: "Available",
            },
            sizes: {
              large: {
                h: 220,
                w: 220,
                resize: "fit",
              },
              medium: {
                h: 220,
                w: 220,
                resize: "fit",
              },
              small: {
                h: 220,
                w: 220,
                resize: "fit",
              },
              thumb: {
                h: 150,
                w: 150,
                resize: "crop",
              },
            },
            original_info: {
              height: 220,
              width: 220,
              focus_rects: [],
            },
            video_info: {
              aspect_ratio: [1, 1],
              variants: [
                {
                  bitrate: 0,
                  content_type: "video/mp4",
                  url: "https://video.twimg.com/tweet_video/GbejICPaYAAhMPY.mp4",
                },
              ],
            },
          },
          {
            display_url: "pic.x.com/3d6hh428Ld",
            expanded_url:
              "https://x.com/ReacherXfounder/status/1853129138821017726/photo/1",
            id_str: "1853129130122043392",
            indices: [164, 187],
            media_key: "16_1853129130122043392",
            media_url_https:
              "https://pbs.twimg.com/tweet_video_thumb/GbejICPaYAAhMPY.jpg",
            type: "animated_gif",
            url: "https://t.co/3d6hh428Ld",
            ext_media_availability: {
              status: "Available",
            },
            sizes: {
              large: {
                h: 220,
                w: 220,
                resize: "fit",
              },
              medium: {
                h: 220,
                w: 220,
                resize: "fit",
              },
              small: {
                h: 220,
                w: 220,
                resize: "fit",
              },
              thumb: {
                h: 150,
                w: 150,
                resize: "crop",
              },
            },
            original_info: {
              height: 220,
              width: 220,
              focus_rects: [],
            },
            video_info: {
              aspect_ratio: [1, 1],
              variants: [
                {
                  bitrate: 0,
                  content_type: "video/mp4",
                  url: "https://video.twimg.com/tweet_video/GbejICPaYAAhMPY.mp4",
                },
              ],
            },
          },
        ],
        user_mentions: [],
        urls: [],
        hashtags: [],
        symbols: [],
      },
      is_pinned: false,
    },
    {
      tweet_created_at: "2025-02-10T13:26:02.000000Z",
      id: 1888942505967616373,
      id_str: "1888942505967616373",
      conversation_id_str: "1888942505967616373",
      text: null,
      full_text: "Test post • 1 https://t.co/jNIcRHQB7L",
      source:
        '<a href="http://twitter.com/download/android" rel="nofollow">Twitter for Android</a>',
      truncated: false,
      in_reply_to_status_id: null,
      in_reply_to_status_id_str: null,
      in_reply_to_user_id: null,
      in_reply_to_user_id_str: null,
      in_reply_to_screen_name: null,
      user: {
        id: 1743216568451125248,
        id_str: "1743216568451125248",
        name: "ReacherX founder",
        screen_name: "ReacherXfounder",
        location: "Vice City",
        url: "http://reacherx.com",
        description:
          "Building ReacherX, A search engine—to find customers. DM me for early access.",
        protected: false,
        verified: true,
        followers_count: 125,
        friends_count: 410,
        listed_count: 3,
        favourites_count: 779,
        statuses_count: 517,
        created_at: "2024-01-05T10:23:41.000000Z",
        profile_banner_url:
          "https://pbs.twimg.com/profile_banners/1743216568451125248/1715349496",
        profile_image_url_https:
          "https://pbs.twimg.com/profile_images/1769118183061848064/bOqqwNMn_normal.jpg",
        can_dm: true,
      },
      quoted_status_id: null,
      quoted_status_id_str: null,
      is_quote_status: false,
      quoted_status: null,
      retweeted_status: null,
      quote_count: 0,
      reply_count: 0,
      retweet_count: 0,
      favorite_count: 0,
      views_count: 2,
      bookmark_count: 0,
      lang: "en",
      entities: {
        media: [
          {
            display_url: "pic.x.com/jNIcRHQB7L",
            expanded_url:
              "https://x.com/ReacherXfounder/status/1888942505967616373/video/1",
            id_str: "1888942447926910976",
            indices: [14, 37],
            media_key: "3_1888942447926910976",
            media_url_https: "https://pbs.twimg.com/media/GjbfJfnXIAAYhJm.jpg",
            type: "photo",
            url: "https://t.co/jNIcRHQB7L",
            ext_media_availability: {
              status: "Available",
            },
            features: {
              large: {
                faces: [],
              },
              medium: {
                faces: [],
              },
              small: {
                faces: [],
              },
              orig: {
                faces: [],
              },
            },
            sizes: {
              large: {
                h: 2048,
                w: 1152,
                resize: "fit",
              },
              medium: {
                h: 1200,
                w: 675,
                resize: "fit",
              },
              small: {
                h: 680,
                w: 383,
                resize: "fit",
              },
              thumb: {
                h: 150,
                w: 150,
                resize: "crop",
              },
            },
            original_info: {
              height: 4096,
              width: 2304,
              focus_rects: [
                {
                  x: 0,
                  y: 1710,
                  w: 2304,
                  h: 1290,
                },
                {
                  x: 0,
                  y: 1203,
                  w: 2304,
                  h: 2304,
                },
                {
                  x: 0,
                  y: 1042,
                  w: 2304,
                  h: 2627,
                },
                {
                  x: 0,
                  y: 0,
                  w: 2048,
                  h: 4096,
                },
                {
                  x: 0,
                  y: 0,
                  w: 2304,
                  h: 4096,
                },
              ],
            },
          },
          {
            display_url: "pic.x.com/jNIcRHQB7L",
            expanded_url:
              "https://x.com/ReacherXfounder/status/1888942505967616373/video/1",
            id_str: "1888942441027301377",
            indices: [14, 37],
            media_key: "7_1888942441027301377",
            media_url_https:
              "https://pbs.twimg.com/ext_tw_video_thumb/1888942441027301377/pu/img/FA8-Q3S6EP8jSwwO.jpg",
            type: "video",
            url: "https://t.co/jNIcRHQB7L",
            additional_media_info: {
              monetizable: false,
            },
            ext_media_availability: {
              status: "Available",
            },
            sizes: {
              large: {
                h: 1920,
                w: 864,
                resize: "fit",
              },
              medium: {
                h: 1200,
                w: 540,
                resize: "fit",
              },
              small: {
                h: 680,
                w: 306,
                resize: "fit",
              },
              thumb: {
                h: 150,
                w: 150,
                resize: "crop",
              },
            },
            original_info: {
              height: 1920,
              width: 864,
              focus_rects: [],
            },
            video_info: {
              aspect_ratio: [9, 20],
              duration_millis: 8266,
              variants: [
                {
                  content_type: "application/x-mpegURL",
                  url: "https://video.twimg.com/ext_tw_video/1888942441027301377/pu/pl/cY1PFU-TMZuvQgY4.m3u8?tag=12",
                },
                {
                  bitrate: 632000,
                  content_type: "video/mp4",
                  url: "https://video.twimg.com/ext_tw_video/1888942441027301377/pu/vid/avc1/320x710/cwF-MH1aqj9ecSCK.mp4?tag=12",
                },
                {
                  bitrate: 950000,
                  content_type: "video/mp4",
                  url: "https://video.twimg.com/ext_tw_video/1888942441027301377/pu/vid/avc1/480x1066/bAhCToyqv1RxW74o.mp4?tag=12",
                },
                {
                  bitrate: 2176000,
                  content_type: "video/mp4",
                  url: "https://video.twimg.com/ext_tw_video/1888942441027301377/pu/vid/avc1/720x1600/NuSKZPDkG2K5Ke61.mp4?tag=12",
                },
              ],
            },
          },
          {
            display_url: "pic.x.com/jNIcRHQB7L",
            expanded_url:
              "https://x.com/ReacherXfounder/status/1888942505967616373/video/1",
            id_str: "1888942473591783424",
            indices: [14, 37],
            media_key: "7_1888942473591783424",
            media_url_https:
              "https://pbs.twimg.com/ext_tw_video_thumb/1888942473591783424/pu/img/iXzyAZUnik0P6lJ9.jpg",
            type: "video",
            url: "https://t.co/jNIcRHQB7L",
            additional_media_info: {
              monetizable: false,
            },
            ext_media_availability: {
              status: "Available",
            },
            sizes: {
              large: {
                h: 320,
                w: 296,
                resize: "fit",
              },
              medium: {
                h: 320,
                w: 296,
                resize: "fit",
              },
              small: {
                h: 320,
                w: 296,
                resize: "fit",
              },
              thumb: {
                h: 150,
                w: 150,
                resize: "crop",
              },
            },
            original_info: {
              height: 320,
              width: 296,
              focus_rects: [],
            },
            video_info: {
              aspect_ratio: [37, 40],
              duration_millis: 980,
              variants: [
                {
                  content_type: "application/x-mpegURL",
                  url: "https://video.twimg.com/ext_tw_video/1888942473591783424/pu/pl/qkM3wi5a2FuT4_yB.m3u8?tag=12",
                },
                {
                  bitrate: 632000,
                  content_type: "video/mp4",
                  url: "https://video.twimg.com/ext_tw_video/1888942473591783424/pu/vid/avc1/296x320/hW21DrzoJjFEVYz6.mp4?tag=12",
                },
              ],
            },
          },
          {
            display_url: "pic.x.com/jNIcRHQB7L",
            expanded_url:
              "https://x.com/ReacherXfounder/status/1888942505967616373/video/1",
            id_str: "1888942491094687744",
            indices: [14, 37],
            media_key: "7_1888942491094687744",
            media_url_https:
              "https://pbs.twimg.com/ext_tw_video_thumb/1888942491094687744/pu/img/H3bjYgIuRG_32_WS.jpg",
            type: "video",
            url: "https://t.co/jNIcRHQB7L",
            additional_media_info: {
              monetizable: false,
            },
            ext_media_availability: {
              status: "Available",
            },
            sizes: {
              large: {
                h: 1052,
                w: 1920,
                resize: "fit",
              },
              medium: {
                h: 658,
                w: 1200,
                resize: "fit",
              },
              small: {
                h: 373,
                w: 680,
                resize: "fit",
              },
              thumb: {
                h: 150,
                w: 150,
                resize: "crop",
              },
            },
            original_info: {
              height: 1052,
              width: 1920,
              focus_rects: [],
            },
            video_info: {
              aspect_ratio: [480, 263],
              duration_millis: 1407,
              variants: [
                {
                  content_type: "application/x-mpegURL",
                  url: "https://video.twimg.com/ext_tw_video/1888942491094687744/pu/pl/740OWLCp7fZ4ZtqL.m3u8?tag=12",
                },
                {
                  bitrate: 256000,
                  content_type: "video/mp4",
                  url: "https://video.twimg.com/ext_tw_video/1888942491094687744/pu/vid/avc1/492x270/KOVh5nLmINEPlIXr.mp4?tag=12",
                },
                {
                  bitrate: 832000,
                  content_type: "video/mp4",
                  url: "https://video.twimg.com/ext_tw_video/1888942491094687744/pu/vid/avc1/656x360/9cd1Y1guEAPJjKeg.mp4?tag=12",
                },
                {
                  bitrate: 2176000,
                  content_type: "video/mp4",
                  url: "https://video.twimg.com/ext_tw_video/1888942491094687744/pu/vid/avc1/1314x720/jQrji3zjwusptufk.mp4?tag=12",
                },
              ],
            },
          },
          {
            display_url: "pic.x.com/jNIcRHQB7L",
            expanded_url:
              "https://x.com/ReacherXfounder/status/1888942505967616373/video/1",
            id_str: "1888942447926910976",
            indices: [14, 37],
            media_key: "3_1888942447926910976",
            media_url_https: "https://pbs.twimg.com/media/GjbfJfnXIAAYhJm.jpg",
            type: "photo",
            url: "https://t.co/jNIcRHQB7L",
            ext_media_availability: {
              status: "Available",
            },
            features: {
              large: {
                faces: [],
              },
              medium: {
                faces: [],
              },
              small: {
                faces: [],
              },
              orig: {
                faces: [],
              },
            },
            sizes: {
              large: {
                h: 2048,
                w: 1152,
                resize: "fit",
              },
              medium: {
                h: 1200,
                w: 675,
                resize: "fit",
              },
              small: {
                h: 680,
                w: 383,
                resize: "fit",
              },
              thumb: {
                h: 150,
                w: 150,
                resize: "crop",
              },
            },
            original_info: {
              height: 4096,
              width: 2304,
              focus_rects: [
                {
                  x: 0,
                  y: 1710,
                  w: 2304,
                  h: 1290,
                },
                {
                  x: 0,
                  y: 1203,
                  w: 2304,
                  h: 2304,
                },
                {
                  x: 0,
                  y: 1042,
                  w: 2304,
                  h: 2627,
                },
                {
                  x: 0,
                  y: 0,
                  w: 2048,
                  h: 4096,
                },
                {
                  x: 0,
                  y: 0,
                  w: 2304,
                  h: 4096,
                },
              ],
            },
          },
          {
            display_url: "pic.x.com/jNIcRHQB7L",
            expanded_url:
              "https://x.com/ReacherXfounder/status/1888942505967616373/video/1",
            id_str: "1888942441027301377",
            indices: [14, 37],
            media_key: "7_1888942441027301377",
            media_url_https:
              "https://pbs.twimg.com/ext_tw_video_thumb/1888942441027301377/pu/img/FA8-Q3S6EP8jSwwO.jpg",
            type: "video",
            url: "https://t.co/jNIcRHQB7L",
            additional_media_info: {
              monetizable: false,
            },
            ext_media_availability: {
              status: "Available",
            },
            sizes: {
              large: {
                h: 1920,
                w: 864,
                resize: "fit",
              },
              medium: {
                h: 1200,
                w: 540,
                resize: "fit",
              },
              small: {
                h: 680,
                w: 306,
                resize: "fit",
              },
              thumb: {
                h: 150,
                w: 150,
                resize: "crop",
              },
            },
            original_info: {
              height: 1920,
              width: 864,
              focus_rects: [],
            },
            video_info: {
              aspect_ratio: [9, 20],
              duration_millis: 8266,
              variants: [
                {
                  content_type: "application/x-mpegURL",
                  url: "https://video.twimg.com/ext_tw_video/1888942441027301377/pu/pl/cY1PFU-TMZuvQgY4.m3u8?tag=12",
                },
                {
                  bitrate: 632000,
                  content_type: "video/mp4",
                  url: "https://video.twimg.com/ext_tw_video/1888942441027301377/pu/vid/avc1/320x710/cwF-MH1aqj9ecSCK.mp4?tag=12",
                },
                {
                  bitrate: 950000,
                  content_type: "video/mp4",
                  url: "https://video.twimg.com/ext_tw_video/1888942441027301377/pu/vid/avc1/480x1066/bAhCToyqv1RxW74o.mp4?tag=12",
                },
                {
                  bitrate: 2176000,
                  content_type: "video/mp4",
                  url: "https://video.twimg.com/ext_tw_video/1888942441027301377/pu/vid/avc1/720x1600/NuSKZPDkG2K5Ke61.mp4?tag=12",
                },
              ],
            },
          },
          {
            display_url: "pic.x.com/jNIcRHQB7L",
            expanded_url:
              "https://x.com/ReacherXfounder/status/1888942505967616373/video/1",
            id_str: "1888942473591783424",
            indices: [14, 37],
            media_key: "7_1888942473591783424",
            media_url_https:
              "https://pbs.twimg.com/ext_tw_video_thumb/1888942473591783424/pu/img/iXzyAZUnik0P6lJ9.jpg",
            type: "video",
            url: "https://t.co/jNIcRHQB7L",
            additional_media_info: {
              monetizable: false,
            },
            ext_media_availability: {
              status: "Available",
            },
            sizes: {
              large: {
                h: 320,
                w: 296,
                resize: "fit",
              },
              medium: {
                h: 320,
                w: 296,
                resize: "fit",
              },
              small: {
                h: 320,
                w: 296,
                resize: "fit",
              },
              thumb: {
                h: 150,
                w: 150,
                resize: "crop",
              },
            },
            original_info: {
              height: 320,
              width: 296,
              focus_rects: [],
            },
            video_info: {
              aspect_ratio: [37, 40],
              duration_millis: 980,
              variants: [
                {
                  content_type: "application/x-mpegURL",
                  url: "https://video.twimg.com/ext_tw_video/1888942473591783424/pu/pl/qkM3wi5a2FuT4_yB.m3u8?tag=12",
                },
                {
                  bitrate: 632000,
                  content_type: "video/mp4",
                  url: "https://video.twimg.com/ext_tw_video/1888942473591783424/pu/vid/avc1/296x320/hW21DrzoJjFEVYz6.mp4?tag=12",
                },
              ],
            },
          },
          {
            display_url: "pic.x.com/jNIcRHQB7L",
            expanded_url:
              "https://x.com/ReacherXfounder/status/1888942505967616373/video/1",
            id_str: "1888942491094687744",
            indices: [14, 37],
            media_key: "7_1888942491094687744",
            media_url_https:
              "https://pbs.twimg.com/ext_tw_video_thumb/1888942491094687744/pu/img/H3bjYgIuRG_32_WS.jpg",
            type: "video",
            url: "https://t.co/jNIcRHQB7L",
            additional_media_info: {
              monetizable: false,
            },
            ext_media_availability: {
              status: "Available",
            },
            sizes: {
              large: {
                h: 1052,
                w: 1920,
                resize: "fit",
              },
              medium: {
                h: 658,
                w: 1200,
                resize: "fit",
              },
              small: {
                h: 373,
                w: 680,
                resize: "fit",
              },
              thumb: {
                h: 150,
                w: 150,
                resize: "crop",
              },
            },
            original_info: {
              height: 1052,
              width: 1920,
              focus_rects: [],
            },
            video_info: {
              aspect_ratio: [480, 263],
              duration_millis: 1407,
              variants: [
                {
                  content_type: "application/x-mpegURL",
                  url: "https://video.twimg.com/ext_tw_video/1888942491094687744/pu/pl/740OWLCp7fZ4ZtqL.m3u8?tag=12",
                },
                {
                  bitrate: 256000,
                  content_type: "video/mp4",
                  url: "https://video.twimg.com/ext_tw_video/1888942491094687744/pu/vid/avc1/492x270/KOVh5nLmINEPlIXr.mp4?tag=12",
                },
                {
                  bitrate: 832000,
                  content_type: "video/mp4",
                  url: "https://video.twimg.com/ext_tw_video/1888942491094687744/pu/vid/avc1/656x360/9cd1Y1guEAPJjKeg.mp4?tag=12",
                },
                {
                  bitrate: 2176000,
                  content_type: "video/mp4",
                  url: "https://video.twimg.com/ext_tw_video/1888942491094687744/pu/vid/avc1/1314x720/jQrji3zjwusptufk.mp4?tag=12",
                },
              ],
            },
          },
        ],
        user_mentions: [],
        urls: [],
        hashtags: [],
        symbols: [],
      },
      is_pinned: false,
    },
  ];

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

        <WaitlistDrawer waitlistUsers={mockWaitlistUsers} />

        <WaitlistUsersMarquee className="mt-6 md:mt-12" />
      </section>

      <section
        id="vision"
        aria-labelledby="vision-heading"
        className="space-y-6 md:space-y-12"
      >
        <h2 id="vision-heading" className="text-3xl font-medium">
          Vision.
        </h2>
        <PostCard
          size="lg"
          className="px-0"
          key={mockTweets[-0].id}
          detailHref={`/tweets/${mockTweets[-0].id}`}
          displayName={mockTweets[-0].user.name}
          username={mockTweets[-0].user.screen_name}
          avatarUrl={mockTweets[-0].user.profile_image_url_https}
          pro={mockTweets[-0].user.verified}
          dateTime={mockTweets[-0].tweet_created_at}
          body={mockTweets[-0].full_text || ""}
          cardSlot={
            mockTweets[0].entities?.media ? (
              <PostMedia media={mockTweets[-0].entities.media} />
            ) : null
          }
          replies={mockTweets[-0].reply_count}
          likes={mockTweets[-0].favorite_count}
          bookmarks={mockTweets[-0].bookmark_count}
          impressions={mockTweets[-0].views_count}
          reposts={mockTweets[-0].retweet_count}
        />
      </section>

      <section aria-label="Key value props" className="mb-16 space-y-4 text-lg">
        <div className="text-5xl font-medium md:text-6xl">
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
        className="space-y-6 md:space-y-12"
      >
        <div className="flex items-center justify-between">
          <h2 id="recent-thread-heading" className="text-3xl font-medium">
            Recent thread.
          </h2>
          <Button variant="link">View all</Button>
        </div>
        <PostCard {...threadsWithParsedHtml[0]} className="px-0" size="lg" />
      </section>

      <section id="join-waitlist" aria-labelledby="waitlist-heading">
        <h2 id="waitlist-heading" className="text-3xl font-medium">
          Join over 50 people already on the wait-list!
        </h2>

        <WaitlistDrawer waitlistUsers={mockWaitlistUsers} />

        <WaitlistUsersMarquee className="mt-6 md:mt-12" />
      </section>
    </div>
  );
}
