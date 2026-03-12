export const DEFAULT_WORKSPACE_USE_CASE_KEY = "customer_prospecting";

export const WORKSPACE_USE_CASE_KEYS = [
  "customer_prospecting",
  "recruiting",
  "partnership_outreach",
  "investor_outreach",
  "user_research_recruitment",
  "creator_outreach",
  "community_growth",
  "podcast_speaker_sourcing",
] as const;

export type WorkspaceUseCaseKey = (typeof WORKSPACE_USE_CASE_KEYS)[number];

export const WORKSPACE_USE_CASE_STAGE_KEYS = [
  "new",
  "contacted",
  "in_progress",
  "converted",
  "archived",
] as const;

export type WorkspaceUseCaseStageKey =
  (typeof WORKSPACE_USE_CASE_STAGE_KEYS)[number];

export const WORKSPACE_USE_CASE_FUNNEL_STAGE_KEYS = [
  "new",
  "contacted",
  "in_progress",
  "converted",
] as const;

export type WorkspaceUseCaseFunnelStageKey =
  (typeof WORKSPACE_USE_CASE_FUNNEL_STAGE_KEYS)[number];

export type WorkspaceUseCaseDefinition = {
  key: WorkspaceUseCaseKey;
  displayName: string;
  shortDescription: string;
  entitySingular: string;
  entityPlural: string;
  successDefinition: string;
  profileLabelPlural: string;
  routeSlugs: {
    entity: string;
    success: string;
  };
  stageLabels: Record<WorkspaceUseCaseStageKey, string>;
  pageLabels: {
    entities: string;
    converts: string;
    archives: "Archives";
    analytics: string;
  };
  promptContext: {
    searchIntent: string;
    qualificationLens: string;
    outreachGoal: string;
    successDefinition: string;
    terminology: {
      entitySingular: string;
      entityPlural: string;
      successLabel: string;
      profileLabelPlural: string;
    };
  };
};

export const workspaceUseCaseRegistry = {
  customer_prospecting: {
    key: "customer_prospecting",
    displayName: "Customer Prospecting",
    shortDescription:
      "Find people and companies likely to become paying customers.",
    entitySingular: "Prospect",
    entityPlural: "Prospects",
    successDefinition: "A converted prospect becomes a customer.",
    profileLabelPlural: "Ideal customer profiles",
    routeSlugs: {
      entity: "prospects",
      success: "converts",
    },
    stageLabels: {
      new: "New",
      contacted: "Contacted",
      in_progress: "In progress",
      converted: "Converted",
      archived: "Archived",
    },
    pageLabels: {
      entities: "Prospects",
      converts: "Converts",
      archives: "Archives",
      analytics: "Analytics",
    },
    promptContext: {
      searchIntent: "purchase intent, problems, and clear need signals",
      qualificationLens:
        "ICP fit, urgency, business pain, and likelihood to buy",
      outreachGoal:
        "start a relevant sales conversation that can lead to a customer",
      successDefinition:
        "a successful outcome is turning the prospect into a customer",
      terminology: {
        entitySingular: "prospect",
        entityPlural: "prospects",
        successLabel: "Converts",
        profileLabelPlural: "Ideal customer profiles",
      },
    },
  },
  recruiting: {
    key: "recruiting",
    displayName: "Recruiting",
    shortDescription:
      "Source and engage candidates who match an open role or talent profile.",
    entitySingular: "Candidate",
    entityPlural: "Candidates",
    successDefinition: "A converted candidate becomes a hire.",
    profileLabelPlural: "Ideal candidate profiles",
    routeSlugs: {
      entity: "candidates",
      success: "hires",
    },
    stageLabels: {
      new: "Sourced",
      contacted: "Contacted",
      in_progress: "Interviewing",
      converted: "Hired",
      archived: "Archived",
    },
    pageLabels: {
      entities: "Candidates",
      converts: "Hires",
      archives: "Archives",
      analytics: "Analytics",
    },
    promptContext: {
      searchIntent:
        "role fit, skill signals, hiring intent, and open-to-work language",
      qualificationLens:
        "role fit, relevant experience, interest level, and interview potential",
      outreachGoal: "start a recruiting conversation that can lead to a hire",
      successDefinition:
        "a successful outcome is moving the candidate to a hire",
      terminology: {
        entitySingular: "candidate",
        entityPlural: "candidates",
        successLabel: "Hires",
        profileLabelPlural: "Ideal candidate profiles",
      },
    },
  },
  partnership_outreach: {
    key: "partnership_outreach",
    displayName: "Partnership Outreach",
    shortDescription:
      "Identify companies or operators who could become strategic partners.",
    entitySingular: "Partner",
    entityPlural: "Partners",
    successDefinition: "A converted partner becomes an active partner.",
    profileLabelPlural: "Ideal partner profiles",
    routeSlugs: {
      entity: "partners",
      success: "active-partners",
    },
    stageLabels: {
      new: "Identified",
      contacted: "Contacted",
      in_progress: "Negotiating",
      converted: "Partnered",
      archived: "Archived",
    },
    pageLabels: {
      entities: "Partners",
      converts: "Active partners",
      archives: "Archives",
      analytics: "Analytics",
    },
    promptContext: {
      searchIntent:
        "integration fit, co-marketing potential, reseller fit, and strategic alignment",
      qualificationLens:
        "mutual value, audience overlap, partnership readiness, and execution fit",
      outreachGoal:
        "open a partnership conversation that can lead to an active partner",
      successDefinition:
        "a successful outcome is converting the outreach target into an active partner",
      terminology: {
        entitySingular: "partner",
        entityPlural: "partners",
        successLabel: "Active partners",
        profileLabelPlural: "Ideal partner profiles",
      },
    },
  },
  investor_outreach: {
    key: "investor_outreach",
    displayName: "Investor Outreach",
    shortDescription:
      "Find investors whose thesis and activity align with the opportunity.",
    entitySingular: "Investor",
    entityPlural: "Investors",
    successDefinition: "A converted investor becomes a committed investor.",
    profileLabelPlural: "Ideal investor profiles",
    routeSlugs: {
      entity: "investors",
      success: "committed-investors",
    },
    stageLabels: {
      new: "Identified",
      contacted: "Contacted",
      in_progress: "In discussion",
      converted: "Committed",
      archived: "Archived",
    },
    pageLabels: {
      entities: "Investors",
      converts: "Committed investors",
      archives: "Archives",
      analytics: "Analytics",
    },
    promptContext: {
      searchIntent:
        "thesis fit, investment activity, portfolio alignment, and investor intent",
      qualificationLens:
        "check size fit, thematic fit, investment recency, and likelihood to engage",
      outreachGoal:
        "start an investor conversation that can lead to a committed investor",
      successDefinition:
        "a successful outcome is converting the outreach target into a committed investor",
      terminology: {
        entitySingular: "investor",
        entityPlural: "investors",
        successLabel: "Committed investors",
        profileLabelPlural: "Ideal investor profiles",
      },
    },
  },
  user_research_recruitment: {
    key: "user_research_recruitment",
    displayName: "User Research Recruitment",
    shortDescription:
      "Recruit participants who can provide useful product or market feedback.",
    entitySingular: "Participant",
    entityPlural: "Participants",
    successDefinition:
      "A converted participant becomes a confirmed participant.",
    profileLabelPlural: "Ideal participant profiles",
    routeSlugs: {
      entity: "participants",
      success: "confirmed-participants",
    },
    stageLabels: {
      new: "Found",
      contacted: "Contacted",
      in_progress: "Interested",
      converted: "Completed",
      archived: "Archived",
    },
    pageLabels: {
      entities: "Participants",
      converts: "Confirmed participants",
      archives: "Archives",
      analytics: "Analytics",
    },
    promptContext: {
      searchIntent:
        "expressed pain points, willingness to talk, and feedback signals",
      qualificationLens:
        "research relevance, response likelihood, and interview value",
      outreachGoal:
        "start a research conversation that can lead to a confirmed participant",
      successDefinition:
        "a successful outcome is converting the outreach target into a confirmed participant",
      terminology: {
        entitySingular: "participant",
        entityPlural: "participants",
        successLabel: "Confirmed participants",
        profileLabelPlural: "Ideal participant profiles",
      },
    },
  },
  creator_outreach: {
    key: "creator_outreach",
    displayName: "Creator Outreach",
    shortDescription:
      "Find creators who match the audience, brand, or collaboration goal.",
    entitySingular: "Creator",
    entityPlural: "Creators",
    successDefinition: "A converted creator becomes a collaborator.",
    profileLabelPlural: "Ideal creator profiles",
    routeSlugs: {
      entity: "creators",
      success: "collaborators",
    },
    stageLabels: {
      new: "Found",
      contacted: "Contacted",
      in_progress: "Negotiating",
      converted: "Collaborating",
      archived: "Archived",
    },
    pageLabels: {
      entities: "Creators",
      converts: "Collaborators",
      archives: "Archives",
      analytics: "Analytics",
    },
    promptContext: {
      searchIntent:
        "audience fit, content alignment, and sponsorship or collaboration posture",
      qualificationLens:
        "brand fit, engagement quality, collaboration readiness, and audience overlap",
      outreachGoal:
        "start a creator conversation that can lead to a collaboration",
      successDefinition:
        "a successful outcome is converting the outreach target into a collaborator",
      terminology: {
        entitySingular: "creator",
        entityPlural: "creators",
        successLabel: "Collaborators",
        profileLabelPlural: "Ideal creator profiles",
      },
    },
  },
  community_growth: {
    key: "community_growth",
    displayName: "Community Growth",
    shortDescription:
      "Find people who are likely to join and participate in the community.",
    entitySingular: "Potential member",
    entityPlural: "Potential members",
    successDefinition: "A converted prospect becomes a member.",
    profileLabelPlural: "Ideal member profiles",
    routeSlugs: {
      entity: "potential-members",
      success: "members",
    },
    stageLabels: {
      new: "Found",
      contacted: "Contacted",
      in_progress: "Interested",
      converted: "Active",
      archived: "Archived",
    },
    pageLabels: {
      entities: "Potential members",
      converts: "Members",
      archives: "Archives",
      analytics: "Analytics",
    },
    promptContext: {
      searchIntent: "interest, participation, discovery, and join signals",
      qualificationLens:
        "community fit, intent to join, and likelihood to become active",
      outreachGoal:
        "start a community conversation that can lead to a new member",
      successDefinition:
        "a successful outcome is converting the outreach target into an active community member",
      terminology: {
        entitySingular: "potential member",
        entityPlural: "potential members",
        successLabel: "Members",
        profileLabelPlural: "Ideal member profiles",
      },
    },
  },
  podcast_speaker_sourcing: {
    key: "podcast_speaker_sourcing",
    displayName: "Podcast Speaker Sourcing",
    shortDescription:
      "Source guests with the right expertise, voice, and storytelling ability.",
    entitySingular: "Guest",
    entityPlural: "Guests",
    successDefinition: "A converted guest becomes a booked guest.",
    profileLabelPlural: "Ideal guest profiles",
    routeSlugs: {
      entity: "guests",
      success: "booked-guests",
    },
    stageLabels: {
      new: "Identified",
      contacted: "Contacted",
      in_progress: "Interested",
      converted: "Booked",
      archived: "Archived",
    },
    pageLabels: {
      entities: "Guests",
      converts: "Booked guests",
      archives: "Archives",
      analytics: "Analytics",
    },
    promptContext: {
      searchIntent:
        "expertise, public speaking signals, thought leadership, and storytelling ability",
      qualificationLens:
        "topic fit, audience value, availability likelihood, and booking potential",
      outreachGoal:
        "start a guest booking conversation that can lead to a booked guest",
      successDefinition:
        "a successful outcome is converting the outreach target into a booked guest",
      terminology: {
        entitySingular: "guest",
        entityPlural: "guests",
        successLabel: "Booked guests",
        profileLabelPlural: "Ideal guest profiles",
      },
    },
  },
} satisfies Record<WorkspaceUseCaseKey, WorkspaceUseCaseDefinition>;

export const workspaceUseCases = WORKSPACE_USE_CASE_KEYS.map(
  (key) => workspaceUseCaseRegistry[key]
);

export function isWorkspaceUseCaseKey(
  value: unknown
): value is WorkspaceUseCaseKey {
  return (
    typeof value === "string" &&
    WORKSPACE_USE_CASE_KEYS.includes(value as WorkspaceUseCaseKey)
  );
}

// Older workspace rows will not have a persisted useCaseKey until later phases.
export function resolveWorkspaceUseCaseKey(
  value: unknown
): WorkspaceUseCaseKey {
  return isWorkspaceUseCaseKey(value) ? value : DEFAULT_WORKSPACE_USE_CASE_KEY;
}

export function getWorkspaceUseCase(
  value: unknown
): WorkspaceUseCaseDefinition {
  return workspaceUseCaseRegistry[resolveWorkspaceUseCaseKey(value)];
}

export function getWorkspaceStageLabel(
  value: unknown,
  stage: WorkspaceUseCaseStageKey
): string {
  return getWorkspaceUseCase(value).stageLabels[stage];
}

export function getWorkspaceStageActionLabel(
  value: unknown,
  stage: WorkspaceUseCaseStageKey
): string {
  return `Mark "${getWorkspaceStageLabel(value, stage)}"`;
}
