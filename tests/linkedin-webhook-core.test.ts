import assert from "node:assert/strict";
import test from "node:test";
import {
  getWebhookMessageDirection,
  getWebhookParticipantProviderId,
} from "../convex/lib/linkedinWebhookCore";

test("extracts user_provider_id from Unipile's new_relation payload", () => {
  const payload = {
    event: "new_relation",
    account_id: "unipile-account-1",
    user_provider_id: "urn:li:fsd_profile:adam-tahir",
    user_public_identifier: "adam-tahir",
    user_name: "Adam Tahir",
    user_profile_url: "https://www.linkedin.com/in/adam-tahir",
  };

  assert.equal(
    getWebhookParticipantProviderId(payload, {
      providerId: "urn:li:fsd_profile:me",
    }),
    "urn:li:fsd_profile:adam-tahir"
  );
});

test("does not classify a persisted outbound message as a prospect reply", () => {
  const payload = {
    event: "message_received",
    account_id: "unipile-account-1",
    chat_id: "chat-1",
    message_id: "outbound-message-1",
    message: "The outbound message text",
  };

  assert.equal(
    getWebhookMessageDirection(
      payload,
      { providerId: "urn:li:fsd_profile:me" },
      "sent"
    ),
    "sent"
  );
});

test("prefers Unipile's explicit sender flag when available", () => {
  assert.equal(
    getWebhookMessageDirection(
      {
        event: "message_received",
        is_sender: 1,
      },
      { providerId: "urn:li:fsd_profile:me" }
    ),
    "sent"
  );
  assert.equal(
    getWebhookMessageDirection(
      {
        event: "message_received",
        is_sender: 0,
      },
      { providerId: "urn:li:fsd_profile:me" },
      "sent"
    ),
    "received"
  );
});
