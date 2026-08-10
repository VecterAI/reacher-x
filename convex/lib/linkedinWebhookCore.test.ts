import { describe, expect, test } from "vitest";
import {
  getWebhookMessageDirection,
  getWebhookParticipantProviderId,
} from "./linkedinWebhookCore";

describe("Unipile v1 message_received payloads", () => {
  const account = { providerId: "stored-account-provider" };

  test("classifies a sent message from documented account_info and sender fields", () => {
    const payload = {
      event: "message_received",
      account_info: { user_id: "mailbox-owner" },
      sender: { attendee_provider_id: "mailbox-owner" },
      attendees: [{ attendee_provider_id: "prospect-provider" }],
    };

    expect(getWebhookMessageDirection(payload, account)).toBe("sent");
    expect(getWebhookParticipantProviderId(payload, account)).toBe(
      "prospect-provider"
    );
  });

  test("classifies an inbound message and maps the sender as the prospect", () => {
    const payload = {
      event: "message_received",
      account_info: { user_id: "mailbox-owner" },
      sender: { attendee_provider_id: "prospect-provider" },
    };

    expect(getWebhookMessageDirection(payload, account)).toBe("received");
    expect(getWebhookParticipantProviderId(payload, account)).toBe(
      "prospect-provider"
    );
  });

  test("honors an explicit sender flag before fallback state", () => {
    expect(
      getWebhookMessageDirection(
        { is_sender: 1, sender: { attendee_provider_id: "prospect-provider" } },
        account,
        "received"
      )
    ).toBe("sent");
  });
});
