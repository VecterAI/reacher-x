import assert from "node:assert/strict";
import { test } from "node:test";
import { createPlaybackPasteEvent } from "./playbackActions";

test("scripted paste retains text when the browser replaces the supplied transfer", (t) => {
  const originalTransfer = Object.getOwnPropertyDescriptor(
    globalThis,
    "DataTransfer"
  );
  const originalEvent = Object.getOwnPropertyDescriptor(
    globalThis,
    "ClipboardEvent"
  );
  t.after(() => {
    for (const [key, descriptor] of [
      ["DataTransfer", originalTransfer],
      ["ClipboardEvent", originalEvent],
    ] as const) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else Reflect.deleteProperty(globalThis, key);
    }
  });
  class Transfer {
    values = new Map<string, string>();
    setData(type: string, value: string) {
      this.values.set(type, value);
    }
    getData(type: string) {
      return this.values.get(type) ?? "";
    }
  }
  Object.defineProperty(globalThis, "DataTransfer", {
    configurable: true,
    value: Transfer,
  });
  for (const replacesTransfer of [false, true]) {
    class Paste extends Event {
      clipboardData: Transfer;
      constructor(
        type: string,
        options: EventInit & { clipboardData: Transfer }
      ) {
        super(type, options);
        this.clipboardData = replacesTransfer
          ? new Transfer()
          : options.clipboardData;
      }
    }
    Object.defineProperty(globalThis, "ClipboardEvent", {
      configurable: true,
      value: Paste,
    });
    for (const text of ["@client-feedback", "A reply.\nWith two lines.", ""]) {
      const event = createPlaybackPasteEvent(text);
      assert.equal(event.clipboardData?.getData("text/plain"), text);
      assert.equal(event.bubbles, true);
      assert.equal(event.cancelable, true);
    }
  }
});
