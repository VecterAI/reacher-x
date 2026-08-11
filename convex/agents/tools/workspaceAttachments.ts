"use node";

import { createTool } from "@convex-dev/agent";
import { z } from "zod";
import { internal } from "../../_generated/api";
import type { Id } from "../../_generated/dataModel";
import {
  createAttachmentPreviewArtifact,
  type AgentArtifactEnvelope,
} from "../../../shared/lib/json-render/agentArtifacts";
import { buildWorkspaceAttachmentCountSummary } from "../../lib/workspaceAttachmentCore";
import type { WorkspaceAttachmentCompatibility } from "../../lib/workspaceAttachmentCore";
import type { AgentAttachmentToolReference } from "../../lib/agentAttachmentReferenceCore";
import {
  getToolPromptMessageId,
  resolveWorkspaceMemoryContext,
} from "./workspaceMemoryHelpers";

const operationSchema = z.enum([
  "count",
  "search",
  "inspect",
  "show",
  "resolve_memory",
]);
const mediaKindSchema = z.enum(["image", "gif", "video", "file"]);
const destinationSchema = z.object({
  platform: z.enum(["twitter", "linkedin"]),
  surface: z.enum(["comment", "dm"]),
});

type ToolAttachment = {
  attachmentRef: string;
  fileName: string;
  displayName: string;
  mimeType: string;
  mediaKind: "image" | "gif" | "video" | "file";
  size: number;
  tags: string[];
  uploadedAt: number;
  mediaUrl: string;
  compatible: boolean | null;
  disabledReason: string | null;
};

type AgentAttachmentRecord = {
  uploadId: Id<"mediaUploads">;
  fileName: string;
  displayName: string;
  mimeType: string;
  mediaKind: "image" | "gif" | "video" | "file";
  size: number;
  tags: string[];
  uploadedAt: number;
  mediaUrl: string;
  compatibility: {
    twitterReply: WorkspaceAttachmentCompatibility;
    twitterDm: WorkspaceAttachmentCompatibility;
    linkedInComment: WorkspaceAttachmentCompatibility;
    linkedInDm: WorkspaceAttachmentCompatibility;
  };
};

export type WorkspaceAttachmentsToolResult = {
  success: boolean;
  operation: z.infer<typeof operationSchema>;
  message: string;
  count?: number;
  breakdown?: {
    images: number;
    gifs: number;
    videos: number;
    files: number;
  };
  attachments?: ToolAttachment[];
  requiresClarification?: boolean;
  artifact?: AgentArtifactEnvelope;
};

function normalizeName(value: string): string {
  return value.trim().toLocaleLowerCase();
}

function getDestinationCompatibility(
  attachment: AgentAttachmentRecord,
  destination: z.infer<typeof destinationSchema> | undefined
) {
  if (!destination) return null;
  if (destination.platform === "twitter") {
    return destination.surface === "dm"
      ? attachment.compatibility.twitterDm
      : attachment.compatibility.twitterReply;
  }
  return destination.surface === "dm"
    ? attachment.compatibility.linkedInDm
    : attachment.compatibility.linkedInComment;
}

export const workspaceAttachments = createTool({
  description:
    "Count, search, inspect, show, or resolve memory-linked attachments in the current workspace. Results come from live workspace data. Use show when the user asks to see a file. Use resolve_memory when an applicable workspace memory names a memoryKey with linked attachments. Never invent an attachment reference, storage URL, or database ID.",
  inputSchema: z.object({
    operation: operationSchema.describe(
      "count for totals, search for discovery, inspect for metadata, show for inline rendering, or resolve_memory for attachments bound to an applicable workspace memory."
    ),
    query: z
      .string()
      .max(240)
      .optional()
      .describe(
        "Natural file-name, display-name, tag, or type query. Required for inspect/show unless selecting latest or oldest."
      ),
    memoryKey: z
      .string()
      .max(120)
      .optional()
      .describe(
        "The exact memoryKey supplied in workspace memory context. Use only with resolve_memory."
      ),
    mediaKind: mediaKindSchema
      .optional()
      .describe("Optional image, GIF, video, or generic file filter."),
    selection: z
      .enum(["best_match", "latest", "oldest"])
      .optional()
      .default("best_match")
      .describe("How to choose among live workspace attachments."),
    limit: z.number().int().min(1).max(8).optional().default(5),
    destination: destinationSchema
      .optional()
      .describe(
        "Optional outreach destination used to report whether each result can be selected. Internal platform value twitter is rendered to users as X/Twitter."
      ),
  }),
  execute: async (ctx, args): Promise<WorkspaceAttachmentsToolResult> => {
    const context = await resolveWorkspaceMemoryContext(
      ctx,
      "workspaceAttachments"
    );
    if (!context.userId || !context.workspaceId) {
      return {
        success: false,
        operation: args.operation,
        message: "I couldn't determine the current workspace.",
      };
    }
    const workspaceId = context.workspaceId as Id<"workspaces">;
    const userId = context.userId;

    if (args.operation === "count") {
      const counts = await ctx.runQuery(
        internal.workspaceAttachments.getCountForAgentInternal,
        { workspaceId, userId }
      );
      return {
        success: true,
        operation: "count",
        message: buildWorkspaceAttachmentCountSummary(counts),
        count: counts.total,
        breakdown: {
          images: counts.images,
          gifs: counts.gifs,
          videos: counts.videos,
          files: counts.files,
        },
      };
    }

    let records: AgentAttachmentRecord[];
    if (args.operation === "resolve_memory") {
      if (!args.memoryKey?.trim()) {
        return {
          success: false,
          operation: args.operation,
          message: "A workspace memory key is required to resolve its files.",
        };
      }
      const uploadIds = await ctx.runQuery(
        internal.workspaceAttachments.getMemoryAttachmentIdsForAgentInternal,
        { workspaceId, userId, memoryKey: args.memoryKey }
      );
      records = await ctx.runQuery(
        internal.workspaceAttachments.getByIdsForAgentInternal,
        { workspaceId, userId, uploadIds }
      );
    } else {
      if (
        (args.operation === "show" || args.operation === "inspect") &&
        !args.query?.trim() &&
        args.selection === "best_match"
      ) {
        return {
          success: false,
          operation: args.operation,
          message:
            "Name the attachment to find, or ask for the latest or oldest matching file.",
        };
      }
      records = await ctx.runQuery(
        internal.workspaceAttachments.searchForAgentInternal,
        {
          workspaceId,
          userId,
          query: args.query,
          mediaKind: args.mediaKind,
          selection: args.selection,
          limit:
            args.operation === "show" || args.operation === "inspect"
              ? Math.max(args.limit, 2)
              : args.limit,
        }
      );
    }

    if (records.length === 0) {
      return {
        success: true,
        operation: args.operation,
        message:
          args.operation === "resolve_memory"
            ? "That workspace memory has no available linked attachments."
            : "No matching attachments were found in this workspace.",
        attachments: [],
      };
    }

    if (args.operation === "show" || args.operation === "inspect") {
      const normalizedQuery = args.query ? normalizeName(args.query) : "";
      const exactMatches = normalizedQuery
        ? records.filter(
            (record) =>
              normalizeName(record.fileName) === normalizedQuery ||
              normalizeName(record.displayName) === normalizedQuery
          )
        : [];
      if (exactMatches.length === 1) {
        records = exactMatches;
      } else if (records.length === 1 || args.selection !== "best_match") {
        records = records.slice(0, 1);
      } else {
        return {
          success: true,
          operation: args.operation,
          message: `I found multiple matching attachments: ${records
            .map((record) => record.displayName)
            .join(", ")}. Ask the user which one they mean.`,
          requiresClarification: true,
        };
      }
    }

    const messageId = getToolPromptMessageId(ctx);
    if (!ctx.threadId || !messageId) {
      return {
        success: false,
        operation: args.operation,
        message:
          "The attachments were found, but this Agent turn cannot safely stage them. Try again in the workspace conversation.",
      };
    }
    await ctx.runMutation(
      internal.workspaceAttachments.stageForAgentToolInternal,
      {
        threadId: ctx.threadId,
        messageId,
        workspaceId,
        userId,
        uploadIds: records.map((record) => record.uploadId).slice(0, 4),
      }
    );
    const references: AgentAttachmentToolReference[] = await ctx.runQuery(
      internal.agentAttachments.listAvailableForAgentTool,
      { threadId: ctx.threadId, messageId, userId }
    );
    const referenceByUploadId = new Map(
      references.map((reference) => [String(reference.uploadId), reference])
    );
    const attachments = records.flatMap((record) => {
      const reference = referenceByUploadId.get(String(record.uploadId));
      if (!reference) return [];
      const compatibility = getDestinationCompatibility(
        record,
        args.destination
      );
      return [
        {
          attachmentRef: reference.reference,
          fileName: record.fileName,
          displayName: record.displayName,
          mimeType: record.mimeType,
          mediaKind: record.mediaKind,
          size: record.size,
          tags: record.tags,
          uploadedAt: record.uploadedAt,
          mediaUrl: record.mediaUrl,
          compatible: compatibility?.compatible ?? null,
          disabledReason: compatibility?.reason ?? null,
        } satisfies ToolAttachment,
      ];
    });

    if (attachments.length === 0) {
      return {
        success: false,
        operation: args.operation,
        message:
          "The matching attachments could not be staged in this Agent turn.",
      };
    }

    const result: WorkspaceAttachmentsToolResult = {
      success: true,
      operation: args.operation,
      message:
        args.operation === "show"
          ? `Showing ${attachments.map((attachment) => attachment.displayName).join(", ")}.`
          : `Found ${attachments.length} matching ${attachments.length === 1 ? "attachment" : "attachments"}.`,
      attachments,
    };
    if (args.operation === "show") {
      result.artifact = createAttachmentPreviewArtifact({ attachments });
    }
    return result;
  },
});
