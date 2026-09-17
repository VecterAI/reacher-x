import type { BlogDemoShot, DemoAction } from "./blogDemoHelpers";
const wide = { x: 640, y: 425, zoom: 1, mobileZoom: 1 };
const detail = { x: 950, y: 420, zoom: 1.65, mobileZoom: 2.4 };
const click = (label: string, action: DemoAction): BlogDemoShot => ({
  label,
  action,
  duration: 1500,
  camera: detail,
});
const editor = 'main [contenteditable="true"]';
const send = { selector: 'button[aria-label="Send message"]' };
export const SETUP_DEMO_SHOTS: readonly BlogDemoShot[] = [
  { label: "Start with one concrete job", duration: 2200, camera: wide },
  {
    label: "Describe the contract and relevant experience",
    duration: 1500,
    camera: detail,
    action: {
      selector: editor,
      input:
        "I need an engineer for a contract project. They should have experience building checkout or payment features for web apps. Help me find people whose work shows that experience.",
    },
  },
  click("Ask △ Agent to propose an audience", send),
  click("Review the example candidates", {
    selector: "button",
    text: "Review",
  }),
  {
    label: "Examples steer the search",
    duration: 3000,
    camera: detail,
    focus: { selector: "#rx-onboarding-panel" },
  },
  {
    label: "Tighten the requirements",
    duration: 1500,
    camera: detail,
    action: {
      selector: editor,
      input:
        "Require TypeScript and Stripe checkout experience. This is a six-week contract, not a permanent role.",
    },
  },
  click("Send the correction", send),
  {
    label: "Check the revised examples",
    duration: 3500,
    camera: detail,
    waitFor: {
      selector: "#rx-onboarding-panel",
      containsText: "Contract TypeScript engineer",
    },
    focus: { selector: "#rx-onboarding-panel" },
  },
  click("Approve these examples", {
    selector: "#rx-onboarding-panel button",
    text: "Continue",
  }),
  {
    label: "The workspace is ready",
    duration: 3000,
    camera: detail,
    waitFor: { selector: "button", text: "View candidates" },
    focus: { selector: '[role="log"] article', all: true },
  },
  click("Review the first result", {
    selector: "button",
    text: "View candidates",
  }),
  click("Open Erin's profile", {
    selector: '[data-prospect-id="demo_contract_engineer"]',
  }),
  click("Check the actual payment experience", {
    selector: '[role="tab"]',
    text: "Relevant activity",
  }),
  {
    label: "Stripe checkout, retries, and duplicate orders",
    duration: 3500,
    camera: detail,
    focus: { selector: '[role="tabpanel"]' },
  },
  click("Ask for an approach to Erin", {
    selector: "aside button",
    text: "Agent",
  }),
  {
    label: "Ask about contract availability",
    duration: 1500,
    camera: detail,
    action: {
      selector: editor,
      input:
        "Draft an introduction to Erin for the six-week TypeScript and Stripe contract. Ask about availability; don't assume she is available.",
    },
  },
  click("Prepare the introduction", send),
  click("Open the plan for review", { selector: "button", text: "Show plan" }),
  click("Read the complete introduction", {
    selector: "aside article li button",
    text: "Show more",
  }),
  {
    label: "Review the first message before sending",
    duration: 3500,
    camera: detail,
    focus: { selector: "aside article" },
  },
  {
    label: "A focused workspace and a relevant first message",
    duration: 2600,
    camera: wide,
  },
];
