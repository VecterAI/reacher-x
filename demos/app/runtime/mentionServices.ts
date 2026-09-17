import mediaSizes from "./mediaAssets.json";
import { api } from "@/convex/_generated/api";
import type { MentionEntitySearchResult } from "@/shared/lib/mentions/mentionEntities";
import { normalizeProspectProfileData } from "@/features/prospects/lib/normalizeProspectProfileData";
import type { createAppFixtures } from "./appFixtures";
import type { LocalClient } from "./LocalClient";

export function registerMentionServices(
  client: LocalClient,
  state: ReturnType<typeof createAppFixtures>,
  uploads: MentionEntitySearchResult[] = []
) {
  client.register(
    api.mediaMentions.searchMentionEntities,
    ({ query, workspaceId, limit = 8, allowedKinds }) => {
      const workspace = workspaceId ?? state.selectedWorkspaceId;
      const people: MentionEntitySearchResult[] = state.prospects
        .filter((person) => person.workspaceId === workspace)
        .map((person) => ({
          id: `prospect:${person._id}`,
          entityId: person._id,
          kind: "prospect",
          label: person.displayName ?? "Person",
          mentionText: person.displayName ?? "Person",
          secondaryLabel: person.title ?? "",
          avatarUrl: normalizeProspectProfileData(person)?.avatarUrl ?? null,
          verified: false,
          workspaceId: workspace,
          prospectId: person._id,
        }));
      const attachments: MentionEntitySearchResult[] = (
        ["video", "image"] as const
      ).map((kind) => ({
        id: `attachment:demo_feedback_${kind}`,
        entityId: `demo_feedback_${kind}`,
        kind: "attachment",
        label: kind === "video" ? "client-feedback.mp4" : "client-feedback.png",
        mentionText: `Attachment: client-feedback.${kind === "video" ? "mp4" : "png"}`,
        secondaryLabel: "Workspace attachment",
        avatarUrl: null,
        verified: false,
        workspaceId: workspace,
        attachmentUrl: `/media/client-feedback.${kind === "video" ? "mp4" : "png"}`,
        attachmentMimeType: kind === "video" ? "video/mp4" : "image/png",
        attachmentSize:
          mediaSizes[
            kind === "video" ? "client-feedback.mp4" : "client-feedback.png"
          ],
        attachmentMediaKind: kind,
        attachmentDisabled: false,
        attachmentDisabledReason: null,
      }));
      if (state.scenario === "find-creators")
        attachments.push({
          id: "attachment:demo_reacherx_workflow",
          entityId: "demo_reacherx_workflow",
          kind: "attachment",
          label: "reacherx-workflow.mp4",
          mentionText: "Attachment: reacherx-workflow.mp4",
          secondaryLabel: "Workspace attachment",
          avatarUrl: null,
          verified: false,
          workspaceId: workspace,
          attachmentUrl: "/media/reacherx-workflow.mp4",
          attachmentMimeType: "video/mp4",
          attachmentSize: mediaSizes["reacherx-workflow.mp4"],
          attachmentMediaKind: "video",
          attachmentDisabled: false,
          attachmentDisabledReason: null,
        });
      return [
        ...people,
        ...attachments,
        ...uploads.filter((item) => item.workspaceId === workspace),
      ]
        .filter(
          (entity) =>
            (!allowedKinds || allowedKinds.includes(entity.kind)) &&
            `${entity.label} ${entity.secondaryLabel}`
              .toLowerCase()
              .includes(query.trim().toLowerCase())
        )
        .slice(0, limit);
    }
  );
}
