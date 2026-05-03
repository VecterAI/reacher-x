import type { UIMessage } from "@convex-dev/agent/react";
import {
  isReasoningPart,
  isSourcePart,
  type SourcePartLike,
} from "./toolParts";

type MessageReasoningDetail = {
  type: "reasoning" | "text" | "redacted";
  text?: string;
  data?: string;
  signature?: string;
  providerMetadata?: Record<string, Record<string, unknown>>;
};

type MessageSource = {
  id: string;
  sourceType: "url" | "document";
  url?: string;
  title?: string;
  filename?: string;
  mediaType?: string;
  type?: "source";
  providerMetadata?: Record<string, Record<string, unknown>>;
};

type MessageWithMetadata = UIMessage & {
  model?: unknown;
  providerMetadata?: Record<string, Record<string, unknown>>;
  reasoning?: unknown;
  reasoningDetails?: MessageReasoningDetail[];
  sources?: MessageSource[];
};

export interface NormalizedAssistantSource {
  id: string;
  href: string;
  title: string;
  label: string;
  description: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function getStringProperty(obj: unknown, key: string): string | null {
  if (!isRecord(obj)) return null;
  const value = obj[key];
  return typeof value === "string" && value.trim().length > 0 ? value : null;
}

function normalizeWhitespace(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function truncate(value: string, maxLength: number): string {
  if (value.length <= maxLength) return value;
  return `${value.slice(0, Math.max(0, maxLength - 3)).trimEnd()}...`;
}

function pushUnique(values: string[], value: string) {
  const normalized = normalizeWhitespace(value);
  if (!normalized) return;
  if (
    !values.some((existing) => normalizeWhitespace(existing) === normalized)
  ) {
    values.push(normalized);
  }
}

function getOpenRouterMetadata(
  message: MessageWithMetadata
): Record<string, unknown> | null {
  const providerMetadata = message.providerMetadata;

  if (!isRecord(providerMetadata)) return null;
  const openrouter = providerMetadata.openrouter;
  return isRecord(openrouter) ? openrouter : null;
}

function collectReasoningTexts(message: MessageWithMetadata): string[] {
  const reasoningTexts: string[] = [];

  for (const part of message.parts ?? []) {
    if (isReasoningPart(part) && typeof part.text === "string") {
      pushUnique(reasoningTexts, part.text);
    }
  }

  if (typeof message.reasoning === "string") {
    pushUnique(reasoningTexts, message.reasoning);
  }

  for (const detail of message.reasoningDetails ?? []) {
    if (
      (detail.type === "reasoning" || detail.type === "text") &&
      typeof detail.text === "string"
    ) {
      pushUnique(reasoningTexts, detail.text);
    }
  }

  return reasoningTexts;
}

function getReasoningStepCandidates(text: string): string[] {
  const lineCandidates = text
    .split(/\n+/)
    .map((line) =>
      normalizeWhitespace(line.replace(/^(\d+[).\s-]+|[-*•]\s+)/, ""))
    )
    .filter((line) => line.length >= 12);

  if (lineCandidates.length > 1) {
    return lineCandidates;
  }

  return text
    .split(/(?<=[.!?])\s+/)
    .map((sentence) => normalizeWhitespace(sentence))
    .filter((sentence) => sentence.length >= 24);
}

function buildSourceLabel(href: string, title: string | null): string {
  if (title) {
    return truncate(title, 36);
  }

  try {
    return new URL(href).hostname.replace(/^www\./, "");
  } catch {
    return truncate(href, 36);
  }
}

function buildSourceDescription(href: string): string {
  try {
    return new URL(href).hostname.replace(/^www\./, "");
  } catch {
    return href;
  }
}

function normalizeUrlSource(input: {
  id?: string | null;
  href?: string | null;
  title?: string | null;
}): NormalizedAssistantSource | null {
  if (!input.href) return null;

  const title = input.title?.trim() || buildSourceDescription(input.href);
  const id = input.id?.trim() || input.href;

  return {
    id,
    href: input.href,
    title,
    label: buildSourceLabel(input.href, input.title ?? null),
    description: buildSourceDescription(input.href),
  };
}

function collectTopLevelSources(
  message: MessageWithMetadata
): NormalizedAssistantSource[] {
  const sources: NormalizedAssistantSource[] = [];

  for (const source of message.sources ?? []) {
    if (source.sourceType !== "url") continue;
    const normalized = normalizeUrlSource({
      id: source.id,
      href: source.url,
      title: source.title ?? null,
    });
    if (normalized) {
      sources.push(normalized);
    }
  }

  return sources;
}

function collectPartSources(
  message: MessageWithMetadata
): NormalizedAssistantSource[] {
  const sources: NormalizedAssistantSource[] = [];

  for (const rawPart of message.parts ?? []) {
    if (!isSourcePart(rawPart)) continue;
    const part: SourcePartLike = rawPart;
    const sourceType =
      part.sourceType ?? (part.type === "source-document" ? "document" : "url");
    if (sourceType !== "url") continue;
    const normalized = normalizeUrlSource({
      id: part.id ?? null,
      href: part.url ?? null,
      title: part.title ?? null,
    });
    if (normalized) {
      sources.push(normalized);
    }
  }

  return sources;
}

function collectOpenRouterAnnotationSources(
  message: MessageWithMetadata
): NormalizedAssistantSource[] {
  const sources: NormalizedAssistantSource[] = [];
  const openrouter = getOpenRouterMetadata(message);
  const annotations = openrouter?.annotations;
  if (!Array.isArray(annotations)) {
    return sources;
  }

  for (const annotation of annotations) {
    const href = getStringProperty(annotation, "url");
    if (!href) continue;

    const normalized = normalizeUrlSource({
      id: getStringProperty(annotation, "id"),
      href,
      title: getStringProperty(annotation, "title"),
    });
    if (normalized) {
      sources.push(normalized);
    }
  }

  return sources;
}

export function getAssistantMessageModel(message: UIMessage): string | null {
  const typedMessage = message as MessageWithMetadata;

  if (typeof typedMessage.model === "string" && typedMessage.model.trim()) {
    return typedMessage.model;
  }

  const openRouterModel = typedMessage.providerMetadata?.openrouter?.model;
  if (typeof openRouterModel === "string" && openRouterModel.trim()) {
    return openRouterModel;
  }

  return null;
}

export function extractAssistantReasoning(message: UIMessage): string | null {
  const reasoningTexts = collectReasoningTexts(message as MessageWithMetadata);
  if (reasoningTexts.length === 0) {
    return null;
  }

  return reasoningTexts.join("\n\n");
}

export function hasRedactedReasoning(message: UIMessage): boolean {
  const typedMessage = message as MessageWithMetadata;
  return (typedMessage.reasoningDetails ?? []).some(
    (detail: MessageReasoningDetail) => detail.type === "redacted"
  );
}

export function extractAssistantReasoningSummary(
  message: UIMessage
): string | null {
  const reasoning = extractAssistantReasoning(message);
  if (!reasoning) return null;

  const firstBlock = reasoning.split(/\n{2,}/)[0] ?? reasoning;
  return truncate(normalizeWhitespace(firstBlock), 240);
}

export function extractAssistantReasoningSteps(message: UIMessage): string[] {
  const steps: string[] = [];
  const reasoningTexts = collectReasoningTexts(message as MessageWithMetadata);

  for (const reasoningText of reasoningTexts) {
    for (const candidate of getReasoningStepCandidates(reasoningText)) {
      pushUnique(steps, candidate);
      if (steps.length >= 5) {
        return steps;
      }
    }
  }

  return steps;
}

export function extractAssistantSources(
  message: UIMessage
): NormalizedAssistantSource[] {
  const typedMessage = message as MessageWithMetadata;
  const sources: NormalizedAssistantSource[] = [];
  const seen = new Set<string>();

  const addSource = (source: NormalizedAssistantSource | null) => {
    if (!source) return;
    const dedupeKey = `${source.href}:${source.title}`;
    if (seen.has(dedupeKey)) return;
    seen.add(dedupeKey);
    sources.push(source);
  };

  for (const source of collectPartSources(typedMessage)) {
    addSource(source);
  }

  for (const source of collectTopLevelSources(typedMessage)) {
    addSource(source);
  }

  for (const source of collectOpenRouterAnnotationSources(typedMessage)) {
    addSource(source);
  }

  return sources;
}
