import { getManyFrom } from "convex-helpers/server/relationships";
import type { Infer } from "convex/values";
import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import { agentComponentThreadStatusValidator } from "../validators";

type RelationshipDb = QueryCtx["db"] | MutationCtx["db"];

export type ProspectThreadLink = Doc<"prospectThreads">;
export type ProspectThreadStatus = Infer<
  typeof agentComponentThreadStatusValidator
>;
export type ProspectThreadMetadataInput = {
  threadStatus?: ProspectThreadStatus;
  threadSummary?: string;
};

export type ProspectThreadContext = {
  link: ProspectThreadLink;
  prospect: Doc<"prospects">;
};

type EnsureProspectThreadLinkInput = {
  prospectId: Id<"prospects">;
  threadId: string;
  userId: Id<"users">;
} & ProspectThreadMetadataInput;

function sortLinksByNewest(links: ProspectThreadLink[]): ProspectThreadLink[] {
  return [...links].sort((a, b) => b._creationTime - a._creationTime);
}

function pickCanonicalThreadLink(
  links: ProspectThreadLink[],
  threadId: string
): ProspectThreadLink | null {
  if (links.length === 0) {
    return null;
  }

  if (links.length > 1) {
    console.error(
      `[RelationshipHelpers] Found ${links.length} prospect thread links for thread ${threadId}; using the newest row`
    );
  }

  return sortLinksByNewest(links)[0] ?? null;
}

export async function listProspectThreadLinksByProspect(
  db: RelationshipDb,
  prospectId: Id<"prospects">
): Promise<ProspectThreadLink[]> {
  const links = await getManyFrom(
    db,
    "prospectThreads",
    "by_prospect",
    prospectId,
    "prospectId"
  );
  return sortLinksByNewest(links);
}

export async function listProspectThreadIdsByProspect(
  db: RelationshipDb,
  prospectId: Id<"prospects">
): Promise<string[]> {
  const links = await listProspectThreadLinksByProspect(db, prospectId);
  return links.map((link) => link.threadId);
}

export async function getProspectThreadLinkByThreadId(
  db: RelationshipDb,
  threadId: string
): Promise<ProspectThreadLink | null> {
  const links = await getManyFrom(
    db,
    "prospectThreads",
    "by_thread",
    threadId,
    "threadId"
  );
  return pickCanonicalThreadLink(links, threadId);
}

export async function listProspectThreadLinksByThreadId(
  db: RelationshipDb,
  threadId: string
): Promise<ProspectThreadLink[]> {
  const links = await getManyFrom(
    db,
    "prospectThreads",
    "by_thread",
    threadId,
    "threadId"
  );
  return sortLinksByNewest(links);
}

export async function getProspectIdFromThreadId(
  db: RelationshipDb,
  threadId: string
): Promise<Id<"prospects"> | null> {
  const link = await getProspectThreadLinkByThreadId(db, threadId);
  return link?.prospectId ?? null;
}

export async function getProspectThreadContextByThreadId(
  db: RelationshipDb,
  threadId: string
): Promise<ProspectThreadContext | null> {
  const link = await getProspectThreadLinkByThreadId(db, threadId);
  if (!link) {
    return null;
  }

  const prospect = await db.get(link.prospectId);
  if (!prospect) {
    console.warn(
      `[RelationshipHelpers] Prospect ${link.prospectId} missing for thread ${threadId}`
    );
    return null;
  }

  return { link, prospect };
}

function buildProspectThreadMetadataPatch(
  existing: Pick<Doc<"prospectThreads">, "threadStatus" | "threadSummary">,
  input: ProspectThreadMetadataInput
): Partial<Pick<Doc<"prospectThreads">, "threadStatus" | "threadSummary">> {
  const patch: Partial<
    Pick<Doc<"prospectThreads">, "threadStatus" | "threadSummary">
  > = {};

  if (
    input.threadStatus !== undefined &&
    existing.threadStatus !== input.threadStatus
  ) {
    patch.threadStatus = input.threadStatus;
  }

  if (
    input.threadSummary !== undefined &&
    existing.threadSummary !== input.threadSummary
  ) {
    patch.threadSummary = input.threadSummary;
  }

  return patch;
}

export async function ensureProspectThreadLink(
  ctx: MutationCtx,
  input: EnsureProspectThreadLinkInput
): Promise<{ linkId: Id<"prospectThreads">; created: boolean; updated: boolean }> {
  const existingLink = await getProspectThreadLinkByThreadId(
    ctx.db,
    input.threadId
  );

  if (existingLink) {
    if (
      existingLink.prospectId !== input.prospectId ||
      existingLink.userId !== input.userId
    ) {
      throw new Error(
        `Thread ${input.threadId} is already linked to a different prospect relationship`
      );
    }

    const patch = buildProspectThreadMetadataPatch(existingLink, input);
    const updated = Object.keys(patch).length > 0;
    if (updated) {
      await ctx.db.patch(existingLink._id, patch);
    }

    return { linkId: existingLink._id, created: false, updated };
  }

  const linkId = await ctx.db.insert("prospectThreads", input);
  return { linkId, created: true, updated: false };
}
