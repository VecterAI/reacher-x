import type { Exchange } from "../../core/calls/http";
import { domainKey, linkedinKey } from "../../core/judging/identity";
import {
  entitySchema,
  type BenchmarkEntity,
  type Candidate,
  type Evidence,
} from "../../core/types";

/** Trimmed non-empty text, or null. */
export function text(value: unknown): string | null {
  if (typeof value !== "string" && typeof value !== "number") return null;
  const trimmed = String(value).replace(/\s+/g, " ").trim();
  return trimmed ? trimmed : null;
}

export function httpUrl(value: unknown): string | null {
  const candidate = text(value);
  if (!candidate) return null;
  try {
    const url = new URL(
      /^https?:\/\//i.test(candidate) ? candidate : `https://${candidate}`
    );
    return url.protocol === "https:" || url.protocol === "http:"
      ? url.toString()
      : null;
  } catch {
    return null;
  }
}

/** The first LinkedIn profile or company page among several URLs. */
export function linkedinUrl(values: readonly unknown[]): string | null {
  for (const value of values) {
    const url = httpUrl(value);
    if (url && linkedinKey(url)) return url;
  }
  return null;
}

export function isoDate(value: unknown): string | null {
  const raw = text(value);
  if (!raw) return null;
  const time = Date.parse(raw);
  return Number.isFinite(time) ? new Date(time).toISOString() : null;
}

export function joinText(parts: readonly unknown[], separator = ", ") {
  return text(
    parts
      .map(text)
      .filter((part): part is string => part !== null)
      .join(separator)
  );
}

/** Non-negative whole number, or null. */
export function count(value: unknown): number | null {
  // A blank string is unknown, not zero.
  const number =
    typeof value === "string"
      ? value.trim() === ""
        ? null
        : Number(value)
      : value;
  return typeof number === "number" && Number.isInteger(number) && number >= 0
    ? number
    : null;
}

export function evidenceItem(
  id: string,
  url: unknown,
  body: unknown,
  publishedAt: unknown,
  retrievedAt: string
): Evidence | null {
  const link = httpUrl(url);
  const content = typeof body === "string" ? body.trim() : "";
  if (!link || !content) return null;
  return {
    id,
    url: link,
    text: Array.from(content).slice(0, 2_000).join(""),
    publishedAt: isoDate(publishedAt),
    retrievedAt,
  };
}

export type PersonFields = Readonly<{
  name: unknown;
  profileUrl?: unknown;
  title?: unknown;
  employer?: unknown;
  location?: unknown;
  description?: unknown;
  evidence?: readonly (Evidence | null)[];
}>;

export type CompanyFields = Readonly<{
  name: unknown;
  profileUrl?: unknown;
  domain?: unknown;
  location?: unknown;
  description?: unknown;
  industry?: unknown;
  employeeCount?: unknown;
  evidence?: readonly (Evidence | null)[];
}>;

const keepEvidence = (items: readonly (Evidence | null)[] | undefined) =>
  (items ?? []).filter((item): item is Evidence => item !== null);

export function personEntity(fields: PersonFields): BenchmarkEntity | null {
  const name = text(fields.name);
  if (!name) return null;
  return entitySchema.parse({
    prospectType: "individual",
    name,
    profileUrl: httpUrl(fields.profileUrl),
    title: text(fields.title),
    employer: text(fields.employer),
    location: text(fields.location),
    description: text(fields.description),
    evidence: keepEvidence(fields.evidence),
  });
}

export function companyEntity(fields: CompanyFields): BenchmarkEntity | null {
  const name = text(fields.name);
  if (!name) return null;
  const domainSource = text(fields.domain);
  return entitySchema.parse({
    prospectType: "organization",
    name,
    profileUrl: httpUrl(fields.profileUrl),
    domain: domainSource ? domainKey(domainSource) : null,
    location: text(fields.location),
    description: text(fields.description),
    industry: text(fields.industry),
    employeeCount: count(fields.employeeCount),
    evidence: keepEvidence(fields.evidence),
  });
}

/** Ranks parsed entities in provider order, keeping the provider's own ID private. */
export function rankCandidates(
  items: readonly { sourceId: string; entity: BenchmarkEntity | null }[],
  discoveredAt: string,
  topK: number
): Candidate[] {
  return items
    .filter(
      (item): item is { sourceId: string; entity: BenchmarkEntity } =>
        item.entity !== null
    )
    .slice(0, topK)
    .map((item, index) => ({
      sourceId: item.sourceId,
      rank: index + 1,
      discoveredAt,
      entity: item.entity,
    }));
}

export class ProviderError extends Error {}

/**
 * Credits a provider reported for a call. When it reports none, the request is
 * recorded in a unit with no rate, so it stays unpriced instead of costing $0.
 */
export function creditUsage(provider: string, credits: number | undefined) {
  return credits === undefined
    ? {
        provider,
        unit: "request-without-credit-report",
        quantity: 1,
        reportedUsd: null,
      }
    : { provider, unit: "credit", quantity: credits, reportedUsd: null };
}

/** A required key from the private env file; its value is never logged. */
export function secret(
  secrets: Readonly<Record<string, string>>,
  name: string
): string {
  const value = secrets[name];
  if (!value) throw new ProviderError(`${name} is not set.`);
  return value;
}

/** Stops the unit on a non-2xx response; the exchange is still saved for review. */
export function requireOk(exchange: Exchange) {
  if (exchange.response.status < 200 || exchange.response.status >= 300)
    throw new ProviderError(
      `${exchange.step} returned HTTP ${exchange.response.status}.`
    );
  return exchange.response.body;
}
