/**
 * LinkedIn outreach plan constraints.
 *
 * A DM task for an unconnected prospect is a connect-first intent: execution
 * sends one connection request, waits for acceptance, and then sends the
 * approved DM. Direct DM eligibility is still kept separate for execution and
 * recovery decisions.
 */

export type LinkedInRelationshipStatus =
  | "connected"
  | "pending"
  | "not_connected"
  | "unknown";

export type LinkedInRelationshipContext = {
  status: LinkedInRelationshipStatus;
  hasExistingConversation: boolean;
};

export function isLinkedInDmEligible(
  status: LinkedInRelationshipStatus | null | undefined,
  hasExistingConversation = false
): boolean {
  return status === "connected" || hasExistingConversation;
}

export function isLinkedInDmPlanAllowed(
  status: LinkedInRelationshipStatus | null | undefined,
  hasExistingConversation = false
): boolean {
  if (isLinkedInDmEligible(status, hasExistingConversation)) {
    return true;
  }

  return (
    !hasExistingConversation &&
    (status === "not_connected" || status === "pending")
  );
}

export function formatLinkedInRelationshipPlanGuidance(
  status: LinkedInRelationshipStatus,
  hasExistingConversation = false
): string {
  if (hasExistingConversation && status !== "connected") {
    return [
      "## LinkedIn Relationship",
      `Status: ${status.replace("_", " ")}.`,
      "An existing LinkedIn conversation is available, so DM tasks are allowed in that conversation.",
      "Do not start a new conversation when refining or executing this plan.",
    ].join("\n");
  }

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
        "Status: pending connection request (not yet accepted).",
        "A DM task may use the connect-first flow: do not send another connection request. Wait for acceptance, then send the approved DM automatically.",
        "Do not attempt the DM before the connection is accepted, and do not invent a separate invite task type.",
      ].join("\n");
    case "not_connected":
      return [
        "## LinkedIn Relationship",
        "Status: not connected.",
        "A DM task may use the connect-first flow: after approval, send one LinkedIn connection request, wait for acceptance, then send the approved DM automatically.",
        "Do not attempt the DM before the connection is accepted, and do not invent a separate invite task type.",
      ].join("\n");
    case "unknown":
      return [
        "## LinkedIn Relationship",
        "Status: unknown (could not verify live relationship).",
        "CRITICAL: Do NOT include a new DM task until an accepted connection or existing conversation is verified.",
        "Prefer comment and/or react on a suitable recent post. You may add wait or ask_human.",
      ].join("\n");
  }
}

export function applyLinkedInRelationshipTaskConstraints<
  T extends { type: string },
>(args: {
  platform: "twitter" | "linkedin" | string | null | undefined;
  relationship: LinkedInRelationshipStatus | null | undefined;
  hasExistingConversation?: boolean;
  tasks: T[];
}): { tasks: T[]; removedDmCount: number } {
  if (args.platform !== "linkedin") {
    return { tasks: args.tasks, removedDmCount: 0 };
  }
  if (
    isLinkedInDmPlanAllowed(
      args.relationship,
      args.hasExistingConversation ?? false
    )
  ) {
    return { tasks: args.tasks, removedDmCount: 0 };
  }

  const tasks = args.tasks.filter((task) => task.type !== "dm");
  return {
    tasks,
    removedDmCount: args.tasks.length - tasks.length,
  };
}

export function linkedInDmBlockedMessage(
  status: LinkedInRelationshipStatus,
  hasExistingConversation = false
): string {
  if (hasExistingConversation) {
    return "LinkedIn messages are available in the existing conversation. Refine the plan to use that conversation instead of starting a new one.";
  }
  if (status === "pending") {
    return "A LinkedIn connection request is already pending. ReacherX will send the approved DM automatically after the request is accepted.";
  }
  if (status === "unknown") {
    return "LinkedIn messaging is unavailable because the live connection status could not be verified. Use a comment or reaction (or wait/ask_human) instead.";
  }
  return "A LinkedIn connection request is required before this DM can be sent. ReacherX will send the request and the approved DM automatically after acceptance.";
}

export function hasConcreteOutreachTask(
  tasks: readonly { type: string }[]
): boolean {
  return tasks.some(
    (task) =>
      task.type === "comment" || task.type === "dm" || task.type === "react"
  );
}
