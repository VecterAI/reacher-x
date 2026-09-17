import type { BlogDemoShot, DemoAction } from "./blogDemoHelpers";
const wide = { x: 640, y: 425, zoom: 1, mobileZoom: 1 };
const detail = { x: 950, y: 420, zoom: 1.65, mobileZoom: 2.4 };
const act = (label: string, action: DemoAction): BlogDemoShot => ({
  label,
  action,
  duration: 1500,
  camera: detail,
});
const editor = 'main [contenteditable="true"]';
const send = { selector: 'button[aria-label="Send message"]' };
const openPlan = (name: string) => ({
  selector: "button",
  text: "Show plan",
  within: { selector: "article", containsText: name },
});
export const BATCH_DEMO_SHOTS: readonly BlogDemoShot[] = [
  {
    label: "Different people, different invitations",
    duration: 2200,
    camera: wide,
  },
  act("Find Maya in the mention picker", { selector: editor, input: "@Maya" }),
  act("Select the speaker", {
    selector: '[role="option"]',
    containsText: "Maya Shaw",
  }),
  act("Find Tom", { selector: editor, input: "@Tom", inputMode: "append" }),
  act("Select the community host", {
    selector: '[role="option"]',
    containsText: "Tom Reed",
  }),
  act("Find Lee", { selector: editor, input: "@Lee", inputMode: "append" }),
  act("Select the guest", {
    selector: '[role="option"]',
    containsText: "Lee Park",
  }),
  act("Give each person a different role", {
    selector: editor,
    inputMode: "append",
    input:
      "Create a plan for each of these people. Invite Maya to give a ten-minute talk at our free client-feedback workshop. Ask Tom to share it with his design community. Invite Lee to join the discussion as a guest, with no presentation or preparation.",
  }),
  {
    label: "Three selected people, one request",
    duration: 3000,
    camera: detail,
    focus: { selector: editor },
  },
  act("Create the plans", send),
  {
    label: "Two plans finish; one needs a retry",
    duration: 3500,
    camera: detail,
    waitFor: {
      selector: '[role="log"]',
      containsText: "Lee's plan request timed out",
    },
    focus: { selector: '[role="log"]' },
  },
  act("Review Maya's speaking invitation", openPlan("Maya Shaw")),
  {
    label: "Read the full draft",
    duration: 1500,
    camera: detail,
    action: { selector: "aside article li button", text: "Show more" },
  },
  {
    label: "Maya gets a short-talk invitation",
    duration: 3500,
    camera: detail,
    focus: { selector: "aside article" },
  },
  act("Return to the results", {
    selector: 'aside button[aria-label="Go back"]',
  }),
  act("Review Tom's community invitation", openPlan("Tom Reed")),
  {
    label: "Read the full draft",
    duration: 1500,
    camera: detail,
    action: { selector: "aside article li button", text: "Show more" },
  },
  {
    label: "Tom is asked to share, not to speak",
    duration: 3500,
    camera: detail,
    focus: { selector: "aside article" },
  },
  act("Return to retry the failed person", {
    selector: 'aside button[aria-label="Go back"]',
  }),
  act("Select only Lee for the retry", { selector: editor, input: "@Lee" }),
  act("Keep the retry scoped to Lee", {
    selector: '[role="option"]',
    containsText: "Lee Park",
  }),
  act("Retry the guest invitation", {
    selector: editor,
    inputMode: "append",
    input:
      "Retry the plan for Lee only. Invite Lee as a guest, with no presentation or preparation. Keep Maya's and Tom's existing plans.",
  }),
  act("Run the single-person retry", send),
  act("Review Lee's completed plan", openPlan("Lee Park")),
  {
    label: "Read the full draft",
    duration: 1500,
    camera: detail,
    action: { selector: "aside article li button", text: "Show more" },
  },
  {
    label: "Lee gets a guest invitation",
    duration: 3500,
    camera: detail,
    focus: { selector: "aside article" },
  },
  {
    label: "Three plans, each ready for its own review",
    duration: 2600,
    camera: wide,
  },
];
