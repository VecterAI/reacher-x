import assert from "node:assert/strict";
import test from "node:test";
import {
  applyLinkedInRelationshipTaskConstraints,
  formatLinkedInRelationshipPlanGuidance,
  isLinkedInDmEligible,
  isLinkedInDmPlanAllowed,
  linkedInDmBlockedMessage,
} from "../convex/lib/linkedinOutreachPlanCore";
import {
  normalizeAutoPlanDraft,
  validateAutoPlanDraftAgainstGrounding,
  type AutoPlanDraft,
} from "../convex/lib/autoPlanCore";
import { getLinkedInFailure } from "../convex/lib/unipileClient";

test("LinkedIn DM eligibility allows a connection or existing conversation", () => {
  assert.equal(isLinkedInDmEligible("connected"), true);
  assert.equal(isLinkedInDmEligible("not_connected", true), true);
  assert.equal(isLinkedInDmEligible("unknown", true), true);
  assert.equal(isLinkedInDmEligible("pending"), false);
  assert.equal(isLinkedInDmEligible("not_connected"), false);
  assert.equal(isLinkedInDmEligible("unknown"), false);
  assert.equal(isLinkedInDmEligible(null), false);
});

test("LinkedIn DM plans allow the connect-first flow", () => {
  assert.equal(isLinkedInDmPlanAllowed("connected"), true);
  assert.equal(isLinkedInDmPlanAllowed("not_connected"), true);
  assert.equal(isLinkedInDmPlanAllowed("pending"), true);
  assert.equal(isLinkedInDmPlanAllowed("unknown"), false);
  assert.equal(isLinkedInDmPlanAllowed(null), false);
  assert.equal(isLinkedInDmPlanAllowed("unknown", true), true);
});

test("relationship guidance explains the connect-first flow", () => {
  const guidance = formatLinkedInRelationshipPlanGuidance("not_connected");
  assert.match(guidance, /connection request/i);
  assert.match(guidance, /after approval/i);
  assert.doesNotMatch(guidance, /Do NOT include a new DM task/i);
  assert.match(
    linkedInDmBlockedMessage("not_connected"),
    /connection request/i
  );
});

test("applyLinkedInRelationshipTaskConstraints keeps DM tasks for connect-first", () => {
  const result = applyLinkedInRelationshipTaskConstraints({
    platform: "linkedin",
    relationship: "not_connected",
    tasks: [
      { type: "react", id: "1" },
      { type: "dm", id: "2" },
      { type: "comment", id: "3" },
    ],
  });
  assert.equal(result.removedDmCount, 0);
  assert.deepEqual(
    result.tasks.map((task) => task.type),
    ["react", "dm", "comment"]
  );
});

test("applyLinkedInRelationshipTaskConstraints keeps DM while request is pending", () => {
  const result = applyLinkedInRelationshipTaskConstraints({
    platform: "linkedin",
    relationship: "pending",
    tasks: [{ type: "dm", id: "1" }],
  });
  assert.equal(result.removedDmCount, 0);
  assert.equal(result.tasks.length, 1);
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

test("applyLinkedInRelationshipTaskConstraints keeps DM in an existing conversation", () => {
  const result = applyLinkedInRelationshipTaskConstraints({
    platform: "linkedin",
    relationship: "not_connected",
    hasExistingConversation: true,
    tasks: [{ type: "dm", id: "1" }],
  });
  assert.equal(result.removedDmCount, 0);
  assert.equal(result.tasks.length, 1);
});

test("normalizeAutoPlanDraft keeps a LinkedIn DM as connect-first intent", () => {
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
  assert.equal(normalized.tasks.length, 2);
  assert.equal(normalized.tasks[0]?.type, "dm");
  assert.equal(normalized.tasks[1]?.type, "comment");
});

test("validateAutoPlanDraftAgainstGrounding rejects LinkedIn DM when relationship is unknown", () => {
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
    linkedinRelationship: "unknown",
  });
  assert.ok(
    errors.some((error) => error.toLowerCase().includes("dm tasks require"))
  );
});

test("auto-plan validation allows a DM to trigger connect-first recovery", () => {
  const draft: AutoPlanDraft = {
    strategy: {
      rationale: "Start with a relevant connection.",
      valueProposition: "Help.",
      tone: "Peer",
    },
    tasks: [
      {
        type: "dm",
        description: "Connect first, then send the approved DM",
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
  assert.equal(
    errors.some((error) => error.toLowerCase().includes("dm tasks require")),
    false
  );
});

test("auto-plan validation allows a DM in an existing conversation", () => {
  const draft: AutoPlanDraft = {
    strategy: {
      rationale: "Continue the existing conversation.",
      valueProposition: "Help.",
      tone: "Peer",
    },
    tasks: [
      {
        type: "dm",
        description: "Continue the conversation",
        timing: { type: "immediate" },
        content: "Hi again",
      },
    ],
  };
  const normalized = normalizeAutoPlanDraft(draft, {
    platform: "linkedin",
    linkedinRelationship: "unknown",
    linkedinHasExistingConversation: true,
  });
  const errors = validateAutoPlanDraftAgainstGrounding({
    draft: normalized,
    recentPosts: [],
    platform: "linkedin",
    linkedinRelationship: "unknown",
    linkedinHasExistingConversation: true,
  });

  assert.equal(normalized.tasks[0]?.type, "dm");
  assert.equal(
    errors.some((error) => error.toLowerCase().includes("dm tasks require")),
    false
  );
});

test("getLinkedInFailure keeps Attendee not found separate from relationship status", () => {
  const failure = getLinkedInFailure({
    body: {
      status: 404,
      type: "errors/resource_not_found",
      detail: "The requested resource were not found.\nAttendee not found",
    },
  });
  assert.equal(failure.classification, "attendee_not_found");
  assert.match(failure.message, /Attendee not found/i);
});
