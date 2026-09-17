import assert from "node:assert/strict";
import { test } from "node:test";
import { NextRequest } from "next/server";
import { proxy } from "../proxy";
import {
  DEMO_SETUP_THREAD_ID,
  getDemoSetupScenario,
} from "./scenarios/setupHelpers";

test("setup enters its existing local thread before the real UI mounts", () => {
  for (const suffix of ["", "&threadId="]) {
    const response = proxy(
      new NextRequest(
        `https://demo.example.test/agent/setup?scenario=getting-started-with-reacherx${suffix}`
      )
    );
    assert.equal(response.status, 307);
    const destination = new URL(response.headers.get("location")!);
    assert.equal(destination.searchParams.has("scenario"), false);
    assert.equal(
      destination.searchParams.get("threadId"),
      DEMO_SETUP_THREAD_ID
    );
    assert.equal(
      proxy(new NextRequest(destination)).headers.get("location"),
      null
    );
  }
});

test("canonical setup URLs retain each demo identity without a competing query", () => {
  for (const scenario of [
    "find-creators",
    "find-investors",
    "find-candidates",
  ]) {
    const response = proxy(
      new NextRequest(
        `https://demo.example.test/agent/setup?scenario=${scenario}`
      )
    );
    const url = new URL(response.headers.get("location")!);
    assert.equal(url.searchParams.has("scenario"), false);
    assert.equal(
      getDemoSetupScenario(url.searchParams.get("threadId")),
      scenario
    );
    assert.equal(proxy(new NextRequest(url)).headers.get("location"), null);
  }
});
