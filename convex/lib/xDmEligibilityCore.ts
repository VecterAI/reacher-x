import type { XDmEligibility } from "../../shared/lib/twitter/dm";

type XDmEligibilityInput = {
  isConnected: boolean;
  missingScopes?: string[];
  receivesYourDm?: boolean;
  conversationId?: string;
  recipientDisplayName?: string;
  recipientUsername?: string;
  recipientVerified?: boolean;
  senderUsername?: string;
  senderVerified?: boolean;
  restriction?: "subscription_required" | "not_allowed";
};

function formatHandle(username?: string): string | undefined {
  const normalized = username?.trim().replace(/^@/u, "");
  return normalized ? `@${normalized}` : undefined;
}

function getRecipientLabel(args: XDmEligibilityInput): string {
  const displayName = args.recipientDisplayName?.trim();
  if (displayName && displayName !== "Unknown") return displayName;
  return formatHandle(args.recipientUsername) ?? "this person";
}

export function buildXDmEligibility(args: XDmEligibilityInput): XDmEligibility {
  const recipientLabel = getRecipientLabel(args);
  const recipientUsername = formatHandle(args.recipientUsername);
  const senderUsername = formatHandle(args.senderUsername);
  const base = {
    conversationId: args.conversationId,
    recipientLabel,
    recipientUsername,
    recipientVerified: args.recipientVerified,
    senderUsername,
    senderVerified: args.senderVerified,
  };

  if (!args.isConnected) {
    return {
      ...base,
      enabled: false,
      reasonCode: "missing_connection",
      reasonTitle: "Connect X/Twitter",
      reasonLabel: `Connect an X/Twitter account to DM ${recipientLabel}.`,
      nextSteps: ["connect_account"],
    };
  }

  const missingScopes = new Set(args.missingScopes ?? []);
  if (missingScopes.has("dm.read") || missingScopes.has("dm.write")) {
    return {
      ...base,
      enabled: false,
      reasonCode: "missing_scopes",
      reasonTitle: "Reconnect X/Twitter",
      reasonLabel: `Reconnect ${senderUsername ?? "your account"} to DM ${recipientLabel}.`,
      nextSteps: ["reconnect_account"],
    };
  }

  if (args.restriction === "subscription_required") {
    const sender = senderUsername ?? "your connected account";
    return {
      ...base,
      enabled: false,
      reasonCode: "subscription_required",
      reasonTitle: "Verification required",
      reasonLabel: `${recipientLabel} only accepts DMs from verified accounts. Verify ${sender} or use another account.`,
      receivesYourDm: false,
      nextSteps: ["verify_account", "switch_account", "wait_for_follow_back"],
    };
  }

  if (args.receivesYourDm === false || args.restriction === "not_allowed") {
    const sender = senderUsername ?? "your connected account";
    return {
      ...base,
      enabled: false,
      reasonCode: "not_allowed",
      reasonTitle: `Can't message ${recipientLabel}`,
      reasonLabel: `${recipientLabel} isn't accepting DMs from ${sender}. Use another account or wait for a follow-back.`,
      receivesYourDm: false,
      nextSteps: [
        "public_engagement",
        "wait_for_follow_back",
        "switch_account",
        "recheck_eligibility",
      ],
    };
  }

  if (args.receivesYourDm === true) {
    return {
      ...base,
      enabled: true,
      reasonCode: "eligible",
      reasonTitle: `Message ${recipientLabel}`,
      reasonLabel: `You can DM ${recipientLabel} on X/Twitter.`,
      receivesYourDm: true,
      nextSteps: [],
    };
  }

  return {
    ...base,
    enabled: false,
    reasonCode: "unknown",
    reasonTitle: "Can't check X/Twitter DM access",
    reasonLabel: `Try again before sending a DM to ${recipientLabel}.`,
    nextSteps: ["recheck_eligibility"],
  };
}

export function getBlockedXDmPlanMessage(eligibility: XDmEligibility): string {
  const recipient = eligibility.recipientLabel ?? "this person";
  const reason = eligibility.reasonLabel;

  switch (eligibility.reasonCode) {
    case "missing_connection":
      return `${reason} Update the plan. Connect X/Twitter, then recheck before the DM step.`;
    case "missing_scopes":
      return `${reason} Update the plan. Reconnect X/Twitter, then recheck before the DM step.`;
    case "unknown":
      return `${reason} Don't plan an immediate DM until X/Twitter confirms access.`;
    case "subscription_required":
    case "not_allowed":
      return `${reason} Use public engagement, wait for a follow-back, or switch accounts. Recheck before sending. Following ${recipient} does not unlock DMs unless they follow back.`;
    case "eligible":
      return reason;
  }
}

export function hasBlockedImmediateXDmTask(
  tasks: Array<{ type: string; timing?: { type?: string } }>,
  eligibility: Pick<XDmEligibility, "enabled">
): boolean {
  return (
    !eligibility.enabled &&
    tasks.some(
      (task) => task.type === "dm" && task.timing?.type === "immediate"
    )
  );
}
