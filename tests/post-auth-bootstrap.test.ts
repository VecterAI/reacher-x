import assert from "node:assert/strict";
import test from "node:test";
import {
  applyPostAuthRedirect,
  replaceRedirectLocation,
  resolvePostAuthSetupHref,
  type PostAuthBootstrapOperations,
} from "../shared/lib/auth/postAuthBootstrapCore";

const user = {
  workosUserId: "user_123",
  email: "person@example.com",
};

function createOperations(
  bootstrapState: Awaited<
    ReturnType<PostAuthBootstrapOperations["getSetupBootstrapState"]>
  >
) {
  const calls: string[] = [];
  const operations: PostAuthBootstrapOperations = {
    upsertUser: async () => {
      calls.push("upsertUser");
    },
    getSetupBootstrapState: async () => {
      calls.push("getSetupBootstrapState");
      return bootstrapState;
    },
    startFirstWorkspaceSetup: async () => {
      calls.push("startFirstWorkspaceSetup");
      return { threadId: "thread_created" };
    },
  };

  return { calls, operations };
}

test("post-auth bootstrap resumes an active setup session", async () => {
  const { calls, operations } = createOperations({
    activeSession: { threadId: "thread_existing" },
    suggestedMode: "first_workspace",
    requiresFirstWorkspace: true,
  });

  assert.deepEqual(await resolvePostAuthSetupHref(user, operations), {
    setupHref: "/agent/setup?threadId=thread_existing",
    requiresFirstWorkspace: true,
    resumedExistingSession: true,
  });
  assert.deepEqual(calls, ["upsertUser", "getSetupBootstrapState"]);
});

test("post-auth bootstrap creates the first setup session before redirecting", async () => {
  const { calls, operations } = createOperations({
    activeSession: null,
    suggestedMode: "first_workspace",
    requiresFirstWorkspace: true,
  });

  assert.deepEqual(await resolvePostAuthSetupHref(user, operations), {
    setupHref: "/agent/setup?threadId=thread_created",
    requiresFirstWorkspace: true,
    resumedExistingSession: false,
  });
  assert.deepEqual(calls, [
    "upsertUser",
    "getSetupBootstrapState",
    "startFirstWorkspaceSetup",
  ]);
});

test("post-auth bootstrap preserves returnTo after onboarding is complete", async () => {
  const { calls, operations } = createOperations({
    activeSession: null,
    suggestedMode: null,
    requiresFirstWorkspace: false,
  });

  assert.deepEqual(await resolvePostAuthSetupHref(user, operations), {
    setupHref: null,
    requiresFirstWorkspace: false,
    resumedExistingSession: false,
  });
  assert.deepEqual(calls, ["upsertUser", "getSetupBootstrapState"]);
});

test("completed users skip a redundant bare setup render", () => {
  const response = new Response(null, {
    status: 307,
    headers: { location: "http://localhost:3000/agent/setup" },
  });

  const redirected = applyPostAuthRedirect(
    response,
    "http://localhost:3000/callback",
    {
      setupHref: "/agent/setup?threadId=thread_stale",
      requiresFirstWorkspace: false,
      resumedExistingSession: false,
    }
  );

  assert.equal(redirected.headers.get("location"), "http://localhost:3000/");
});

test("explicit setup destinations remain intact for completed users", () => {
  for (const location of [
    "http://localhost:3000/agent/setup?threadId=thread_requested",
    "http://localhost:3000/agent/setup?action=newWorkspace",
  ]) {
    const response = new Response(null, {
      status: 307,
      headers: { location },
    });

    const redirected = applyPostAuthRedirect(
      response,
      "http://localhost:3000/callback",
      {
        setupHref: null,
        requiresFirstWorkspace: false,
        resumedExistingSession: false,
      }
    );

    assert.equal(redirected.headers.get("location"), location);
  }
});

test("an existing first-workspace draft preserves the requested landing decision", () => {
  const requestedLocation =
    "http://localhost:3000/agent/setup?action=newWorkspace";
  const response = new Response(null, {
    status: 307,
    headers: { location: requestedLocation },
  });

  const redirected = applyPostAuthRedirect(
    response,
    "http://localhost:3000/callback",
    {
      setupHref: "/agent/setup?threadId=thread_existing",
      requiresFirstWorkspace: true,
      resumedExistingSession: true,
    }
  );

  assert.equal(redirected.headers.get("location"), requestedLocation);
});

test("a newly created first-workspace session replaces the landing decision route", () => {
  const response = new Response(null, {
    status: 307,
    headers: {
      location: "http://localhost:3000/agent/setup?action=newWorkspace",
    },
  });

  const redirected = applyPostAuthRedirect(
    response,
    "http://localhost:3000/callback",
    {
      setupHref: "/agent/setup?threadId=thread_created",
      requiresFirstWorkspace: true,
      resumedExistingSession: false,
    }
  );

  assert.equal(
    redirected.headers.get("location"),
    "http://localhost:3000/agent/setup?threadId=thread_created"
  );
});

test("callback redirect is replaced without dropping response headers", () => {
  const response = new Response(null, {
    status: 307,
    headers: {
      location: "http://localhost:3000/",
      "set-cookie": "wos-session=sealed; Path=/; HttpOnly",
    },
  });

  const redirected = replaceRedirectLocation(
    response,
    "http://localhost:3000/callback?code=code_123",
    "/agent/setup?threadId=thread_123"
  );

  assert.equal(
    redirected.headers.get("location"),
    "http://localhost:3000/agent/setup?threadId=thread_123"
  );
  assert.equal(
    redirected.headers.get("set-cookie"),
    "wos-session=sealed; Path=/; HttpOnly"
  );
});
