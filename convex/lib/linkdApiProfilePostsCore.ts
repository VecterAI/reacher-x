export type LinkdApiProfilePostsQuery = {
  urn: string;
  start: 0;
  cursor?: string;
};

export function buildLinkdApiProfilePostsQuery(
  urn: string,
  cursor?: string
): LinkdApiProfilePostsQuery {
  const normalizedCursor = cursor?.trim();

  return {
    urn,
    start: 0,
    ...(normalizedCursor ? { cursor: normalizedCursor } : {}),
  };
}

export function limitLinkdApiProfilePosts<T>(
  posts: T[],
  maxPosts?: number
): T[] {
  if (maxPosts === undefined) {
    return posts;
  }

  const limit = Number.isFinite(maxPosts)
    ? Math.max(0, Math.floor(maxPosts))
    : 0;
  return posts.slice(0, limit);
}
