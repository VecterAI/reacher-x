import { registerPublicInteractionServices } from "./publicInteractionServices";
import { registerBatchStory } from "./scenarios/batch";
import { registerSetupStory } from "./scenarios/setup";
import { registerMediaStory } from "./scenarios/media";
import { registerMentionServices } from "./mentionServices";
import { registerMediaServices } from "./mediaServices";
import { registerPlanServices } from "./planServices";
import { registerAutocompleteStory } from "./scenarios/autocomplete";
import type { BlogDemoId } from "@/features/blog/lib/blogDemoHelpers";
import { createAppFixtures } from "./appFixtures";
import { createServices } from "./conversationServices";
import { registerConversationContextServices } from "./conversationContextServices";
import { registerWorkspaceControlServices } from "./workspaceControlServices";
import { registerWorkspaceServices } from "./workspaceServices";
import { registerProspectServices } from "./prospectServices";
import { registerProspectListServices } from "./prospectListServices";
import { registerProspectHistoryServices } from "./prospectHistoryServices";
import { registerMemoryStory } from "./scenarios/memory";
import { registerReportingServices } from "./reportingServices";
import { registerAgentServices } from "./agentServices";
import { registerAccountServices } from "./accountServices";
import { registerNotificationServices } from "./notificationServices";
import { registerProfileServices } from "./profileServices";
import { registerOutreachStory } from "./scenarios/outreach";

/** One local service graph per mounted app; stories vary only their seed data. */
export function createAppServices(scenario?: BlogDemoId) {
  const state = createAppFixtures(scenario);
  const services = createServices(state);
  const { client } = services;
  const notifications = registerNotificationServices(client, state);
  registerConversationContextServices(client, state);
  const workspaceServices = registerWorkspaceServices(
    client,
    state,
    notifications.pendingCount
  );

  const accounts = registerAccountServices(client, state);
  registerProspectServices(client, state);
  registerProfileServices(client, state, accounts);
  registerProspectListServices(client, state);
  registerProspectHistoryServices(client, state);
  registerPublicInteractionServices(client, state);
  const reporting = registerReportingServices(client, state);
  const agent = registerAgentServices(client, state);
  registerMemoryStory(agent, state, reporting);
  registerAutocompleteStory(client, state);
  registerMentionServices(client, state, registerMediaServices(client));
  const planLifecycle = registerPlanServices(client, state);
  registerWorkspaceControlServices(client, state, planLifecycle);
  registerMediaStory(agent, state);
  registerSetupStory(client, state, agent, workspaceServices);
  registerBatchStory(client, state, agent);
  registerOutreachStory(agent, state);
  return { ...services, state, agent, reporting, planLifecycle };
}
