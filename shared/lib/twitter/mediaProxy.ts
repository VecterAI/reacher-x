const ALLOWED_TWITTER_MEDIA_HOSTS = new Set(["video.twimg.com"]);

function isAllowedTwitterMediaUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return (
      parsed.protocol === "https:" &&
      ALLOWED_TWITTER_MEDIA_HOSTS.has(parsed.hostname.toLowerCase())
    );
  } catch {
    return false;
  }
}

export function toTwitterMediaProxyUrl(url?: string): string | undefined {
  if (!url || !isAllowedTwitterMediaUrl(url)) {
    return url;
  }

  const params = new URLSearchParams({ url });
  return `/api/twitter-media?${params.toString()}`;
}

export function isTwitterMediaProxyable(url?: string): boolean {
  return Boolean(url && isAllowedTwitterMediaUrl(url));
}
