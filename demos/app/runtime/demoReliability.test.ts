import assert from "node:assert/strict";
import { test } from "node:test";
import { readFile } from "node:fs/promises";
import { SampleVoiceRecorder } from "./sampleVoiceRecorderCore";
import {
  installDemoHistory,
  isDemoInitialLocation,
} from "./demoHistoryHelpers";
import { normalizeLinkedInMediaType } from "./demoMediaHelpers";
import { normalizeLinkedInMediaType as productionMediaType } from "../../../shared/lib/linkedin/media";
import portraits from "./portraitAssets.json";
import { createAppFixtures } from "./appFixtures";
import { BLOG_DEMO_IDS } from "@/features/blog/lib/blogDemoHelpers";
import { getNestedRecord, getStringProperty } from "@/convex/lib/typeGuards";
import type { VoiceNoteRecording } from "../../../features/composer/hooks/useVoiceNoteRecorder";
const sample: VoiceNoteRecording = {
  file: new File(["sample"], "voice-note.m4a", { type: "audio/mp4" }),
  durationMs: 4500,
  waveform: [],
};

test("reset waits for old thread and profile queries, allowing the entry scenario and setup thread", () => {
  assert.equal(
    isDemoInitialLocation(
      { pathname: "/agent", search: "?threadId=old" },
      "/agent"
    ),
    false
  );
  assert.equal(
    isDemoInitialLocation(
      {
        pathname: "/",
        search: "?scenario=manage-dm-conversations&prospectId=old",
      },
      "/"
    ),
    false
  );
  assert.equal(
    isDemoInitialLocation(
      { pathname: "/agent", search: "?scenario=teach-reacherx-what-you-want" },
      "/agent"
    ),
    true
  );
  assert.equal(
    isDemoInitialLocation({ pathname: "/agent", search: "" }, "/"),
    false
  );
  assert.equal(
    isDemoInitialLocation(
      { pathname: "/agent/setup", search: "?threadId=current" },
      "/agent/setup"
    ),
    true
  );
});

test("sample recorder reviews real sample duration, discards and re-records independently", async () => {
  const a = new SampleVoiceRecorder(async () => sample),
    b = new SampleVoiceRecorder(async () => sample);
  await a.start();
  assert.equal(a.getSnapshot().status, "recording");
  assert.equal(b.getSnapshot().status, "idle");
  a.stop();
  assert.equal(a.getSnapshot().recording?.file, sample.file);
  assert.equal(a.getSnapshot().elapsedMs, sample.durationMs);
  a.cancel();
  assert.equal(a.getSnapshot().recording, null);
  await a.start();
  a.stop();
  assert.equal(a.getSnapshot().status, "review");
  a.reset();
  b.reset();
});

test("cancel and unmount cleanup ignore late audio loads; retries survive failures", async () => {
  let finish!: (value: VoiceNoteRecording) => void;
  const a = new SampleVoiceRecorder(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      })
  );
  const pending = a.start();
  a.reset();
  finish(sample);
  await pending;
  assert.equal(a.getSnapshot().status, "idle");
  let fail = true;
  const b = new SampleVoiceRecorder(async () => {
    if (fail) throw new Error("offline");
    return sample;
  });
  await b.start();
  assert.equal(b.getSnapshot().error, "offline");
  fail = false;
  await b.start();
  b.stop();
  assert.equal(b.getSnapshot().status, "review");
  b.reset();
});

test("duplicate starts load once; automatic stop enforces the 60 second limit", async (t) => {
  t.mock.timers.enable({ apis: ["setInterval", "Date"] });
  let loads = 0;
  const a = new SampleVoiceRecorder(async () => {
    loads++;
    return sample;
  });
  await Promise.all([a.start(), a.start()]);
  assert.equal(loads, 1);
  t.mock.timers.tick(60_000);
  assert.equal(a.getSnapshot().status, "review");
  assert.equal(a.getSnapshot().elapsedMs, 4500);
  a.reset();
  t.mock.timers.tick(60_000);
  assert.equal(a.getSnapshot().status, "idle");
});

test("embed navigation replaces history with router state intact; standalone is unchanged", () => {
  const calls: unknown[][] = [];
  const history = {
    pushState(...args: unknown[]) {
      calls.push(["push", ...args]);
    },
    replaceState(...args: unknown[]) {
      calls.push(["replace", ...args]);
    },
  };
  const embedded = { parent: {}, history } as unknown as Window;
  const cleanup = installDemoHistory(embedded);
  const state = { __NA: true, tree: ["agent"] };
  embedded.history.pushState(state, "", "/agent");
  assert.deepEqual(calls, [["replace", state, "", "/agent"]]);
  cleanup();
  embedded.history.pushState({}, "", "/");
  assert.equal(calls[1][0], "push");
  const standalone = { history } as unknown as Window;
  Object.assign(standalone, { parent: standalone });
  installDemoHistory(standalone)();
  standalone.history.pushState({}, "", "/");
  assert.equal(calls[2][0], "push");
});

test("only the bundled image bypasses provider classification; production stays strict", () => {
  for (const type of [undefined, "unknown", "photo", "IMAGE"])
    assert.equal(
      normalizeLinkedInMediaType(type, "/media/client-feedback.png"),
      "image"
    );
  for (const type of ["link", "document", "carousel"])
    assert.equal(
      normalizeLinkedInMediaType(type, "/media/client-feedback.png"),
      "link"
    );
  assert.equal(
    normalizeLinkedInMediaType("video", "/media/client-feedback.png"),
    "video"
  );
  assert.equal(
    normalizeLinkedInMediaType("image", "/media/client-feedback.png"),
    "image"
  );
  assert.equal(
    productionMediaType("image", "/media/client-feedback.png"),
    "link"
  );
  for (const url of [
    "//attacker.test/media/client-feedback.png",
    "https://attacker.test/media/client-feedback.png",
    "/api/private.png",
    "javascript:alert(1)",
  ]) {
    assert.equal(
      normalizeLinkedInMediaType("image", url),
      productionMediaType("image", url)
    );
  }
  assert.equal(
    normalizeLinkedInMediaType("video", "/media/client-feedback.mp4"),
    "video"
  );
});

test("all scenario profiles and evidence use the portrait belonging to that identity", () => {
  const assets: Record<string, { path: string }> = portraits;
  for (const scenario of BLOG_DEMO_IDS) {
    for (const person of createAppFixtures(scenario).prospects) {
      const expected = assets[person.displayName ?? ""]?.path;
      assert.ok(expected, `${scenario}: ${person.displayName}`);
      for (const data of [person.data, ...(person.evidencePosts ?? [])]) {
        const author = getNestedRecord(data, "author");
        const user = getNestedRecord(data, "user");
        assert.equal(
          author
            ? getStringProperty(author, "profilePictureURL")
            : getStringProperty(user, "profile_image_url_https"),
          expected
        );
      }
    }
  }
});

test("every fictional audience identity has a different available portrait", async () => {
  const assets = Object.values(portraits);
  assert.equal(new Set(assets.map((a) => a.source)).size, assets.length);
  assert.equal(new Set(assets.map((a) => a.path)).size, assets.length);
  for (const asset of assets) {
    const data = await readFile(
      new URL(`../public${asset.path}`, import.meta.url)
    );
    assert.equal(data.readUInt16BE(0), 0xffd8);
    assert.ok(data.length > 1000);
  }
});
