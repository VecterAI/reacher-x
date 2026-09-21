import { PUBLIC_OUTREACH_DEMO_COPY } from "./publicOutreachDemoCopy";
import type { BlogDemoShot } from "./blogDemoHelpers";
import { AUDIENCE_DEMO_IDS, type AudienceDemoId } from "./blogDemoCatalog";
import {
  USE_CASE_WALKTHROUGH_COPY,
  type UseCaseWalkthroughId,
} from "./useCaseWalkthroughCopy";

const wide = { x: 640, y: 425, zoom: 1, mobileZoom: 1 };
const detail = { x: 1000, y: 425, zoom: 1.65, mobileZoom: 2.3 };
const click = (
  label: string,
  action: NonNullable<BlogDemoShot["action"]>
): BlogDemoShot => ({
  label,
  action,
  duration: 1500,
  camera: detail,
});
const tab = (text: string) => ({ selector: '[role="tab"]', text });
const menu = (text: string) => ({ selector: '[role="menuitem"]', text });
const profileMenu = { selector: '[aria-label="Profile menu"]' };
const back = { selector: 'aside button[aria-label="Go back"]' };

export function buildUseCaseWalkthroughShots(
  id: UseCaseWalkthroughId
): readonly BlogDemoShot[] {
  const copy = USE_CASE_WALKTHROUGH_COPY[id];
  const publicCopy = PUBLIC_OUTREACH_DEMO_COPY[id];
  const firstId =
    id === "find-candidates"
      ? "use_case_demo_candidates_1"
      : "use_case_demo_audience_1";
  return [
    { label: "Start a workspace for this goal", duration: 2200, camera: wide },
    {
      label: "Describe the goal and audience",
      duration: 1500,
      camera: wide,
      action: {
        selector: 'main [contenteditable="true"]',
        input: copy.request,
      },
    },
    click("Ask △ Agent", { selector: 'button[aria-label="Send message"]' }),
    click("Review the proposed audience", {
      selector: "button",
      text: "Review",
    }),
    {
      label: "Read the audience examples",
      duration: 3000,
      camera: detail,
      focus: { selector: "#rx-onboarding-panel" },
    },
    {
      label: "Clarify the criteria and outreach terms",
      duration: 1500,
      camera: wide,
      action: {
        selector: 'main [contenteditable="true"]',
        input: copy.refinement,
      },
    },
    click("Refine the search", {
      selector: 'button[aria-label="Send message"]',
    }),
    {
      label: "Review the refined criteria",
      duration: 3000,
      camera: detail,
      focus: { selector: "#rx-onboarding-panel" },
    },
    click("Confirm and create the workspace", {
      selector: "#rx-onboarding-panel button",
      text: "Continue",
    }),
    {
      label: "Discovery starts in the new workspace",
      duration: 3000,
      camera: wide,
    },
    click("Open the people found", {
      selector: 'nav a[href="/"], [data-sidebar="menu-button"][href="/"]',
    }),
    click("Research a relevant match", {
      selector: `[data-prospect-id="${firstId}"]`,
    }),
    {
      label: "Read the profile and qualification evidence",
      duration: 3000,
      camera: detail,
      focus: { selector: '[role="tabpanel"]' },
    },
    click("Inspect the original activity", tab("Relevant activity")),
    {
      label: "Check evidence against the criteria",
      duration: 3500,
      camera: detail,
      focus: { selector: '[role="tabpanel"]' },
    },
    click("Open the full profile details", tab("Overview")),
    click("Expand the researched details", {
      selector: 'aside [role="tabpanel"] section > div > button',
      text: "Show more",
    }),
    {
      label: "Inspect the researched details",
      duration: 3000,
      camera: detail,
      focus: { selector: "aside section", containsText: "Location" },
    },
    click("Open profile options", profileMenu),
    click("Inspect the dedicated LinkedIn profile", menu("Open on LinkedIn")),
    {
      label: "Review current work and professional context",
      duration: 3500,
      camera: detail,
      focus: { selector: "aside" },
    },
    click("Return to the prospect", back),
    click("Return to the overview", tab("Overview")),
    click("Generate an outreach plan", {
      selector: "aside button",
      text: "Generate plan",
    }),
    click("Review the generated plan", {
      selector: "button",
      text: "Show plan",
    }),
    click("Read the complete message", {
      selector: "aside article li button",
      text: "Show more",
    }),
    {
      label: "Review the proposed introduction",
      duration: 3500,
      camera: detail,
      focus: { selector: "aside article" },
    },
    click("Approve the plan", {
      selector: 'aside [role="toolbar"] button',
      text: "Approve",
    }),
    {
      label: "The first task is ready for approval",
      duration: 2200,
      camera: detail,
      focus: { selector: "aside article li" },
    },
    ...(publicCopy
      ? [
          click("Edit the public comment before posting", {
            selector: "aside article li button",
            text: "Edit",
          }),
          {
            label: "Review the original post and draft together",
            duration: 3000,
            camera: detail,
            waitFor: { selector: "aside button", text: "Approve comment" },
            focus: { selector: "aside" },
          },
          click("Refine the comment", {
            selector: 'aside [contenteditable="true"]',
            input: publicCopy.edited,
          }),
          click("Approve and post the edited comment", {
            selector: "aside button",
            text: "Approve comment",
          }),
          {
            label: "The reviewed comment is posted",
            duration: 2600,
            camera: detail,
            waitFor: { selector: "aside h1", text: "Posted comment" },
          },
          click("Close the posted comment", back),
          click("Return to the plan", {
            selector: "button",
            text: "Show plan",
          }),
          {
            label: "The comment is complete and the message is ready",
            duration: 2600,
            camera: detail,
            focus: { selector: "aside article" },
          },
        ]
      : []),
    click("Approve the message task", {
      selector: "aside article li button",
      text: "Approve",
    }),
    {
      label: "The task and plan complete",
      duration: 3000,
      camera: detail,
      waitFor: { selector: "aside article", containsText: "Completed" },
      focus: { selector: "aside article" },
    },
    click("Open the delivered message", {
      selector: "aside article li button",
      text: "View",
      within: {
        selector: "aside article li",
        containsText:
          id === "find-candidates"
            ? "Introduce the frontend engineer role"
            : "Send a relevant introduction",
      },
    }),
    {
      label: "The sent message and reply belong to the same plan",
      duration: 4000,
      camera: detail,
      waitFor: { selector: '[role="log"] article', containsText: copy.reply },
      focus: { selector: '[role="log"] article', all: true },
    },
    {
      label: "A complete workflow for this goal",
      duration: 2600,
      camera: wide,
    },
  ];
}

export const AUDIENCE_DEMO_SHOTS = Object.fromEntries(
  AUDIENCE_DEMO_IDS.map((id) => [id, buildUseCaseWalkthroughShots(id)])
) as Record<AudienceDemoId, readonly BlogDemoShot[]>;
