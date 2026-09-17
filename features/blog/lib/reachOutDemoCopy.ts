/** One fictional customer story shared by the article's playback and local services. */
export const REACH_OUT_PREFERENCE =
  "Always open with a question about their work, never open with my product.";
export const REACH_OUT_MEMORY_DRAFT =
  "Hi Nora, how did you work out which logo changes were approved when the feedback was split across Slack, email, and a PDF? Your post made me wonder whether you keep a final approval in one place or still have to piece it together.";
export const REACH_OUT_VIDEO_PROMPT =
  "Create a first-message plan for Nora. Her post describes logo approvals scattered across Slack, a PDF, and email. Use this clip in the first message to show a client leaving feedback beside a design without creating an account. Explain why I picked it for her, keep it short, and leave sending for my review.";
export const REACH_OUT_VIDEO_DRAFT =
  "Hi Nora, your post about piecing together logo approvals across Slack, email, and a PDF sounded familiar. I put together this walkthrough with that problem in mind: your client leaves a comment beside the design, without creating an account. Would this fit the way you review work with clients?";
export const REACH_OUT_BUBBLES = [
  "Hi Nora, your post about chasing logo approvals across Slack, email, and a PDF sounded familiar.",
  "I'm building a feedback tool for freelance designers. Clients leave comments beside the design, so you can see what they approved in one place.",
  "Would that help with your client reviews, or have you already found a setup that works?",
] as const;

export const REACH_OUT_BUBBLE_PROMPT =
  "Draft an introduction to Nora as three separate LinkedIn messages, not one block. Start with her post about scattered logo approvals, explain the client-feedback tool, then ask one easy question. Make each bubble its own DM task and leave them for my review.";
export const REACH_OUT_BUBBLE_TASKS = REACH_OUT_BUBBLES.map(
  (content, index) => ({
    description: [
      "Open with Nora's post",
      "Explain the feedback tool",
      "Ask one easy question",
    ][index],
    content,
  })
);
export const REACH_OUT_UNICODE_PROMPT =
  "Draft a first LinkedIn message to Nora about her scattered client approvals. Use Unicode bold for just the phrase 'one review link', then two short bullet points about comments beside the design and no client account needed. Keep the rest in ordinary text. End with a question and leave the message for my review.";
export const REACH_OUT_UNICODE_DRAFT =
  "Hi Nora, your post about tracking approvals across Slack, email, and a PDF caught my eye.\n\nI'm building a feedback tool for designers that keeps everything behind 𝗼𝗻𝗲 𝗿𝗲𝘃𝗶𝗲𝘄 𝗹𝗶𝗻𝗸:\n• Comments sit beside the design.\n• Clients don't need an account.\n\nWould that fit how you review work with clients?";
export const REACH_OUT_UNICODE_TASKS = [
  {
    description: "Introduce one review link with a short, formatted message",
    content: REACH_OUT_UNICODE_DRAFT,
  },
];
