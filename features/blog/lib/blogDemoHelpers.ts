import {
  DEMO_DESIGN_WIDTH,
  DEMO_DESIGN_HEIGHT,
  type DemoPresentation,
} from "@/features/landing/ui/components/use-case-demo/demoPresentationHelpers";

export const BLOG_DEMO_IDS = [
  "find-candidates",
  "manage-people-with-reacherx",
  "workspaces-explained",
] as const;
export type BlogDemoId = (typeof BLOG_DEMO_IDS)[number];
export interface DemoCamera {
  x: number;
  y: number;
  zoom: number;
  mobileZoom: number;
}
export interface DemoTarget {
  selector: string;
  text?: string;
}
export interface DemoRect {
  x: number;
  y: number;
  width: number;
  height: number;
}
export interface BlogDemoShot {
  label: string;
  duration: number;
  /** Checkpoint used only for seeking, replay, and resuming after manual exploration. */
  app: DemoPresentation;
  camera: DemoCamera;
  focus?: DemoTarget;
  action?: DemoTarget;
}
// Pointer travel takes 1050ms; activate 50ms after it reaches the target.
export const BLOG_DEMO_CLICK_AT_MS = 1100;
const CLICK_SHOT_DURATION_MS = 1500;
const WORKSPACE_SWITCH_DURATION_MS = 2000;

const wide = { x: 640, y: 425, zoom: 1, mobileZoom: 1 };
const profile = { x: 1020, y: 400, zoom: 1.8, mobileZoom: 2.5 };
const sidebar = { x: 150, y: 160, zoom: 2.1, mobileZoom: 3 };
const button = (text: string): DemoTarget => ({ selector: "button", text });
const tab = (text: string): DemoTarget => ({ selector: '[role="tab"]', text });
const menuItem = (text: string): DemoTarget => ({
  selector: '[role="menuitem"]',
  text,
});
const switcher = { selector: '[aria-label="Switch workspace"]' };
const firstPerson = {
  selector: '[data-prospect-id="use_case_demo_candidates_1"]',
};
const profileMenu = { selector: '[aria-label="Profile menu"]' };
const plan = { selector: "[data-demo-plan]" };
const candidates: DemoPresentation = {
  useCase: "candidates",
  page: "prospects",
};
const selected = { ...candidates, selected: true };
const menu = { ...selected, profileMenu: true };

/** Each click changes the same local state a visitor changes. Checkpoints are not playback. */
export const BLOG_DEMO_SHOTS: Record<BlogDemoId, readonly BlogDemoShot[]> = {
  "find-candidates": [
    {
      label: "Your hiring workspace",
      duration: 2200,
      app: { useCase: "candidates", page: "workspace" },
      camera: wide,
    },
    {
      label: "Start with a clear role",
      duration: 3200,
      app: { useCase: "candidates", page: "workspace" },
      camera: { ...wide, zoom: 1.65, mobileZoom: 2.5 },
      focus: { selector: 'textarea[name="rawUserDescription"]' },
    },
    {
      label: "Open the candidates",
      duration: CLICK_SHOT_DURATION_MS,
      app: { useCase: "candidates", page: "workspace" },
      camera: sidebar,
      action: button("Candidates"),
    },
    {
      label: "Review a relevant match",
      duration: CLICK_SHOT_DURATION_MS,
      app: candidates,
      camera: { ...wide, zoom: 1.65, mobileZoom: 2.5 },
      action: firstPerson,
    },
    {
      label: "Check the evidence",
      duration: CLICK_SHOT_DURATION_MS,
      app: selected,
      camera: profile,
      action: tab("Relevant activity"),
    },
    {
      label: "Read the work behind the match",
      duration: 3200,
      app: { ...selected, profileTab: "relevant-activity" },
      camera: profile,
      focus: { selector: '[role="tabpanel"]' },
    },
    {
      label: "Return to the overview",
      duration: CLICK_SHOT_DURATION_MS,
      app: { ...selected, profileTab: "relevant-activity" },
      camera: profile,
      action: tab("Overview"),
    },
    {
      label: "Review the outreach plan",
      duration: 3200,
      app: selected,
      camera: profile,
      focus: plan,
    },
    {
      label: "Ready to reach out",
      duration: 2600,
      app: selected,
      camera: wide,
    },
  ],
  "manage-people-with-reacherx": [
    {
      label: "Your candidates",
      duration: 2200,
      app: candidates,
      camera: wide,
    },
    {
      label: "Open the candidate",
      duration: CLICK_SHOT_DURATION_MS,
      app: candidates,
      camera: { ...wide, zoom: 1.5, mobileZoom: 2.4 },
      action: firstPerson,
    },
    {
      label: "Open the profile menu",
      duration: CLICK_SHOT_DURATION_MS,
      app: selected,
      camera: profile,
      action: profileMenu,
    },
    {
      label: "Open the conversation",
      duration: CLICK_SHOT_DURATION_MS,
      app: menu,
      camera: profile,
      action: menuItem("DM on X/Twitter"),
    },
    {
      label: "Read the reply",
      duration: 4000,
      app: { ...selected, conversation: true },
      camera: profile,
      focus: { selector: '[data-slot="message-scroller-item"]' },
    },
    {
      label: "Return to the profile",
      duration: CLICK_SHOT_DURATION_MS,
      app: { ...selected, conversation: true },
      camera: profile,
      action: { selector: '[data-demo-profile] button[aria-label="Go back"]' },
    },
    {
      label: "Update the hiring stage",
      duration: CLICK_SHOT_DURATION_MS,
      app: selected,
      camera: profile,
      action: profileMenu,
    },
    {
      label: "Mark Interviewing",
      duration: CLICK_SHOT_DURATION_MS,
      app: menu,
      camera: profile,
      action: menuItem('Mark "Interviewing"'),
    },
    {
      label: "Return to candidates",
      duration: CLICK_SHOT_DURATION_MS,
      app: { ...selected, status: "in_progress" },
      camera: profile,
      action: { selector: '[data-demo-profile] button[aria-label="Go back"]' },
    },
    {
      label: "Find them in Interviewing",
      duration: CLICK_SHOT_DURATION_MS,
      app: { ...candidates, status: "in_progress" },
      camera: { ...wide, zoom: 1.65, mobileZoom: 2.5 },
      action: tab("Interviewing"),
    },
    {
      label: "The stage and count are updated",
      duration: 2600,
      app: { ...candidates, status: "in_progress", listTab: "in_progress" },
      camera: { ...wide, zoom: 1.6, mobileZoom: 2.5 },
      focus: firstPerson,
    },
    {
      label: "Your updated candidate list",
      duration: 2600,
      app: { ...candidates, status: "in_progress", listTab: "in_progress" },
      camera: wide,
    },
  ],
  "workspaces-explained": [
    {
      label: "Your hiring workspace",
      duration: 2200,
      app: candidates,
      camera: wide,
    },
    {
      label: "Switch your workspace",
      duration: CLICK_SHOT_DURATION_MS,
      app: candidates,
      camera: sidebar,
      action: switcher,
    },
    {
      label: "Choose People to try the app",
      duration: WORKSPACE_SWITCH_DURATION_MS,
      app: { ...candidates, workspaceMenu: true },
      camera: sidebar,
      action: { selector: '[role="option"]', text: "People to try the app" },
    },
    {
      label: "Same page, different people",
      duration: 2600,
      app: { useCase: "customers", page: "prospects" },
      camera: { ...wide, zoom: 1, mobileZoom: 1.6 },
      focus: { selector: "main" },
    },
    {
      label: "Switch back to hiring",
      duration: CLICK_SHOT_DURATION_MS,
      app: { useCase: "customers", page: "prospects" },
      camera: sidebar,
      action: switcher,
    },
    {
      label: "Choose Hire a designer",
      duration: WORKSPACE_SWITCH_DURATION_MS,
      app: { useCase: "customers", page: "prospects", workspaceMenu: true },
      camera: sidebar,
      action: { selector: '[role="option"]', text: "Hire a designer" },
    },
    {
      label: "Your candidates are still here",
      duration: 2600,
      app: candidates,
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
export function getBlogDemoFrame(id: BlogDemoId, time: number) {
  const shots = BLOG_DEMO_SHOTS[id];
  const duration = getBlogDemoDuration(id);
  const elapsed = Number.isFinite(time) ? Math.max(0, time) % duration : 0;
  let start = 0;
  const index = shots.findIndex((shot) => {
    if (elapsed < start + shot.duration) return true;
    start += shot.duration;
    return false;
  });
  const shot = shots[index];
  return {
    index,
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
  camera: DemoCamera
) {
  const safeWidth = Math.max(1, width),
    safeHeight = Math.max(1, height);
  const fit =
    Math.min(safeWidth / DEMO_DESIGN_WIDTH, safeHeight / DEMO_DESIGN_HEIGHT) *
    0.88;
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
