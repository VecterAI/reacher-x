import type { LanguageModelMiddleware, ProviderMetadata } from "ai";

type Source = {
  type: "source";
  sourceType: "url";
  id: string;
  url: string;
  title?: string;
  providerMetadata?: ProviderMetadata;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function getStringProperty(obj: unknown, key: string): string | undefined {
  if (!isRecord(obj)) return undefined;
  const value = obj[key];
  return typeof value === "string" && value.trim().length > 0
    ? value
    : undefined;
}

function sanitizeJsonValue(value: unknown): unknown {
  if (value === null) return null;

  switch (typeof value) {
    case "string":
    case "number":
    case "boolean":
      return value;
    case "bigint":
      return value.toString();
    case "undefined":
    case "function":
    case "symbol":
      return undefined;
    case "object":
      if (value instanceof Date) {
        return value.toISOString();
      }

      if (Array.isArray(value)) {
        return value
          .map((item) => sanitizeJsonValue(item))
          .filter((item) => item !== undefined);
      }

      if (!isRecord(value)) {
        return undefined;
      }

      return Object.fromEntries(
        Object.entries(value)
          .filter(([key]) => !key.startsWith("$") && !key.startsWith("."))
          .map(
            ([key, entryValue]) => [key, sanitizeJsonValue(entryValue)] as const
          )
          .filter(([, entryValue]) => entryValue !== undefined)
      );
    default:
      return undefined;
  }
}

function providerMetadataFromUnknown(
  value: unknown
): ProviderMetadata | undefined {
  const sanitized = sanitizeJsonValue(value);
  if (!isRecord(sanitized)) {
    return undefined;
  }

  const providerMetadata = Object.fromEntries(
    Object.entries(sanitized).filter(([, entryValue]) => isRecord(entryValue))
  );

  return Object.keys(providerMetadata).length > 0
    ? (providerMetadata as ProviderMetadata)
    : undefined;
}

function sourceKey(source: Source): string {
  return source.sourceType === "url"
    ? `${source.sourceType}:${source.url}:${source.title ?? ""}`
    : `${source.sourceType}:${source.id}:${source.title}`;
}

function isSourceLike(value: unknown): value is Source {
  return isRecord(value) && value.type === "source";
}

function getOpenRouterMetadata(
  providerMetadata: ProviderMetadata | undefined
): Record<string, unknown> | undefined {
  if (!providerMetadata) {
    return undefined;
  }

  const openrouter = providerMetadata.openrouter;
  return isRecord(openrouter) ? openrouter : undefined;
}

export function normalizeOpenRouterProviderMetadata(
  providerMetadata: ProviderMetadata | undefined
): ProviderMetadata | undefined {
  const normalized = providerMetadataFromUnknown(providerMetadata);
  if (!normalized?.openrouter || !isRecord(normalized.openrouter)) {
    return normalized;
  }

  const { annotations: _annotations, ...restOpenRouter } =
    normalized.openrouter;
  return {
    ...normalized,
    openrouter: restOpenRouter,
  };
}

export function extractOpenRouterSources(
  providerMetadata: ProviderMetadata | undefined
): Source[] {
  const openrouter = getOpenRouterMetadata(providerMetadata);
  const annotations = openrouter?.annotations;
  if (!Array.isArray(annotations)) {
    return [];
  }

  return annotations.flatMap((annotation, index) => {
    const url = getStringProperty(annotation, "url");
    if (!url) {
      return [];
    }

    return [
      {
        type: "source" as const,
        sourceType: "url" as const,
        id:
          getStringProperty(annotation, "id") ??
          `openrouter-source-${index + 1}`,
        url,
        title:
          getStringProperty(annotation, "title") ??
          getStringProperty(annotation, "source_title"),
      },
    ];
  });
}

function mergeSources(
  existingSources: Source[],
  additionalSources: Source[]
): Source[] {
  const merged = [...existingSources];
  const seen = new Set(existingSources.map(sourceKey));

  for (const source of additionalSources) {
    const key = sourceKey(source);
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    merged.push(source);
  }

  return merged;
}

function normalizeContentArray<T extends unknown[]>(
  content: T,
  additionalSources: Source[]
): T {
  const normalizedContent = content.map((part) => {
    if (!isRecord(part) || !("providerMetadata" in part)) {
      return part;
    }

    return {
      ...part,
      providerMetadata: normalizeOpenRouterProviderMetadata(
        part.providerMetadata as ProviderMetadata | undefined
      ),
    };
  });

  const mergedContent = mergeSources(
    normalizedContent.filter(isSourceLike),
    additionalSources
  );

  if (mergedContent.length === normalizedContent.filter(isSourceLike).length) {
    return normalizedContent as T;
  }

  const nonSourceContent = normalizedContent.filter(
    (part) => !isSourceLike(part)
  );
  return [...nonSourceContent, ...mergedContent] as T;
}

export function sanitizeTelemetryPayload(value: unknown): unknown {
  return sanitizeJsonValue(value) ?? null;
}

export function sanitizeProviderMetadataForConvex(
  providerMetadata: unknown
): unknown {
  return sanitizeTelemetryPayload(
    normalizeOpenRouterProviderMetadata(
      providerMetadata as ProviderMetadata | undefined
    )
  );
}

export const openRouterMetadataMiddleware: LanguageModelMiddleware = {
  middlewareVersion: "v2",
  async wrapGenerate({ doGenerate }) {
    const result = await doGenerate();
    const additionalSources = extractOpenRouterSources(result.providerMetadata);

    return {
      ...result,
      content: normalizeContentArray(result.content, additionalSources),
      providerMetadata: normalizeOpenRouterProviderMetadata(
        result.providerMetadata
      ),
    };
  },
  async wrapStream({ doStream }) {
    const result = await doStream();
    const seenSources = new Set<string>();

    return {
      ...result,
      stream: result.stream.pipeThrough(
        new TransformStream({
          transform(part, controller) {
            const providerMetadata =
              isRecord(part) && "providerMetadata" in part
                ? (part.providerMetadata as ProviderMetadata | undefined)
                : undefined;

            for (const source of extractOpenRouterSources(providerMetadata)) {
              const key = sourceKey(source);
              if (seenSources.has(key)) {
                continue;
              }
              seenSources.add(key);
              controller.enqueue(source);
            }

            if (!isRecord(part)) {
              controller.enqueue(part);
              return;
            }

            // Sanitize nested object values to strip $-prefixed keys
            // (e.g. $schema from OpenRouter) that Convex rejects. The
            // agent library persists stream deltas directly to the DB.
            const sanitized = Object.fromEntries(
              Object.entries(part).map(([key, val]) => [
                key,
                key === "providerMetadata"
                  ? normalizeOpenRouterProviderMetadata(providerMetadata)
                  : typeof val === "object" && val !== null
                    ? sanitizeJsonValue(val)
                    : val,
              ])
            );

            controller.enqueue(sanitized as unknown as typeof part);
          },
        })
      ),
    };
  },
};
