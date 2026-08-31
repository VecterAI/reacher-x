import type {
  GenericDatabaseReader,
  GenericDatabaseWriter,
} from "convex/server";
import type { Id } from "../_generated/dataModel";
import {
  type WorkspaceMemoryNamespaceKind,
  normalizeMemoryText,
} from "./memoryHelpers";
import {
  getWorkspaceAgentOpsContributionsFromBuiltInMemory,
  isWorkspaceAgentOpsStripeEmpty,
  mergeWorkspaceAgentOpsStripeContributions,
} from "./agentOpsReadModelHelpers";
import { getUtcDayStartTimestamp } from "./readModelHelpers";
import { getReadModelStripe } from "./readModelStripeHelpers";
import { getCurrentUTCTimestamp } from "../../shared/lib/utils/time/timeUtils";
import {
  buildCanonicalWorkspaceMemoryIdentity,
  buildCanonicalWorkspaceMemoryRagText,
  getWorkspaceMemoryAuthority,
  type WorkspaceMemoryProvenanceKind,
  upsertCanonicalWorkspaceMemory,
} from "./workspaceMemoryCore";

type MemoryDbReader = GenericDatabaseReader<any>;
type MemoryDbWriter = GenericDatabaseWriter<any>;

export const AGENT_MEMORY_MARKER = "[ReacherX Memory]";
const MEMORY_META_PREFIX = "meta: ";
const SECTION_LABELS = [
  "Signals:",
  "Evidence:",
  "RelatedQueries:",
  "Narrative:",
] as const;
const MAX_RELEVANCE_CANDIDATES = 120;
const AGENT_MEMORY_USER_INDEX = "userId";
const STOP_WORDS = new Set([
  "a",
  "an",
  "and",
  "are",
  "as",
  "at",
  "be",
  "by",
  "for",
  "from",
  "how",
  "in",
  "is",
  "it",
  "of",
  "on",
  "or",
  "that",
  "the",
  "their",
  "this",
  "to",
  "was",
  "with",
]);

export const WORKSPACE_MEMORY_CATEGORIES = [
  "operator_instruction",
  "qualification_win_pattern",
  "qualification_false_positive_pattern",
  "enrichment_signal_pattern",
  "enrichment_role_pattern",
  "outreach_winning_pattern",
  "outreach_objection_pattern",
  "writing_style_profile_twitter",
  "writing_style_profile_linkedin",
] as const;

export type WorkspaceMemoryCategory =
  (typeof WORKSPACE_MEMORY_CATEGORIES)[number];

export function normalizeWorkspaceMemoryCategories(
  categories: WorkspaceMemoryCategory[] | undefined
): WorkspaceMemoryCategory[] | undefined {
  return categories?.length ? categories : undefined;
}

export type WorkspaceMemorySource =
  | "qualification"
  | "enrichment"
  | "outreach"
  | "operator"
  | "style_analysis";

export type BuiltInAgentMemoryRow = {
  _id: string;
  _creationTime: number;
  memory: string;
  userId?: string;
  threadId?: string;
  embeddingId?: string;
};

export type ParsedAgentMemory = {
  version: 1;
  workspaceId: string;
  category: WorkspaceMemoryCategory;
  namespace: WorkspaceMemoryNamespaceKind;
  source: WorkspaceMemorySource;
  title: string;
  summary: string;
  confidence: number;
  impactScore: number;
  prospectId?: string;
  relatedQueries: string[];
  signals: string[];
  evidence: string[];
  narrative: string;
};

type SerializedAgentMemoryMeta = {
  version: 1;
  workspaceId: string;
  category: WorkspaceMemoryCategory;
  namespace: WorkspaceMemoryNamespaceKind;
  source: WorkspaceMemorySource;
  title: string;
  summary: string;
  confidence: number;
  impactScore: number;
  prospectId?: string;
};

export type BuiltInAgentMemoryMatch = {
  memoryId: string;
  createdAt: number;
  relevanceScore: number;
  parsed: ParsedAgentMemory;
};

export type WorkspaceAgentMemoryRecord = {
  memoryId: string;
  createdAt: number;
  memoryText: string;
  parsed: ParsedAgentMemory;
};

export type WorkspaceAgentMemoryInventoryRecord = {
  memoryId: string;
  createdAt: number;
  title: string;
  summary: string;
  source: WorkspaceMemorySource;
  category: WorkspaceMemoryCategory;
  confidence: number;
  impactScore: number;
  relatedQueriesCount: number;
  evidenceCount: number;
  prospectId?: string;
  quarantinedAt?: number;
  quarantineReason?: string;
  qualificationAuditRunId?: string;
};

export type PromoteAgentMemoryArgs = {
  userId: string;
  workspaceId: string;
  category: WorkspaceMemoryCategory;
  namespace: WorkspaceMemoryNamespaceKind;
  source: WorkspaceMemorySource;
  title: string;
  summary: string;
  confidence: number;
  impactScore?: number;
  prospectId?: string;
  threadId?: string;
  signals?: string[];
  evidence?: string[];
  relatedQueries?: string[];
  narrative?: string;
  /** Exact, unmodified operator message when this memory came from the user. */
  instruction?: string;
  /** Exact canonical value/content. Never reconstructed from the summary. */
  canonicalContent?: string;
  /** Stable open-ended subject key; a newer value supersedes older active values. */
  conflictKey?: string;
  /** Open-ended application metadata for arbitrary instructions. */
  metadata?: unknown;
  kind?: string;
  precedence?: number;
  surfaces?: string[];
  channels?: string[];
  provenanceKind?: WorkspaceMemoryProvenanceKind;
  provenanceMessageId?: string;
  attachmentUploadIds?: Id<"mediaUploads">[];
};

export type AgentMemoryPromotionResult = {
  created: boolean;
  memoryId: string;
  memoryText: string;
  parsed: ParsedAgentMemory;
  canonicalMemoryId: string;
  canonicalContentHash: string;
  canonicalRagKey: string;
  canonicalRagNamespace: WorkspaceMemoryNamespaceKind;
  canonicalRagText: string;
  canonicalShouldIndex: boolean;
};

export function buildAgentMemoryNarrative(args: {
  title: string;
  summary: string;
  signals?: string[];
  evidence?: string[];
}): string {
  const signalBlock =
    args.signals && args.signals.length > 0
      ? `Signals: ${args.signals.join("; ")}.`
      : "";
  const evidenceBlock =
    args.evidence && args.evidence.length > 0
      ? `Evidence: ${args.evidence.join("; ")}.`
      : "";

  return [args.title, args.summary, signalBlock, evidenceBlock]
    .filter((part) => part.length > 0)
    .join(" ");
}

export function categoryToNamespace(
  category: WorkspaceMemoryCategory
): WorkspaceMemoryNamespaceKind {
  switch (category) {
    case "operator_instruction":
      return "lessons";
    case "qualification_win_pattern":
    case "outreach_winning_pattern":
      return "wins";
    case "qualification_false_positive_pattern":
      return "losses";
    case "outreach_objection_pattern":
      return "objections";
    case "enrichment_signal_pattern":
      return "patterns";
    case "enrichment_role_pattern":
      return "lessons";
    case "writing_style_profile_twitter":
    case "writing_style_profile_linkedin":
      return "style";
    default:
      return "lessons";
  }
}

function clampScore(value: number | undefined, fallback: number): number {
  const normalized =
    typeof value === "number" && Number.isFinite(value) ? value : fallback;
  return Math.min(1, Math.max(0, normalized));
}

function buildMemoryMeta(args: PromoteAgentMemoryArgs): ParsedAgentMemory {
  return {
    version: 1,
    workspaceId: args.workspaceId,
    category: args.category,
    namespace: args.namespace,
    source: args.source,
    title: args.title.trim(),
    summary: args.summary.trim(),
    confidence: clampScore(args.confidence, 0.7),
    impactScore: clampScore(args.impactScore, 0.5),
    prospectId: args.prospectId,
    relatedQueries: sanitizeLines(args.relatedQueries),
    signals: sanitizeLines(args.signals),
    evidence: sanitizeLines(args.evidence),
    narrative:
      args.narrative?.trim() ||
      buildAgentMemoryNarrative({
        title: args.title,
        summary: args.summary,
        signals: args.signals,
        evidence: args.evidence,
      }),
  };
}

function sanitizeLines(values: string[] | undefined): string[] {
  if (!values || values.length === 0) {
    return [];
  }

  return values
    .map((value) => value.trim())
    .filter((value, index, array) => {
      if (value.length === 0) {
        return false;
      }
      return array.indexOf(value) === index;
    })
    .slice(0, 8);
}

function renderSection(
  title: (typeof SECTION_LABELS)[number],
  values: string[]
) {
  if (values.length === 0) {
    return `${title}\n- None recorded`;
  }

  return `${title}\n${values.map((value) => `- ${value}`).join("\n")}`;
}

export function serializeAgentMemory(parsed: ParsedAgentMemory): string {
  return [
    AGENT_MEMORY_MARKER,
    `${MEMORY_META_PREFIX}${JSON.stringify({
      version: parsed.version,
      workspaceId: parsed.workspaceId,
      category: parsed.category,
      namespace: parsed.namespace,
      source: parsed.source,
      title: parsed.title,
      summary: parsed.summary,
      confidence: parsed.confidence,
      impactScore: parsed.impactScore,
      prospectId: parsed.prospectId,
    } satisfies SerializedAgentMemoryMeta)}`,
    "",
    renderSection("Signals:", parsed.signals),
    "",
    renderSection("Evidence:", parsed.evidence),
    "",
    renderSection("RelatedQueries:", parsed.relatedQueries),
    "",
    "Narrative:",
    parsed.narrative,
  ].join("\n");
}

function parseSection(
  lines: string[],
  sectionLabel: (typeof SECTION_LABELS)[number]
): string[] {
  const startIndex = lines.findIndex((line) => line === sectionLabel);
  if (startIndex === -1) {
    return [];
  }

  const values: string[] = [];
  for (let index = startIndex + 1; index < lines.length; index += 1) {
    const line = lines[index];
    if (SECTION_LABELS.includes(line as (typeof SECTION_LABELS)[number])) {
      break;
    }
    if (line.startsWith("- ")) {
      values.push(line.slice(2).trim());
    }
  }
  return sanitizeLines(values);
}

function parseNarrative(lines: string[]): string {
  const startIndex = lines.findIndex((line) => line === "Narrative:");
  if (startIndex === -1) {
    return "";
  }

  return lines
    .slice(startIndex + 1)
    .filter(
      (line) =>
        !SECTION_LABELS.includes(line as (typeof SECTION_LABELS)[number])
    )
    .join("\n")
    .trim();
}

function isSerializedAgentMemoryMeta(
  value: unknown
): value is SerializedAgentMemoryMeta {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }

  const meta = value as Record<string, unknown>;
  return (
    meta.version === 1 &&
    typeof meta.workspaceId === "string" &&
    typeof meta.category === "string" &&
    typeof meta.namespace === "string" &&
    typeof meta.source === "string" &&
    typeof meta.title === "string" &&
    typeof meta.summary === "string" &&
    typeof meta.confidence === "number" &&
    typeof meta.impactScore === "number" &&
    (meta.prospectId === undefined || typeof meta.prospectId === "string") &&
    meta.createdAt === undefined &&
    meta.threadId === undefined
  );
}

export function parseAgentMemory(memoryText: string): ParsedAgentMemory | null {
  if (!memoryText.startsWith(AGENT_MEMORY_MARKER)) {
    return null;
  }

  const lines = memoryText.split("\n");
  const metaLine = lines.find((line) => line.startsWith(MEMORY_META_PREFIX));
  if (!metaLine) {
    return null;
  }

  try {
    const parsedMeta = JSON.parse(metaLine.slice(MEMORY_META_PREFIX.length));
    if (!isSerializedAgentMemoryMeta(parsedMeta)) {
      return null;
    }

    return {
      ...parsedMeta,
      confidence: clampScore(parsedMeta.confidence, 0.7),
      impactScore: clampScore(parsedMeta.impactScore, 0.5),
      signals: parseSection(lines, "Signals:"),
      evidence: parseSection(lines, "Evidence:"),
      relatedQueries: parseSection(lines, "RelatedQueries:"),
      narrative:
        parseNarrative(lines) ||
        buildAgentMemoryNarrative({
          title: parsedMeta.title,
          summary: parsedMeta.summary,
        }),
    };
  } catch {
    return null;
  }
}

function getComponentMemoryReader(db: MemoryDbReader) {
  return db as unknown as {
    query: (tableName: string) => any;
    normalizeId?: (tableName: string, id: string) => string | null;
  };
}

function getComponentMemoryWriter(db: MemoryDbWriter) {
  return db as unknown as {
    query: (tableName: string) => any;
    insert: (
      tableName: string,
      value: Record<string, unknown>
    ) => Promise<string>;
    delete: (id: string) => Promise<void>;
  };
}

async function getBuiltInAgentMemoryRowById(
  db: MemoryDbReader,
  memoryId: string
): Promise<BuiltInAgentMemoryRow | null> {
  const componentDb = getComponentMemoryReader(db);
  const normalizedId = componentDb.normalizeId?.("memories", memoryId) ?? null;
  if (!normalizedId) {
    return null;
  }

  return (await db.get(normalizedId as any)) as BuiltInAgentMemoryRow | null;
}

function dedupeWorkspaceAgentMemoryRecords(
  records: WorkspaceAgentMemoryRecord[]
): WorkspaceAgentMemoryRecord[] {
  const seen = new Set<string>();
  return records.filter((record) => {
    if (seen.has(record.memoryId)) {
      return false;
    }
    seen.add(record.memoryId);
    return true;
  });
}

async function listWorkspaceAgentMemoriesFromInventory(
  db: MemoryDbReader,
  args: {
    workspaceId: Id<"workspaces">;
    category?: WorkspaceMemoryCategory;
    source?: WorkspaceMemorySource;
    limit?: number;
  }
): Promise<WorkspaceAgentMemoryRecord[]> {
  const limit = Math.max(1, args.limit ?? 20);
  const matchedRows = args.category
    ? await db
        .query("workspaceAgentMemoryInventory")
        .withIndex(
          "by_workspace_category_quarantined_at_and_created_at",
          (q: any) =>
            q
              .eq("workspaceId", args.workspaceId)
              .eq("category", args.category!)
              .eq("quarantinedAt", undefined)
        )
        .order("desc")
        .take(limit)
    : args.source
      ? await db
          .query("workspaceAgentMemoryInventory")
          .withIndex(
            "by_workspace_source_quarantined_at_and_created_at",
            (q: any) =>
              q
                .eq("workspaceId", args.workspaceId)
                .eq("source", args.source!)
                .eq("quarantinedAt", undefined)
          )
          .order("desc")
          .take(limit)
      : await db
          .query("workspaceAgentMemoryInventory")
          .withIndex("by_workspace_quarantined_at_and_created_at", (q: any) =>
            q.eq("workspaceId", args.workspaceId).eq("quarantinedAt", undefined)
          )
          .order("desc")
          .take(limit);

  const records = await Promise.all(
    matchedRows.map(async (row) => {
      const memoryRow = await getBuiltInAgentMemoryRowById(db, row.memoryId);
      if (!memoryRow) {
        return null;
      }

      const parsed = parseAgentMemory(memoryRow.memory);
      if (!parsed || parsed.workspaceId !== String(args.workspaceId)) {
        return null;
      }

      return {
        memoryId: memoryRow._id,
        createdAt: memoryRow._creationTime,
        memoryText: memoryRow.memory,
        parsed,
      } satisfies WorkspaceAgentMemoryRecord;
    })
  );

  return dedupeWorkspaceAgentMemoryRecords(
    records
      .filter((value): value is WorkspaceAgentMemoryRecord => value !== null)
      .sort((left, right) => right.createdAt - left.createdAt)
  );
}

export async function listRecentAgentMemories(
  db: MemoryDbReader,
  args: {
    userId: string;
    limit?: number;
  }
): Promise<BuiltInAgentMemoryRow[]> {
  const componentDb = getComponentMemoryReader(db);
  const limit = Math.min(MAX_RELEVANCE_CANDIDATES, args.limit ?? 50);

  // The Agent component's `memories` table index names are component-defined.
  // Don't assume an index name matches the field name.
  try {
    return (await componentDb
      .query("memories")
      .withIndex(AGENT_MEMORY_USER_INDEX, (q: any) =>
        q.eq("userId", args.userId)
      )
      .order("desc")
      .take(limit)) as BuiltInAgentMemoryRow[];
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (
      !message.includes("Index memories.") ||
      !message.includes("not found")
    ) {
      throw error;
    }
    return (await componentDb
      .query("memories")
      .filter((q: any) => q.eq(q.field("userId"), args.userId))
      .order("desc")
      .take(limit)) as BuiltInAgentMemoryRow[];
  }
}

async function listAgentMemoriesByUser(
  db: MemoryDbReader,
  args: {
    userId: string;
    limit?: number;
  }
): Promise<BuiltInAgentMemoryRow[]> {
  if (typeof args.limit === "number") {
    return await listRecentAgentMemories(db, args);
  }

  const componentDb = getComponentMemoryReader(db);

  try {
    return (await componentDb
      .query("memories")
      .withIndex(AGENT_MEMORY_USER_INDEX, (q: any) =>
        q.eq("userId", args.userId)
      )
      .order("desc")
      .collect()) as BuiltInAgentMemoryRow[];
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (
      !message.includes("Index memories.") ||
      !message.includes("not found")
    ) {
      throw error;
    }
    return (await componentDb
      .query("memories")
      .filter((q: any) => q.eq(q.field("userId"), args.userId))
      .order("desc")
      .collect()) as BuiltInAgentMemoryRow[];
  }
}

async function paginateAgentMemoriesByUser(
  db: MemoryDbReader,
  args: {
    userId: string;
    cursor?: string | null;
    limit?: number;
  }
): Promise<{
  page: BuiltInAgentMemoryRow[];
  continueCursor: string;
  isDone: boolean;
}> {
  const componentDb = getComponentMemoryReader(db);
  const limit = Math.max(
    1,
    Math.min(MAX_RELEVANCE_CANDIDATES, args.limit ?? 50)
  );

  try {
    return (await componentDb
      .query("memories")
      .withIndex(AGENT_MEMORY_USER_INDEX, (q: any) =>
        q.eq("userId", args.userId)
      )
      .order("desc")
      .paginate({
        cursor: args.cursor ?? null,
        numItems: limit,
      })) as {
      page: BuiltInAgentMemoryRow[];
      continueCursor: string;
      isDone: boolean;
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (
      !message.includes("Index memories.") ||
      !message.includes("not found")
    ) {
      throw error;
    }
    return (await componentDb
      .query("memories")
      .filter((q: any) => q.eq(q.field("userId"), args.userId))
      .order("desc")
      .paginate({
        cursor: args.cursor ?? null,
        numItems: limit,
      })) as {
      page: BuiltInAgentMemoryRow[];
      continueCursor: string;
      isDone: boolean;
    };
  }
}

export async function listWorkspaceAgentMemories(
  db: MemoryDbReader,
  args: {
    userId: string;
    workspaceId: string;
    limit?: number;
  }
): Promise<WorkspaceAgentMemoryRecord[]> {
  const recentRows = await listAgentMemoriesByUser(db, {
    userId: args.userId,
    limit: typeof args.limit === "number" ? Math.max(1, args.limit) : undefined,
  });

  return recentRows
    .map((row) => {
      const parsed = parseAgentMemory(row.memory);
      if (!parsed || parsed.workspaceId !== args.workspaceId) {
        return null;
      }

      return {
        memoryId: row._id,
        createdAt: row._creationTime,
        memoryText: row.memory,
        parsed,
      } satisfies WorkspaceAgentMemoryRecord;
    })
    .filter((value): value is WorkspaceAgentMemoryRecord => value !== null)
    .sort((left, right) => right.createdAt - left.createdAt);
}

export async function listWorkspaceAgentMemoriesByCategory(
  db: MemoryDbReader,
  args: {
    workspaceId: Id<"workspaces">;
    category: WorkspaceMemoryCategory;
    limit?: number;
  }
): Promise<WorkspaceAgentMemoryRecord[]> {
  return await listWorkspaceAgentMemoriesFromInventory(db, {
    workspaceId: args.workspaceId,
    category: args.category,
    limit: args.limit,
  });
}

export async function listWorkspaceAgentMemoriesBySource(
  db: MemoryDbReader,
  args: {
    workspaceId: Id<"workspaces">;
    source: WorkspaceMemorySource;
    limit?: number;
  }
): Promise<WorkspaceAgentMemoryRecord[]> {
  return await listWorkspaceAgentMemoriesFromInventory(db, {
    workspaceId: args.workspaceId,
    source: args.source,
    limit: args.limit,
  });
}

export async function listWorkspaceAgentMemoriesInWindow(
  db: MemoryDbReader,
  args: {
    userId: string;
    workspaceId: string;
    startMs: number;
    endMs: number;
  }
): Promise<WorkspaceAgentMemoryRecord[]> {
  const componentDb = getComponentMemoryReader(db);
  const endMs = Math.max(args.startMs, args.endMs - 1);

  const recentRows = (await componentDb
    .query("memories")
    .withIndex(AGENT_MEMORY_USER_INDEX, (q: any) =>
      q
        .eq("userId", args.userId)
        .gte("_creationTime", args.startMs)
        .lte("_creationTime", endMs)
    )
    .order("desc")
    .collect()) as BuiltInAgentMemoryRow[];

  return recentRows
    .map((row) => {
      const parsed = parseAgentMemory(row.memory);
      if (!parsed || parsed.workspaceId !== args.workspaceId) {
        return null;
      }

      return {
        memoryId: row._id,
        createdAt: row._creationTime,
        memoryText: row.memory,
        parsed,
      } satisfies WorkspaceAgentMemoryRecord;
    })
    .filter((value): value is WorkspaceAgentMemoryRecord => value !== null)
    .sort((left, right) => right.createdAt - left.createdAt);
}

export function buildWorkspaceAgentMemoryInventoryRecord(args: {
  memoryId: string;
  createdAt: number;
  parsed: ParsedAgentMemory;
}): WorkspaceAgentMemoryInventoryRecord {
  return {
    memoryId: args.memoryId,
    createdAt: args.createdAt,
    title: args.parsed.title,
    summary: args.parsed.summary,
    source: args.parsed.source,
    category: args.parsed.category,
    confidence: args.parsed.confidence,
    impactScore: args.parsed.impactScore,
    relatedQueriesCount: args.parsed.relatedQueries.length,
    evidenceCount: args.parsed.evidence.length,
    prospectId: args.parsed.prospectId,
  };
}

export async function ensureWorkspaceAgentMemoryInventoryRecord(
  db: MemoryDbWriter,
  args: {
    workspaceId: Id<"workspaces">;
    record: WorkspaceAgentMemoryInventoryRecord;
  }
): Promise<boolean> {
  const existing = await db
    .query("workspaceAgentMemoryInventory")
    .withIndex("by_memory_id", (q) => q.eq("memoryId", args.record.memoryId))
    .first();

  if (existing) {
    return false;
  }

  await insertWorkspaceAgentMemoryInventoryRecord(db, args);
  return true;
}

async function insertWorkspaceAgentMemoryInventoryRecord(
  db: MemoryDbWriter,
  args: {
    workspaceId: Id<"workspaces">;
    record: WorkspaceAgentMemoryInventoryRecord;
  }
) {
  const prospectId = args.record.prospectId
    ? (db.normalizeId("prospects", args.record.prospectId) ?? undefined)
    : undefined;

  await db.insert("workspaceAgentMemoryInventory", {
    workspaceId: args.workspaceId,
    memoryId: args.record.memoryId,
    createdAt: args.record.createdAt,
    createdDayStartUtcMs: getUtcDayStartTimestamp(args.record.createdAt),
    title: args.record.title,
    summary: args.record.summary,
    source: args.record.source,
    category: args.record.category,
    confidence: args.record.confidence,
    impactScore: args.record.impactScore,
    relatedQueriesCount: args.record.relatedQueriesCount,
    evidenceCount: args.record.evidenceCount,
    prospectId,
  });
}

export async function ensureWorkspaceAgentMemoryInventoryRecords(
  db: MemoryDbWriter,
  args: {
    workspaceId: Id<"workspaces">;
    records: WorkspaceAgentMemoryInventoryRecord[];
  }
): Promise<{ inserted: number; existing: number }> {
  const existingRows = await Promise.all(
    args.records.map((record) =>
      db
        .query("workspaceAgentMemoryInventory")
        .withIndex("by_memory_id", (q) => q.eq("memoryId", record.memoryId))
        .first()
    )
  );
  let inserted = 0;
  let existing = 0;
  const seenMemoryIds = new Set<string>();

  for (const [index, record] of args.records.entries()) {
    if (existingRows[index] || seenMemoryIds.has(record.memoryId)) {
      existing += 1;
      continue;
    }
    seenMemoryIds.add(record.memoryId);
    await insertWorkspaceAgentMemoryInventoryRecord(db, {
      workspaceId: args.workspaceId,
      record,
    });
    inserted += 1;
  }

  return { inserted, existing };
}

export async function reconcileWorkspaceAgentMemoryInventoryPage(
  db: MemoryDbWriter,
  args: {
    workspaceId: Id<"workspaces">;
    cursor: string | null;
    limit: number;
  }
): Promise<{
  continueCursor: string;
  isDone: boolean;
  scanned: number;
  deleted: number;
  deletedMemoryIds: string[];
}> {
  const page = await db
    .query("workspaceAgentMemoryInventory")
    .withIndex("by_workspace_created_at", (q) =>
      q.eq("workspaceId", args.workspaceId)
    )
    .paginate({
      cursor: args.cursor,
      numItems: Math.max(1, args.limit),
    });
  const sourceRows = await Promise.all(
    page.page.map((row) => getBuiltInAgentMemoryRowById(db, row.memoryId))
  );
  const deletedMemoryIds: string[] = [];

  for (const [index, row] of page.page.entries()) {
    if (sourceRows[index]) {
      continue;
    }
    await db.delete(row._id);
    deletedMemoryIds.push(row.memoryId);
  }

  return {
    continueCursor: page.continueCursor,
    isDone: page.isDone,
    scanned: page.page.length,
    deleted: deletedMemoryIds.length,
    deletedMemoryIds,
  };
}

export async function listWorkspaceAgentMemoryInventoryInWindow(
  db: MemoryDbReader,
  args: {
    workspaceId: Id<"workspaces">;
    startMs: number;
    endMs: number;
    limit?: number;
  }
): Promise<WorkspaceAgentMemoryInventoryRecord[]> {
  const endMs = Math.max(args.startMs, args.endMs - 1);

  const query = db
    .query("workspaceAgentMemoryInventory")
    .withIndex("by_workspace_quarantined_at_and_created_at", (q: any) =>
      q
        .eq("workspaceId", args.workspaceId)
        .eq("quarantinedAt", undefined)
        .gte("createdAt", args.startMs)
        .lte("createdAt", endMs)
    )
    .order("desc");

  const rows =
    typeof args.limit === "number"
      ? await query.take(Math.max(1, args.limit))
      : await query.collect();

  return rows.map((row) => ({
    memoryId: row.memoryId,
    createdAt: row.createdAt,
    title: row.title,
    summary: row.summary,
    source: row.source,
    category: row.category,
    confidence: row.confidence,
    impactScore: row.impactScore,
    relatedQueriesCount: row.relatedQueriesCount,
    evidenceCount: row.evidenceCount,
    prospectId: row.prospectId ? String(row.prospectId) : undefined,
    quarantinedAt: row.quarantinedAt,
    quarantineReason: row.quarantineReason,
    qualificationAuditRunId: row.qualificationAuditRunId
      ? String(row.qualificationAuditRunId)
      : undefined,
  }));
}

export async function listWorkspaceAgentMemoriesPage(
  db: MemoryDbReader,
  args: {
    userId: string;
    workspaceId: string;
    cursor?: string | null;
    limit?: number;
  }
): Promise<{
  page: Array<
    Pick<
      WorkspaceAgentMemoryRecord,
      "memoryId" | "createdAt" | "memoryText" | "parsed"
    >
  >;
  continueCursor: string;
  isDone: boolean;
}> {
  const result = await paginateAgentMemoriesByUser(db, {
    userId: args.userId,
    cursor: args.cursor,
    limit: args.limit,
  });

  return {
    page: result.page
      .map((row) => {
        const parsed = parseAgentMemory(row.memory);
        if (!parsed || parsed.workspaceId !== args.workspaceId) {
          return null;
        }

        return {
          memoryId: row._id,
          createdAt: row._creationTime,
          memoryText: row.memory,
          parsed,
        } satisfies Pick<
          WorkspaceAgentMemoryRecord,
          "memoryId" | "createdAt" | "memoryText" | "parsed"
        >;
      })
      .filter(
        (
          value
        ): value is Pick<
          WorkspaceAgentMemoryRecord,
          "memoryId" | "createdAt" | "memoryText" | "parsed"
        > => value !== null
      ),
    continueCursor: result.continueCursor,
    isDone: result.isDone,
  };
}

export async function getWorkspaceAgentMemoryById(
  db: MemoryDbReader,
  args: {
    userId: string;
    workspaceId: string;
    memoryId: string;
  }
): Promise<WorkspaceAgentMemoryRecord | null> {
  const row = await getBuiltInAgentMemoryRowById(db, args.memoryId);

  if (row) {
    const parsed = parseAgentMemory(row.memory);
    if (
      parsed &&
      parsed.workspaceId === args.workspaceId &&
      row.userId === args.userId
    ) {
      return {
        memoryId: row._id,
        createdAt: row._creationTime,
        memoryText: row.memory,
        parsed,
      };
    }
  }

  const rows = await listWorkspaceAgentMemories(db, {
    userId: args.userId,
    workspaceId: args.workspaceId,
    limit: MAX_RELEVANCE_CANDIDATES,
  });

  return rows.find((row) => row.memoryId === args.memoryId) ?? null;
}

async function deleteWorkspaceAgentMemoryInventoryRecord(
  db: MemoryDbWriter,
  memoryId: string
) {
  const existing = await db
    .query("workspaceAgentMemoryInventory")
    .withIndex("by_memory_id", (q) => q.eq("memoryId", memoryId))
    .first();
  if (existing) {
    await db.delete(existing._id);
  }
}

/**
 * Deletes a bounded page of workspace-scoped Agent component memories together
 * with their app-owned inventory rows. Missing component rows are tolerated so
 * retries also repair stale inventory records.
 */
export async function deleteWorkspaceAgentMemoryBatch(
  db: MemoryDbWriter,
  args: {
    workspaceId: Id<"workspaces">;
    limit: number;
  }
): Promise<number> {
  const rows = await db
    .query("workspaceAgentMemoryInventory")
    .withIndex("by_workspace_created_at", (q) =>
      q.eq("workspaceId", args.workspaceId)
    )
    .take(Math.max(1, args.limit));
  const componentDb = getComponentMemoryWriter(db);

  for (const row of rows) {
    const memory = await getBuiltInAgentMemoryRowById(db, row.memoryId);
    if (memory) {
      await componentDb.delete(row.memoryId);
    }
    await db.delete(row._id);
  }

  return rows.length;
}

export async function deleteWorkspaceAgentMemoriesByCategory(
  db: MemoryDbWriter,
  args: {
    userId: string;
    workspaceId: string;
    category: WorkspaceMemoryCategory;
    source: WorkspaceMemorySource;
  }
): Promise<{ deleted: number }> {
  const componentDb = getComponentMemoryWriter(db);
  const rows = await listWorkspaceAgentMemoriesByCategory(db, {
    workspaceId: args.workspaceId as Id<"workspaces">,
    category: args.category,
    limit: 100,
  });

  let deleted = 0;
  for (const row of rows) {
    if (
      row.parsed.category !== args.category ||
      row.parsed.source !== args.source ||
      row.parsed.source === "operator"
    ) {
      continue;
    }
    await componentDb.delete(row.memoryId);
    await deleteWorkspaceAgentMemoryInventoryRecord(db, row.memoryId);
    deleted += 1;
  }

  return { deleted };
}

async function attachCanonicalWorkspaceMemory(
  db: MemoryDbWriter,
  args: PromoteAgentMemoryArgs,
  legacy: {
    created: boolean;
    memoryId: string;
    memoryText: string;
    parsed: ParsedAgentMemory;
  }
): Promise<AgentMemoryPromotionResult> {
  const canonicalContent =
    args.canonicalContent ??
    args.instruction ??
    legacy.parsed.narrative ??
    legacy.memoryText;
  const metadata = args.metadata ?? {
    signals: legacy.parsed.signals,
    evidence: legacy.parsed.evidence,
    relatedQueries: legacy.parsed.relatedQueries,
    narrative: legacy.parsed.narrative,
  };
  const canonical = await upsertCanonicalWorkspaceMemory(db, {
    userId: args.userId as Id<"users">,
    workspaceId: args.workspaceId as Id<"workspaces">,
    legacyMemoryId: legacy.memoryId,
    source: args.source,
    category: args.category,
    namespace: args.namespace,
    kind: args.kind,
    title: legacy.parsed.title,
    summary: legacy.parsed.summary,
    canonicalContent,
    conflictKey: args.conflictKey,
    instruction: args.instruction,
    metadata,
    precedence: args.precedence,
    confidence: legacy.parsed.confidence,
    impactScore: legacy.parsed.impactScore,
    prospectId: args.prospectId as Id<"prospects"> | undefined,
    surfaces: args.surfaces,
    channels: args.channels,
    provenanceKind: args.provenanceKind,
    provenanceThreadId: args.threadId,
    provenanceMessageId: args.provenanceMessageId,
    attachmentUploadIds: args.attachmentUploadIds,
  });
  const canonicalRagText = buildCanonicalWorkspaceMemoryRagText({
    title: canonical.memory.title,
    summary: canonical.memory.summary,
    canonicalContent: canonical.memory.canonicalContent,
    instruction: canonical.memory.instruction,
    kind: canonical.memory.kind,
    metadata: canonical.memory.metadata,
  });
  return {
    ...legacy,
    canonicalMemoryId: canonical.memory.memoryId,
    canonicalContentHash: canonical.memory.contentHash,
    canonicalRagKey: canonical.memory.ragKey,
    canonicalRagNamespace: canonical.memory.ragNamespace,
    canonicalRagText,
    canonicalShouldIndex: canonical.shouldIndex,
  };
}

export async function promoteAgentMemory(
  db: MemoryDbWriter,
  args: PromoteAgentMemoryArgs
): Promise<AgentMemoryPromotionResult> {
  const parsed = buildMemoryMeta(args);
  const memoryText = serializeAgentMemory(parsed);
  const canonicalContent =
    args.canonicalContent ?? args.instruction ?? parsed.narrative ?? memoryText;
  const canonicalIdentityKey = buildCanonicalWorkspaceMemoryIdentity({
    workspaceId: args.workspaceId,
    authority: getWorkspaceMemoryAuthority(args.source),
    canonicalContent,
    prospectId: args.prospectId,
    surfaces: args.surfaces,
    channels: args.channels,
  });
  const existingCanonical = await db
    .query("workspaceMemories")
    .withIndex("by_workspace_and_identity_key", (query: any) =>
      query
        .eq("workspaceId", args.workspaceId as Id<"workspaces">)
        .eq("identityKey", canonicalIdentityKey)
    )
    .unique();
  if (existingCanonical?.legacyMemoryId) {
    const existingRow = await getBuiltInAgentMemoryRowById(
      db,
      existingCanonical.legacyMemoryId
    );
    const existingParsed = existingRow
      ? parseAgentMemory(existingRow.memory)
      : null;
    if (existingRow && existingParsed) {
      return await attachCanonicalWorkspaceMemory(db, args, {
        created: false,
        memoryId: existingRow._id,
        memoryText: existingRow.memory,
        parsed: existingParsed,
      });
    }
  }

  const componentDb = getComponentMemoryWriter(db);
  const createdAt = getCurrentUTCTimestamp();
  const memoryId = await componentDb.insert("memories", {
    userId: args.userId,
    threadId: args.threadId,
    memory: memoryText,
  });

  await ensureWorkspaceAgentMemoryInventoryRecord(db, {
    workspaceId: args.workspaceId as Id<"workspaces">,
    record: buildWorkspaceAgentMemoryInventoryRecord({
      memoryId,
      createdAt,
      parsed,
    }),
  });

  const contributions = getWorkspaceAgentOpsContributionsFromBuiltInMemory({
    workspaceId: args.workspaceId as Id<"workspaces">,
    memory: {
      createdAt,
      parsed,
    },
  });
  const stripe = getReadModelStripe(String(memoryId));

  for (const targeted of contributions) {
    const existingDaily = await db
      .query("workspaceAgentOpsDailyStripes")
      .withIndex("by_workspace_day_and_stripe", (q: any) =>
        q
          .eq("workspaceId", targeted.workspaceId)
          .eq("dayStartUtcMs", targeted.dayStartUtcMs)
          .eq("stripe", stripe)
      )
      .unique();
    const nextDaily = mergeWorkspaceAgentOpsStripeContributions(existingDaily, {
      workspaceId: targeted.workspaceId,
      dayStartUtcMs: targeted.dayStartUtcMs,
      add: [targeted.contribution],
    });
    if (isWorkspaceAgentOpsStripeEmpty(nextDaily)) {
      if (existingDaily) {
        await db.delete(existingDaily._id);
      }
    } else if (existingDaily) {
      await db.patch(existingDaily._id, nextDaily);
    } else {
      await db.insert("workspaceAgentOpsDailyStripes", {
        ...nextDaily,
        stripe,
      });
    }
  }

  return await attachCanonicalWorkspaceMemory(db, args, {
    created: true,
    memoryId,
    memoryText,
    parsed,
  });
}

function tokenizeForRelevance(value: string): string[] {
  return normalizeMemoryText(value)
    .split(/[^a-z0-9]+/)
    .map((token) => token.trim())
    .filter((token) => token.length >= 3 && !STOP_WORDS.has(token));
}

function buildMemorySearchText(memory: ParsedAgentMemory): string {
  return [
    memory.title,
    memory.summary,
    memory.narrative,
    ...memory.signals,
    ...memory.evidence,
    ...memory.relatedQueries,
  ].join(" ");
}

function scoreMemoryRelevance(
  memory: ParsedAgentMemory,
  query: string,
  createdAt: number
): number {
  const queryTokens = tokenizeForRelevance(query);
  if (queryTokens.length === 0) {
    return memory.confidence + memory.impactScore;
  }

  const memoryTokens = new Set(
    tokenizeForRelevance(buildMemorySearchText(memory))
  );
  let overlap = 0;
  for (const token of queryTokens) {
    if (memoryTokens.has(token)) {
      overlap += 1;
    }
  }

  const overlapScore = overlap / queryTokens.length;
  const recencyBoost = createdAt / 1_000_000_000_000;
  return (
    overlapScore * 10 +
    memory.confidence * 2 +
    memory.impactScore +
    recencyBoost
  );
}

export async function findRelevantAgentMemories(
  db: MemoryDbReader,
  args: {
    userId: string;
    workspaceId: string;
    query: string;
    categories?: WorkspaceMemoryCategory[];
    limit?: number;
  }
): Promise<BuiltInAgentMemoryMatch[]> {
  const normalizedCategories = normalizeWorkspaceMemoryCategories(
    args.categories
  );
  const allowedCategories = normalizedCategories
    ? new Set<WorkspaceMemoryCategory>(normalizedCategories)
    : null;
  const operatorRecords = await listWorkspaceAgentMemoriesBySource(db, {
    workspaceId: args.workspaceId as Id<"workspaces">,
    source: "operator",
    limit: Math.max(MAX_RELEVANCE_CANDIDATES, (args.limit ?? 5) * 20),
  });
  const generalRecords = allowedCategories
    ? (
        await Promise.all(
          [...allowedCategories].map((category) =>
            listWorkspaceAgentMemoriesByCategory(db, {
              workspaceId: args.workspaceId as Id<"workspaces">,
              category,
              limit: Math.max(MAX_RELEVANCE_CANDIDATES, (args.limit ?? 5) * 20),
            })
          )
        )
      ).flat()
    : await listWorkspaceAgentMemoriesFromInventory(db, {
        workspaceId: args.workspaceId as Id<"workspaces">,
        limit: MAX_RELEVANCE_CANDIDATES,
      });
  const seen = new Set<string>();
  const candidateRows = [...operatorRecords, ...generalRecords]
    .filter((record) => {
      if (seen.has(record.memoryId)) {
        return false;
      }
      seen.add(record.memoryId);
      return true;
    })
    .map((record) => ({
      _id: record.memoryId,
      _creationTime: record.createdAt,
      memory: record.memoryText,
      userId: args.userId,
    }));

  return candidateRows
    .map((row) => {
      const parsed = parseAgentMemory(row.memory);
      if (!parsed) {
        return null;
      }
      if (parsed.workspaceId !== args.workspaceId) {
        return null;
      }
      if (allowedCategories && !allowedCategories.has(parsed.category)) {
        return null;
      }

      return {
        memoryId: row._id,
        createdAt: row._creationTime,
        relevanceScore:
          scoreMemoryRelevance(parsed, args.query, row._creationTime) +
          (parsed.source === "operator" ? 100 : 0),
        parsed,
      } satisfies BuiltInAgentMemoryMatch;
    })
    .filter((value): value is BuiltInAgentMemoryMatch => value !== null)
    .sort((left, right) => right.relevanceScore - left.relevanceScore)
    .slice(0, Math.max(1, args.limit ?? 5));
}
