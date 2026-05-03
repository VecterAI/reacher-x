const LINKEDIN_IMAGE_EXTENSIONS =
  /\.(avif|bmp|gif|heic|heif|jpe?g|png|svg|webp)$/i;

function parseUrl(url: string): URL | null {
  try {
    return new URL(url);
  } catch {
    return null;
  }
}

export function isLinkedInCdnImageUrl(url: string): boolean {
  const parsed = parseUrl(url);
  if (!parsed || parsed.protocol !== "https:") {
    return false;
  }

  const hostname = parsed.hostname.toLowerCase();
  if (hostname !== "licdn.com" && !hostname.endsWith(".licdn.com")) {
    return false;
  }

  const pathname = parsed.pathname.toLowerCase();
  return (
    LINKEDIN_IMAGE_EXTENSIONS.test(pathname) ||
    pathname.includes("/dms/image/") ||
    pathname.includes("/profile-displayphoto") ||
    pathname.includes("/profile-displaybackgroundimage") ||
    pathname.includes("/company-logo_")
  );
}

export function normalizeLinkedInMediaType(
  rawType: string | undefined,
  url: string | undefined
): "image" | "video" | "link" | null {
  if (!url) {
    return null;
  }

  const type = rawType?.trim().toLowerCase();
  if (type === "video") {
    return "video";
  }

  if (
    type === "link" ||
    type === "article" ||
    type === "document" ||
    type === "documents" ||
    type === "carousel"
  ) {
    return "link";
  }

  if (type === "image" || type === "photo") {
    return isLinkedInCdnImageUrl(url) ? "image" : "link";
  }

  return isLinkedInCdnImageUrl(url) ? "image" : "link";
}
