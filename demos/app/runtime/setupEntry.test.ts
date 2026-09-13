import assert from "node:assert/strict";
import { test } from "node:test";
import { NextRequest } from "next/server";
import { proxy } from "../proxy";
import { DEMO_SETUP_THREAD_ID } from "./scenarios/setupHelpers";

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
