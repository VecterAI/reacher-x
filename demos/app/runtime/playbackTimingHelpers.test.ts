import assert from "node:assert/strict";
import { test } from "node:test";
import { waitForPlaybackFrame } from "./playbackTimingHelpers";

for (const paints of [true, false]) {
  test(`preparation settles with painting ${paints ? "enabled" : "throttled"}`, async (t) => {
    const raf = Object.getOwnPropertyDescriptor(
      globalThis,
      "requestAnimationFrame"
    );
    const cancel = Object.getOwnPropertyDescriptor(
      globalThis,
      "cancelAnimationFrame"
    );
    t.after(() => {
      for (const [key, value] of [
        ["requestAnimationFrame", raf],
        ["cancelAnimationFrame", cancel],
      ] as const) {
        if (value) Object.defineProperty(globalThis, key, value);
        else Reflect.deleteProperty(globalThis, key);
      }
    });
    let paint: FrameRequestCallback | undefined;
    const cancelled: number[] = [];
    Object.defineProperty(globalThis, "requestAnimationFrame", {
      configurable: true,
      value: (callback: FrameRequestCallback) => {
        paint = callback;
        return 42;
      },
    });
    Object.defineProperty(globalThis, "cancelAnimationFrame", {
      configurable: true,
      value: (id: number) => cancelled.push(id),
    });
    const pending = waitForPlaybackFrame();
    if (paints) paint!(0);
    await pending;
    assert.deepEqual(cancelled, [42]);
  });
}
