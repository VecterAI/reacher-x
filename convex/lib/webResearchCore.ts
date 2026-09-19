const REACHERX_HOSTNAMES = new Set(["reacherx.com", "www.reacherx.com"]);
const REACHERX_BLOG_PATH =
  /^\/blog\/([a-z0-9]+(?:-[a-z0-9]+)*)(?:\/markdown)?\/?$/i;

export function isHttpUrl(value: string): boolean {
  try {
    const parsed = new URL(value);
    return parsed.protocol === "https:" || parsed.protocol === "http:";
  } catch {
    return false;
  }
}

export function isReacherXUrl(value: string): boolean {
  try {
    const parsed = new URL(value);
    return (
      isHttpUrl(value) && REACHERX_HOSTNAMES.has(parsed.hostname.toLowerCase())
    );
  } catch {
    return false;
  }
}

export function getReacherXBlogSlug(value: string): string | null {
  if (!isReacherXUrl(value)) {
    return null;
  }

  const match = new URL(value).pathname.match(REACHERX_BLOG_PATH);
  return match?.[1]?.toLowerCase() ?? null;
}
