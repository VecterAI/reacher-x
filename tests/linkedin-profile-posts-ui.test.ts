import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const PANEL_FILE = "features/prospects/ui/components/LinkedInProfilePanel.tsx";
const ACTION_FILE = "convex/linkedin.ts";

test("profile post actions preserve the complete provider page", () => {
  const source = readFileSync(ACTION_FILE, "utf8");
  const prospectAction = source.slice(
    source.indexOf("export const getLinkedInProfilePostsPage"),
    source.indexOf("export const getLinkedInDmPostPreview")
  );
  const identityAction = source.slice(
    source.indexOf("export const getLinkedInIdentityProfilePostsPage"),
    source.indexOf("export const listLinkedInPostComments")
  );

  assert.match(prospectAction, /cursor: args\.cursor/);
  assert.doesNotMatch(prospectAction, /maxPosts:/);
  assert.match(identityAction, /cursor: args\.cursor/);
  assert.doesNotMatch(identityAction, /maxPosts:/);
});

test("an empty cursor page ends pagination without becoming a UI error", () => {
  const source = readFileSync(
    "convex/integrations/linkedin/getProfilePosts.ts",
    "utf8"
  );

  assert.match(
    source,
    /if \(isLinkdApiNoDataError\(error\)\) \{\s*return \{\s*posts: \[\],\s*nextCursor: null,\s*unavailableReason: "profile_data_unavailable" as const,\s*\};/
  );
});

test("profile post failures stop automatic retries and keep manual retry", () => {
  const source = readFileSync(PANEL_FILE, "utf8");

  assert.match(
    source,
    /if \(result\.error\) \{\s*setPostsError\(result\.error\);\s*return;/
  );
  assert.match(
    source,
    /loadMoreError=\{Boolean\(postsError && recentPosts\.length > 0\)\}/
  );
  assert.match(
    source,
    /initialPostsRequestedRef\.current\.delete\(profileUrn\)/
  );
  assert.match(source, /retryLabel="Retry loading LinkedIn posts"/);
});
