import {
  REACH_OUT_MEMORY_SHOTS,
  REACH_OUT_VIDEO_SHOTS,
  REACH_OUT_BUBBLE_SHOTS,
  REACH_OUT_UNICODE_SHOTS,
} from "./reachOutDemoShots";
import { BATCH_DEMO_SHOTS } from "./batchDemoShots";
import { SETUP_DEMO_SHOTS } from "./setupDemoShots";
import {
  VOICE_DEMO_SHOTS,
  DM_DEMO_SHOTS,
  AUTOCOMPLETE_DEMO_SHOTS,
  MEDIA_DEMO_SHOTS,
} from "./conversationDemoShots";
import {
  AUTOMATION_DEMO_SHOTS,
  ANALYTICS_DEMO_SHOTS,
  OBSERVABILITY_DEMO_SHOTS,
  MEMORY_DEMO_SHOTS,
} from "./reportingDemoShots";
import { BLOG_DEMO_IDS, type BlogDemoId } from "./blogDemoCatalog";
import {
  AUDIENCE_DEMO_SHOTS,
  buildUseCaseWalkthroughShots,
} from "./audienceDemoShots";
import {
  DEMO_DESIGN_WIDTH,
  DEMO_DESIGN_HEIGHT,
} from "@/features/landing/ui/components/use-case-demo/demoPresentationHelpers";

export type { BlogDemoId } from "./blogDemoCatalog";
export { BLOG_DEMO_IDS } from "./blogDemoCatalog";
export interface DemoCamera {
  x: number;
  y: number;
  zoom: number;
  mobileZoom: number;
}
export interface DemoTarget {
  selector: string;
  text?: string;
  containsText?: string;
  within?: { selector: string; containsText: string };
  /** Frame the union of matching elements when used as a camera focus. */
  all?: boolean;
}
export interface DemoRect {
  x: number;
  y: number;
  width: number;
  height: number;
}
export interface DemoAction extends DemoTarget {
  input?: string;
  inputMode?: "replace" | "append";
  key?: string;
}
export interface BlogDemoShot {
  label: string;
  duration: number;
  camera: DemoCamera;
  focus?: DemoTarget;
  /** Visible outcome required before presenting this scene. */
  waitFor?: DemoTarget;
  action?: DemoAction;
}
// Pointer travel takes 1050ms; activate 50ms after it reaches the target.
export const BLOG_DEMO_CLICK_AT_MS = 1100;
const CLICK_SHOT_DURATION_MS = 1500;
const WORKSPACE_SWITCH_DURATION_MS = 2000;

const wide = { x: 640, y: 425, zoom: 1, mobileZoom: 1 };
const profile = { x: 1020, y: 400, zoom: 1.8, mobileZoom: 2.5 };
const sidebar = { x: 150, y: 160, zoom: 2.1, mobileZoom: 3 };
const tab = (text: string): DemoTarget => ({ selector: '[role="tab"]', text });
const menuItem = (text: string): DemoTarget => ({
  selector: '[role="menuitem"]',
  text,
});
const switcher = { selector: '[role="combobox"]' };
const firstPerson = {
  selector: '[data-prospect-id="use_case_demo_candidates_1"]',
};
const profileMenu = { selector: '[aria-label="Profile menu"]' };
/** Stories contain camera direction and DOM actions, never alternate app state. */
export const BLOG_DEMO_SHOTS: Record<BlogDemoId, readonly BlogDemoShot[]> = {
  ...AUDIENCE_DEMO_SHOTS,
  "reach-out-writing-preferences": REACH_OUT_MEMORY_SHOTS,
  "reach-out-personal-video": REACH_OUT_VIDEO_SHOTS,
  "reach-out-message-bubbles": REACH_OUT_BUBBLE_SHOTS,
  "reach-out-unicode-formatting": REACH_OUT_UNICODE_SHOTS,
  "send-voice-notes": VOICE_DEMO_SHOTS,
  "create-plans-for-several-people": BATCH_DEMO_SHOTS,
  "getting-started-with-reacherx": SETUP_DEMO_SHOTS,
  "manage-dm-conversations": DM_DEMO_SHOTS,
  "introducing-reacherx-v4": buildUseCaseWalkthroughShots("find-candidates"),
  "outreach-with-images-and-video": MEDIA_DEMO_SHOTS,
  "write-with-autocomplete": AUTOCOMPLETE_DEMO_SHOTS,
  "what-reacherx-does-automatically": AUTOMATION_DEMO_SHOTS,
  "teach-reacherx-what-you-want": MEMORY_DEMO_SHOTS,
  "read-your-reacherx-analytics": ANALYTICS_DEMO_SHOTS,
  "understand-agent-observability": OBSERVABILITY_DEMO_SHOTS,
  "how-reacherx-enrichment-works": [
    { label: "Research attached to each person", duration: 2200, camera: wide },
    {
      label: "Open the researched profile",
      duration: 1500,
      camera: profile,
      action: firstPerson,
    },
    {
      label: "Profile details and qualification",
      duration: 3500,
      camera: profile,
      focus: { selector: 'aside [role="tabpanel"]' },
    },
    {
      label: "Check the supporting posts",
      duration: 1500,
      camera: profile,
      action: tab("Relevant activity"),
    },
    {
      label: "Evidence behind the qualification",
      duration: 4000,
      camera: profile,
      focus: { selector: 'aside [role="tabpanel"]' },
    },
    {
      label: "Return to detailed research",
      duration: 1500,
      camera: profile,
      action: tab("Overview"),
    },
    {
      label: "Expand the researched details",
      duration: 1500,
      camera: profile,
      action: {
        selector: 'aside [role="tabpanel"] section > div > button',
        text: "Show more",
      },
    },
    {
      label: "Inspect the details below the introduction",
      duration: 3000,
      camera: profile,
      focus: { selector: "aside section", containsText: "Location" },
    },
    {
      label: "Open professional profile options",
      duration: 1500,
      camera: profile,
      action: profileMenu,
    },
    {
      label: "Open the dedicated LinkedIn profile",
      duration: 1500,
      camera: profile,
      action: menuItem("Open on LinkedIn"),
    },
    {
      label: "Review experience, skills and posts",
      duration: 3500,
      camera: profile,
      focus: { selector: "aside" },
    },
    {
      label: "Return to the researched person",
      duration: 1500,
      camera: profile,
      action: { selector: 'aside button[aria-label="Go back"]' },
    },
    {
      label: "Open the X profile",
      duration: 1500,
      camera: profile,
      action: { selector: "aside button", text: "X/Twitter" },
    },
    {
      label: "Review the public X profile and activity",
      duration: 3500,
      camera: profile,
      focus: { selector: "aside" },
    },
    { label: "Research in context", duration: 2600, camera: wide },
  ],
  "find-candidates": buildUseCaseWalkthroughShots("find-candidates"),
  "manage-people-with-reacherx": [
    {
      label: "Your candidates",
      duration: 2200,
      camera: wide,
    },
    {
      label: "Open the candidate",
      duration: CLICK_SHOT_DURATION_MS,
      camera: { ...wide, zoom: 1.5, mobileZoom: 2.4 },
      action: firstPerson,
    },
    {
      label: "Inspect the candidate history",
      duration: 1500,
      camera: profile,
      action: tab("Activity log"),
    },
    {
      label: "Review discovery and qualification",
      duration: 3500,
      camera: profile,
      focus: { selector: 'aside [role="tabpanel"]' },
    },
    {
      label: "Return to the overview",
      duration: 1500,
      camera: profile,
      action: tab("Overview"),
    },
    {
      label: "Update the hiring stage",
      duration: CLICK_SHOT_DURATION_MS,
      camera: profile,
      action: profileMenu,
    },
    {
      label: "Mark Interviewing",
      duration: CLICK_SHOT_DURATION_MS,
      camera: profile,
      action: menuItem('Mark "Interviewing"'),
    },
    {
      label: "Return to candidates",
      duration: CLICK_SHOT_DURATION_MS,
      camera: profile,
      action: { selector: 'aside button[aria-label="Go back"]' },
    },
    {
      label: "Find them in Interviewing",
      duration: CLICK_SHOT_DURATION_MS,
      camera: { ...wide, zoom: 1.65, mobileZoom: 2.5 },
      action: tab("Interviewing"),
    },
    {
      label: "The candidate is now Interviewing",
      duration: 2600,
      camera: { ...wide, zoom: 1.6, mobileZoom: 2.5 },
      focus: firstPerson,
    },
    {
      label: "Your updated candidate list",
      duration: 2600,
      camera: wide,
    },
  ],
  "workspaces-explained": [
    {
      label: "Separate workspaces for separate jobs",
      duration: 2200,
      camera: wide,
    },
    {
      label: "Create a separate workspace for another job",
      duration: 1500,
      camera: sidebar,
      action: { selector: "button", text: "New workspace" },
    },
    ...SETUP_DEMO_SHOTS.slice(0, 11),
    {
      label: "Return to the existing hiring workspace",
      duration: 1500,
      camera: sidebar,
      action: switcher,
    },
    {
      label: "Choose the original hiring workspace",
      duration: 2000,
      camera: sidebar,
      action: {
        selector: '[role="option"]',
        text: "Hiring — product designer",
      },
    },
    {
      label: "Your hiring workspace",
      duration: 2200,
      camera: wide,
    },
    {
      label: "Switch your workspace",
      duration: CLICK_SHOT_DURATION_MS,
      camera: sidebar,
      action: switcher,
    },
    {
      label: "Choose People to try the app",
      duration: WORKSPACE_SWITCH_DURATION_MS,
      camera: sidebar,
      action: {
        selector: '[role="option"]',
        text: "Customers — freelance designers",
      },
    },
    {
      label: "Same page, different people",
      waitFor: { selector: '[data-prospect-id="use_case_demo_customers_1"]' },
      duration: 2600,
      camera: { ...wide, zoom: 1, mobileZoom: 1.6 },
      focus: { selector: "main" },
    },
    {
      label: "Switch back to hiring",
      duration: CLICK_SHOT_DURATION_MS,
      camera: sidebar,
      action: switcher,
    },
    {
      label: "Choose Hire a designer",
      duration: WORKSPACE_SWITCH_DURATION_MS,
      camera: sidebar,
      action: {
        selector: '[role="option"]',
        text: "Hiring — product designer",
      },
    },
    {
      label: "Your candidates are still here",
      waitFor: firstPerson,
      duration: 2600,
      camera: wide,
    },
  ],
};
export function isBlogDemoId(value: unknown): value is BlogDemoId {
  return BLOG_DEMO_IDS.some((id) => id === value);
}
export function getBlogDemoDuration(id: BlogDemoId) {
  return BLOG_DEMO_SHOTS[id].reduce((total, shot) => total + shot.duration, 0);
}
export function getBlogDemoFrame(
  id: BlogDemoId,
  time: number,
  sceneRange?: readonly [number, number]
) {
  const allShots = BLOG_DEMO_SHOTS[id];
  const first = sceneRange?.[0] ?? 0;
  const last = sceneRange?.[1] ?? allShots.length - 1;
  if (
    !Number.isInteger(first) ||
    !Number.isInteger(last) ||
    first < 0 ||
    last < first ||
    last >= allShots.length
  )
    throw new Error("Invalid demo scene range");
  const shots = allShots.slice(first, last + 1);
  const duration = shots.reduce((total, shot) => total + shot.duration, 0);
  const elapsed = Number.isFinite(time) ? Math.max(0, time) % duration : 0;
  let start = 0;
  const index = shots.findIndex((shot) => {
    if (elapsed < start + shot.duration) return true;
    start += shot.duration;
    return false;
  });
  const shot = shots[index];
  return {
    index: index + first,
    shot,
    camera: shot.camera,
    elapsed,
    duration,
    localTime: elapsed - start,
    start,
    actionAt: BLOG_DEMO_CLICK_AT_MS,
  };
}
export function getBlogDemoPlacement(
  width: number,
  height: number,
  camera: DemoCamera,
  presentation: "cinematic" | "fixed" = "cinematic"
) {
  const safeWidth = Math.max(1, width),
    safeHeight = Math.max(1, height);
  const fit =
    Math.min(safeWidth / DEMO_DESIGN_WIDTH, safeHeight / DEMO_DESIGN_HEIGHT) *
    0.88;
  if (presentation === "fixed") {
    const scale = Math.min(
      safeWidth / DEMO_DESIGN_WIDTH,
      safeHeight / DEMO_DESIGN_HEIGHT
    );
    return {
      x: 0,
      y: 0,
      scale,
    };
  }
  const zoom = safeWidth < 640 ? camera.mobileZoom : camera.zoom;
  const scale = fit * Math.max(1, Math.min(3.5, zoom));
  const centerX = Math.max(0, Math.min(DEMO_DESIGN_WIDTH, camera.x));
  const centerY = Math.max(0, Math.min(DEMO_DESIGN_HEIGHT, camera.y));
  // Give a visible app edge a deliberate wallpaper gutter. Never leave a
  // rounded corner flush against the player where only a tiny sliver shows.
  const gutter = Math.max(12, Math.min(24, safeWidth * 0.04));
  const place = (size: number, extent: number, center: number) => {
    if (extent <= size) return (size - extent) / 2;
    const offset = Math.min(
      gutter,
      Math.max(size - extent - gutter, size / 2 - center * scale)
    );
    if (Math.abs(offset) < gutter) return gutter;
    if (Math.abs(offset + extent - size) < gutter)
      return size - extent - gutter;
    return offset;
  };
  return {
    x: place(safeWidth, DEMO_DESIGN_WIDTH * scale, centerX),
    y: place(safeHeight, DEMO_DESIGN_HEIGHT * scale, centerY),
    scale,
  };
}
export function getDemoTargetCamera(
  camera: DemoCamera,
  rect?: DemoRect
): DemoCamera {
  return rect
    ? { ...camera, x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 }
    : camera;
}
export const DEMO_WIDE_CAMERA = wide;

/** Keep the playback pointer visible even when the camera leaves its last target. */
export function getBlogDemoCursorPlacement(
  width: number,
  height: number,
  placement: { x: number; y: number; scale: number },
  point: { x: number; y: number }
) {
  return {
    x: Math.max(
      8,
      Math.min(width - 36, placement.x + point.x * placement.scale - 3)
    ),
    y: Math.max(
      8,
      Math.min(height - 42, placement.y + point.y * placement.scale - 2)
    ),
  };
}

/** A suspended tab/frame must not consume the preparation timeout budget. */
export function advanceBlogDemoWait(
  elapsed: number,
  delta: number,
  active: boolean
) {
  return elapsed + (active ? Math.max(0, Math.min(delta, 100)) : 0);
}

export function getBlogDemoRecoveryAction(
  playback: "playing" | "paused" | "interactive",
  manual: boolean,
  retries: number
) {
  if (manual || playback !== "playing") return "defer";
  return retries < 1 ? "retry" : "pause";
}
