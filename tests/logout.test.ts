import assert from "node:assert/strict";
import test, { type TestContext } from "node:test";
import { createLogoutController } from "../shared/lib/auth/logoutCore";

function setup(t: TestContext) {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  let finishCleanup!: () => void;
  let failCleanup!: (error: Error) => void;
  const cleanup = new Promise<void>((resolve, reject) => {
    finishCleanup = resolve;
    failCleanup = reject;
  });
  const dependencies = {
    clearBrowserData: t.mock.fn(() => cleanup),
    submitLogout: t.mock.fn(),
    showPending: t.mock.fn(),
    dismissPending: t.mock.fn(),
    showError: t.mock.fn(),
  };
  const controller = createLogoutController(dependencies);
  t.after(controller.reset);
  return { controller, dependencies, finishCleanup, failCleanup };
}

test("fast logout clears data before submitting and never flashes a toast", async (t) => {
  const { controller, dependencies, finishCleanup } = setup(t);
  const logout = controller.start();
  assert.equal(dependencies.submitLogout.mock.callCount(), 0);
  finishCleanup();
  await logout;
  assert.equal(dependencies.submitLogout.mock.callCount(), 1);
  controller.reset();
  t.mock.timers.tick(1_000);
  assert.equal(dependencies.showPending.mock.callCount(), 0);
});

test("slow cleanup shows one toast after 750 ms and waits before submitting", async (t) => {
  const { controller, dependencies, finishCleanup } = setup(t);
  const logout = controller.start();
  t.mock.timers.tick(749);
  assert.equal(dependencies.showPending.mock.callCount(), 0);
  t.mock.timers.tick(1);
  assert.equal(dependencies.showPending.mock.callCount(), 1);
  assert.equal(dependencies.submitLogout.mock.callCount(), 0);
  t.mock.timers.tick(10_000);
  assert.equal(dependencies.showPending.mock.callCount(), 1);
  finishCleanup();
  await logout;
  assert.equal(dependencies.submitLogout.mock.callCount(), 1);
});

test("a slow sign-out response also gets feedback after fast cleanup", async (t) => {
  const { controller, dependencies, finishCleanup } = setup(t);
  const logout = controller.start();
  finishCleanup();
  await logout;
  t.mock.timers.tick(750);
  assert.equal(dependencies.showPending.mock.callCount(), 1);
  controller.reset();
  assert.equal(dependencies.dismissPending.mock.callCount(), 1);
});

test("repeated clicks and Strict Mode do not repeat cleanup or submission", async (t) => {
  const { controller, dependencies, finishCleanup } = setup(t);
  const logout = controller.start();
  await controller.start();
  finishCleanup();
  await logout;
  await controller.start();
  assert.equal(dependencies.clearBrowserData.mock.callCount(), 1);
  assert.equal(dependencies.submitLogout.mock.callCount(), 1);
});

test("storage rejection is logged but does not strand an authenticated session", async (t) => {
  const { controller, dependencies, failCleanup } = setup(t);
  const log = t.mock.method(console, "error", () => undefined);
  const logout = controller.start();
  failCleanup(new Error("IndexedDB unavailable"));
  await logout;
  assert.equal(log.mock.callCount(), 1);
  assert.equal(dependencies.submitLogout.mock.callCount(), 1);
  assert.equal(dependencies.showError.mock.callCount(), 0);
});

test("a synchronous cleanup error also allows sign-out", async (t) => {
  const { controller, dependencies } = setup(t);
  t.mock.method(console, "error", () => undefined);
  dependencies.clearBrowserData.mock.mockImplementation(() => {
    throw new Error("storage access denied");
  });
  await controller.start();
  assert.equal(dependencies.submitLogout.mock.callCount(), 1);
});

test("submission failure replaces the pending toast and permits retry", async (t) => {
  const { controller, dependencies, finishCleanup } = setup(t);
  t.mock.method(console, "error", () => undefined);
  dependencies.submitLogout.mock.mockImplementationOnce(() => {
    throw new Error("form submission failed");
  });
  const logout = controller.start();
  t.mock.timers.tick(750);
  finishCleanup();
  await logout;
  assert.equal(dependencies.dismissPending.mock.callCount(), 0);
  assert.equal(dependencies.showError.mock.callCount(), 1);
  await controller.start();
  assert.equal(dependencies.submitLogout.mock.callCount(), 2);
});

test("leaving during cleanup cancels its later submission and toast", async (t) => {
  const { controller, dependencies, finishCleanup } = setup(t);
  const logout = controller.start();
  controller.reset();
  finishCleanup();
  await logout;
  t.mock.timers.tick(750);
  assert.equal(dependencies.submitLogout.mock.callCount(), 0);
  assert.equal(dependencies.showPending.mock.callCount(), 0);
});

test("restoring the document permits a new logout without an old attempt submitting", async (t) => {
  const { controller, dependencies, finishCleanup } = setup(t);
  const first = controller.start();
  controller.reset();
  const second = controller.start();
  finishCleanup();
  await Promise.all([first, second]);
  assert.equal(dependencies.clearBrowserData.mock.callCount(), 2);
  assert.equal(dependencies.submitLogout.mock.callCount(), 1);
});
