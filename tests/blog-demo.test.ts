import { blogBodyMarkdown } from "../features/blog/lib/blogContentCore";
import assert from "node:assert/strict";
import test from "node:test";
import {
  BLOG_DEMO_IDS,
  advanceBlogDemoWait,
  getBlogDemoRecoveryAction,
  BLOG_DEMO_SHOTS,
  getBlogDemoFrame,
  getBlogDemoDuration,
  getBlogDemoPlacement,
  getBlogDemoCursorPlacement,
  isBlogDemoId,
} from "../features/blog/lib/blogDemoHelpers";
import {
  getEditorialDemoDataset,
  getEditorialDemoPlan,
  getEditorialWorkspaceDescription,
} from "../features/landing/ui/components/use-case-demo/demoEditorialHelpers";
import {
  USE_CASE_DEMO_DATASETS,
  USE_CASE_DEMO_PLANS,
} from "../features/landing/ui/components/use-case-demo/useCaseDemoData";

test("every shot, boundary, and loop resolves to a valid finite frame", () => {
  for (const id of BLOG_DEMO_IDS) {
    let start = 0;
    BLOG_DEMO_SHOTS[id].forEach((shot, index) => {
      assert.ok(shot.duration >= 1500);
      assert.equal(getBlogDemoFrame(id, start).index, index);
      assert.equal(
        getBlogDemoFrame(id, start + shot.duration - 1).index,
        index
      );
      for (const value of Object.values(
        getBlogDemoFrame(id, start + 800).camera
      ))
        assert.ok(Number.isFinite(value));
      start += shot.duration;
    });
    assert.equal(getBlogDemoFrame(id, start).index, 0);
    for (const bad of [-100, NaN, Infinity, -Infinity])
      assert.equal(getBlogDemoFrame(id, bad).elapsed, 0);
  }
});
test("only known scenarios are accepted", () => {
  for (const id of BLOG_DEMO_IDS) assert.ok(isBlogDemoId(id));
  for (const bad of ["__proto__", "missing", null, {}, 0])
    assert.equal(isBlogDemoId(bad), false);
});
test("article fixtures do not mutate the home demo", () => {
  const before = JSON.stringify(USE_CASE_DEMO_DATASETS);
  const plansBefore = JSON.stringify(USE_CASE_DEMO_PLANS);
  const hiring = getEditorialDemoDataset("candidates", "hiring");
  assert.match(hiring.prospects[0].briefIntro ?? "", /keyboard navigation/);
  assert.equal(
    getEditorialDemoDataset("candidates", "workspaces").prospects[0].title,
    "Product designer"
  );
  assert.match(
    getEditorialDemoPlan(hiring.prospects[0]._id, "hiring")?.rationale ?? "",
    /salary range/
  );
  assert.match(
    getEditorialWorkspaceDescription("customers", "workspaces"),
    /try the app/
  );
  assert.equal(JSON.stringify(USE_CASE_DEMO_DATASETS), before);
  assert.equal(JSON.stringify(USE_CASE_DEMO_PLANS), plansBefore);
});
test("stories drive real controls without alternate UI checkpoints", () => {
  for (const shots of Object.values(BLOG_DEMO_SHOTS)) {
    assert.ok(shots.every((shot) => !("app" in shot)));
  }
  const crm = BLOG_DEMO_SHOTS["manage-people-with-reacherx"];
  assert.ok(crm.some((shot) => shot.action?.text === "Activity log"));
  assert.ok(crm.some((shot) => shot.action?.text === 'Mark "Interviewing"'));
  assert.equal(
    crm.filter((shot) => shot.action).at(-1)?.action?.text,
    "Interviewing"
  );
  const workspace = BLOG_DEMO_SHOTS["workspaces-explained"];
  assert.deepEqual(
    workspace
      .filter((shot) => shot.action?.selector === '[role="option"]')
      .map((shot) => shot.action?.text),
    [
      "Hiring — product designer",
      "Customers — freelance designers",
      "Hiring — product designer",
    ]
  );
  assert.ok(workspace.every((shot) => shot.action?.selector !== "a"));
});
test("close-ups use the focal point with deliberate wallpaper gutters", () => {
  for (const width of [320, 390, 768, 1440, 1920]) {
    const height = (width * 9) / 16;
    for (const shots of Object.values(BLOG_DEMO_SHOTS))
      for (const shot of shots) {
        const p = getBlogDemoPlacement(width, height, shot.camera);
        assert.ok(Object.values(p).every(Number.isFinite));
        assert.ok(p.scale > 0);
        if (1280 * p.scale > width) {
          assert.ok(Math.abs(p.x) >= 12);
          assert.ok(Math.abs(p.x + 1280 * p.scale - width) >= 12);
        }
        if (850 * p.scale > height) {
          assert.ok(Math.abs(p.y) >= 12);
          assert.ok(Math.abs(p.y + 850 * p.scale - height) >= 12);
        }
      }
    const left = getBlogDemoPlacement(width, height, {
      x: 100,
      y: 200,
      zoom: 2,
      mobileZoom: 3,
    });
    const right = getBlogDemoPlacement(width, height, {
      x: 1150,
      y: 200,
      zoom: 2,
      mobileZoom: 3,
    });
    assert.ok(
      left.x > right.x,
      "Camera follows the target instead of staying centered"
    );
  }
});
test("only explicit actions produce clicks and leave time for their result", () => {
  for (const id of BLOG_DEMO_IDS) {
    assert.ok(getBlogDemoDuration(id) < 120000);
    let start = 0;
    for (const shot of BLOG_DEMO_SHOTS[id]) {
      const frame = getBlogDemoFrame(id, start);
      assert.ok(
        frame.actionAt >= 1050 && frame.actionAt <= 1150,
        "Activate within 100ms of the pointer arriving, without shortening the camera animation"
      );
      assert.ok(
        shot.duration - frame.actionAt >= 400,
        "Leave enough time for the actual UI transition"
      );
      if (shot.action) {
        assert.ok(
          shot.duration - frame.actionAt <=
            (shot.action.selector === '[role="option"]' ? 1000 : 450),
          "Do not add dead post-click holds beyond the UI transition"
        );
      }
      assert.ok(
        !("cursor" in shot),
        "Cursor positions are measured, never authored pixels"
      );
      start += shot.duration;
    }
    assert.equal(
      BLOG_DEMO_SHOTS[id].at(-1)?.action,
      undefined,
      "Hold the completed result without a fake click"
    );
  }
});

test("demo captions are preserved in readable article Markdown", () => {
  const text = blogBodyMarkdown(
    '<BlogAppDemo scenario="find-candidates" title="Hiring" caption="Review relevant work before reaching out." />'
  );
  assert.match(text, /resource: find-candidates/);
  assert.match(text, /Review relevant work before reaching out\./);
});

test("every recording opens and closes with the whole app and background visible", () => {
  for (const shots of Object.values(BLOG_DEMO_SHOTS)) {
    for (const shot of [shots[0], shots[shots.length - 1]]) {
      assert.equal(shot.action, undefined);
      assert.equal(shot.focus, undefined);
      assert.ok(shot.duration >= 2200, "Allow the camera to settle and hold");
      for (const [width, height] of [
        [320, 180],
        [390, 220],
        [800, 450],
        [1440, 810],
        [390, 844],
        [1920, 1080],
      ]) {
        const p = getBlogDemoPlacement(width, height, shot.camera);
        assert.ok(p.x > 0 && p.y > 0);
        assert.ok(p.x + 1280 * p.scale < width);
        assert.ok(p.y + 850 * p.scale < height);
      }
    }
  }
});

test("the cursor stays visible through wide views, crops, and offscreen targets", () => {
  for (const width of [320, 390, 720, 1440]) {
    const height = (width * 9) / 16;
    for (const shots of Object.values(BLOG_DEMO_SHOTS)) {
      for (const shot of shots) {
        const placement = getBlogDemoPlacement(width, height, shot.camera);
        for (const point of [
          { x: 0, y: 0 },
          { x: 640, y: 425 },
          { x: 1280, y: 850 },
        ]) {
          const cursor = getBlogDemoCursorPlacement(
            width,
            height,
            placement,
            point
          );
          assert.ok(cursor.x >= 8 && cursor.x + 28 <= width - 8);
          assert.ok(cursor.y >= 8 && cursor.y + 34 <= height - 8);
        }
      }
    }
  }
});

test("menu failures during pause or manual exploration wait for resume", () => {
  assert.equal(getBlogDemoRecoveryAction("paused", false, 0), "defer");
  assert.equal(getBlogDemoRecoveryAction("interactive", true, 0), "defer");
  assert.equal(getBlogDemoRecoveryAction("playing", true, 0), "defer");
  assert.equal(getBlogDemoRecoveryAction("playing", false, 0), "retry");
  assert.equal(getBlogDemoRecoveryAction("playing", false, 1), "pause");
  assert.equal(getBlogDemoRecoveryAction("playing", false, 20), "pause");
});

test("suspension does not expire a pending menu preparation", () => {
  assert.equal(advanceBlogDemoWait(50, 30000, false), 50);
  assert.equal(advanceBlogDemoWait(50, 30000, true), 150);
  assert.equal(advanceBlogDemoWait(50, 16, true), 66);
  let elapsed = 0;
  for (let i = 0; i < 200; i++)
    elapsed = advanceBlogDemoWait(elapsed, 16, true);
  assert.ok(elapsed >= 3000, "A genuinely unavailable target still times out");
});

test("workspace-switching sample plans match the people in that workspace", () => {
  const before = JSON.stringify(USE_CASE_DEMO_PLANS);
  for (const [id, name] of [
    ["use_case_demo_customers_1", "Daniel"],
    ["use_case_demo_customers_2", "Sofia"],
  ]) {
    const plan = getEditorialDemoPlan(id, "workspaces");
    assert.ok(plan);
    assert.match(plan.rationale, new RegExp(name));
    assert.match(JSON.stringify(plan.tasks), /feedback/);
    assert.doesNotMatch(
      JSON.stringify(plan),
      /Priya|Loopstack|Fleetbase|logistics|cold-email/
    );
  }
  assert.equal(JSON.stringify(USE_CASE_DEMO_PLANS), before);
});

test("marketing chapters loop within their range and keep absolute scene indices", () => {
  for (const range of [
    [0, 12],
    [13, 20],
    [23, 41],
  ] as const) {
    const first = getBlogDemoFrame("find-potential-customers", 0, range);
    assert.equal(first.index, range[0]);
    assert.equal(
      getBlogDemoFrame("find-potential-customers", first.duration - 1, range)
        .index,
      range[1]
    );
    assert.equal(
      getBlogDemoFrame("find-potential-customers", first.duration, range).index,
      range[0]
    );
  }
  assert.throws(
    () => getBlogDemoFrame("find-potential-customers", 0, [-1, 2]),
    /Invalid/
  );
  assert.throws(
    () => getBlogDemoFrame("find-potential-customers", 0, [4, 3]),
    /Invalid/
  );
});
