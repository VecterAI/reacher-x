import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const linkedinSource = readFileSync("convex/linkedin.ts", "utf8");

test("LinkedIn reaction action authorizes ownership before calling the provider", () => {
  const actionStart = linkedinSource.indexOf(
    "export const reactToLinkedInMessage = action"
  );
  const actionSource = linkedinSource.slice(actionStart);

  assert.ok(actionStart >= 0);
  assert.ok(
    actionSource.indexOf("getOwnedLinkedInProspectForUser") <
      actionSource.indexOf("setLinkedInMessageReaction")
  );
  assert.ok(
    actionSource.indexOf("getConversationMessageInternal") <
      actionSource.indexOf("setLinkedInMessageReaction")
  );
  assert.ok(
    actionSource.indexOf("resolveLinkedInMessageReactionTarget") <
      actionSource.indexOf("setLinkedInMessageReaction")
  );
});

test("attachment downloads are not blocked by the reaction capability", () => {
  const attachmentStart = linkedinSource.indexOf(
    "export const getLinkedInConversationAttachment = action"
  );
  const nextAction = linkedinSource.indexOf(
    "export const",
    attachmentStart + 20
  );
  const attachmentSource = linkedinSource.slice(attachmentStart, nextAction);

  assert.doesNotMatch(attachmentSource, /disabledFeatures[\s\S]*reaction/);
});
