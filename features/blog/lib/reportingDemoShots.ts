import type { BlogDemoShot, DemoTarget } from "./blogDemoHelpers";
const wide = { x: 640, y: 425, zoom: 1, mobileZoom: 1 };
const detail = { x: 980, y: 400, zoom: 1.65, mobileZoom: 2.3 };
const click = (label: string, action: DemoTarget): BlogDemoShot => ({
  label,
  action,
  duration: 1500,
  camera: detail,
});
const section = { selector: 'main [role="toolbar"] [role="combobox"]' };
const option = (text: string) => ({ selector: '[role="option"]', text });
const close = { selector: "main button", text: "Close" };
const row = { selector: "main tbody tr" };

export const AGENT_CLOCK_DEMO_SHOTS: readonly BlogDemoShot[] = [
  { label: "The workspace while you are away", duration: 2400, camera: wide },
  {
    label: "Agent working, around the clock",
    duration: 2400,
    camera: detail,
    focus: { selector: "button", containsText: "Agent working" },
  },
  click("Open the workspace status", {
    selector: "button",
    containsText: "Agent working",
  }),
  {
    label: "Live workspace progress",
    duration: 3200,
    camera: detail,
    waitFor: { selector: '[role="dialog"]' },
    focus: { selector: '[role="dialog"]' },
  },
  click("Pause whenever you want", {
    selector: '[role="dialog"] button',
    text: "Pause △ Agent",
  }),
  {
    label: "Pausing keeps everything you have",
    duration: 2600,
    camera: detail,
    waitFor: { selector: '[role="dialog"]', containsText: "Pause △ Agent?" },
    focus: { selector: '[role="dialog"]' },
  },
  click("Keep the agent running", {
    selector: '[role="dialog"] button',
    text: "Cancel",
  }),
  {
    label: "Discovery never stops for this goal",
    duration: 2600,
    camera: wide,
  },
];

export const OBSERVABILITY_DEMO_SHOTS: readonly BlogDemoShot[] = [
  { label: "△ Agent's work in context", duration: 2200, camera: wide },
  click("Choose an area to inspect", section),
  click("Inspect Discovery", option("Discovery")),
  click("Filter query status", {
    selector: '[role="combobox"]',
    text: "All statuses",
  }),
  click("Show activated queries", option("Activated")),
  click("Open the search query", {
    ...row,
    containsText: '"keyboard navigation" "frontend"',
  }),
  {
    label: "Check the query, status, and results",
    duration: 4000,
    camera: detail,
    focus: { selector: "main .h-full.shrink-0" },
  },
  click("Close the query", close),
  click("Switch the area", section),
  click("Inspect Memory", option("Memory")),
  click("Open the saved instruction", {
    ...row,
    containsText: "Short, question-led introductions",
  }),
  {
    label: "An active instruction from the operator",
    duration: 4000,
    camera: detail,
    focus: { selector: "main .h-full.shrink-0" },
  },
  click("Close the memory", close),
  click("Follow the recorded activity", section),
  click("Inspect Activity", option("Activity")),
  click("Open the activation event", {
    ...row,
    containsText: "Discovery query activated",
  }),
  {
    label: "The event behind the query",
    duration: 3500,
    camera: detail,
    focus: { selector: "main .h-full.shrink-0" },
  },
  { label: "Evidence behind △ Agent's work", duration: 2600, camera: wide },
];

export const ANALYTICS_DEMO_SHOTS: readonly BlogDemoShot[] = [
  {
    label: "Start with the workspace and period",
    duration: 2200,
    camera: wide,
  },
  click("Compare a longer period", { selector: '[role="tab"]', text: "30d" }),
  {
    label: "Read the count beneath the reply rate",
    duration: 3200,
    camera: detail,
    focus: { selector: "main article", containsText: "Reply rate" },
  },
  {
    label: "Separate qualification from readiness",
    duration: 3500,
    camera: detail,
    focus: { selector: "main article", all: true },
  },
  click("Find the work waiting for approval", {
    selector: '[data-sidebar="menu-button"][href="/"]',
  }),
  click("Open the candidate with a draft", {
    selector: '[data-prospect-id="use_case_demo_candidates_1"]',
  }),
  {
    label: "Inspect the actual waiting plan",
    duration: 3500,
    camera: detail,
    focus: { selector: "aside article" },
  },
  {
    label: "Use the numbers to choose a next step",
    duration: 2600,
    camera: wide,
  },
];

export function buildMemoryDemoShots(copy: {
  instruction: string;
  request: string;
}): readonly BlogDemoShot[] {
  return [
    { label: "Teach the workspace how to write", duration: 2200, camera: wide },
    {
      label: "Give a clear writing instruction",
      duration: 1500,
      camera: detail,
      action: {
        selector: 'main [contenteditable="true"]',
        input: copy.instruction,
      },
    },
    click("Save the instruction", {
      selector: 'button[aria-label="Send message"]',
    }),
    {
      label: "Check that it was saved",
      duration: 3000,
      camera: detail,
      waitFor: {
        selector: 'button[aria-label="Open memory in Agent observability"]',
      },
      focus: { selector: '[role="log"] [role="status"]' },
    },
    {
      label: "Ask for a new introduction",
      duration: 1500,
      camera: detail,
      action: {
        selector: 'main [contenteditable="true"]',
        input: copy.request,
      },
    },
    click("Create the draft", {
      selector: 'button[aria-label="Send message"]',
    }),
    click("Open the proposed plan", { selector: "button", text: "Show plan" }),
    {
      label: "Read the full draft",
      duration: 1500,
      camera: detail,
      action: { selector: "aside article li button", text: "Show more" },
    },
    {
      label: "Read the introduction using that instruction",
      duration: 4500,
      camera: detail,
      focus: { selector: "aside article" },
    },
    {
      label: "The saved instruction carries into later work",
      duration: 2600,
      camera: wide,
    },
  ];
}

export const MEMORY_DEMO_SHOTS = buildMemoryDemoShots({
  instruction:
    "Remember this for outreach: keep the first message under 80 words. Ask one question. Don't ask for a meeting in the first message.",
  request:
    "Draft a first message to Nora about collecting client feedback. Use the instruction you saved.",
});

export const AUTOMATION_DEMO_SHOTS: readonly BlogDemoShot[] = [
  { label: "Your workspace controls", duration: 2200, camera: wide },
  click("Inspect sending approvals", {
    selector: '[role="tab"]',
    text: "Agent",
  }),
  {
    label: "Sending approvals start enabled",
    duration: 2600,
    camera: detail,
    focus: { selector: "main article", containsText: "Ask before sending" },
  },
  click("Edit agent settings", { selector: "main button", text: "Edit" }),
  click("Turn off sending approvals", {
    selector: '[role="switch"][aria-label="Toggle ask before sending"]',
  }),
  click("Review the change", { selector: "main button", text: "Done" }),
  {
    label: "Read the existing draft-plan count",
    duration: 3500,
    camera: detail,
    focus: { selector: '[role="alertdialog"]' },
  },
  click("Confirm the existing plans may start", {
    selector: '[role="alertdialog"] button',
    text: "Turn off and start plans",
  }),
  {
    label: "The workspace now sends without another approval",
    duration: 2300,
    camera: detail,
    waitFor: { selector: '[role="switch"][aria-checked="false"]' },
    focus: { selector: "main article", containsText: "Ask before sending" },
  },
  click("Inspect workspace progress", {
    selector: 'button[aria-label="△ Agent is active"]',
  }),
  {
    label: "Discovery and saved progress",
    duration: 2600,
    camera: detail,
    focus: { selector: '[role="dialog"]' },
  },
  click("Pause △ Agent", {
    selector: '[role="dialog"] button',
    text: "Pause △ Agent",
  }),
  {
    label: "Read what pauses and what stays saved",
    duration: 3000,
    camera: detail,
    focus: { selector: '[role="dialog"]' },
  },
  click("Confirm the pause", {
    selector: '[role="dialog"] button',
    text: "Pause △ Agent",
  }),
  click("Inspect the paused workspace", {
    selector: 'button[aria-label="△ Agent is paused"]',
  }),
  {
    label: "△ Agent is paused; progress is preserved",
    duration: 2600,
    camera: detail,
    focus: { selector: '[role="dialog"]' },
  },
  click("Resume from the same dialog", {
    selector: '[role="dialog"] button',
    text: "Resume △ Agent",
  }),
  {
    label: "△ Agent resumes",
    duration: 2300,
    camera: detail,
    waitFor: { selector: '[role="dialog"] button', text: "Pause △ Agent" },
    focus: { selector: '[role="dialog"]' },
  },
  click("Return to the workspace", {
    selector: '[role="dialog"] button',
    text: "Close",
  }),
  click("Inspect the contacted people", {
    selector: '[data-sidebar="menu-button"][href="/"]',
  }),
  click("View contacted candidates", {
    selector: '[role="tab"][id$="trigger-contacted"]',
  }),
  click("Review the completed outreach", {
    selector: '[data-prospect-id="use_case_demo_candidates_1"]',
  }),
  {
    label: "The plan and its task completed",
    duration: 3500,
    camera: detail,
    waitFor: { selector: "aside article", containsText: "Completed" },
    focus: { selector: "aside article" },
  },
  { label: "You control when △ Agent works", duration: 2600, camera: wide },
];
