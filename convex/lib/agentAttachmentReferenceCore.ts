import type { Id } from "../_generated/dataModel";

export const MAX_AGENT_ATTACHMENT_REFERENCES = 4;
export const AGENT_ATTACHMENT_CONTEXT_WINDOW = 20;

export type AgentAttachmentToolReference = {
  reference: string;
  uploadId: Id<"mediaUploads">;
  url: string;
  fileName: string;
  mediaKind: "image" | "gif" | "video" | "file";
  selectedInCurrentMessage: boolean;
};

export type AgentAttachmentMediaInput = {
  attachmentRefs?: string[];
  mediaUrls?: string[];
  mediaDescriptions?: string[];
  mediaKinds?: Array<"image" | "gif" | "video" | "file">;
};

export type ResolvedAgentAttachmentMediaInput = {
  mediaUrls?: string[];
  mediaUploadIds?: Id<"mediaUploads">[];
  mediaDescriptions?: string[];
  mediaKinds?: Array<"image" | "gif" | "video" | "file">;
};

export function getAgentAttachmentReference(index: number): string {
  return `attachment_${index + 1}`;
}

export function buildAgentAttachmentReferenceContext(
  references: AgentAttachmentToolReference[]
): string | null {
  if (references.length === 0) {
    return null;
  }

  return [
    "Attachment references available to tools for this request:",
    ...references.map(
      (attachment) =>
        `- ${attachment.reference}: ${attachment.fileName} (type: ${attachment.mediaKind}; ${
          attachment.selectedInCurrentMessage
            ? "selected in the current message"
            : "selected earlier in this thread"
        })`
    ),
    "Use these exact reference names in a tool's attachmentRefs field. Never put storage URLs or upload IDs in tool input.",
    "Attachments from the current message are deliberate request context. Use an earlier attachment only when the user clearly refers to it.",
  ].join("\n");
}

export function resolveAgentAttachmentMediaInput(
  input: AgentAttachmentMediaInput,
  availableReferences: AgentAttachmentToolReference[]
): ResolvedAgentAttachmentMediaInput {
  const attachmentRefs = input.attachmentRefs ?? [];
  const mediaUrls = input.mediaUrls ?? [];

  if (attachmentRefs.length === 0) {
    return {
      mediaUrls: input.mediaUrls,
      mediaDescriptions: input.mediaDescriptions,
      mediaKinds: input.mediaKinds,
    };
  }

  if (mediaUrls.length > 0) {
    throw new Error(
      "Use attachmentRefs for selected files or mediaUrls for explicit delegated URLs, not both in the same task."
    );
  }
  if (new Set(attachmentRefs).size !== attachmentRefs.length) {
    throw new Error("attachmentRefs cannot contain the same file twice.");
  }

  const availableByReference = new Map(
    availableReferences.map((attachment) => [attachment.reference, attachment])
  );
  const resolved = attachmentRefs.map((reference) => {
    const attachment = availableByReference.get(reference);
    if (!attachment) {
      throw new Error(
        `Attachment reference "${reference}" is unavailable. Use one of the attachment references provided in the current context.`
      );
    }
    return attachment;
  });

  if (
    input.mediaDescriptions &&
    input.mediaDescriptions.length > resolved.length
  ) {
    throw new Error(
      "mediaDescriptions cannot exceed the number of attachmentRefs."
    );
  }

  return {
    mediaUrls: resolved.map((attachment) => attachment.url),
    mediaUploadIds: resolved.map((attachment) => attachment.uploadId),
    mediaDescriptions: input.mediaDescriptions,
    mediaKinds: resolved.map((attachment) => attachment.mediaKind),
  };
}

export function restoreExistingMediaUploadIds<
  Task extends {
    mediaUrls?: string[];
    mediaUploadIds?: Id<"mediaUploads">[];
  },
>(
  tasks: Task[],
  existingTasks: Array<{
    mediaUrls?: string[];
    mediaUploadIds?: Id<"mediaUploads">[];
  }>
): Task[] {
  const uploadIdByUrl = new Map<string, Id<"mediaUploads">>();
  for (const existingTask of existingTasks) {
    if (
      !existingTask.mediaUrls?.length ||
      existingTask.mediaUrls.length !== existingTask.mediaUploadIds?.length
    ) {
      continue;
    }
    existingTask.mediaUrls.forEach((url, index) => {
      uploadIdByUrl.set(url, existingTask.mediaUploadIds![index]);
    });
  }

  return tasks.map((task) => {
    if (task.mediaUploadIds?.length || !task.mediaUrls?.length) {
      return task;
    }
    const mediaUploadIds = task.mediaUrls.map((url) => uploadIdByUrl.get(url));
    if (
      mediaUploadIds.some(
        (uploadId): uploadId is undefined => uploadId === undefined
      )
    ) {
      return task;
    }
    return {
      ...task,
      mediaUploadIds: mediaUploadIds as Id<"mediaUploads">[],
    };
  });
}
