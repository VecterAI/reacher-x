import type { BlogDemoShot } from "./blogDemoHelpers";
import { buildMemoryDemoShots } from "./reportingDemoShots";
import { buildMediaDemoShots } from "./conversationDemoShots";
import {
  REACH_OUT_PREFERENCE,
  REACH_OUT_VIDEO_PROMPT,
  REACH_OUT_BUBBLE_PROMPT,
  REACH_OUT_BUBBLE_TASKS,
  REACH_OUT_UNICODE_PROMPT,
  REACH_OUT_UNICODE_TASKS,
} from "./reachOutDemoCopy";

export const REACH_OUT_MEMORY_SHOTS = buildMemoryDemoShots({
  instruction: `Remember this for outreach: ${REACH_OUT_PREFERENCE}`,
  request:
    "Draft a first message to Nora. Use the writing preference you saved and the post about her client approvals.",
});

export const REACH_OUT_VIDEO_SHOTS = buildMediaDemoShots({
  opening: "Show Nora a workflow that fits her problem",
  status: "new",
  prompt: REACH_OUT_VIDEO_PROMPT,
});

const wide = { x: 640, y: 425, zoom: 1, mobileZoom: 1 };
const detail = { x: 980, y: 650, zoom: 1.8, mobileZoom: 2.5 };
function buildAgentMessageShots(copy: {
  opening: string;
  prompt: string;
  messages: readonly { description: string; content: string }[];
}): readonly BlogDemoShot[] {
  return [
    { label: copy.opening, duration: 2200, camera: wide },
    {
      label: "Open Nora's profile",
      duration: 1500,
      camera: detail,
      action: { selector: '[data-prospect-id="use_case_demo_audience_1"]' },
    },
    {
      label: "Read the post behind the introduction",
      duration: 1500,
      camera: detail,
      action: { selector: '[role="tab"]', text: "Relevant activity" },
    },
    {
      label: "Approvals scattered across three places",
      duration: 2800,
      camera: detail,
      focus: { selector: 'aside [role="tabpanel"]' },
    },
    {
      label: "Ask △ Agent to write the introduction",
      duration: 1500,
      camera: detail,
      action: { selector: "aside button", text: "Agent" },
    },
    {
      label: "Describe the message and its format",
      duration: 1500,
      camera: detail,
      action: { selector: 'main [contenteditable="true"]', input: copy.prompt },
    },
    {
      label: "Check the instruction",
      duration: 3500,
      camera: detail,
      focus: { selector: 'main [contenteditable="true"]' },
    },
    {
      label: "Give the request to △ Agent",
      duration: 1500,
      camera: detail,
      action: { selector: 'button[aria-label="Send message"]' },
    },
    {
      label: "Open the Agent's proposed plan",
      duration: 1500,
      camera: detail,
      action: { selector: "button", text: "Show plan" },
    },
    {
      label: "Review the plan before anything is sent",
      duration: 3500,
      camera: detail,
      focus: { selector: "aside article" },
    },
    {
      label: "Approve the plan",
      duration: 1500,
      camera: detail,
      action: { selector: 'aside [role="toolbar"] button', text: "Approve" },
    },
    ...copy.messages.flatMap((message, index): BlogDemoShot[] => [
      ...(index
        ? [
            {
              label: "Return to the next message in the plan",
              duration: 1500,
              camera: detail,
              action: { selector: "button", text: "Show plan" },
            },
          ]
        : []),
      {
        label: `Read draft ${index + 1}`,
        duration: 1500,
        camera: detail,
        action: {
          selector: "button",
          text: "Edit",
          within: {
            selector: "aside article li",
            containsText: message.description,
          },
        },
      },
      {
        label: "Check the Agent's wording before sending",
        duration: 4200,
        camera: detail,
        waitFor: {
          selector: 'aside [contenteditable="true"]',
          containsText: message.content.split("\n")[0],
        },
        focus: { selector: 'aside [contenteditable="true"]' },
      },
      {
        label: `Approve message ${index + 1} for △ Agent to send`,
        duration: 1500,
        camera: detail,
        action: { selector: "aside button", text: "Approve DM" },
      },
      {
        label: `Message ${index + 1} is delivered`,
        duration: 3200,
        camera: detail,
        waitFor: {
          selector: 'aside [role="log"] article',
          containsText: message.content.split("\n")[0],
        },
        focus: { selector: 'aside [role="log"] article', all: true },
      },
    ]),
    {
      label: "The approved messages are in Nora's conversation",
      duration: 3500,
      camera: wide,
    },
  ];
}

export const REACH_OUT_BUBBLE_SHOTS = buildAgentMessageShots({
  opening: "Ask △ Agent for three separate messages",
  prompt: REACH_OUT_BUBBLE_PROMPT,
  messages: REACH_OUT_BUBBLE_TASKS,
});

export const REACH_OUT_UNICODE_SHOTS = buildAgentMessageShots({
  opening: "Ask △ Agent for a message that is easy to scan",
  prompt: REACH_OUT_UNICODE_PROMPT,
  messages: REACH_OUT_UNICODE_TASKS,
});
