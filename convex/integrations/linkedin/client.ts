"use node";

import type { LinkdAPI as LinkdAPIType } from "linkdapi";

const { LinkdAPI } = require("linkdapi") as {
  LinkdAPI: typeof LinkdAPIType;
};

let cachedClient: LinkdAPIType | null = null;

function getApiKey() {
  const apiKey = process.env.LINKDAPI_API_KEY?.trim();
  if (!apiKey) {
    throw new Error("LINKDAPI_API_KEY environment variable not set");
  }
  return apiKey;
}

export function getLinkedInReadClient() {
  if (!cachedClient) {
    cachedClient = new LinkdAPI({ apiKey: getApiKey() });
  }
  return cachedClient;
}

export async function getLinkedInProfileUrn(username: string) {
  const response = await getLinkedInReadClient().getProfileUrn(username);
  const data =
    response && typeof response === "object"
      ? (response as Record<string, unknown>).data
      : undefined;
  if (typeof data === "string" && data.trim()) {
    return data.trim();
  }
  if (data && typeof data === "object") {
    const record = data as Record<string, unknown>;
    if (typeof record.urn === "string" && record.urn.trim()) {
      return record.urn.trim();
    }
  }
  if (
    response &&
    typeof response === "object" &&
    typeof (response as Record<string, unknown>).urn === "string"
  ) {
    return ((response as Record<string, unknown>).urn as string).trim();
  }
  return undefined;
}

export async function getLinkedInAllPosts(urn: string) {
  return await getLinkedInReadClient().getAllPosts(urn);
}

export async function getLinkedInPostComments(
  urn: string,
  start?: number,
  count?: number
) {
  return await getLinkedInReadClient().getPostComments(urn, start, count);
}
