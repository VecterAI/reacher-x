import type { BlogDemoShot } from "./blogDemoHelpers";
import {
  DM_LINKEDIN_REPLY,
  DM_X_REPLY,
  AUTOCOMPLETE_PREFIX,
  AUTOCOMPLETE_SUGGESTION,
  AUTOCOMPLETE_EDITED,
  AUTOCOMPLETE_FINAL,
} from "./conversationDemoCopy";
const wide = { x: 640, y: 425, zoom: 1, mobileZoom: 1 };
const detail = { x: 980, y: 650, zoom: 1.8, mobileZoom: 2.5 };
const editor = 'aside [contenteditable="true"]';
export const AUTOCOMPLETE_DEMO_SHOTS: readonly BlogDemoShot[] = [
  { label: "Reply in your own words", duration: 2200, camera: wide },
  {
    label: "Open the designer",
    duration: 1500,
    camera: detail,
    action: { selector: '[data-prospect-id="use_case_demo_audience_1"]' },
  },
  {
    label: "Open conversation options",
    duration: 1500,
    camera: detail,
    action: { selector: '[aria-label="Profile menu"]' },
  },
  {
    label: "Read their LinkedIn conversation",
    duration: 1500,
    camera: detail,
    action: { selector: '[role="menuitem"]', text: "Message on LinkedIn" },
  },
  {
    label: "Read the question before replying",
    duration: 3000,
    camera: detail,
    focus: { selector: '[role="log"] article', all: true },
  },
  {
    label: "Start the reply",
    duration: 1500,
    camera: detail,
    action: { selector: editor, input: AUTOCOMPLETE_PREFIX },
  },
  {
    label: "Consider the inline suggestion",
    duration: 2300,
    camera: detail,
    waitFor: { selector: "aside div", text: AUTOCOMPLETE_SUGGESTION },
    focus: { selector: editor },
  },
  {
    label: "Accept with Tab",
    duration: 1500,
    camera: detail,
    action: { selector: editor, key: "Tab" },
  },
  {
    label: "Check the accepted words",
    duration: 2000,
    camera: detail,
    waitFor: { selector: editor, containsText: AUTOCOMPLETE_SUGGESTION },
    focus: { selector: editor },
  },
  {
    label: "Edit the wording and keep writing",
    duration: 1500,
    camera: detail,
    action: { selector: editor, input: AUTOCOMPLETE_EDITED },
  },
  {
    label: "A suggestion you do not want",
    duration: 2100,
    camera: detail,
    waitFor: { selector: "aside div", text: "it every day" },
    focus: { selector: editor },
  },
  {
    label: "Dismiss with Escape",
    duration: 1500,
    camera: detail,
    action: { selector: editor, key: "Escape" },
  },
  {
    label: "Finish with a statement you can stand behind",
    duration: 1500,
    camera: detail,
    action: { selector: editor, input: AUTOCOMPLETE_FINAL },
  },
  {
    label: "Review your reply",
    duration: 3000,
    camera: detail,
    focus: { selector: editor },
  },
  {
    label: "Send the reply",
    duration: 1500,
    camera: detail,
    action: { selector: 'aside button[aria-label="Send"]' },
  },
  {
    label: "Check the sent message",
    duration: 3000,
    camera: detail,
    waitFor: {
      selector: '[role="log"] article',
      containsText: AUTOCOMPLETE_FINAL,
    },
    focus: {
      selector: '[role="log"] article',
      containsText: AUTOCOMPLETE_FINAL,
    },
  },
  { label: "Your words, with a little help", duration: 2600, camera: wide },
];

export const MEDIA_DEMO_SHOTS: readonly BlogDemoShot[] = [
  { label: "Give the agent a relevant clip", duration: 2200, camera: wide },
  {
    label: "Open the designer's profile",
    duration: 1500,
    camera: detail,
    action: { selector: '[data-prospect-id="use_case_demo_audience_1"]' },
  },
  {
    label: "Plan an approach for this person",
    duration: 1500,
    camera: detail,
    action: { selector: "aside button", text: "Agent" },
  },
  {
    label: "Find the clip in workspace attachments",
    duration: 1500,
    camera: detail,
    action: {
      selector: 'main [contenteditable="true"]',
      input: "@client",
    },
  },
  {
    label: "Narrow the attachment search",
    duration: 1500,
    camera: detail,
    action: {
      selector: 'main [contenteditable="true"]',
      input: "-feedback",
      inputMode: "append",
    },
  },
  {
    label: "Choose the client-feedback walkthrough",
    duration: 1500,
    camera: detail,
    action: {
      selector: '[role="option"]',
      containsText: "client-feedback.mp4",
    },
  },
  {
    label: "Explain who it is for and what it shows",
    duration: 1500,
    camera: detail,
    action: {
      selector: 'main [contenteditable="true"]',
      input:
        "Create a plan for Nora. Use this demo in the first message: it shows a client leaving feedback without creating an account. Keep the message short and explain the clip.",
    },
  },
  {
    label: "Check the attached filename",
    duration: 2500,
    camera: detail,
    focus: { selector: '[role="log"]' },
  },
  {
    label: "Ask for the plan",
    duration: 1500,
    camera: detail,
    action: { selector: 'button[aria-label="Send message"]' },
  },
  {
    label: "Open the proposed outreach",
    duration: 1500,
    camera: detail,
    action: { selector: "button", text: "Show plan" },
  },
  {
    label: "Read the proposed introduction",
    duration: 3000,
    camera: detail,
    focus: { selector: "aside article" },
  },
  {
    label: "Review the message and attachment together",
    duration: 1500,
    camera: detail,
    action: { selector: "aside button", text: "Edit" },
  },
  {
    label: "The clip accompanies the draft",
    duration: 3500,
    camera: detail,
    waitFor: { selector: "aside video" },
    focus: { selector: "aside" },
  },
  {
    label: "A short explanation, with something useful to show",
    duration: 2600,
    camera: wide,
  },
];

export const DM_DEMO_SHOTS: readonly BlogDemoShot[] = [
  {
    label: "Keep the conversation with the person",
    duration: 2200,
    camera: wide,
  },
  {
    label: "Open Nora's profile",
    duration: 1500,
    camera: detail,
    action: { selector: '[data-prospect-id="use_case_demo_audience_1"]' },
  },
  {
    label: "Read the original context",
    duration: 1500,
    camera: detail,
    action: { selector: '[role="tab"]', text: "Relevant activity" },
  },
  {
    label: "Why the feedback workflow is relevant",
    duration: 2600,
    camera: detail,
    focus: { selector: '[role="tabpanel"]' },
  },
  {
    label: "Open conversation options",
    duration: 1500,
    camera: detail,
    action: { selector: '[aria-label="Profile menu"]' },
  },
  {
    label: "Read the LinkedIn conversation",
    duration: 1500,
    camera: detail,
    action: { selector: '[role="menuitem"]', text: "Message on LinkedIn" },
  },
  {
    label: "Read the introduction and reply",
    duration: 3200,
    camera: detail,
    focus: { selector: '[role="log"] article', all: true },
  },
  {
    label: "Find the relevant screenshot",
    duration: 1500,
    camera: detail,
    action: { selector: editor, input: "@client-feedback" },
  },
  {
    label: "Attach the client review screen",
    duration: 1500,
    camera: detail,
    action: {
      selector: '[role="option"]',
      containsText: "client-feedback.png",
    },
  },
  {
    label: "Answer Nora and explain the image",
    duration: 1500,
    camera: detail,
    action: { selector: editor, input: DM_LINKEDIN_REPLY },
  },
  {
    label: "Review the reply and screenshot",
    duration: 2600,
    camera: detail,
    focus: {
      selector:
        'aside [contenteditable="true"], aside [data-slot="attachment"]',
      all: true,
    },
  },
  {
    label: "Send the LinkedIn reply",
    duration: 1500,
    camera: detail,
    action: { selector: 'aside button[aria-label="Send"]' },
  },
  {
    label: "The reply and image are in the conversation",
    duration: 3000,
    camera: detail,
    waitFor: {
      selector: '[role="log"] article',
      containsText: DM_LINKEDIN_REPLY,
    },
    focus: {
      selector: '[role="log"] article',
      containsText: DM_LINKEDIN_REPLY,
    },
  },
  {
    label: "Return to the profile",
    duration: 1500,
    camera: detail,
    action: { selector: 'aside button[aria-label="Go back"]' },
  },
  {
    label: "Return to the list",
    duration: 1500,
    camera: detail,
    action: { selector: 'aside button[aria-label="Go back"]' },
  },
  {
    label: "Open an X conversation",
    duration: 1500,
    camera: detail,
    action: { selector: '[data-prospect-id="use_case_demo_audience_3"]' },
  },
  {
    label: "Open Samir's conversation options",
    duration: 1500,
    camera: detail,
    action: { selector: '[aria-label="Profile menu"]' },
  },
  {
    label: "Read the X conversation",
    duration: 1500,
    camera: detail,
    action: { selector: '[role="menuitem"]', text: "DM on X/Twitter" },
  },
  {
    label: "Read Samir's reply",
    duration: 3000,
    camera: detail,
    focus: { selector: '[role="log"] article', all: true },
  },
  {
    label: "Write a relevant answer",
    duration: 1500,
    camera: detail,
    action: { selector: editor, input: DM_X_REPLY },
  },
  {
    label: "Send the X reply",
    duration: 1500,
    camera: detail,
    action: { selector: 'aside button[aria-label="Send"]' },
  },
  {
    label: "Check the sent reply",
    duration: 3000,
    camera: detail,
    waitFor: { selector: '[role="log"] article', containsText: DM_X_REPLY },
    focus: { selector: '[role="log"] article', containsText: DM_X_REPLY },
  },
  {
    label: "Two platforms, conversations in context",
    duration: 2600,
    camera: wide,
  },
];

export const VOICE_DEMO_SHOTS: readonly BlogDemoShot[] = [
  { label: "Answer with a short voice note", duration: 2200, camera: wide },
  {
    label: "Open Nora's profile",
    duration: 1500,
    camera: detail,
    action: { selector: '[data-prospect-id="use_case_demo_audience_1"]' },
  },
  {
    label: "Open conversation options",
    duration: 1500,
    camera: detail,
    action: { selector: '[aria-label="Profile menu"]' },
  },
  {
    label: "Open your LinkedIn conversation",
    duration: 1500,
    camera: detail,
    action: { selector: '[role="menuitem"]', text: "Message on LinkedIn" },
  },
  {
    label: "Read the conversation before recording",
    duration: 3000,
    camera: detail,
    focus: { selector: '[role="log"] article', all: true },
  },
  {
    label: "Record a first take",
    duration: 1500,
    camera: detail,
    action: { selector: 'button[aria-label="Record voice note"]' },
  },
  {
    label: "Record the first sentence",
    duration: 1500,
    camera: detail,
    waitFor: {
      selector:
        'section[aria-label="Voice note"] time:is([datetime="PT1S"],[datetime="PT2S"],[datetime="PT3S"],[datetime="PT4S"])',
    },
    focus: { selector: 'section[aria-label="Voice note"]' },
  },
  {
    label: "Stop and review",
    duration: 1500,
    camera: detail,
    action: { selector: 'button[aria-label="Stop recording"]' },
  },
  {
    label: "Discard this take",
    duration: 1500,
    camera: detail,
    action: { selector: 'button[aria-label="Delete voice note"]' },
  },
  {
    label: "Record the replacement",
    duration: 1500,
    camera: detail,
    action: { selector: 'button[aria-label="Record voice note"]' },
  },
  {
    label: "Keep the answer short",
    duration: 1600,
    camera: detail,
    waitFor: {
      selector:
        'section[aria-label="Voice note"] time:is([datetime="PT3S"],[datetime="PT4S"],[datetime="PT5S"],[datetime="PT6S"],[datetime="PT7S"])',
    },
    focus: { selector: 'section[aria-label="Voice note"]' },
  },
  {
    label: "Stop the recording",
    duration: 1500,
    camera: detail,
    action: { selector: 'button[aria-label="Stop recording"]' },
  },
  {
    label: "Play back before sending",
    duration: 1500,
    camera: detail,
    action: { selector: 'button[aria-label="Play voice note"]' },
  },
  {
    label: "Listen to the replacement",
    duration: 3000,
    camera: detail,
    focus: { selector: 'section[aria-label="Voice note"]' },
  },
  {
    label: "Send the reviewed voice note",
    duration: 1500,
    camera: detail,
    action: { selector: 'button[aria-label="Send voice note"]' },
  },
  {
    label: "The voice note is in the conversation",
    duration: 3000,
    camera: detail,
    waitFor: { selector: '[role="log"] button[aria-label="Play voice note"]' },
    focus: { selector: '[role="log"] article:last-child' },
  },
  { label: "Recorded, reviewed, and sent", duration: 2600, camera: wide },
];
