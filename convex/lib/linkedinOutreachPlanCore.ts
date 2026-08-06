/**
 * LinkedIn outreach plan constraints.
 * Relationship must be known before planning DMs so we never invent
 * invite-after-failure loops or burn tokens regenerating plans.
 */

export type LinkedInRelationshipStatus =
  | "connected"
  | "pending"
  | "not_connected"
  | "unknown";

export function isLinkedInDmEligible(
  status: LinkedInRelationshipStatus | null | undefined
): boolean {
  return status === "connected";
}

export function formatLinkedInRelationshipPlanGuidance(
  status: LinkedInRelationshipStatus
): string {
  switch (status) {
    case "connected":
      return [
        "## LinkedIn Relationship",
        "Status: connected (1st-degree).",
        "DM tasks are allowed.",
      ].join("\n");
    case "pending":
      return [
        "## LinkedIn Relationship",
        "Status: pending invitation (not yet accepted).",
        "CRITICAL: Do NOT include any DM tasks. LinkedIn only allows DMs with connections.",
        "Prefer comment and/or react on a suitable recent post. You may add wait or ask_human.",
        "Do not invent an invite task type.",
      ].join("\n");
    case "not_connected":
      return [
        "## LinkedIn Relationship",
        "Status: not connected.",
        "CRITICAL: Do NOT include any DM tasks. LinkedIn only allows DMs with connections.",
        "Prefer comment and/or react on a suitable recent post. You may add wait or ask_human.",
        "Do not invent an invite task type.",
      ].join("\n");
    case "unknown":
      return [
        "## LinkedIn Relationship",
        "Status: unknown (could not verify live relationship).",
        "CRITICAL: Do NOT include any DM tasks until relationship is verified as connected.",
        "Prefer comment and/or react on a suitable recent post. You may add wait or ask_human.",
      ].join("\n");
  }
}

export function applyLinkedInRelationshipTaskConstraints<
  T extends { type: string },
>(args: {
  platform: "twitter" | "linkedin" | string | null | undefined;
  relationship: LinkedInRelationshipStatus | null | undefined;
  tasks: T[];
}): { tasks: T[]; removedDmCount: number } {
  if (args.platform !== "linkedin") {
    return { tasks: args.tasks, removedDmCount: 0 };
  }
  if (isLinkedInDmEligible(args.relationship)) {
    return { tasks: args.tasks, removedDmCount: 0 };
  }

  const tasks = args.tasks.filter((task) => task.type !== "dm");
  return {
    tasks,
    removedDmCount: args.tasks.length - tasks.length,
  };
}

export function linkedInDmBlockedMessage(
  status: LinkedInRelationshipStatus
): string {
  if (status === "pending") {
    return "LinkedIn DM tasks are blocked while a connection invitation is still pending. Use comment/react (or wait/ask_human) instead.";
  }
  if (status === "unknown") {
    return "LinkedIn DM tasks are blocked because the live connection status could not be verified. Use comment/react (or wait/ask_human) instead.";
  }
  return "LinkedIn DM tasks are blocked because you are not connected with this prospect. Use comment/react (or wait/ask_human) instead.";
}
