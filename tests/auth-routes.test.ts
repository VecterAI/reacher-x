import assert from "node:assert/strict";
import test from "node:test";
import {
  buildLoginHref,
  NEW_WORKSPACE_SETUP_AUTH_RETURN_TO,
  resolveAuthReturnTo,
  SETUP_AUTH_RETURN_TO,
} from "../shared/lib/urls/authRoutes";

test("login links preserve the canonical setup destination", () => {
  assert.equal(
    buildLoginHref(SETUP_AUTH_RETURN_TO),
    "/login?returnTo=%2Fagent%2Fsetup"
  );
});

test("landing acquisition can preserve explicit new-workspace intent", () => {
  assert.equal(
    buildLoginHref(NEW_WORKSPACE_SETUP_AUTH_RETURN_TO),
    "/login?returnTo=%2Fagent%2Fsetup%3Faction%3DnewWorkspace"
  );
});

test("auth return paths accept internal app routes", () => {
  assert.equal(
    resolveAuthReturnTo("/agent/setup?threadId=thread_123"),
    "/agent/setup?threadId=thread_123"
  );
});

test("auth return paths reject external and protocol-relative redirects", () => {
  assert.equal(resolveAuthReturnTo("https://attacker.example"), "/");
  assert.equal(resolveAuthReturnTo("//attacker.example/path"), "/");
  assert.equal(resolveAuthReturnTo("/\\attacker.example/path"), "/");
  assert.equal(resolveAuthReturnTo(null), "/");
});
