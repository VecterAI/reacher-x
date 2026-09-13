import type { BlogDemoShot, DemoTarget } from "./blogDemoHelpers";
import { AUDIENCE_DEMO_IDS, type AudienceDemoId } from "./blogDemoCatalog";
import { AUDIENCE_DEMO_INVITATIONS } from "./audienceDemoCopy";

const wide = { x: 640, y: 425, zoom: 1, mobileZoom: 1 };
const detail = { x: 1030, y: 400, zoom: 1.65, mobileZoom: 2.3 };
const person = (index: number): DemoTarget => ({
  selector: `[data-prospect-id="use_case_demo_audience_${index}"]`,
});
const profileMenu = { selector: '[aria-label="Profile menu"]' };
const back = { selector: 'aside button[aria-label="Go back"]' };
const tab = (text: string) => ({ selector: '[role="tab"]', text });
const menu = (text: string) => ({ selector: '[role="menuitem"]', text });
const click = (label: string, action: DemoTarget): BlogDemoShot => ({
  label,
  action,
  duration: 1500,
  camera: detail,
});

function audienceShots(id: AudienceDemoId): readonly BlogDemoShot[] {
  const exclude =
    id === "find-potential-customers" || id === "find-research-participants";
  return [
    { label: "A focused workspace", duration: 2200, camera: wide },
    {
      label: "Start with a specific brief",
      duration: 3500,
      camera: { ...wide, zoom: 1.65, mobileZoom: 2.4 },
      focus: { selector: 'textarea[name="rawUserDescription"]' },
    },
    click("Open the people found", {
      selector: 'nav a[href="/"], [data-sidebar="menu-button"][href="/"]',
    }),
    click("Read a promising match", person(1)),
    click("Check the original post", tab("Relevant activity")),
    {
      label: "Evidence behind the match",
      duration: 3500,
      camera: detail,
      focus: { selector: '[role="tabpanel"]' },
    },
    ...(exclude
      ? [
          click("Compare another result", back),
          click("Inspect a possible mismatch", person(2)),
          click("Read beyond the headline", tab("Relevant activity")),
          {
            label:
              id === "find-potential-customers"
                ? "Teaching design is different from doing client work"
                : "This tutor does not manage their own bookings",
            duration: 3200,
            camera: detail,
            focus: { selector: '[role="tabpanel"]' },
          },
          click("Remove the unsuitable match", profileMenu),
          click("Archive this result", menu("Archive")),
          click("Return to the list", back),
          click("Return to the relevant person", person(1)),
        ]
      : []),
    ...(!exclude ? [click("Review the introduction", tab("Overview"))] : []),
    click("Read the complete proposed message", {
      selector: "aside article li button",
      text: "Show more",
    }),
    {
      label: "A message tied to their work",
      duration: 3500,
      camera: detail,
      focus: { selector: "aside article" },
    },
    click("Open their contact options", profileMenu),
    click("Open the conversation", menu("Message on LinkedIn")),
    ...(id === "find-creators"
      ? [
          {
            label: "Find the product walkthrough",
            duration: 1500,
            camera: detail,
            action: {
              selector: 'aside [contenteditable="true"]',
              input: "@reacherx-workflow",
            },
          },
          click("Attach the current product clip", {
            selector: '[role="option"]',
            containsText: "reacherx-workflow.mp4",
          }),
        ]
      : []),
    {
      label: "Write the introduction",
      duration: 1500,
      camera: detail,
      action: {
        selector: 'aside [contenteditable="true"]',
        input: AUDIENCE_DEMO_INVITATIONS[id],
      },
    },
    {
      label: "Review before sending",
      duration: 3200,
      camera: detail,
      focus: { selector: 'aside [contenteditable="true"]' },
    },
    click("Send the introduction", {
      selector: 'aside button[aria-label="Send"]',
    }),
    {
      label: "The sent message stays in the conversation",
      duration: 3500,
      camera: detail,
      waitFor: { selector: '[role="log"] article' },
      focus: { selector: '[role="log"] article' },
    },
    { label: "Ready to follow the conversation", duration: 2600, camera: wide },
  ];
}

export const AUDIENCE_DEMO_SHOTS = Object.fromEntries(
  AUDIENCE_DEMO_IDS.map((id) => [id, audienceShots(id)])
) as Record<AudienceDemoId, readonly BlogDemoShot[]>;
