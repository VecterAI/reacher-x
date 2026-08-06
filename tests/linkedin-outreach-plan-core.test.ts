import assert from "node:assert/strict";
import test from "node:test";
import {
  applyLinkedInRelationshipTaskConstraints,
  formatLinkedInRelationshipPlanGuidance,
  isLinkedInDmEligible,
  linkedInDmBlockedMessage,
} from "../convex/lib/linkedinOutreachPlanCore";
import {
  normalizeAutoPlanDraft,
  validateAutoPlanDraftAgainstGrounding,
  type AutoPlanDraft,
} from "../convex/lib/autoPlanCore";
import { getLinkedInFailure } from "../convex/lib/unipileClient";

test("LinkedIn DM eligibility is only true when connected", () => {
  assert.equal(isLinkedInDmEligible("connected"), true);
  assert.equal(isLinkedInDmEligible("pending"), false);
  assert.equal(isLinkedInDmEligible("not_connected"), false);
  assert.equal(isLinkedInDmEligible("unknown"), false);
  assert.equal(isLinkedInDmEligible(null), false);
});

test("relationship guidance forbids DM when not connected", () => {
  const guidance = formatLinkedInRelationshipPlanGuidance("not_connected");
  assert.match(guidance, /Do NOT include any DM tasks/i);
  assert.match(linkedInDmBlockedMessage("not_connected"), /not connected/i);
});

test("applyLinkedInRelationshipTaskConstraints strips DM tasks when not connected", () => {
  const result = applyLinkedInRelationshipTaskConstraints({
    platform: "linkedin",
    relationship: "not_connected",
    tasks: [
      { type: "react", id: "1" },
      { type: "dm", id: "2" },
      { type: "comment", id: "3" },
    ],
  });
  assert.equal(result.removedDmCount, 1);
  assert.deepEqual(
    result.tasks.map((task) => task.type),
    ["react", "comment"]
  );
});

test("applyLinkedInRelationshipTaskConstraints keeps DM when connected", () => {
  const result = applyLinkedInRelationshipTaskConstraints({
    platform: "linkedin",
    relationship: "connected",
    tasks: [
      { type: "dm", id: "1" },
      { type: "wait", id: "2" },
    ],
  });
  assert.equal(result.removedDmCount, 0);
  assert.equal(result.tasks.length, 2);
});

test("normalizeAutoPlanDraft strips LinkedIn DMs using relationship", () => {
  const draft: AutoPlanDraft = {
    strategy: {
      rationale: "Engage publicly first.",
      valueProposition: "Help with outreach.",
      tone: "Peer",
      targetTweetId: "post-1",
    },
    tasks: [
      {
        type: "dm",
        description: "Send intro DM",
        timing: { type: "immediate" },
        content: "Hello",
      },
      {
        type: "comment",
        description: "Comment on post",
        timing: { type: "immediate" },
        targetTweetId: "post-1",
        content: "Great point.",
      },
    ],
  };

  const normalized = normalizeAutoPlanDraft(draft, {
    platform: "linkedin",
    linkedinRelationship: "not_connected",
  });
  assert.equal(normalized.tasks.length, 1);
  assert.equal(normalized.tasks[0]?.type, "comment");
});

test("validateAutoPlanDraftAgainstGrounding rejects LinkedIn DM without connection", () => {
  const draft: AutoPlanDraft = {
    strategy: {
      rationale: "DM them.",
      valueProposition: "Help.",
      tone: "Peer",
    },
    tasks: [
      {
        type: "dm",
        description: "DM",
        timing: { type: "immediate" },
        content: "Hi",
      },
    ],
  };
  const errors = validateAutoPlanDraftAgainstGrounding({
    draft,
    recentPosts: [],
    platform: "linkedin",
    linkedinRelationship: "not_connected",
  });
  assert.ok(
    errors.some((error) => error.toLowerCase().includes("dm tasks require"))
  );
});

test("getLinkedInFailure maps Attendee not found to not_connected", () => {
  const failure = getLinkedInFailure({
    body: {
      status: 404,
      type: "errors/resource_not_found",
      detail: "The requested resource were not found.\nAttendee not found",
    },
  });
  assert.equal(failure.classification, "not_connected");
  assert.match(failure.message, /Attendee not found/i);
});
