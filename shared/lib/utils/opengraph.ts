export type OpenGraphData = {
  url: string;
  title?: string | null;
  description?: string | null;
  image?: string | null;
  siteName?: string | null;
};

export async function fetchOpenGraph(
  url: string
): Promise<OpenGraphData | null> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 6000);
    const res = await fetch(url, {
      method: "GET",
      redirect: "follow",
      headers: { "User-Agent": "ReacherXBot/1.0 (+https://reacherx.app)" },
      signal: controller.signal,
      cache: "no-store",
    });
    clearTimeout(timeout);
    const html = await res.text();
    const og = extractOgFromHtml(html, url);
    return og;
  } catch {
    return null;
  }
}

export function extractOgFromHtml(
  html: string,
  baseUrl: string
): OpenGraphData {
  const get = (prop: string): string | null => {
    const m = html.match(
      new RegExp(
        `<meta[^>]+property=["']${prop}["'][^>]+content=["']([^"']+)["']`,
        "i"
      )
    );
    return m?.[1] ?? null;
  };
  const getName = (name: string): string | null => {
    const m = html.match(
      new RegExp(
        `<meta[^>]+name=["']${name}["'][^>]+content=["']([^"']+)["']`,
        "i"
      )
    );
    return m?.[1] ?? null;
  };
  const ogImage = get("og:image") || getName("twitter:image") || null;
  const title = get("og:title") || getName("twitter:title") || null;
  const description =
    get("og:description") || getName("twitter:description") || null;
  const siteName = get("og:site_name") || null;
  const absImage =
    ogImage && !/^https?:\/\//i.test(ogImage)
      ? new URL(ogImage, baseUrl).toString()
      : ogImage;
  return { url: baseUrl, title, description, image: absImage, siteName };
}
