import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import test from "node:test";
import {
  StepInterrupted,
  interruptOnSignals,
} from "../../core/steps/interrupt";

test("the first Ctrl+C stops new work; later ones never cut the reset short", () => {
  // A stand-in for process, so the test runner itself receives no signal.
  const source = new EventEmitter();
  const messages: string[] = [];
  const interrupt = interruptOnSignals(source, (line) => messages.push(line));
  assert.equal(interrupt.signal.aborted, false);

  source.emit("SIGINT", "SIGINT");
  assert.equal(interrupt.signal.aborted, true);
  assert.ok(interrupt.signal.reason instanceof StepInterrupted);
  assert.match(messages[0], /reset runs before exit/);

  // A second Ctrl+C or a SIGTERM only explains; the handlers stay installed.
  source.emit("SIGINT", "SIGINT");
  source.emit("SIGTERM", "SIGTERM");
  assert.equal(messages.length, 3);
  assert.match(messages[1], /not skipped/);
  assert.equal(source.listenerCount("SIGINT"), 1);

  interrupt.dispose();
  assert.equal(source.listenerCount("SIGINT"), 0);
  assert.equal(source.listenerCount("SIGTERM"), 0);
});
