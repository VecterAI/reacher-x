import assert from "node:assert/strict";
import test from "node:test";
import {
  areSearchParamsEquivalent,
  resolveOnboardingNavigationAction,
} from "../features/webapp/lib/onboardingNavigationCore";

const base = {
  activeContextType: "setup_session" as const,
  currentQueryString: "",
  isDevelopmentSetupPreview: false,
  locked: true,
  pathname: "/",
  targetLockedUrl: "/agent/setup?threadId=setup-thread",
};

test("active setup redirects ordinary app routes to its canonical thread", () => {
  assert.deepEqual(resolveOnboardingNavigationAction(base), {
    kind: "replace",
    href: "/agent/setup?threadId=setup-thread",
  });
});

test("active setup corrects a stale or different setup thread", () => {
  assert.deepEqual(
    resolveOnboardingNavigationAction({
      ...base,
      pathname: "/agent/setup",
      currentQueryString: "threadId=old-thread",
    }),
    {
      kind: "replace",
      href: "/agent/setup?threadId=setup-thread",
    }
  );
});

test("selecting a completed workspace exits the setup route", () => {
  assert.deepEqual(
    resolveOnboardingNavigationAction({
      ...base,
      activeContextType: "workspace",
      pathname: "/agent/setup",
      currentQueryString: "threadId=setup-thread",
      locked: false,
      targetLockedUrl: "/",
    }),
    { kind: "replace", href: "/" }
  );
});

test("completed workspace context leaves ordinary app routes alone", () => {
  assert.deepEqual(
    resolveOnboardingNavigationAction({
      ...base,
      activeContextType: "workspace",
      locked: false,
      targetLockedUrl: "/",
    }),
    { kind: "none" }
  );
});

test("explicit new-workspace bootstrap may render before its thread exists", () => {
  assert.deepEqual(
    resolveOnboardingNavigationAction({
      ...base,
      activeContextType: "workspace",
      pathname: "/agent/setup",
      currentQueryString: "action=newWorkspace",
      locked: false,
      targetLockedUrl: "/",
    }),
    { kind: "none" }
  );
});

test("an active draft does not bypass the explicit new-workspace decision", () => {
  assert.deepEqual(
    resolveOnboardingNavigationAction({
      ...base,
      pathname: "/agent/setup",
      currentQueryString: "action=newWorkspace",
    }),
    { kind: "none" }
  );
});

test("setup auth result parameters are preserved until their callback is handled", () => {
  assert.deepEqual(
    resolveOnboardingNavigationAction({
      ...base,
      pathname: "/agent/setup",
      currentQueryString: "threadId=setup-thread&linkedin_status=success",
    }),
    { kind: "none" }
  );
});

test("first-workspace legacy recovery keeps an explicit setup thread", () => {
  assert.deepEqual(
    resolveOnboardingNavigationAction({
      ...base,
      activeContextType: "workspace",
      pathname: "/agent/setup",
      currentQueryString: "threadId=recovery-thread",
      targetLockedUrl: "/agent/setup",
    }),
    { kind: "none" }
  );
});

test("query comparison is order-independent but value-sensitive", () => {
  assert.equal(
    areSearchParamsEquivalent("threadId=one&state=ok", "state=ok&threadId=one"),
    true
  );
  assert.equal(
    areSearchParamsEquivalent("threadId=one", "threadId=two"),
    false
  );
});
